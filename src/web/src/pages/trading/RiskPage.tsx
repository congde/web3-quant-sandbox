import {
  AlertOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleFilled,
  FireOutlined,
  PauseCircleOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Button, Modal, Progress, Segmented, Space, Table, Tooltip } from "antd";
import { useMemo, useState } from "react";
import type { RiskRejection } from "../../types";
import { useReport } from "../../contexts/ReportContext";
import {
  MetricTile,
  QuantGlowCard,
  SectionHeader,
  SignalRow,
  StatusPill,
  TradingPageShell,
  type Tone,
} from "./TradingPageShell";

type Severity = "safe" | "warning" | "critical";
type StrategyMode = "Active" | "Pause" | "Close & Cancel";
type LogLevel = "normal" | "warning" | "critical";

const REJECTION_LIMIT_OPTIONS = [
  { label: "Top 10", value: 10 },
  { label: "Top 25", value: 25 },
  { label: "Top 50", value: 50 },
  { label: "全部", value: 0 },
];

const REJECTION_WINDOW_OPTIONS = [
  { label: "全部时间", value: "all" },
  { label: "近 30 天", value: "30d" },
  { label: "近 90 天", value: "90d" },
  { label: "近 180 天", value: "180d" },
];

const ASSET_DISTRIBUTION = [
  { name: "Binance", pct: 38, tone: "profit" },
  { name: "OKX", pct: 24, tone: "neutral" },
  { name: "Ethereum", pct: 27, tone: "ai" },
  { name: "Solana", pct: 11, tone: "loss" },
] as const;

const POSITION_RISKS = [
  { symbol: "ETH-PERP", risk: 72, liq: "$2,945", exposure: "+1.28M" },
  { symbol: "SOL-PERP", risk: 58, liq: "$112.4", exposure: "-420K" },
  { symbol: "BTC-PERP", risk: 41, liq: "$54,800", exposure: "+860K" },
];

const ONCHAIN_RADAR = [
  { label: "Aave Health Factor", value: "1.18", threshold: "1.10 红线", load: 78, severity: "warning" },
  { label: "USDC Peg Drift", value: "-0.18%", threshold: "0.50% 预警", load: 36, severity: "safe" },
  { label: "stETH Discount", value: "-0.42%", threshold: "0.50% 预警", load: 84, severity: "warning" },
  { label: "Oracle Spread", value: "0.31%", threshold: "0.80% 红线", load: 46, severity: "safe" },
  { label: "CEX WebSocket", value: "126ms", threshold: "200ms 红线", load: 63, severity: "warning" },
  { label: "RPC Node", value: "88ms", threshold: "200ms 红线", load: 44, severity: "safe" },
] satisfies Array<{
  label: string;
  value: string;
  threshold: string;
  load: number;
  severity: Severity;
}>;

const STRATEGY_GUARDS = ["套利网格", "趋势突破", "链上搬砖", "资金费率", "AI 信号池"];

function dateMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function severityTone(severity: Severity): Tone {
  if (severity === "critical") return "loss";
  if (severity === "warning") return "ai";
  return "profit";
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function sortedRejections(rows: RiskRejection[]) {
  return [...rows].sort((a, b) => dateMs(b.date) - dateMs(a.date));
}

function logLabel(level: LogLevel): string {
  if (level === "critical") return "紧急";
  if (level === "warning") return "警告";
  return "正常";
}

export default function RiskPage() {
  const { report, loading } = useReport();
  const [rejectionLimit, setRejectionLimit] = useState(25);
  const [ruleFilter, setRuleFilter] = useState("all");
  const [windowFilter, setWindowFilter] = useState("all");
  const [killSwitchTripped, setKillSwitchTripped] = useState(false);
  const [strategyModes, setStrategyModes] = useState<Record<string, StrategyMode>>(
    () => Object.fromEntries(STRATEGY_GUARDS.map((name) => [name, "Active"])),
  );

  const riskChecks = report?.risk_checks ?? [];
  const trades = report?.backtest.trades ?? [];
  const rejections = report?.backtest.risk_rejections ?? [];
  const activeRules = report?.fusion.risk_rules ?? report?.backtest.risk_rules ?? [];
  const metrics = report?.backtest.metrics;
  const criticalChecks = riskChecks.filter((item) => item.severity === "critical").length;
  const warningChecks = riskChecks.filter((item) => item.severity === "warning").length;
  const drawdownPct = Math.abs(metrics?.maximum_drawdown_pct ?? 0);
  const intradayDrawdownPct = Math.min(2.6, drawdownPct * 0.38 + 0.42);
  const gasBaseFee = killSwitchTripped ? 142 : 86;
  const priorityFee = killSwitchTripped ? 5.8 : 2.4;
  const statusSeverity: Severity =
    killSwitchTripped || criticalChecks > 0 || gasBaseFee > 120 || drawdownPct >= 3
      ? "critical"
      : warningChecks > 0 || intradayDrawdownPct >= 1.5 || gasBaseFee > 80
        ? "warning"
        : "safe";
  const statusText = killSwitchTripped
    ? "紧急熔断中"
    : statusSeverity === "critical"
      ? "紧急"
      : statusSeverity === "warning"
        ? "预警"
        : "安全";

  const ruleOptions = useMemo(
    () => [
      { label: "全部规则", value: "all" },
      ...Array.from(new Set(rejections.map((item) => item.rule_id)))
        .sort()
        .map((ruleId) => ({ label: ruleId, value: ruleId })),
    ],
    [rejections],
  );

  const filteredRejections = useMemo(() => {
    const latestMs = rejections.reduce((latest, item) => Math.max(latest, dateMs(item.date)), 0);
    const windowDays =
      windowFilter === "30d" ? 30 : windowFilter === "90d" ? 90 : windowFilter === "180d" ? 180 : 0;
    const cutoff = windowDays && latestMs ? latestMs - windowDays * 24 * 60 * 60 * 1000 : 0;
    const rows = sortedRejections(rejections)
      .filter((item) => ruleFilter === "all" || item.rule_id === ruleFilter)
      .filter((item) => !cutoff || dateMs(item.date) >= cutoff);
    return rejectionLimit > 0 ? rows.slice(0, rejectionLimit) : rows;
  }, [rejectionLimit, rejections, ruleFilter, windowFilter]);

  const eventLogs = useMemo(() => {
    const rejectionLogs = sortedRejections(rejections)
      .slice(0, 8)
      .map((item) => ({
        ts: item.date,
        level: "warning" as LogLevel,
        message: `${item.symbol || "SYSTEM"} ${item.side} 被 ${item.rule_id} 拦截：${item.reason}`,
      }));
    return [
      {
        ts: "10:24:02.123",
        level: gasBaseFee > 120 ? "critical" as LogLevel : "warning" as LogLevel,
        message: `ETH Gas Base Fee ${gasBaseFee} Gwei，已限制高频链上套利额度`,
      },
      {
        ts: "10:24:05.456",
        level: "normal" as LogLevel,
        message: `Binance 账户权益回撤 ${intradayDrawdownPct.toFixed(2)}%，策略降频检查已更新`,
      },
      ...rejectionLogs,
    ];
  }, [gasBaseFee, intradayDrawdownPct, rejections]);

  const confirmKillSwitch = () => {
    Modal.confirm({
      title: "确认执行全局熔断？",
      icon: <ExclamationCircleFilled />,
      content:
        "模拟动作：撤销 CEX 挂单、平仓高风险仓位、链上资金撤回安全地址。本教学界面只切换前端状态，不会触发真实交易。",
      okText: "确认熔断",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => setKillSwitchTripped(true),
    });
  };

  return (
    <TradingPageShell
      eyebrow="Risk Control Center"
      title="风控中心"
      description="集中监控回撤、杠杆、清算距离、链上 Gas、健康因子、脱锚、预言机价差与节点延迟；风险员需要在秒级内看到全局并执行分级熔断。"
      actions={
        <>
          <StatusPill tone={severityTone(statusSeverity)}>
            {loading ? "Loading" : `系统状态：${statusText}`}
          </StatusPill>
          <Tooltip title="二级确认后进入全局熔断模拟状态">
            <Button
              danger
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              onClick={confirmKillSwitch}
            >
              全局熔断
            </Button>
          </Tooltip>
        </>
      }
    >
      <section className="risk-control-grid">
        <QuantGlowCard className={`risk-global-card risk-${statusSeverity} risk-span-12`}>
          <div className="risk-global-status">
            <div className="risk-status-light" />
            <div>
              <span>Global State</span>
              <strong>{statusText}</strong>
              <p>Risk WebSocket 模拟 5-10Hz 汇总推送；当前页面按局部组件刷新展示。</p>
            </div>
          </div>
          <div className="risk-gas-strip">
            <MetricTile label="ETH Base Fee" value={`${gasBaseFee} Gwei`} subtle="Priority fee 同步监控" tone={gasBaseFee > 120 ? "loss" : "ai"} />
            <MetricTile label="Priority Fee" value={`${priorityFee} Gwei`} subtle="链上执行预算" tone="neutral" />
            <MetricTile label="Solana RPC" value="88ms" subtle="节点延迟红线 200ms" tone="profit" />
            <MetricTile label="活跃规则" value={activeRules.length} subtle="RiskManager gates" tone="neutral" />
          </div>
        </QuantGlowCard>

        <QuantGlowCard
          className="risk-span-7"
          title={<SectionHeader title="财务风控矩阵" description="回撤、保证金、清算距离与多空敞口" />}
          badge={<SafetyOutlined style={{ color: "var(--qa-neutral)" }} />}
        >
          <div className="risk-metric-board">
            <MetricTile label="总资产权益" value={metrics?.final_equity ?? 100000} kind="usd" subtle="离线回测权益链路" tone="profit" />
            <MetricTile label="今日动态回撤" value={-intradayDrawdownPct} kind="pct" subtle="限制线 -3.00%" tone={intradayDrawdownPct > 1.5 ? "loss" : "ai"} showSign />
            <MetricTile label="最大回撤" value={-drawdownPct} kind="pct" subtle="后测复核红线" tone={drawdownPct > 3 ? "loss" : "neutral"} showSign />
            <MetricTile label="净 / 总敞口" value="+0.74M / 2.56M" subtle="Delta exposure" tone="neutral" />
          </div>

          <div className="risk-subgrid">
            <div className="risk-panel">
              <div className="risk-panel-title">多交易所 / 多链资产分布</div>
              <div className="risk-allocation">
                {ASSET_DISTRIBUTION.map((item) => (
                  <div key={item.name}>
                    <span>{item.name}</span>
                    <div className="risk-allocation-bar">
                      <i className={`risk-bar-${item.tone}`} style={{ width: `${item.pct}%` }} />
                    </div>
                    <strong>{item.pct}%</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="risk-panel">
              <div className="risk-panel-title">最接近清算线的仓位</div>
              <div className="risk-position-list">
                {POSITION_RISKS.map((item) => (
                  <div key={item.symbol} className={item.risk > 70 ? "is-warning" : ""}>
                    <span>{item.symbol}</span>
                    <strong>{item.risk}%</strong>
                    <em>liq {item.liq} · {item.exposure}</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </QuantGlowCard>

        <QuantGlowCard
          className="risk-span-5"
          title={<SectionHeader title="链上风险雷达" description="协议健康度、脱锚、预言机与延迟" />}
          badge={<ApiOutlined style={{ color: "var(--qa-ai)" }} />}
        >
          <div className="risk-radar-list">
            {ONCHAIN_RADAR.map((item) => (
              <div key={item.label} className={`risk-radar-row risk-${item.severity}`}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.threshold}</span>
                </div>
                <Progress percent={clampPct(item.load)} showInfo={false} strokeColor={item.severity === "warning" ? "#f59e0b" : "#10b981"} />
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        </QuantGlowCard>

        <QuantGlowCard
          className="risk-span-12"
          title={<SectionHeader title="分级熔断控制" description="每条策略独立控制：暂停新单、平仓撤单、恢复运行" />}
        >
          <div className="risk-guard-grid">
            {STRATEGY_GUARDS.map((name) => (
              <div key={name} className={`risk-guard-row mode-${strategyModes[name]?.replace(/\s|&/g, "-").toLowerCase()}`}>
                <div>
                  <strong>{name}</strong>
                  <span>{strategyModes[name] === "Active" ? "允许生成新订单" : strategyModes[name] === "Pause" ? "停止新订单，保留现有仓位" : "撤单并市价退出模拟队列"}</span>
                </div>
                <Segmented
                  value={strategyModes[name]}
                  onChange={(value) => setStrategyModes((current) => ({ ...current, [name]: value as StrategyMode }))}
                  options={[
                    { label: "Active", value: "Active", icon: <CheckCircleOutlined /> },
                    { label: "Pause", value: "Pause", icon: <PauseCircleOutlined /> },
                    { label: "Close", value: "Close & Cancel", icon: <CloseCircleOutlined /> },
                  ]}
                />
              </div>
            ))}
          </div>
        </QuantGlowCard>

        <QuantGlowCard
          className="risk-span-6"
          title={<SectionHeader title="RiskManager 规则栈" description="命中任一规则即短路拦截" />}
          badge={<FireOutlined style={{ color: "var(--qa-loss)" }} />}
        >
          <div className="trading-list">
            {activeRules.length ? (
              activeRules.map((ruleId) => (
                <SignalRow
                  key={ruleId}
                  title={ruleId}
                  meta="已注册到运行时 RiskManager；订单意图先过风控再进入撮合"
                  badge={<StatusPill tone="profit">active</StatusPill>}
                />
              ))
            ) : (
              <SignalRow title="无活跃规则" meta="当前报告未返回 RiskManager 配置" />
            )}
          </div>
        </QuantGlowCard>

        <QuantGlowCard
          className="risk-span-6"
          title={<SectionHeader title="实时风控事件流" description="瀑布流展示自动限频、拦截和状态恢复" />}
        >
          <div className="risk-log-stream">
            {eventLogs.map((item, index) => (
              <div key={`${item.ts}-${index}`} className={`risk-log-${item.level}`}>
                <time>[{item.ts}]</time>
                <span>[{logLabel(item.level)}]</span>
                <strong>{item.message}</strong>
              </div>
            ))}
          </div>
        </QuantGlowCard>

        <QuantGlowCard
          className="risk-span-7"
          title={
            <SectionHeader
              title="拦截明细"
              description={`当前 ${filteredRejections.length}/${rejections.length} 条`}
              action={
                <Space wrap className="risk-table-controls">
                  <Segmented value={rejectionLimit} onChange={(value) => setRejectionLimit(value as number)} options={REJECTION_LIMIT_OPTIONS} />
                  <Segmented value={windowFilter} onChange={(value) => setWindowFilter(value as string)} options={REJECTION_WINDOW_OPTIONS} />
                  <Segmented value={ruleFilter} onChange={(value) => setRuleFilter(value as string)} options={ruleOptions} />
                </Space>
              }
            />
          }
        >
          <Table
            className="trading-ant-table risk-compact-table"
            pagination={rejectionLimit === 0 ? { pageSize: 25, showSizeChanger: false } : false}
            rowKey={(row) => `${row.date}-${row.side}-${row.rule_id}-${row.reason}`}
            dataSource={filteredRejections}
            locale={{ emptyText: "无运行时拦截记录" }}
            columns={[
              { title: "日期", dataIndex: "date" },
              { title: "方向", dataIndex: "side" },
              { title: "规则", dataIndex: "rule_id" },
              { title: "原因", dataIndex: "reason", ellipsis: true },
            ]}
          />
        </QuantGlowCard>

        <QuantGlowCard className="risk-span-5" title={<SectionHeader title="成交与放行样本" />}>
          <Table
            className="trading-ant-table risk-compact-table"
            pagination={false}
            rowKey={(row) => `${row.date}-${row.action}-${row.price}`}
            dataSource={trades.slice(0, 8)}
            columns={[
              { title: "日期", dataIndex: "date" },
              { title: "动作", dataIndex: "action" },
              { title: "价格", dataIndex: "price" },
            ]}
          />
          <div className="risk-audio-note">
            <AlertOutlined />
            红色阈值触发时保留声音告警入口；教学环境默认静音，避免误报打断讲解。
          </div>
        </QuantGlowCard>
      </section>
    </TradingPageShell>
  );
}
