import {
  BookOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FundProjectionScreenOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Checkbox,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from "antd";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchFactorMine, runMinedFactorBacktest } from "../../api";
import { saveFactorHandoff } from "../../factorHandoff";
import { MonoNumber } from "../../quant-atelier";
import type { FactorMiningBranch, FactorMiningPayload, MinedFactorBacktestPayload } from "../../types";
import { MetricTile, QuantGlowCard, SectionHeader, StatusPill, TradingPageShell } from "./TradingPageShell";
import "./trading.css";
import "./factor-research.css";

const SYMBOL_OPTIONS = [
  { label: "WEB3-DEMO/USDT · 固定教学样本", value: "WEB3-DEMO/USDT" },
  { label: "BTC-USDT · 离线快照 / 可拉最新", value: "BTC-USDT" },
];

const METHOD_LABELS: Record<FactorMiningBranch["method"], string> = {
  gp: "GP 符号搜索",
  ml: "ML 线性组合",
  template: "经济直觉模板",
  llm: "LLM 假设提案",
};

const STATUS_META = {
  research_ready: { label: "可进入复核", tone: "profit" as const },
  watch: { label: "观察", tone: "ai" as const },
  reject: { label: "拒绝", tone: "loss" as const },
};

const PAPERS = [
  {
    tag: "Crypto factors",
    title: "Common Risk Factors in Cryptocurrency",
    authors: "Liu, Tsyvinski & Wu · Journal of Finance, 2022",
    method: "把市场、规模、动量作为加密资产横截面基准；本页据此明确区分“单币时序”与“多币横截面”。",
    href: "https://www.nber.org/papers/w25882",
  },
  {
    tag: "Multiple testing",
    title: "… and the Cross-Section of Expected Returns",
    authors: "Harvey, Liu & Zhu · Review of Financial Studies, 2016",
    method: "候选越多，普通 p-value 越不可信；本页记录实验预算并显示 Bonferroni 调整值。",
    href: "https://www.nber.org/papers/w20592",
  },
  {
    tag: "Selection bias",
    title: "The Deflated Sharpe Ratio",
    authors: "Bailey & López de Prado · Journal of Portfolio Management, 2014",
    method: "提醒研究者把非正态收益与多次试验纳入绩效解释；本页不把单次高 IC 当上线证明。",
    href: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551",
  },
  {
    tag: "Machine learning",
    title: "Empirical Asset Pricing via Machine Learning",
    authors: "Gu, Kelly & Xiu · Review of Financial Studies, 2020",
    method: "强调非线性、交互项与严格样本外比较；特征库按动量、流动性、波动与结构分组。",
    href: "https://www.nber.org/papers/w25398",
  },
  {
    tag: "Factor redundancy",
    title: "Which Factors?",
    authors: "Hou, Mo, Xue & Zhang · Review of Finance, 2019",
    method: "大量因子可能被少数基准吸收；候选入库前仍需做相关性、增量解释力与 spanning 检验。",
    href: "https://www.nber.org/papers/w20682",
  },
  {
    tag: "Backtest overfit",
    title: "Backtest Overfitting in Financial Markets",
    authors: "Bailey et al. · 2015",
    method: "反复查看留出集会把它变成验证集；本页采用 60/20/20，并把最终留出标为一次性审计。",
    href: "https://escholarship.org/uc/item/4hn4t174",
  },
];

