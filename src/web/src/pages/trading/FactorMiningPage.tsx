import { ExperimentOutlined, PlayCircleOutlined, SendOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, InputNumber, Select, Space, Table, message } from "antd";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchFactorMine, runMinedFactorBacktest } from "../../api";
import { saveFactorHandoff } from "../../factorHandoff";
import { MonoNumber } from "../../quant-atelier";
import type { FactorMiningPayload, MinedFactorBacktestPayload } from "../../types";
import {
  MetricTile,
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "./TradingPageShell";
import "./trading.css";

const SYMBOL_OPTIONS = [
  { label: "WEB3-DEMO/USDT · 教学样本（固定至 2026-02-20）", value: "WEB3-DEMO/USDT" },
  { label: "BTC-USDT · 离线快照 / 可拉最新", value: "BTC-USDT" },
];

const LIMIT_OPTIONS = [
  { label: "60 根", value: 60 },
  { label: "120 根", value: 120 },
  { label: "300 根", value: 300 },
];

export default function FactorMiningPage() {
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState("BTC-USDT");
  const [barLimit, setBarLimit] = useState(120);
  const [refreshLive, setRefreshLive] = useState(false);
  const [stopLoss, setStopLoss] = useState(3);
  const [takeProfit, setTakeProfit] = useState(5);
  const [trailingStop, setTrailingStop] = useState(0);
  const [maxHoldBars, setMaxHoldBars] = useState(0);
  const [mineHorizon, setMineHorizon] = useState(1);
  const [mineMode, setMineMode] = useState<"gp" | "ml" | "template" | "llm" | "both" | "all">("all");
  const [mineTarget, setMineTarget] = useState<"return" | "risk">("return");
  const [mineRiskKind, setMineRiskKind] = useState<"abs_ret" | "realized_vol">("abs_ret");
  const [factorMine, setFactorMine] = useState<FactorMiningPayload | null>(null);
  const [factorLoading, setFactorLoading] = useState(false);
  const [factorError, setFactorError] = useState<string | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<MinedFactorBacktestPayload | null>(null);
  const [runFeedback, setRunFeedback] = useState<{
    type: "success" | "info" | "warning" | "error";
    message: string;
  } | null>(null);

  const refreshDisabled = symbol === "WEB3-DEMO/USDT" || factorLoading || backtestLoading;

  const runFactorMine = useCallback(async () => {
    setFactorLoading(true);
    setFactorError(null);
    setBacktestResult(null);
    setRunFeedback({ type: "info", message: "因子挖掘运行中：正在生成候选并执行训练/测试切分。" });
    try {
      const payload = await fetchFactorMine({
        mode: mineMode,
        target: mineTarget,
        riskKind: mineRiskKind,
        symbol,
        limit: barLimit,
        horizon: mineHorizon,
        gpGenerations: 10,
        gpPopulation: 20,
        refresh: refreshLive && symbol !== "WEB3-DEMO/USDT",
      });
      setFactorMine(payload);
      const metric = payload.metric_name ?? "IC";
      setRunFeedback({
        type: "success",
        message: `因子挖掘完成：测试 ${metric} ${(payload.leader?.test_ic ?? 0).toFixed(3)}`,
      });
      message.success(
        `${mineTarget === "risk" ? "风险" : "收益"}因子挖掘完成 · 测试 ${metric} ${(payload.leader?.test_ic ?? 0).toFixed(3)}`,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : "因子挖掘失败";
      setFactorError(detail);
      setRunFeedback({ type: "error", message: `因子挖掘失败：${detail}` });
      message.error(detail);
    } finally {
      setFactorLoading(false);
    }
  }, [barLimit, mineHorizon, mineMode, mineRiskKind, mineTarget, refreshLive, symbol]);

  const runMinedBacktest = useCallback(async () => {
    const spec = factorMine?.leader?.backtest_spec;
    if (!spec) {
      const detail = "请先运行收益因子挖掘";
      setRunFeedback({ type: "warning", message: detail });
      message.warning(detail);
      return;
    }
    setBacktestLoading(true);
    setRunFeedback({ type: "info", message: "领先因子回测运行中：正在送入滚动回测引擎。" });
    try {
      const payload = await runMinedFactorBacktest({
        backtestSpec: spec,
        symbol,
        limit: barLimit,
        stopLoss,
        takeProfit,
        trailingStop,
        maxHoldBars,
        refresh: refreshLive && symbol !== "WEB3-DEMO/USDT",
      });
      setBacktestResult(payload);
      setRunFeedback({
        type: "success",
        message: `挖掘因子回测完成：收益 ${payload.total_return_pct.toFixed(2)}% · 交易 ${payload.total_trades} 笔`,
      });
      message.success(`挖掘因子回测：${payload.total_return_pct.toFixed(2)}%`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "挖掘因子回测失败";
      setRunFeedback({ type: "error", message: detail });
      message.error(detail);
    } finally {
      setBacktestLoading(false);
    }
  }, [barLimit, factorMine, maxHoldBars, refreshLive, stopLoss, symbol, takeProfit, trailingStop]);

  const sendToBacktests = useCallback(() => {
    const spec = factorMine?.leader?.backtest_spec;
    if (!spec || mineTarget === "risk") {
      const detail =
        mineTarget === "risk" ? "风险因子仅做仓位缩放，不能送入方向性回测" : "请先运行收益因子挖掘";
      setRunFeedback({ type: "warning", message: detail });
      message.warning(detail);
      return;
    }
    saveFactorHandoff({
      backtestSpec: spec,
      symbol,
      limit: barLimit,
      stopLoss,
      takeProfit,
      trailingStop,
      maxHoldBars,
      label: factorMine?.leader?.label,
      testIc: factorMine?.leader?.test_ic,
      method: factorMine?.leader?.method,
    });
    message.success("已交接领先因子，正在打开策略回测台");
    navigate("/backtests?from=factor-mining");
  }, [
    barLimit,
    factorMine,
    maxHoldBars,
    mineTarget,
    navigate,
    stopLoss,
    symbol,
    takeProfit,
    trailingStop,
  ]);

  const quantileRows = useMemo(() => {
    const branch = factorMine?.leader?.method === "gp" ? factorMine.gp : factorMine?.ml;
    const quantiles = branch?.test?.quantile_returns ?? [];
    return quantiles.map((value, index) => ({
      bucket: `Q${index + 1}`,
      return: value,
    }));
  }, [factorMine]);

  return (
    <TradingPageShell
      eyebrow="Factor Research"
      title="因子挖掘工作台"
      description="独立研究入口：先挖收益/风险因子，看训练测试 IC 与过拟合提示，再把领先因子送入滚动回测。"
      actions={
        <Space wrap>
          <StatusPill tone={factorMine?.leader ? "profit" : "neutral"}>
            {factorMine?.leader ? `${factorMine.leader.method?.toUpperCase()} 领先` : "待挖掘"}
          </StatusPill>
          <Button
            className="btn-gradient"
            type="primary"
            size="large"
            loading={factorLoading}
            icon={<ExperimentOutlined />}
            onClick={() => void runFactorMine()}
          >
            {factorLoading ? "挖掘中" : "运行挖掘"}
          </Button>
        </Space>
      }
    >
      <section className="backtest-command-center">
        <QuantGlowCard
          className="backtest-config-panel"
          title={
            <SectionHeader
              title="1. 配置挖掘任务"
              description="选择标的、样本长度与挖掘模式。收益因子可继续回测；风险因子用于仓位缩放预览。"
            />
          }
        >
          <div className="backtest-form-grid">
            <label className="backtest-field">
              <span>标的资产</span>
              <Select
                value={symbol}
                onChange={setSymbol}
                options={SYMBOL_OPTIONS}
                disabled={factorLoading || backtestLoading}
              />
            </label>
            <label className="backtest-field">
              <span>K 线数量</span>
              <Select
                value={barLimit}
                onChange={setBarLimit}
                options={LIMIT_OPTIONS}
                disabled={factorLoading || backtestLoading}
              />
            </label>
            <label className="backtest-field">
              <span>因子目标</span>
              <Select
                value={mineTarget}
                onChange={setMineTarget}
                options={[
                  { label: "收益因子", value: "return" },
                  { label: "风险因子", value: "risk" },
                ]}
                disabled={factorLoading || backtestLoading}
              />
            </label>
            {mineTarget === "risk" ? (
              <label className="backtest-field">
                <span>风险标签</span>
                <Select
                  value={mineRiskKind}
                  onChange={setMineRiskKind}
                  options={[
                    { label: "前瞻 |收益|", value: "abs_ret" },
                    { label: "前瞻实现波动", value: "realized_vol" },
                  ]}
                  disabled={factorLoading || backtestLoading}
                />
              </label>
            ) : null}
            <label className="backtest-field">
              <span>挖掘模式</span>
              <Select
                value={mineMode}
                onChange={setMineMode}
                options={[
                  { label: "全量", value: "all" },
                  { label: "GP + ML", value: "both" },
                  { label: "模板 Alpha", value: "template" },
                  { label: "LLM 提案", value: "llm" },
                  { label: "仅 GP", value: "gp" },
                  { label: "仅 ML", value: "ml" },
                ]}
                disabled={factorLoading || backtestLoading}
              />
            </label>
            <label className="backtest-field">
              <span>前瞻 bar</span>
              <InputNumber
                min={1}
                max={10}
                value={mineHorizon}
                onChange={(v) => setMineHorizon(Number(v ?? 1))}
                disabled={factorLoading || backtestLoading}
              />
            </label>
            <label className="backtest-field">
              <span>止损 %</span>
              <InputNumber
                min={0.5}
                max={20}
                step={0.5}
                value={stopLoss}
                onChange={(v) => setStopLoss(Number(v ?? 3))}
                disabled={factorLoading || backtestLoading}
              />
            </label>
            <label className="backtest-field">
              <span>止盈 %</span>
              <InputNumber
                min={0.5}
                max={50}
                step={0.5}
                value={takeProfit}
                onChange={(v) => setTakeProfit(Number(v ?? 5))}
                disabled={factorLoading || backtestLoading}
              />
            </label>
            <label className="backtest-field">
              <span>移动止损 %</span>
              <InputNumber
                min={0}
                max={20}
                step={0.5}
                value={trailingStop}
                onChange={(v) => setTrailingStop(Number(v ?? 0))}
                disabled={factorLoading || backtestLoading}
              />
            </label>
            <label className="backtest-field">
              <span>最长持仓</span>
              <InputNumber
                min={0}
                max={500}
                step={1}
                value={maxHoldBars}
                onChange={(v) => setMaxHoldBars(Number(v ?? 0))}
                disabled={factorLoading || backtestLoading}
              />
            </label>
          </div>
          <div className="backtest-config-footer">
            <Checkbox
              checked={refreshLive}
              onChange={(event) => setRefreshLive(event.target.checked)}
              disabled={refreshDisabled}
            >
              拉取最新 K 线
            </Checkbox>
            <span>
              {symbol === "WEB3-DEMO/USDT"
                ? "教学样本固定，不支持实时刷新"
                : "可使用快照或刷新最新行情"}
            </span>
            <Button
              className="btn-gradient"
              type="primary"
              loading={factorLoading}
              icon={<ExperimentOutlined />}
              onClick={() => void runFactorMine()}
            >
              运行挖掘
            </Button>
          </div>
          {runFeedback ? (
            <Alert type={runFeedback.type} showIcon message={runFeedback.message} style={{ marginTop: 12 }} />
          ) : null}
        </QuantGlowCard>

        <QuantGlowCard
          className="backtest-summary-panel"
          title={
            <SectionHeader
              title="2. 研究闭环"
              description="本页先做统计验证与一次试跑；对照、WFO、稳健性审计交给策略回测台。"
            />
          }
        >
          <div className="backtest-summary-stack">
            <div className="factor-backtest-action">
              <Button
                className="factor-backtest-button"
                type="primary"
                size="large"
                loading={backtestLoading}
                disabled={mineTarget === "risk" || !factorMine?.leader?.backtest_spec}
                icon={<PlayCircleOutlined />}
                onClick={() => void runMinedBacktest()}
              >
                用领先因子试跑
              </Button>
              <span className={factorMine?.leader?.backtest_spec ? "factor-action-ready" : ""}>
                {mineTarget === "risk"
                  ? "风险因子仅做仓位缩放"
                  : factorMine?.leader?.backtest_spec
                    ? "领先因子已就绪"
                    : "先运行收益因子挖掘"}
              </span>
            </div>
            {backtestResult ? (
              <div className="backtest-summary-metrics">
                <MetricTile
                  label="总收益"
                  value={backtestResult.total_return_pct}
                  kind="pct"
                  tone={backtestResult.total_return_pct >= 0 ? "profit" : "loss"}
                  showSign
                />
                <MetricTile
                  label="最大回撤"
                  value={-backtestResult.max_drawdown_pct}
                  kind="pct"
                  tone="loss"
                  showSign
                />
                <MetricTile label="Sharpe" value={backtestResult.sharpe_ratio} tone="neutral" precision={2} />
                <MetricTile label="交易数" value={backtestResult.total_trades} kind="qty" tone="neutral" />
              </div>
            ) : (
              <Alert
                type="info"
                showIcon
                message="试跑结果会显示在这里"
                description="完成收益因子挖掘后可先试跑；需要窗口/对照/稳健性时再送入策略回测。"
              />
            )}
            <Space wrap>
              <Button
                className="btn-gradient"
                type="primary"
                icon={<SendOutlined />}
                disabled={mineTarget === "risk" || !factorMine?.leader?.backtest_spec}
                onClick={sendToBacktests}
              >
                送入策略回测
              </Button>
              <Button type="default" onClick={() => navigate("/backtests")}>
                打开策略回测台
              </Button>
            </Space>
            <div className="backtest-disclaimer">
              因子挖掘证明预测关系，不替代策略回测。风控边界见 <Link to="/risk">风控中心</Link>。
            </div>
          </div>
        </QuantGlowCard>
      </section>

      <QuantGlowCard
        id="factor-research"
        className="trading-span-12 factor-mining-card"
        style={{ marginBottom: 16 }}
        title={
          <SectionHeader
            title="挖掘结果"
            description="收益因子（IC→方向回测）· 风险因子（RIC→仓位缩放预览）· 训练/测试切分与过拟合提示"
          />
        }
        badge={
          factorMine?.leader ? (
            <StatusPill tone={Math.abs(factorMine.leader.test_ic ?? 0) >= 0.2 ? "profit" : "neutral"}>
              {factorMine.leader.method?.toUpperCase()}
            </StatusPill>
          ) : undefined
        }
      >
        {factorLoading && (
          <Alert
            type="info"
            showIcon
            message="因子挖掘正在运行"
            description="完成后本区域会自动刷新。"
            style={{ marginBottom: 12 }}
          />
        )}
        {factorError && <Alert type="error" message={factorError} showIcon style={{ marginBottom: 12 }} />}
        {factorMine ? (
          <>
            <div className="trading-metric-grid factor-metric-grid" style={{ marginBottom: 12 }}>
              <MetricTile
                label="领先因子"
                value={factorMine.leader?.label?.slice(0, 24) ?? "—"}
                subtle={`${factorMine.leader?.method?.toUpperCase() ?? "—"} · 测试 ${factorMine.metric_name ?? "IC"} ${(factorMine.leader?.test_ic ?? 0).toFixed(3)}`}
              />
              <MetricTile
                label={`GP 测试 ${factorMine.metric_name ?? "IC"}`}
                value={factorMine.gp?.test?.ic_mean ?? 0}
                tone="neutral"
                precision={3}
              />
              <MetricTile
                label={`ML 测试 ${factorMine.metric_name ?? "IC"}`}
                value={factorMine.ml?.test?.ic_mean ?? 0}
                tone="neutral"
                precision={3}
              />
              <MetricTile label="训练 bar" value={factorMine.train_bars} kind="qty" tone="neutral" />
              <MetricTile label="测试 bar" value={factorMine.test_bars} kind="qty" tone="neutral" />
            </div>
            {factorMine.mining_target === "risk" && factorMine.risk_application?.sample_tail?.length ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 10 }}
                message="仓位缩放预览（教学演示）"
                description={
                  <>
                    均值 scale {factorMine.risk_application.mean_position_scale?.toFixed(3) ?? "—"} · 最近{" "}
                    {factorMine.risk_application.sample_tail.length} 根：
                    {factorMine.risk_application.sample_tail.map((row) => (
                      <span key={row.idx} style={{ marginLeft: 8 }}>
                        z={row.risk_z.toFixed(2)}→{row.position_scale.toFixed(2)}
                      </span>
                    ))}
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                      {factorMine.risk_application.note}
                    </div>
                  </>
                }
              />
            ) : null}
            {(factorMine.gp?.expression || factorMine.ml?.formula) && (
              <div className="trading-kv" style={{ marginBottom: 10, fontSize: 12 }}>
                {factorMine.gp?.expression && (
                  <div>
                    <span style={{ color: "var(--qa-text-2)" }}>GP </span>
                    <code>{factorMine.gp.expression}</code>
                  </div>
                )}
                {factorMine.ml?.formula && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ color: "var(--qa-text-2)" }}>ML </span>
                    <code>{factorMine.ml.formula}</code>
                  </div>
                )}
              </div>
            )}
            {(factorMine.warnings ?? []).map((item) => (
              <Alert key={item} type="warning" message={item} showIcon style={{ marginBottom: 8 }} />
            ))}
            {factorMine.leader?.validation ? (
              <>
                <div className="trading-metric-grid" style={{ marginBottom: 8 }}>
                  <MetricTile
                    label="五分位 spread"
                    value={factorMine.leader.validation.quintile_spread}
                    tone="neutral"
                    precision={4}
                  />
                  <MetricTile
                    label="换手 proxy"
                    value={factorMine.leader.validation.turnover_rate}
                    tone="neutral"
                    precision={3}
                  />
                  <MetricTile
                    label="IC 衰减"
                    value={factorMine.leader.validation.ic_decay}
                    tone="neutral"
                    precision={4}
                  />
                  <MetricTile
                    label="t-stat"
                    value={
                      factorMine.leader.method === "gp"
                        ? (factorMine.gp?.test?.t_stat ?? 0)
                        : (factorMine.ml?.test?.t_stat ?? 0)
                    }
                    tone="neutral"
                    precision={2}
                  />
                  <MetricTile
                    label="p-value"
                    value={
                      factorMine.leader.method === "gp"
                        ? (factorMine.gp?.test?.p_value ?? 1)
                        : (factorMine.ml?.test?.p_value ?? 1)
                    }
                    tone="neutral"
                    precision={3}
                  />
                  <MetricTile
                    label="Rank 自相关"
                    value={
                      factorMine.leader.method === "gp"
                        ? (factorMine.gp?.test?.rank_autocorr ?? 0)
                        : (factorMine.ml?.test?.rank_autocorr ?? 0)
                    }
                    tone="neutral"
                    precision={3}
                  />
                </div>
                {quantileRows.length ? (
                  <Table
                    className="trading-ant-table"
                    pagination={false}
                    size="small"
                    rowKey="bucket"
                    dataSource={quantileRows}
                    columns={[
                      { title: "测试分位", dataIndex: "bucket", width: 100 },
                      {
                        title: "前瞻收益",
                        dataIndex: "return",
                        render: (value: number) => (
                          <MonoNumber
                            value={value * 100}
                            kind="pct"
                            tone={value >= 0 ? "profit" : "loss"}
                            showSign
                          />
                        ),
                      },
                    ]}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            message="尚未运行挖掘"
            description="点击右上角或配置区的「运行挖掘」。完成后可一键把领先因子送入滚动回测引擎。"
          />
        )}
      </QuantGlowCard>
    </TradingPageShell>
  );
}
