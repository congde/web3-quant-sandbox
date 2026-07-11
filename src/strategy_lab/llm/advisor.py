from __future__ import annotations

from typing import Any

from dashboard.llm_signal import _call_llm, llm_configured, resolve_model
from strategy_engine.dsl import check_lookahead_bias, validate_strategy_code
from strategy_engine.dsl.loader import StrategyCompileError, compile_strategy


def explain_strategy(spec: dict[str, Any], *, model: str | None = None) -> dict[str, Any]:
    signal = spec.get("signal") or {}
    fallback = {
        "summary": f"该候选使用 {signal.get('model', 'unknown')} 信号，在满足风险边界后产生订单。",
        "assumptions": ["历史价格结构具有一定延续性", "交易成本口径与回测一致"],
        "risks": ["市场状态切换", "参数过拟合", "流动性与滑点扩大"],
        "review_required": True,
        "source": "deterministic_fallback",
    }
    if not llm_configured(): return fallback
    resolved = resolve_model(model)
    prompt = f"解释以下StrategySpec，只返回JSON，字段summary,assumptions,risks,review_required。不得声称保证收益。\n{spec}"
    try:
        result = _call_llm(prompt, resolved)
        result.update({"source": "llm", "model": resolved, "review_required": True})
        return result
    except Exception as error:
        fallback.update({"llm_error": str(error), "model": resolved})
        return fallback


def diagnose_experiment(result: dict[str, Any], *, model: str | None = None) -> dict[str, Any]:
    gates = result.get("gates") or []
    failed = [item.get("gate") for item in gates if not item.get("passed")]
    fallback = {"verdict": "needs_revision" if failed else "eligible_for_review", "failed_gates": failed, "findings": [f"未通过门禁: {item}" for item in failed] or ["全部自动门禁通过，仍需人工审批"], "allowed_changes": ["信号周期", "止损止盈", "样本区间"], "review_required": True, "source": "deterministic_fallback"}
    if not llm_configured(): return fallback
    resolved = resolve_model(model)
    prompt = f"诊断以下量化实验，只返回JSON：verdict,failed_gates,findings,allowed_changes,review_required。不得建议绕过门禁。\n{result}"
    try:
        diagnosed = _call_llm(prompt, resolved)
        diagnosed.update({"source": "llm", "model": resolved, "review_required": True})
        return diagnosed
    except Exception as error:
        fallback.update({"llm_error": str(error), "model": resolved})
        return fallback


def repair_strategy(code: str, *, error_context: str = "", model: str | None = None, max_attempts: int = 3) -> dict[str, Any]:
    attempts: list[dict[str, Any]] = []
    current = code
    for index in range(1, min(max_attempts, 3) + 1):
        validation = validate_strategy_code(current)
        lookahead = check_lookahead_bias(current)
        compile_error = None
        if validation.valid and lookahead.clean:
            try:
                compile_strategy(current)
                return {"ok": True, "code": current, "attempts": attempts, "attempt_count": index - 1, "review_required": True}
            except StrategyCompileError as error:
                compile_error = str(error)
        errors = [item.message for item in validation.errors] + [item.message for item in lookahead.findings]
        context = "; ".join(errors + ([compile_error] if compile_error else []) + ([error_context] if error_context else []))
        if not llm_configured():
            attempts.append({"attempt": index, "status": "blocked", "errors": context, "source": "no_llm"})
            break
        resolved = resolve_model(model)
        prompt = "修复以下受限策略DSL，只返回JSON对象{code,change_reason}。保留on_tick(ctx,candle)，禁止未来数据和危险导入。\n错误:" + context + "\n代码:\n" + current
        try:
            response = _call_llm(prompt, resolved)
            candidate = str(response.get("code") or "")
            attempts.append({"attempt": index, "status": "proposed", "change_reason": response.get("change_reason"), "model": resolved})
            if not candidate.strip(): break
            current = candidate
        except Exception as error:
            attempts.append({"attempt": index, "status": "failed", "errors": str(error), "model": resolved})
            break
    return {"ok": False, "code": current, "attempts": attempts, "attempt_count": len(attempts), "review_required": True, "message": "自动修复未在三轮内通过确定性准入"}