function pct(value: number | undefined, digits = 2) {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

export default function FactorMiningPage() {
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState("BTC-USDT");
  const [barLimit, setBarLimit] = useState(300);
  const [refreshLive, setRefreshLive] = useState(false);
  const [mineHorizon, setMineHorizon] = useState(1);
  const [mineMode, setMineMode] = useState<"gp" | "ml" | "template" | "llm" | "both" | "all">("all");
  const [mineTarget, setMineTarget] = useState<"return" | "risk">("return");
  const [mineRiskKind, setMineRiskKind] = useState<"abs_ret" | "realized_vol">("abs_ret");
  const [costBps, setCostBps] = useState(8);
  const [validationFolds, setValidationFolds] = useState(4);
  const [stopLoss, setStopLoss] = useState(3);
  const [takeProfit, setTakeProfit] = useState(5);
  const [trailingStop, setTrailingStop] = useState(0);
  const [maxHoldBars, setMaxHoldBars] = useState(0);
  const [factorMine, setFactorMine] = useState<FactorMiningPayload | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<FactorMiningBranch["method"] | null>(null);
  const [resultFingerprint, setResultFingerprint] = useState<string | null>(null);
  const [factorLoading, setFactorLoading] = useState(false);
  const [factorError, setFactorError] = useState<string | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<MinedFactorBacktestPayload | null>(null);

  const fingerprint = useMemo(
    () => JSON.stringify({ symbol, barLimit, refreshLive, mineHorizon, mineMode, mineTarget, mineRiskKind, costBps, validationFolds }),
    [barLimit, costBps, mineHorizon, mineMode, mineRiskKind, mineTarget, refreshLive, symbol, validationFolds],
  );
  const resultIsStale = Boolean(factorMine && fingerprint !== resultFingerprint);
  const leaderMethod = factorMine?.leader?.method ?? null;
  const selectedBranch = selectedMethod ? factorMine?.[selectedMethod] : undefined;
  const isLeaderSelected = Boolean(selectedMethod && selectedMethod === leaderMethod);

  const hypothesis = mineTarget === "risk"
    ? `量价、波动与价格结构能否排序未来 ${mineHorizon} bar 的${mineRiskKind === "abs_ret" ? "绝对收益" : "实现波动"}？`
    : `动量、反转、流动性与波动状态能否排序未来 ${mineHorizon} bar 收益？`;

  const runFactorMine = useCallback(async () => {
    setFactorLoading(true);
    setFactorError(null);
    setBacktestResult(null);
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
        costBps,
        validationFolds,
      });
      setFactorMine(payload);
      setSelectedMethod(payload.leader?.method ?? null);
      setResultFingerprint(fingerprint);
      message.success(`研究完成 · 验证集选出 ${payload.leader?.method?.toUpperCase() ?? "候选"}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "因子研究失败";
      setFactorError(detail);
      message.error(detail);
    } finally {
      setFactorLoading(false);
    }
  }, [barLimit, costBps, fingerprint, mineHorizon, mineMode, mineRiskKind, mineTarget, refreshLive, symbol, validationFolds]);

  const runQuickBacktest = useCallback(async () => {
    const spec = selectedBranch?.backtest_spec;
    if (!spec || resultIsStale || mineTarget === "risk") return;
    setBacktestLoading(true);
    try {
      const result = await runMinedFactorBacktest({
        backtestSpec: spec,
        symbol,
        limit: barLimit,
        stopLoss,
        takeProfit,
        trailingStop,
        maxHoldBars,
        refresh: refreshLive && symbol !== "WEB3-DEMO/USDT",
      });
      setBacktestResult(result);
      message.success(`快速试跑完成 · ${result.total_return_pct.toFixed(2)}%`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "快速试跑失败");
    } finally {
      setBacktestLoading(false);
    }
  }, [barLimit, maxHoldBars, mineTarget, refreshLive, resultIsStale, selectedBranch, stopLoss, symbol, takeProfit, trailingStop]);

  const sendToBacktests = useCallback(() => {
    const spec = selectedBranch?.backtest_spec;
    if (!spec || resultIsStale || mineTarget === "risk") return;
    saveFactorHandoff({
      backtestSpec: spec,
      symbol,
      limit: barLimit,
      stopLoss,
      takeProfit,
      trailingStop,
      maxHoldBars,
      label: selectedBranch?.expression ?? selectedBranch?.formula,
      testIc: selectedBranch?.test?.ic_mean,
      method: selectedMethod ?? undefined,
    });
    navigate("/backtests?from=factor-mining");
  }, [barLimit, maxHoldBars, mineTarget, navigate, resultIsStale, selectedBranch, selectedMethod, stopLoss, symbol, takeProfit, trailingStop]);

  const registryRows = factorMine?.candidate_registry ?? [];
  const quantiles = selectedBranch?.test?.quantile_returns ?? [];
  const maxQuantile = Math.max(...quantiles.map((value) => Math.abs(value)), 0.0001);
  const gateMeta = factorMine?.research_gate ? STATUS_META[factorMine.research_gate.verdict] : null;

  const overview = (
    <div className="factor-tab-stack">
      {!factorMine ? (
        <div className="factor-empty-blueprint">
          <div>
            <span>当前研究问题</span>
            <strong>{hypothesis}</strong>
            <p>先写清经济机制，再生成候选。没有机制说明的高 IC 只进入“观察”，不会自动成为可交易因子。</p>
          </div>
          <ol>
            <li><b>01</b><span>定义标签</span><small>收益 / 风险、持有期</small></li>
            <li><b>02</b><span>冻结数据契约</span><small>时点可得、无未来信息</small></li>
            <li><b>03</b><span>训练段发现</span><small>模板、GP、ML、LLM</small></li>
            <li><b>04</b><span>验证段选优</span><small>不触碰最终留出</small></li>
            <li><b>05</b><span>留出集审计</span><small>置信区间、成本、稳定性</small></li>
            <li><b>06</b><span>登记与复核</span><small>多标的、WFO、组合层</small></li>
          </ol>
        </div>
      ) : (
        <>
          <div className="factor-split-contract">
            <div className="factor-split-train" style={{ flex: factorMine.train_bars }}>
              <b>发现集 60%</b><span>{factorMine.train_bars} bars</span><small>拟合 + 生成候选</small>
            </div>
            <div className="factor-split-validation" style={{ flex: factorMine.validation_bars ?? 0 }}>
              <b>验证集 20%</b><span>{factorMine.validation_bars ?? 0} bars</span><small>只负责选冠军</small>
            </div>
            <div className="factor-split-test" style={{ flex: factorMine.test_bars }}>
              <b>最终留出 20%</b><span>{factorMine.test_bars} bars</span><small>一次性报告</small>
            </div>
          </div>
          <div className="trading-metric-grid factor-research-metrics">
            <MetricTile label="验证集 IC" value={factorMine.leader?.validation_ic ?? 0} precision={3} />
            <MetricTile label="最终留出 IC" value={factorMine.leader?.test_ic ?? 0} precision={3} />
            <MetricTile label="调整后 p" value={factorMine.experiment_audit?.adjusted_best_validation_p ?? 1} precision={3} />
            <MetricTile label="估算试验数" value={factorMine.experiment_audit?.estimated_trials ?? 0} kind="qty" />
            <MetricTile label="稳定时间片" value={pct(factorMine.stability_report?.positive_fold_rate)} />
          </div>
          <section className="factor-registry-section">
            <SectionHeader title="候选登记簿" description="按验证集排序，最终留出 IC 不参与冠军选择；点击一行切换诊断与试跑对象。" />
            <Table
              className="trading-ant-table"
              size="small"
              pagination={false}
              rowKey="method"
              scroll={{ x: 980 }}
              rowClassName={(row) => row.method === selectedMethod ? "factor-selected-row" : ""}
              onRow={(row) => ({ onClick: () => { setSelectedMethod(row.method); setBacktestResult(null); } })}
              dataSource={registryRows}
              columns={[
                { title: "方法", dataIndex: "method", width: 130, render: (value: FactorMiningBranch["method"]) => <strong>{METHOD_LABELS[value]}</strong> },
                { title: "候选表达式", dataIndex: "label", width: 250, ellipsis: true, render: (value: string) => <code title={value}>{value}</code> },
                { title: "训练 IC", dataIndex: "train_ic", width: 100, render: (value: number) => <MonoNumber value={value} precision={3} /> },
                { title: "验证 IC", dataIndex: "validation_ic", width: 100, render: (value: number) => <MonoNumber value={value} precision={3} /> },
                { title: "最终留出 IC", dataIndex: "holdout_ic", width: 118, render: (value: number) => <MonoNumber value={value} precision={3} /> },
                { title: "调整 p", dataIndex: "adjusted_p", width: 92, render: (value: number) => <MonoNumber value={value} precision={3} /> },
                { title: "成本后 spread", dataIndex: "net_spread", width: 126, render: (value: number) => <MonoNumber value={value * 100} kind="pct" precision={2} /> },
                { title: "研究状态", dataIndex: "status", width: 112, render: (value: keyof typeof STATUS_META) => <StatusPill tone={STATUS_META[value].tone}>{STATUS_META[value].label}</StatusPill> },
              ]}
            />
          </section>
          {(factorMine.warnings ?? []).length > 0 ? (
            <Alert type="warning" showIcon message="解释边界" description={<ul className="factor-warning-list">{factorMine.warnings?.map((item) => <li key={item}>{item}</li>)}</ul>} />
          ) : null}
        </>
      )}
    </div>
  );

  const validation = factorMine && selectedBranch ? (
    <div className="factor-tab-stack">
      <div className="factor-selected-head">
        <div><span>当前诊断对象</span><strong>{METHOD_LABELS[selectedBranch.method]}</strong><code>{selectedBranch.expression ?? selectedBranch.formula}</code></div>
        <StatusPill tone={isLeaderSelected ? "profit" : "neutral"}>{isLeaderSelected ? "验证集冠军" : "对照候选"}</StatusPill>
      </div>
      <div className="factor-validation-grid">
        <section className="factor-diagnostic-card factor-diagnostic-wide">
          <SectionHeader title="最终留出：IC 不确定性" description="区块 Bootstrap 保留时间依赖；置信区间跨 0 时，方向证据仍不足。" />
          <div className="factor-ci-track">
            <span>−1</span><div><i /><b style={{ left: `${((selectedBranch.test?.ic_confidence_low ?? 0) + 1) * 50}%`, width: `${Math.max(1, ((selectedBranch.test?.ic_confidence_high ?? 0) - (selectedBranch.test?.ic_confidence_low ?? 0)) * 50)}%` }} /><em style={{ left: `${((selectedBranch.test?.ic_mean ?? 0) + 1) * 50}%` }} /></div><span>+1</span>
          </div>
          <div className="factor-ci-values">
            <span>P2.5 <b>{selectedBranch.test?.ic_confidence_low?.toFixed(3) ?? "—"}</b></span>
            <span>IC <b>{selectedBranch.test?.ic_mean?.toFixed(3) ?? "—"}</b></span>
            <span>P97.5 <b>{selectedBranch.test?.ic_confidence_high?.toFixed(3) ?? "—"}</b></span>
          </div>
        </section>
        <section className="factor-diagnostic-card">
          <SectionHeader title="成本与可交易性" description={`${costBps} bps / 边，按换手代理扣减`} />
          <dl className="factor-stat-list">
            <div><dt>毛 spread</dt><dd>{pct(Math.abs(selectedBranch.test?.quintile_spread ?? 0))}</dd></div>
            <div><dt>成本后 spread</dt><dd>{pct(selectedBranch.test?.cost_adjusted_spread)}</dd></div>
            <div><dt>换手 proxy</dt><dd>{pct(selectedBranch.test?.turnover_rate)}</dd></div>
            <div><dt>分位单调性</dt><dd>{(selectedBranch.test?.quantile_monotonicity ?? 0).toFixed(2)}</dd></div>
          </dl>
        </section>
        <section className="factor-diagnostic-card factor-diagnostic-wide">
          <SectionHeader title="非重叠时间片稳定性" description={factorMine.stability_report?.note ?? ""} />
          {isLeaderSelected ? (
            <div className="factor-fold-chart">
              {factorMine.stability_report?.folds.map((fold) => (
                <div key={fold.fold}>
                  <span>{fold.oriented_ic.toFixed(2)}</span>
                  <i style={{ height: `${Math.max(8, Math.min(100, Math.abs(fold.oriented_ic) * 100))}%` }} className={fold.oriented_ic >= 0 ? "is-positive" : "is-negative"} />
                  <b>W{fold.fold}</b><small>{fold.range}</small>
                </div>
              ))}
            </div>
          ) : <Alert type="info" showIcon message="稳定性报告只对验证集冠军生成" description="切回冠军候选可查看完整时间片与状态诊断。" />}
        </section>
        <section className="factor-diagnostic-card">
          <SectionHeader title="波动状态切片" description="同一因子在高 / 低波动期可能完全不同" />
          <div className="factor-regime-list">
            {factorMine.stability_report?.regimes.map((regime) => <div key={regime.key}><span>{regime.label}<small>{regime.samples} 样本</small></span><b>IC {regime.ic.toFixed(3)}</b><em>净 spread {pct(regime.net_spread)}</em></div>)}
          </div>
        </section>
      </div>
      <section className="factor-diagnostic-card">
        <SectionHeader title="五分位收益梯" description="理想结果应从 Q1 到 Q5 近似单调，而不只是首尾偶然拉开。" />
        <div className="factor-quantile-ladder">
          {quantiles.map((value, index) => <div key={index}><b>Q{index + 1}</b><span><i style={{ width: `${Math.abs(value) / maxQuantile * 100}%` }} className={value >= 0 ? "is-positive" : "is-negative"} /></span><em>{pct(value)}</em></div>)}
        </div>
      </section>
      {isLeaderSelected && factorMine.research_gate && gateMeta ? (
        <section className={`factor-research-gate factor-research-gate-${factorMine.research_gate.verdict}`}>
          <div className="factor-gate-title"><div><span>研究闸门</span><strong>{gateMeta.label}</strong><small>{factorMine.research_gate.next_step}</small></div><StatusPill tone={gateMeta.tone}>{factorMine.research_gate.passed}/{factorMine.research_gate.total}</StatusPill></div>
          <div className="factor-gate-matrix">{factorMine.research_gate.checks.map((check) => <div key={check.label} className={check.passed ? "is-passed" : "is-failed"}><span>{check.passed ? "PASS" : "FAIL"}</span><b>{check.label}</b><MonoNumber value={check.value} precision={3} /></div>)}</div>
          <Alert type="info" showIcon message="通过研究闸门 ≠ 可以上线" description="当前仍是单标的时序教学检验。生产前必须完成多币种横截面、真正的滚动重拟合、容量与组合暴露约束。" />
        </section>
      ) : null}
    </div>
  ) : <Alert type="info" showIcon message="运行研究后生成验证驾驶舱" />;

  const library = (
    <div className="factor-tab-stack">
      <Alert type="info" showIcon message="特征不是越多越好" description="每个特征必须对应可解释机制、可用时点与预期失效条件；单变量筛选仅在发现集运行。" />
      <div className="factor-library-grid">
        {(factorMine?.feature_taxonomy ?? [
          { key: "momentum", label: "动量", thesis: "价格延续与加速度", features: ["ret_5", "ret_20", "macd_hist"] },
          { key: "reversal", label: "反转", thesis: "过度反应与影线拒绝", features: ["ret_5_reversal", "rsi_centered"] },
          { key: "liquidity", label: "量价 / 流动性", thesis: "成交确认与压力", features: ["volume_z20", "dollar_volume_z20"] },
          { key: "volatility", label: "波动率", thesis: "风险状态与聚集", features: ["atr_z20", "ret_vol_20"] },
        ]).map((group) => (
          <section key={group.key} className="factor-library-card"><div><span>{group.label}</span><b>{group.features.length} 项</b></div><p>{group.thesis}</p><div>{group.features.slice(0, 10).map((feature) => <Tag key={feature}>{feature}</Tag>)}{group.features.length > 10 ? <Tag>+{group.features.length - 10}</Tag> : null}</div></section>
        ))}
      </div>
      {factorMine?.baseline_univariate?.length ? (
        <section className="factor-diagnostic-card">
          <SectionHeader title="发现集单变量初筛" description="只用于生成假设，不得把这里的高 IC 当作样本外证据。" />
          <Table className="trading-ant-table" size="small" pagination={false} rowKey="feature" dataSource={factorMine.baseline_univariate} columns={[
            { title: "特征", dataIndex: "feature", render: (value: string) => <code>{value}</code> },
            { title: "IC", dataIndex: "ic_mean", render: (value: number) => <MonoNumber value={value} precision={3} /> },
            { title: "IR", dataIndex: "ir", render: (value: number) => <MonoNumber value={value} precision={2} /> },
            { title: "方向命中", dataIndex: "hit_rate", render: (value: number) => pct(value) },
          ]} />
        </section>
      ) : null}
    </div>
  );

  const evidence = (
    <div className="factor-tab-stack">
      <div className="factor-paper-intro"><BookOutlined /><div><strong>论文不是装饰：每篇对应一个研究控制</strong><p>优先采用原始论文或工作论文页面。这里展示“论文结论 → 本产品实现 → 尚未覆盖”的映射。</p></div></div>
      <div className="factor-paper-grid">{PAPERS.map((paper) => <a key={paper.title} href={paper.href} target="_blank" rel="noreferrer" className="factor-paper-card"><span>{paper.tag}</span><strong>{paper.title}</strong><small>{paper.authors}</small><p>{paper.method}</p><em>查看原文 ↗</em></a>)}</div>
      <div className="factor-boundary-map">
        <section><b>本页已实现</b><p>时点安全特征、60/20/20、验证集选优、最终留出、Bootstrap、多重检验、成本后 spread、时间片与波动状态诊断。</p></section>
        <section><b>下一层：横截面研究</b><p>多币种同一时点排序、行业/规模/流动性中性化、Fama–MacBeth、基准因子 spanning 与增量解释力。</p></section>
        <section><b>上线前：组合与执行</b><p>滚动重拟合、purge / embargo、容量与冲击成本、组合暴露、实时漂移和失效退出规则。</p></section>
      </div>
    </div>
  );

  const handoff = (
    <div className="factor-handoff-grid">
      <section className="factor-diagnostic-card">
        <SectionHeader title="快速策略化试跑" description="这里只检查信号接线是否合理；正式证据应在策略回测台完成 WFO、成本压力与对照实验。" />
        <div className="factor-handoff-form">
          <label><span>止损 %</span><InputNumber min={0.5} max={20} step={0.5} value={stopLoss} onChange={(value) => setStopLoss(Number(value ?? 3))} /></label>
          <label><span>止盈 %</span><InputNumber min={0.5} max={50} step={0.5} value={takeProfit} onChange={(value) => setTakeProfit(Number(value ?? 5))} /></label>
          <label><span>移动止损 %</span><InputNumber min={0} max={20} step={0.5} value={trailingStop} onChange={(value) => setTrailingStop(Number(value ?? 0))} /></label>
          <label><span>最长持仓</span><InputNumber min={0} max={500} value={maxHoldBars} onChange={(value) => setMaxHoldBars(Number(value ?? 0))} /></label>
        </div>
        <Space wrap>
          <Button type="primary" icon={<PlayCircleOutlined />} loading={backtestLoading} disabled={!selectedBranch?.backtest_spec || mineTarget === "risk" || resultIsStale} onClick={() => void runQuickBacktest()}>快速试跑</Button>
          <Button className="btn-gradient" icon={<SendOutlined />} disabled={!selectedBranch?.backtest_spec || mineTarget === "risk" || resultIsStale} onClick={sendToBacktests}>送入策略回测台</Button>
        </Space>
      </section>
      <section className="factor-diagnostic-card">
        <SectionHeader title="试跑结果 / 风险应用" description="收益因子用于方向信号；风险因子只用于仓位缩放预览。" />
        {backtestResult ? <div className="trading-metric-grid factor-handoff-metrics"><MetricTile label="总收益" value={backtestResult.total_return_pct} kind="pct" /><MetricTile label="最大回撤" value={backtestResult.max_drawdown_pct} kind="pct" /><MetricTile label="Sharpe" value={backtestResult.sharpe_ratio} /><MetricTile label="交易数" value={backtestResult.total_trades} kind="qty" /></div> : factorMine?.risk_application ? <div className="factor-risk-preview"><b>平均仓位缩放 {factorMine.risk_application.mean_position_scale?.toFixed(3)}</b><p>{factorMine.risk_application.note}</p><div>{factorMine.risk_application.sample_tail?.map((row) => <span key={row.idx}>z {row.risk_z.toFixed(2)} → {row.position_scale.toFixed(2)}</span>)}</div></div> : <Alert type="info" showIcon message="选择收益候选后可快速试跑" />}
        <p className="factor-handoff-note">完整验证请进入 <Link to="/backtest-learning">回测学堂</Link> 学习样本构建，再到策略回测台执行滚动复核；运行时约束由 <Link to="/risk">风控中心</Link> 负责。</p>
      </section>
    </div>
  );

  return (
    <TradingPageShell
      eyebrow="FACTOR RESEARCH OS"
      title="因子研究实验室"
      description="从经济假设、时点安全特征和实验预算出发，用验证集选优、最终留出审计与成本后证据决定因子去留。"
      actions={<Space wrap><StatusPill tone={gateMeta?.tone ?? "neutral"}>{gateMeta?.label ?? (resultIsStale ? "配置待重跑" : "研究未运行")}</StatusPill><Button className="btn-gradient" size="large" type="primary" icon={<ExperimentOutlined />} loading={factorLoading} onClick={() => void runFactorMine()}>运行研究</Button></Space>}
    >
      <section className="factor-research-command">
        <QuantGlowCard className="factor-hypothesis-panel" title={<SectionHeader title="研究契约" description="先冻结问题与成本假设，再允许搜索器看数据。" />}>
          <div className="factor-hypothesis-box"><span>可证伪假设</span><strong>{hypothesis}</strong><small>失效条件：验证与留出方向相反、区间跨 0、成本后收益为负或跨状态不稳定。</small></div>
          <div className="factor-config-grid">
            <label><span>研究标的</span><Select value={symbol} options={SYMBOL_OPTIONS} onChange={setSymbol} /></label>
            <label><span>样本长度</span><Select value={barLimit} options={[{ label: "120 bars", value: 120 }, { label: "300 bars", value: 300 }, { label: "600 bars", value: 600 }]} onChange={setBarLimit} /></label>
            <label><span>预测目标</span><Select value={mineTarget} options={[{ label: "未来收益排序", value: "return" }, { label: "未来风险排序", value: "risk" }]} onChange={setMineTarget} /></label>
            {mineTarget === "risk" ? <label><span>风险标签</span><Select value={mineRiskKind} options={[{ label: "未来绝对收益", value: "abs_ret" }, { label: "未来实现波动", value: "realized_vol" }]} onChange={setMineRiskKind} /></label> : null}
            <label><span>预测期 bars</span><InputNumber min={1} max={10} value={mineHorizon} onChange={(value) => setMineHorizon(Number(value ?? 1))} /></label>
            <label><span>搜索器</span><Select value={mineMode} options={[{ label: "全部方法", value: "all" }, { label: "GP + ML", value: "both" }, { label: "经济模板", value: "template" }, { label: "LLM 提案", value: "llm" }, { label: "仅 GP", value: "gp" }, { label: "仅 ML", value: "ml" }]} onChange={setMineMode} /></label>
            <label><span>单边成本 bps</span><InputNumber min={0} max={100} value={costBps} onChange={(value) => setCostBps(Number(value ?? 8))} /></label>
            <label><span>稳定性切片</span><InputNumber min={3} max={6} value={validationFolds} onChange={(value) => setValidationFolds(Number(value ?? 4))} /></label>
          </div>
          <div className="factor-config-footer"><Checkbox checked={refreshLive} disabled={symbol === "WEB3-DEMO/USDT"} onChange={(event) => setRefreshLive(event.target.checked)}>刷新最新 K 线</Checkbox><span>训练段冻结归一化 · 分段边界 purge {mineHorizon} bars</span></div>
          {factorError ? <Alert type="error" showIcon message={factorError} /> : null}
          {resultIsStale ? <Alert type="warning" showIcon message="研究契约已变化" description="当前结果保留供对照，但试跑与交接已锁定；请按新契约重跑。" /> : null}
        </QuantGlowCard>
        <div className="factor-research-side">
          <QuantGlowCard title={<SectionHeader title="证据链" description="每一步回答一个不同的问题。" />}>
            <div className="factor-evidence-chain">
              <div><DatabaseOutlined /><span><b>数据契约</b><small>标签、时点、缺失与样本边界</small></span></div>
              <div><ExperimentOutlined /><span><b>发现与选优分离</b><small>60% 发现 · 20% 验证</small></span></div>
              <div><FundProjectionScreenOutlined /><span><b>最终留出审计</b><small>20% 仅报告一次</small></span></div>
              <div><SafetyCertificateOutlined /><span><b>研究闸门</b><small>不确定性、成本、稳定性、多重检验</small></span></div>
            </div>
          </QuantGlowCard>
          <div className="factor-scope-warning"><b>能力边界</b><p>当前引擎是<strong>单标的时序因子实验室</strong>，不是多币种横截面定价模型。研究闸门通过也不能直接上线。</p></div>
        </div>
      </section>

      <QuantGlowCard className="factor-workbench" title={<SectionHeader title="研究工作台" description="总览不重复堆指标；细节按验证、特征、论文和交接分层。" />}>
        <Tabs
          defaultActiveKey="overview"
          items={[
            { key: "overview", label: "01 研究总览", children: overview },
            { key: "validation", label: "02 验证诊断", children: validation },
            { key: "library", label: "03 特征库", children: library },
            { key: "evidence", label: "04 论文方法", children: evidence },
            { key: "handoff", label: "05 回测交接", children: handoff },
          ]}
        />
      </QuantGlowCard>
    </TradingPageShell>
  );
}
