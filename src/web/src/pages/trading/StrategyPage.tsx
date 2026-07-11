import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import type { CSSProperties, ReactElement, UIEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tooltip,
} from "antd";
import {
  cancelStrategyExperiment,
  createStrategyAsset,
  createStrategyAssetVersion,
  createStrategyExperiment,
  deleteStrategyAsset,
  deleteStrategyAssetVersion,
  fetchStrategyAsset,
  fetchStrategyAssets,
  fetchStrategyExperiment,
  proposeAiStrategy,
  runDslBacktest,
  validateStrategy,
} from "../../api";
import type {
  StrategyAiProposal,
  StrategyAssetDetail,
  StrategyAssetSummary,
  StrategyAssetVersion,
  StrategyExperimentPayload,
} from "../../api";
import type { DslBacktestPayload, StrategyValidationResult } from "../../types";
import {
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "./TradingPageShell";

const STORAGE_KEY = "strategy-dsl-draft-v1";
const VERSION_KEY = "strategy-studio-versions-v1";
const BUILDER_DRAFT_KEY = "strategy-studio-builder-draft-v1";
const MODE_DRAFT_KEY = "strategy-studio-mode-v1";

const DEFAULT_CODE = `from ai_trading.api import market_buy, market_sell

def on_tick(ctx, candle):
    if len(ctx.history) < 7:
        return None
    short = (ctx.history[-1].close + ctx.history[-2].close + ctx.history[-3].close) / 3
    long = (ctx.history[-1].close + ctx.history[-2].close + ctx.history[-3].close + ctx.history[-4].close + ctx.history[-5].close + ctx.history[-6].close + ctx.history[-7].close) / 7
    position = ctx.position()
    if short > long and position.qty == 0:
        return market_buy(ctx.symbol, 0.1)
    if short < long and position.qty > 0:
        return market_sell(ctx.symbol, position.qty)
    return None
`;

const TEMPLATES = [
  {
    key: "ma",
    name: "均线趋势",
    description: "短周期上穿长周期时跟随趋势",
    code: DEFAULT_CODE,
  },
  {
    key: "momentum",
    name: "价格动量",
    description: "比较最新价格与 5 根 K 线前价格",
    code: `from ai_trading.api import market_buy, market_sell

def on_tick(ctx, candle):
    if len(ctx.history) < 6:
        return None
    position = ctx.position()
    momentum = ctx.history[-1].close - ctx.history[-6].close
    if momentum > 0 and position.qty == 0:
        return market_buy(ctx.symbol, 0.1)
    if momentum < 0 and position.qty > 0:
        return market_sell(ctx.symbol, position.qty)
    return None
`,
  },
] as const;

const PYTHON_KEYWORDS = new Set([
  "and",
  "as",
  "assert",
  "break",
  "class",
  "continue",
  "def",
  "elif",
  "else",
  "except",
  "False",
  "finally",
  "for",
  "from",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "None",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "True",
  "try",
  "while",
  "with",
  "yield",
]);

const PYTHON_BUILTINS = new Set([
  "abs",
  "bool",
  "dict",
  "float",
  "int",
  "len",
  "list",
  "max",
  "min",
  "range",
  "round",
  "str",
  "sum",
  "tuple",
]);

type StrategyModel = "ma" | "momentum" | "rsi" | "breakout" | "bollinger";
type BuilderConfig = {
  name: string;
  model: StrategyModel;
  fast: number;
  slow: number;
  qty: number;
  symbol: string;
  limit: number;
  stopLoss: number;
  takeProfit: number;
  oversold: number;
  overbought: number;
  deviation: number;
};
type StrategyVersion = {
  id: string;
  version: number;
  savedAt: string;
  config: BuilderConfig;
  status: "validated" | "draft";
  returnPct?: number;
  drawdownPct?: number;
};
const MODEL_LABEL: Record<StrategyModel, string> = {
  ma: "双均线趋势",
  momentum: "价格动量",
  rsi: "RSI 均值回归",
  breakout: "区间突破",
  bollinger: "布林带回归",
};
const DEFAULT_BUILDER: BuilderConfig = {
  name: "趋势策略 V1",
  model: "ma",
  fast: 3,
  slow: 7,
  qty: 0.1,
  symbol: "WEB3-DEMO/USDT",
  limit: 120,
  stopLoss: 3,
  takeProfit: 6,
  oversold: 30,
  overbought: 70,
  deviation: 2,
};

function loadBuilderDraft(): BuilderConfig {
  try {
    const saved = JSON.parse(
      localStorage.getItem(BUILDER_DRAFT_KEY) ?? "null",
    ) as Partial<BuilderConfig> | null;
    return saved ? { ...DEFAULT_BUILDER, ...saved } : DEFAULT_BUILDER;
  } catch {
    return DEFAULT_BUILDER;
  }
}

function describeEntry(config: BuilderConfig): string {
  if (config.model === "ma")
    return `${config.fast} 周期均线上穿 ${config.slow} 周期均线`;
  if (config.model === "momentum") return `价格高于 ${config.slow} 根 K 线前`;
  if (config.model === "rsi")
    return `RSI(${config.slow}) 低于 ${config.oversold}`;
  if (config.model === "breakout")
    return `收盘价突破前 ${config.slow} 根 K 线最高价`;
  return `价格跌破 ${config.slow} 周期布林带下轨（${config.deviation}σ）`;
}

function buildStrategyCode(config: BuilderConfig): string {
  if (config.model === "rsi") {
    return `from ai_trading.api import market_buy, market_sell

def on_tick(ctx, candle):
    if len(ctx.history) < ${config.slow + 1}:
        return None
    gains = 0
    losses = 0
    for index in range(1, ${config.slow + 1}):
        change = ctx.history[-index].close - ctx.history[-index - 1].close
        if change > 0:
            gains = gains + change
        elif change < 0:
            losses = losses - change
    rsi = 100 if losses == 0 else 100 - (100 / (1 + gains / losses))
    position = ctx.position()
    stop_price = position.avg_entry_price * ${100 - config.stopLoss} / 100
    target_price = position.avg_entry_price * ${100 + config.takeProfit} / 100
    if position.qty > 0 and (candle.close <= stop_price or candle.close >= target_price):
        return market_sell(ctx.symbol, position.qty)
    if rsi <= ${config.oversold} and position.qty == 0:
        return market_buy(ctx.symbol, ${config.qty})
    if rsi >= ${config.overbought} and position.qty > 0:
        return market_sell(ctx.symbol, position.qty)
    return None
`;
  }
  if (config.model === "breakout") {
    return `from ai_trading.api import market_buy, market_sell

def on_tick(ctx, candle):
    if len(ctx.history) < ${config.slow + 1}:
        return None
    previous = ctx.history[-${config.slow + 1}:-1]
    resistance = max(item.high for item in previous)
    support = min(item.low for item in previous)
    position = ctx.position()
    stop_price = position.avg_entry_price * ${100 - config.stopLoss} / 100
    target_price = position.avg_entry_price * ${100 + config.takeProfit} / 100
    if position.qty > 0 and (candle.close <= stop_price or candle.close >= target_price):
        return market_sell(ctx.symbol, position.qty)
    if candle.close > resistance and position.qty == 0:
        return market_buy(ctx.symbol, ${config.qty})
    if candle.close < support and position.qty > 0:
        return market_sell(ctx.symbol, position.qty)
    return None
`;
  }
  if (config.model === "bollinger") {
    return `from statistics import mean, pstdev
from ai_trading.api import market_buy, market_sell

def on_tick(ctx, candle):
    if len(ctx.history) < ${config.slow}:
        return None
    closes = [item.close for item in ctx.history[-${config.slow}:]]
    middle = mean(closes)
    spread = pstdev(closes)
    lower = middle - spread * ${config.deviation}
    upper = middle + spread * ${config.deviation}
    position = ctx.position()
    if candle.close <= lower and position.qty == 0:
        return market_buy(ctx.symbol, ${config.qty})
    if (candle.close >= middle or candle.close >= upper) and position.qty > 0:
        return market_sell(ctx.symbol, position.qty)
    return None
`;
  }
  if (config.model === "momentum") {
    return `from ai_trading.api import market_buy, market_sell

def on_tick(ctx, candle):
    if len(ctx.history) < ${config.slow + 1}:
        return None
    position = ctx.position()
    stop_price = position.avg_entry_price * ${100 - config.stopLoss} / 100
    target_price = position.avg_entry_price * ${100 + config.takeProfit} / 100
    if position.qty > 0 and (candle.close <= stop_price or candle.close >= target_price):
        return market_sell(ctx.symbol, position.qty)
    momentum = ctx.history[-1].close - ctx.history[-${config.slow + 1}].close
    if momentum > 0 and position.qty == 0:
        return market_buy(ctx.symbol, ${config.qty})
    if momentum < 0 and position.qty > 0:
        return market_sell(ctx.symbol, position.qty)
    return None
`;
  }
  const average = (period: number) =>
    Array.from(
      { length: period },
      (_, index) => `ctx.history[-${index + 1}].close`,
    ).join(" + ");
  return `from ai_trading.api import market_buy, market_sell

def on_tick(ctx, candle):
    if len(ctx.history) < ${config.slow}:
        return None
    fast_average = (${average(config.fast)}) / ${config.fast}
    slow_average = (${average(config.slow)}) / ${config.slow}
    position = ctx.position()
    stop_price = position.avg_entry_price * ${100 - config.stopLoss} / 100
    target_price = position.avg_entry_price * ${100 + config.takeProfit} / 100
    if position.qty > 0 and (candle.close <= stop_price or candle.close >= target_price):
        return market_sell(ctx.symbol, position.qty)
    if fast_average > slow_average and position.qty == 0:
        return market_buy(ctx.symbol, ${config.qty})
    if fast_average < slow_average and position.qty > 0:
        return market_sell(ctx.symbol, position.qty)
    return None
`;
}

function highlightPython(code: string) {
  let key = 0;
  const nodes: Array<string | ReactElement> = [];
  const pattern =
    /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/gm;
  let cursor = 0;

  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push(code.slice(cursor, index));
    }
    const value = match[0];
    const className = match[1]
      ? "syntax-comment"
      : match[2]
        ? "syntax-string"
        : match[3]
          ? "syntax-number"
          : PYTHON_KEYWORDS.has(value)
            ? "syntax-keyword"
            : PYTHON_BUILTINS.has(value)
              ? "syntax-builtin"
              : "";

    nodes.push(
      className ? (
        <span className={className} key={`syntax-${key++}`}>
          {value}
        </span>
      ) : (
        value
      ),
    );
    cursor = index + value.length;
  }
  if (cursor < code.length) {
    nodes.push(code.slice(cursor));
  }
  return nodes;
}

export default function StrategyPage() {
  const navigate = useNavigate();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const [code, setCode] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CODE,
  );
  const [result, setResult] = useState<StrategyValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [backtesting, setBacktesting] = useState(false);
  const [backtest, setBacktest] = useState<DslBacktestPayload | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("ma");
  const [mode, setMode] = useState<"ai" | "builder" | "code">(() => {
    const savedMode = localStorage.getItem(MODE_DRAFT_KEY);
    return savedMode === "ai" || savedMode === "code" ? savedMode : "builder";
  });
  const [builder, setBuilder] = useState<BuilderConfig>(loadBuilderDraft);
  const [versions, setVersions] = useState<StrategyVersion[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(VERSION_KEY) ?? "[]",
      ) as StrategyVersion[];
    } catch {
      return [];
    }
  });
  const [assetId, setAssetId] = useState<string | null>(() =>
    localStorage.getItem("strategy-studio-asset-id"),
  );
  const [assetVersionId, setAssetVersionId] = useState<string | null>(() =>
    localStorage.getItem("strategy-studio-version-id"),
  );
  const [savingVersion, setSavingVersion] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftName, setDraftName] = useState(builder.name);
  const [draftDescription, setDraftDescription] = useState("");
  const [previewVersion, setPreviewVersion] =
    useState<StrategyAssetVersion | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(() =>
    localStorage.getItem(BUILDER_DRAFT_KEY) ? "已恢复本地草稿" : null,
  );
  const [aiObjective, setAiObjective] = useState(
    () =>
      localStorage.getItem("strategy-studio-ai-objective-v1") ??
      "设计一个适用于 BTC 中低频交易、重视回撤控制的趋势策略",
  );
  const [aiRisk, setAiRisk] = useState("balanced");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProposal, setAiProposal] = useState<StrategyAiProposal | null>(null);
  const [experiment, setExperiment] =
    useState<StrategyExperimentPayload | null>(null);
  const [experimentLoading, setExperimentLoading] = useState(false);
  const [assets, setAssets] = useState<StrategyAssetSummary[]>([]);
  const [assetDetail, setAssetDetail] = useState<StrategyAssetDetail | null>(
    null,
  );
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(
    null,
  );
  const [compareSearch, setCompareSearch] = useState("");
  const [compareGroup, setCompareGroup] = useState("all");
  const [diffOnly, setDiffOnly] = useState(true);
  const [assetLoading, setAssetLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<
    "library" | "editor" | "experiment" | "governance"
  >("editor");
  const [savedAt, setSavedAt] = useState(
    localStorage.getItem(STORAGE_KEY) ? "已恢复本地草稿" : "新草稿",
  );
  const issues = useMemo(
    () => [
      ...(result?.validation.errors ?? []),
      ...(result?.lookahead.findings ?? []),
    ],
    [result],
  );
  const lineNumbers = useMemo(
    () =>
      Array.from(
        { length: Math.max(code.split("\n").length, 10) },
        (_, index) => index + 1,
      ).join("\n"),
    [code],
  );
  const highlightedCode = useMemo(() => highlightPython(code), [code]);
  const configWarnings = useMemo(() => {
    const items: string[] = [];
    if (!builder.name.trim()) items.push("策略名称不能为空");
    if (builder.model === "ma" && builder.fast >= builder.slow)
      items.push("快速周期必须小于慢速周期");
    if (builder.model === "rsi" && builder.oversold >= builder.overbought)
      items.push("RSI 超卖阈值必须低于超买阈值");
    if (builder.takeProfit / builder.stopLoss < 1.2)
      items.push("盈亏比低于 1.2，成本后优势可能不足");
    if (builder.limit < builder.slow * 8)
      items.push("样本长度不足慢周期的 8 倍，统计稳定性偏弱");
    return items;
  }, [builder]);
  const equityPoints = useMemo(() => {
    const values = backtest?.equity_curve ?? [];
    if (values.length < 2) return "";
    const min = Math.min(...values.map((item) => item.equity));
    const max = Math.max(...values.map((item) => item.equity));
    const span = max - min || 1;
    return values
      .map(
        (item, index) =>
          `${(index / (values.length - 1)) * 600},${120 - ((item.equity - min) / span) * 100}`,
      )
      .join(" ");
  }, [backtest]);
  const comparedVersions = useMemo(
    () =>
      compareIds
        .map((id) => assetDetail?.versions.find((item) => item.id === id))
        .filter(Boolean) as StrategyAssetVersion[],
    [assetDetail, compareIds],
  );
  const comparisonRows = useMemo(() => {
    if (comparedVersions.length < 2) return [];
    const flatten = (value: unknown, prefix = ""): Record<string, unknown> =>
      Object.entries((value as Record<string, unknown>) ?? {}).reduce(
        (result, [key, item]) => {
          const path = prefix ? `${prefix}.${key}` : key;
          return {
            ...result,
            ...(item && typeof item === "object" && !Array.isArray(item)
              ? flatten(item, path)
              : { [path]: item }),
          };
        },
        {},
      );
    const flattened = comparedVersions.map((item) => flatten(item.spec));
    const keys = [...new Set(flattened.flatMap((item) => Object.keys(item)))];
    const groupOf = (key: string) => {
      if (/stop|loss|profit|risk|position|qty|size|exposure/i.test(key))
        return "risk";
      if (/fee|slippage|order|execution|commission/i.test(key))
        return "execution";
      if (/symbol|timeframe|limit|sample|source|market/i.test(key))
        return "data";
      return "signal";
    };
    return keys
      .map((key) => {
        const values = flattened.map((item) => item[key]);
        const serialized = values.map((value) => JSON.stringify(value));
        return {
          key,
          values,
          changed: new Set(serialized).size > 1,
          group: groupOf(key),
        };
      })
      .filter(
        (row) =>
          (!diffOnly || row.changed) &&
          (compareGroup === "all" || row.group === compareGroup) &&
          row.key.toLowerCase().includes(compareSearch.trim().toLowerCase()),
      );
  }, [comparedVersions, compareGroup, compareSearch, diffOnly]);

  useEffect(() => {
    if (mode === "builder") {
      setCode(buildStrategyCode(builder));
      setResult(null);
      setBacktest(null);
    }
  }, [builder, mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, code);
      setSavedAt(
        `自动保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      );
    }, 700);
    return () => window.clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void handleValidate();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  function handleEditorScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (!highlightRef.current) {
      return;
    }
    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  function useTemplate(key: string) {
    const template = TEMPLATES.find((item) => item.key === key);
    if (!template) return;
    setSelectedTemplate(key);
    if (key === "ma") {
      setBuilder((current) => ({ ...current, model: "ma", fast: 3, slow: 7 }));
      changeMode("builder");
    } else if (key === "momentum") {
      setBuilder((current) => ({
        ...current,
        model: "momentum",
        fast: 3,
        slow: 5,
      }));
      changeMode("builder");
    }
    setResult(null);
  }

  function focusLine(line: number, col: number) {
    const offset =
      code
        .split("\n")
        .slice(0, Math.max(line - 1, 0))
        .reduce((total, item) => total + item.length + 1, 0) + Math.max(col, 0);
    editorRef.current?.focus();
    editorRef.current?.setSelectionRange(offset, offset);
  }

  async function handleValidate() {
    setLoading(true);
    try {
      setResult(await validateStrategy(code));
    } catch (error) {
      setResult({
        valid: false,
        validation: { valid: false, errors: [] },
        lookahead: { clean: false, findings: [] },
        source: "strategy_engine/dsl",
        error: error instanceof Error ? error.message : "校验失败",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleBacktest() {
    setBacktesting(true);
    try {
      setBacktest(
        await runDslBacktest(code, {
          symbol: builder.symbol,
          limit: builder.limit,
        }),
      );
    } catch (error) {
      setBacktest({
        ok: false,
        message: error instanceof Error ? error.message : "回测失败",
      });
    } finally {
      setBacktesting(false);
    }
  }

  async function saveVersion() {
    setSavingVersion(true);
    try {
      let strategyId = assetId;
      if (!strategyId) {
        const asset = await createStrategyAsset({
          name: builder.name,
          description: `${MODEL_LABEL[builder.model]} · ${builder.symbol}`,
        });
        strategyId = asset.id;
        setAssetId(asset.id);
        localStorage.setItem("strategy-studio-asset-id", asset.id);
      }
      const remoteVersion = await createStrategyAssetVersion(strategyId, {
        spec: builder as unknown as Record<string, unknown>,
        dslCode: code,
        changeReason: backtest?.ok ? "保存已回测配置" : "保存策略配置",
        status: result?.valid ? "validated" : "draft",
      });
      setAssetVersionId(remoteVersion.id);
      localStorage.setItem("strategy-studio-version-id", remoteVersion.id);
    } finally {
      setSavingVersion(false);
    }
    const nextVersion =
      Math.max(
        0,
        ...versions
          .filter((item) => item.config.name === builder.name)
          .map((item) => item.version),
      ) + 1;
    const snapshot: StrategyVersion = {
      id: crypto.randomUUID(),
      version: nextVersion,
      savedAt: new Date().toISOString(),
      config: { ...builder },
      status: result?.valid ? "validated" : "draft",
      returnPct: backtest?.metrics?.total_return_pct,
      drawdownPct: backtest?.metrics?.max_drawdown_pct,
    };
    const next = [snapshot, ...versions].slice(0, 20);
    setVersions(next);
    localStorage.setItem(VERSION_KEY, JSON.stringify(next));
    await refreshAssets();
  }

  function restoreVersion(version: StrategyVersion) {
    setBuilder({ ...version.config });
    changeMode("builder");
    setResult(null);
    setBacktest(null);
  }

  function persistDraftSnapshot(label = "刚刚手动保存") {
    try {
      localStorage.setItem(MODE_DRAFT_KEY, mode);
      localStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(builder));
      localStorage.setItem(STORAGE_KEY, code);
      localStorage.setItem("strategy-studio-ai-objective-v1", aiObjective);
      const stamp = new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setDraftSavedAt(`已保存 ${stamp}`);
      setSavedAt(label === "刚刚手动保存" ? `已保存 ${stamp}` : label);
      void message.success({
        content: `草稿已保存 · ${stamp}`,
        key: "strategy-draft",
        duration: 2,
      });
    } catch (error) {
      void message.error({
        content:
          error instanceof Error
            ? `草稿保存失败：${error.message}`
            : "草稿保存失败",
        key: "strategy-draft",
        duration: 4,
      });
    }
  }

  function openDraftModal() {
    setDraftName(builder.name || "未命名策略");
    setDraftDescription(
      assetDetail?.description ??
        `${MODEL_LABEL[builder.model]} · ${builder.symbol}`,
    );
    setDraftModalOpen(true);
  }

  async function saveBuilderDraft() {
    const normalizedName = draftName.trim();
    if (!normalizedName) {
      void message.warning("请填写策略名称");
      return;
    }
    setSavingDraft(true);
    try {
      const configToSave = { ...builder, name: normalizedName };
      setBuilder(configToSave);
      persistDraftSnapshot("已保存草稿");
      let strategyId =
        assetId && assetDetail?.name === normalizedName ? assetId : null;
      if (!strategyId) {
        const existing = assets.find((item) => item.name === normalizedName);
        strategyId = existing?.id ?? null;
      }
      if (!strategyId) {
        const asset = await createStrategyAsset({
          name: normalizedName,
          description:
            draftDescription.trim() ||
            `${MODEL_LABEL[builder.model]} · ${builder.symbol}`,
        });
        strategyId = asset.id;
        setAssetId(asset.id);
        localStorage.setItem("strategy-studio-asset-id", asset.id);
      }
      const remoteVersion = await createStrategyAssetVersion(strategyId, {
        spec: configToSave as unknown as Record<string, unknown>,
        dslCode: code,
        changeReason: "保存工作草稿",
        status: "draft",
      });
      setAssetVersionId(remoteVersion.id);
      localStorage.setItem("strategy-studio-version-id", remoteVersion.id);
      await refreshAssets();
      setDraftModalOpen(false);
      setWorkspaceView("library");
      void message.success({
        content: `草稿已保存到后台 · v${remoteVersion.version}`,
        key: "strategy-draft",
        duration: 3,
      });
    } catch (error) {
      void message.error({
        content:
          error instanceof Error
            ? `后台草稿保存失败：${error.message}`
            : "后台草稿保存失败",
        key: "strategy-draft",
        duration: 5,
      });
    } finally {
      setSavingDraft(false);
    }
  }

  function openRemoteVersion(version: StrategyAssetVersion) {
    const restored = {
      ...DEFAULT_BUILDER,
      ...(version.spec as Partial<BuilderConfig>),
    };
    setBuilder(restored);
    setCode(version.dsl_code);
    setAssetId(version.strategy_id);
    setAssetVersionId(version.id);
    localStorage.setItem("strategy-studio-asset-id", version.strategy_id);
    localStorage.setItem("strategy-studio-version-id", version.id);
    localStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(restored));
    localStorage.setItem(STORAGE_KEY, version.dsl_code);
    changeMode("builder");
    setResult(null);
    setBacktest(null);
    setWorkspaceView("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
    void message.success(`已打开 ${restored.name} · v${version.version}`);
  }

  async function removeVersion(version: StrategyAssetVersion) {
    setDeletingVersionId(version.id);
    try {
      await deleteStrategyAssetVersion(version.id);
      setCompareIds((current) => current.filter((id) => id !== version.id));
      if (assetVersionId === version.id) {
        setAssetVersionId(null);
        localStorage.removeItem("strategy-studio-version-id");
      }
      const detail = await fetchStrategyAsset(version.strategy_id);
      setAssetDetail(detail);
      setAssets(await fetchStrategyAssets());
      void message.success(
        `v${version.version} 已永久删除，剩余 ${detail.version_count} 个版本`,
      );
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "删除版本失败",
      );
    } finally {
      setDeletingVersionId(null);
    }
  }

  function confirmDeleteAsset() {
    if (!assetDetail) return;
    Modal.confirm({
      title: `删除策略“${assetDetail.name}”？`,
      content:
        "将删除该策略的全部草稿版本。包含准入版本或实验记录时系统会拒绝操作。",
      okText: "删除策略",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          await deleteStrategyAsset(assetDetail.id);
          setAssetDetail(null);
          setAssetId(null);
          setAssetVersionId(null);
          localStorage.removeItem("strategy-studio-asset-id");
          localStorage.removeItem("strategy-studio-version-id");
          await refreshAssets();
          void message.success("策略资产已删除");
        } catch (error) {
          void message.error(
            error instanceof Error ? error.message : "删除策略失败",
          );
          throw error;
        }
      },
    });
  }

  function changeMode(nextMode: "ai" | "builder" | "code") {
    setMode(nextMode);
    localStorage.setItem(MODE_DRAFT_KEY, nextMode);
  }

  async function generateAiProposal() {
    setAiLoading(true);
    try {
      setAiProposal(
        await proposeAiStrategy({
          objective: aiObjective,
          symbol: builder.symbol,
          riskProfile: aiRisk,
        }),
      );
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiProposal() {
    if (!aiProposal) return;
    const signal = aiProposal.spec.signal;
    const params = signal.params;
    setBuilder((current) => ({
      ...current,
      name: aiProposal.name,
      symbol: aiProposal.spec.universe[0] ?? current.symbol,
      model: signal.model as StrategyModel,
      fast: Number(params.fast_period ?? current.fast),
      slow: Number(
        params.slow_period ?? params.period ?? params.lookback ?? current.slow,
      ),
      oversold: Number(params.oversold ?? current.oversold),
      overbought: Number(params.overbought ?? current.overbought),
      deviation: Number(params.deviation ?? current.deviation),
      qty: Number(aiProposal.spec.position.value ?? current.qty),
      stopLoss: Number(aiProposal.spec.risk.stop_loss_pct ?? current.stopLoss),
      takeProfit: Number(
        aiProposal.spec.risk.take_profit_pct ?? current.takeProfit,
      ),
    }));
    changeMode("builder");
  }

  useEffect(() => {
    if (!experiment || !["queued", "running"].includes(experiment.status))
      return;
    const timer = window.setInterval(() => {
      void fetchStrategyExperiment(experiment.id).then(setExperiment);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [experiment?.id, experiment?.status]);

  useEffect(() => {
    void refreshAssets();
  }, []);

  async function refreshAssets() {
    setAssetLoading(true);
    try {
      const rows = await fetchStrategyAssets();
      setAssets(rows);
      const selected = assetId ?? rows[0]?.id;
      if (selected) {
        const detail = await fetchStrategyAsset(selected);
        setAssetDetail(detail);
        setCompareIds(detail.versions.slice(0, 2).map((item) => item.id));
      }
    } finally {
      setAssetLoading(false);
    }
  }

  async function runFullExperiment() {
    if (!assetVersionId) return;
    setExperimentLoading(true);
    try {
      setExperiment(
        await createStrategyExperiment(assetVersionId, {
          symbol: builder.symbol,
          limit: builder.limit,
          windows: 3,
        }),
      );
    } finally {
      setExperimentLoading(false);
    }
  }

  async function migrateLocalVersions() {
    if (!versions.length) return;
    setMigrating(true);
    try {
      const groups = new Map<string, StrategyVersion[]>();
      versions
        .slice()
        .reverse()
        .forEach((item) =>
          groups.set(item.config.name, [
            ...(groups.get(item.config.name) ?? []),
            item,
          ]),
        );
      for (const [name, items] of groups) {
        const asset = await createStrategyAsset({
          name,
          description: "由本地策略工作台迁移",
        });
        for (const item of items)
          await createStrategyAssetVersion(asset.id, {
            spec: item.config as unknown as Record<string, unknown>,
            dslCode: buildStrategyCode(item.config),
            changeReason: `迁移本地 v${item.version}`,
            status: item.status,
          });
      }
      localStorage.removeItem(VERSION_KEY);
      setVersions([]);
      await refreshAssets();
    } finally {
      setMigrating(false);
    }
  }

  return (
    <TradingPageShell
      eyebrow="Strategy Studio"
      title="策略开发工作台"
      description="用可视化规则定义信号、周期和仓位；系统自动生成安全策略，并完成校验与历史回测。"
      actions={
        <Space wrap>
          <Button
            type="primary"
            loading={backtesting}
            icon={<PlayCircleOutlined />}
            disabled={!result?.valid}
            onClick={() => void handleBacktest()}
          >
            运行当前策略
          </Button>
          <Button onClick={() => navigate("/risk")}>去风控中心</Button>
          <StatusPill
            tone={result?.valid ? "profit" : result ? "loss" : "neutral"}
          >
            {result ? (result.valid ? "校验通过" : "发现问题") : "未校验"}
          </StatusPill>
        </Space>
      }
    >
      <section className={`strategy-workspace strategy-view-${workspaceView}`}>
        <nav className="strategy-workspace-nav" aria-label="策略研发工作区">
          <button
            type="button"
            className={workspaceView === "library" ? "active" : ""}
            onClick={() => setWorkspaceView("library")}
          >
            <span>01</span>
            <strong>策略库</strong>
            <em>资产与版本</em>
          </button>
          <button
            type="button"
            className={workspaceView === "editor" ? "active" : ""}
            onClick={() => setWorkspaceView("editor")}
          >
            <span>02</span>
            <strong>策略编辑</strong>
            <em>AI · 配置 · DSL</em>
          </button>
          <button
            type="button"
            className={workspaceView === "experiment" ? "active" : ""}
            onClick={() => setWorkspaceView("experiment")}
          >
            <span>03</span>
            <strong>实验评估</strong>
            <em>回测与稳健性</em>
          </button>
          <button
            type="button"
            className={workspaceView === "governance" ? "active" : ""}
            onClick={() => setWorkspaceView("governance")}
          >
            <span>04</span>
            <strong>审批发布</strong>
            <em>门禁与模拟运行</em>
          </button>
        </nav>
        <aside className="strategy-sidebar">
          <div className="strategy-sidebar-heading">
            <span>快速方案</span>
            <strong>{TEMPLATES.length}</strong>
          </div>
          {TEMPLATES.map((template) => (
            <button
              type="button"
              className={`strategy-template ${selectedTemplate === template.key ? "is-active" : ""}`}
              key={template.key}
              onClick={() => useTemplate(template.key)}
            >
              <span>{template.name}</span>
              <small>{template.description}</small>
            </button>
          ))}
          <div className="strategy-guide">
            <strong>执行约束</strong>
            <ul>
              <li>固定入口 on_tick(ctx, candle)</li>
              <li>仅访问当前与历史数据</li>
              <li>返回订单对象或 None</li>
              <li>服务端重新执行安全校验</li>
            </ul>
          </div>
        </aside>
        <div className="strategy-main">
          <div className="strategy-modebar">
            <div>
              <strong>创建方式</strong>
              <span>
                AI 提案、可视化配置与高级 DSL 共享同一准入流程
                {draftSavedAt ? ` · ${draftSavedAt}` : ""}
              </span>
            </div>
            <Space>
              <Select
                className="strategy-history-select"
                value={assetVersionId ?? undefined}
                allowClear
                placeholder="打开历史版本"
                disabled={!assetDetail?.versions.length}
                options={(assetDetail?.versions ?? []).map((item) => ({
                  label: `v${item.version} · ${item.status} · ${new Date(item.created_at).toLocaleString("zh-CN")}`,
                  value: item.id,
                }))}
                onChange={(versionId) => {
                  const version = assetDetail?.versions.find(
                    (item) => item.id === versionId,
                  );
                  if (version) openRemoteVersion(version);
                }}
              />
              <Button
                size="small"
                loading={savingDraft}
                icon={<SaveOutlined />}
                onClick={openDraftModal}
              >
                保存草稿
              </Button>
              <Button
                size="small"
                loading={savingVersion}
                onClick={() => void saveVersion()}
              >
                发布版本
              </Button>
              <Segmented
                value={mode}
                options={[
                  { label: "AI 策略提案", value: "ai" },
                  { label: "可视化配置", value: "builder" },
                  { label: "高级代码", value: "code" },
                ]}
                onChange={(value) =>
                  changeMode(value as "ai" | "builder" | "code")
                }
              />
            </Space>
          </div>

          {mode === "ai" && (
            <div className="strategy-ai-grid">
              <QuantGlowCard
                title={
                  <SectionHeader
                    title="AI 策略研发任务"
                    description="描述研究目标；AI 只生成候选规格，不直接发布或下单"
                  />
                }
              >
                <div className="strategy-ai-form">
                  <label>
                    研究目标
                    <Input.TextArea
                      rows={5}
                      value={aiObjective}
                      onChange={(event) => setAiObjective(event.target.value)}
                    />
                  </label>
                  <div>
                    <label>
                      风险偏好
                      <Select
                        value={aiRisk}
                        options={[
                          { label: "保守", value: "conservative" },
                          { label: "均衡", value: "balanced" },
                          { label: "进取", value: "aggressive" },
                        ]}
                        onChange={setAiRisk}
                      />
                    </label>
                    <label>
                      研究标的
                      <Select
                        value={builder.symbol}
                        options={[
                          { label: "WEB3 教学样本", value: "WEB3-DEMO/USDT" },
                          { label: "BTC / USDT", value: "BTC-USDT" },
                          { label: "ETH / USDT", value: "ETH-USDT" },
                        ]}
                        onChange={(symbol) =>
                          setBuilder((current) => ({ ...current, symbol }))
                        }
                      />
                    </label>
                  </div>
                  <Button
                    type="primary"
                    loading={aiLoading}
                    disabled={!aiObjective.trim()}
                    onClick={() => void generateAiProposal()}
                  >
                    生成受控候选
                  </Button>
                </div>
              </QuantGlowCard>
              <aside className="strategy-ai-result">
                {aiProposal ? (
                  <>
                    <div className="strategy-review-head">
                      <span>候选提案</span>
                      <StatusPill
                        tone={aiProposal.source === "llm" ? "ai" : "neutral"}
                      >
                        {aiProposal.source === "llm" ? "LLM" : "FALLBACK"}
                      </StatusPill>
                    </div>
                    <strong>{aiProposal.name}</strong>
                    <p>{aiProposal.hypothesis}</p>
                    <div>
                      <b>适用市场</b>
                      <span>{aiProposal.applicable_regime}</span>
                    </div>
                    <div>
                      <b>信号模型</b>
                      <span>
                        {MODEL_LABEL[
                          aiProposal.spec.signal.model as StrategyModel
                        ] ?? aiProposal.spec.signal.model}
                      </span>
                    </div>
                    <div>
                      <b>失效条件</b>
                      {aiProposal.failure_conditions.map((item) => (
                        <span key={item}>· {item}</span>
                      ))}
                    </div>
                    {aiProposal.llm_error && (
                      <small>
                        LLM 不可用，已采用确定性候选：{aiProposal.llm_error}
                      </small>
                    )}
                    <Button block type="primary" onClick={applyAiProposal}>
                      应用到策略规格
                    </Button>
                  </>
                ) : (
                  <div className="strategy-empty">
                    <span>AI</span>
                    <strong>等待研发目标</strong>
                    <span>候选必须经过人工应用、DSL 校验和样本外实验。</span>
                  </div>
                )}
              </aside>
            </div>
          )}

          {mode === "builder" && (
            <div className="strategy-terminal-grid">
              <QuantGlowCard
                className="strategy-config-panel"
                title={
                  <SectionHeader
                    title="策略规格"
                    description="定义数据、信号、风险与执行参数"
                  />
                }
              >
                <div className="strategy-config-section">
                  <div className="strategy-config-title">
                    <b>01</b>
                    <div>
                      <strong>策略与数据</strong>
                      <span>建立可识别的策略实验边界</span>
                    </div>
                  </div>
                  <div className="strategy-form-grid">
                    <label className="strategy-field-wide">
                      策略名称
                      <Input
                        value={builder.name}
                        maxLength={40}
                        onChange={(event) =>
                          setBuilder((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      交易标的
                      <Select
                        value={builder.symbol}
                        options={[
                          { label: "WEB3 教学样本", value: "WEB3-DEMO/USDT" },
                          { label: "BTC / USDT", value: "BTC-USDT" },
                          { label: "ETH / USDT", value: "ETH-USDT" },
                        ]}
                        onChange={(symbol) =>
                          setBuilder((current) => ({ ...current, symbol }))
                        }
                      />
                    </label>
                    <label>
                      样本 K 线数
                      <InputNumber
                        min={60}
                        max={500}
                        step={20}
                        value={builder.limit}
                        onChange={(limit) =>
                          setBuilder((current) => ({
                            ...current,
                            limit: Number(limit ?? 120),
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="strategy-config-section">
                  <div className="strategy-config-title">
                    <b>02</b>
                    <div>
                      <strong>入场与离场信号</strong>
                      <span>覆盖趋势、动量、反转与突破</span>
                    </div>
                  </div>
                  <div className="strategy-form-grid">
                    <label className="strategy-field-wide">
                      信号模型
                      <Select
                        value={builder.model}
                        options={[
                          { label: "趋势 · 双均线交叉", value: "ma" },
                          { label: "动量 · 价格变化", value: "momentum" },
                          { label: "均值回归 · RSI", value: "rsi" },
                          { label: "突破 · 区间高低点", value: "breakout" },
                          { label: "均值回归 · 布林带", value: "bollinger" },
                        ]}
                        onChange={(model) =>
                          setBuilder((current) => ({
                            ...current,
                            model: model as StrategyModel,
                          }))
                        }
                      />
                    </label>
                    {builder.model === "ma" && (
                      <label>
                        快速周期
                        <InputNumber
                          min={2}
                          max={20}
                          value={builder.fast}
                          onChange={(fast) =>
                            setBuilder((current) => ({
                              ...current,
                              fast: Number(fast ?? 3),
                              slow: Math.max(
                                current.slow,
                                Number(fast ?? 3) + 1,
                              ),
                            }))
                          }
                        />
                      </label>
                    )}
                    <label>
                      {builder.model === "ma"
                        ? "慢速周期"
                        : builder.model === "momentum"
                          ? "动量观察期"
                          : builder.model === "rsi"
                            ? "RSI 周期"
                            : builder.model === "breakout"
                              ? "突破观察期"
                              : "布林周期"}
                      <InputNumber
                        min={builder.model === "ma" ? builder.fast + 1 : 2}
                        max={60}
                        value={builder.slow}
                        onChange={(slow) =>
                          setBuilder((current) => ({
                            ...current,
                            slow: Number(slow ?? 7),
                          }))
                        }
                      />
                    </label>
                    {builder.model === "rsi" && (
                      <>
                        <label>
                          超卖阈值
                          <InputNumber
                            min={5}
                            max={45}
                            value={builder.oversold}
                            onChange={(oversold) =>
                              setBuilder((current) => ({
                                ...current,
                                oversold: Number(oversold ?? 30),
                              }))
                            }
                          />
                        </label>
                        <label>
                          超买阈值
                          <InputNumber
                            min={55}
                            max={95}
                            value={builder.overbought}
                            onChange={(overbought) =>
                              setBuilder((current) => ({
                                ...current,
                                overbought: Number(overbought ?? 70),
                              }))
                            }
                          />
                        </label>
                      </>
                    )}
                    {builder.model === "bollinger" && (
                      <label>
                        标准差倍数
                        <InputNumber
                          min={1}
                          max={4}
                          step={0.1}
                          value={builder.deviation}
                          onChange={(deviation) =>
                            setBuilder((current) => ({
                              ...current,
                              deviation: Number(deviation ?? 2),
                            }))
                          }
                        />
                      </label>
                    )}
                  </div>
                </div>
                <div className="strategy-config-section">
                  <div className="strategy-config-title">
                    <b>03</b>
                    <div>
                      <strong>仓位与风险边界</strong>
                      <span>硬性退出规则优先于信号规则</span>
                    </div>
                  </div>
                  <div className="strategy-form-grid strategy-form-grid-three">
                    <label>
                      单次下单数量
                      <InputNumber
                        min={0.001}
                        max={100}
                        step={0.01}
                        value={builder.qty}
                        onChange={(qty) =>
                          setBuilder((current) => ({
                            ...current,
                            qty: Number(qty ?? 0.1),
                          }))
                        }
                      />
                    </label>
                    <label>
                      止损比例
                      <InputNumber
                        min={0.1}
                        max={30}
                        step={0.5}
                        addonAfter="%"
                        value={builder.stopLoss}
                        onChange={(stopLoss) =>
                          setBuilder((current) => ({
                            ...current,
                            stopLoss: Number(stopLoss ?? 3),
                          }))
                        }
                      />
                    </label>
                    <label>
                      止盈比例
                      <InputNumber
                        min={0.1}
                        max={100}
                        step={0.5}
                        addonAfter="%"
                        value={builder.takeProfit}
                        onChange={(takeProfit) =>
                          setBuilder((current) => ({
                            ...current,
                            takeProfit: Number(takeProfit ?? 6),
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="strategy-config-section">
                  <div className="strategy-config-title">
                    <b>04</b>
                    <div>
                      <strong>执行假设</strong>
                      <span>快速回测统一采用可审计成本口径</span>
                    </div>
                  </div>
                  <div className="strategy-execution-strip">
                    <span>市价单</span>
                    <span>手续费 10 bps</span>
                    <span>滑点 5 bps</span>
                    <span>禁止未来数据</span>
                  </div>
                </div>
              </QuantGlowCard>
              <aside className="strategy-review-panel">
                <div className="strategy-review-head">
                  <span>策略审阅</span>
                  <StatusPill
                    tone={
                      result?.valid && configWarnings.length === 0
                        ? "profit"
                        : result || configWarnings.length
                          ? "loss"
                          : "neutral"
                    }
                  >
                    {result?.valid && configWarnings.length === 0
                      ? "READY"
                      : result || configWarnings.length
                        ? "BLOCKED"
                        : "DRAFT"}
                  </StatusPill>
                </div>
                <strong className="strategy-review-name">
                  {builder.name || "未命名策略"}
                </strong>
                <span className="strategy-review-symbol">
                  {builder.symbol} · {builder.limit} bars ·{" "}
                  {MODEL_LABEL[builder.model]}
                </span>
                <div className="strategy-review-score">
                  <span>目标盈亏比</span>
                  <strong>
                    {(builder.takeProfit / builder.stopLoss).toFixed(2)}
                  </strong>
                  <em>
                    {builder.takeProfit / builder.stopLoss >= 1.5
                      ? "风险收益结构合理"
                      : "需要提高止盈或收紧止损"}
                  </em>
                </div>
                <div className="strategy-review-block">
                  <b>ENTRY</b>
                  <p>{describeEntry(builder)}，且当前为空仓</p>
                </div>
                <div className="strategy-review-block">
                  <b>EXIT</b>
                  <p>
                    信号反转，或触发 {builder.stopLoss}% 止损 /{" "}
                    {builder.takeProfit}% 止盈
                  </p>
                </div>
                {configWarnings.length > 0 && (
                  <div className="strategy-config-warnings">
                    {configWarnings.map((warning) => (
                      <span key={warning}>! {warning}</span>
                    ))}
                  </div>
                )}
                <div className="strategy-review-checks">
                  <span>
                    <i className={result?.validation.valid ? "ok" : ""} />
                    语法与安全
                  </span>
                  <span>
                    <i className={result?.lookahead.clean ? "ok" : ""} />
                    前视偏差
                  </span>
                  <span>
                    <i className={result?.compilable ? "ok" : ""} />
                    可执行性
                  </span>
                </div>
                <div className="strategy-review-actions">
                  <Button
                    block
                    type="primary"
                    loading={loading}
                    disabled={configWarnings.length > 0}
                    onClick={() => void handleValidate()}
                  >
                    运行准入检查
                  </Button>
                  <Button
                    block
                    loading={backtesting}
                    disabled={!result?.valid || configWarnings.length > 0}
                    onClick={() => void handleBacktest()}
                  >
                    启动快速回测
                  </Button>
                  <Button block type="text" onClick={() => setMode("code")}>
                    审阅生成代码
                  </Button>
                </div>
              </aside>
            </div>
          )}

          {mode === "code" && (
            <>
              <div className="strategy-api-contract">
                <div>
                  <b>固定入口</b>
                  <code>def on_tick(ctx, candle)</code>
                </div>
                <div>
                  <b>可用数据</b>
                  <code>
                    ctx.history · ctx.position() · ctx.symbol ·
                    candle.close/high/low/open/volume
                  </code>
                </div>
                <div>
                  <b>固定输出</b>
                  <code>market_buy(...) · market_sell(...) · None</code>
                </div>
                <div>
                  <b>允许导入</b>
                  <code>ai_trading.api · math · statistics · decimal</code>
                </div>
              </div>
              <QuantGlowCard
                className="strategy-editor-card"
                title={
                  <SectionHeader
                    title="代码编辑器"
                    description="Ctrl / ⌘ + Enter 快速校验"
                  />
                }
              >
                <div className="strategy-code-shell">
                  <div className="strategy-code-topbar">
                    <span>
                      <i /> strategy.py
                    </span>
                    <div>
                      <ClockCircleOutlined /> {savedAt}
                      <Tooltip title="复制代码">
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() =>
                            void navigator.clipboard.writeText(code)
                          }
                        />
                      </Tooltip>
                    </div>
                  </div>
                  <div className="strategy-code-editor">
                    <pre aria-hidden="true" className="strategy-code-gutter">
                      {lineNumbers}
                    </pre>
                    <div className="strategy-code-input-stack">
                      <pre
                        ref={highlightRef}
                        aria-hidden="true"
                        className="strategy-code-highlight"
                      >
                        {highlightedCode}
                      </pre>
                      <textarea
                        ref={editorRef}
                        rows={12}
                        spellCheck={false}
                        value={code}
                        onChange={(event) => {
                          setCode(event.target.value);
                          setResult(null);
                        }}
                        onScroll={handleEditorScroll}
                        aria-label="策略代码编辑器"
                      />
                    </div>
                  </div>
                </div>
                <div className="strategy-editor-actions">
                  <Button
                    className="btn-gradient"
                    type="primary"
                    loading={loading}
                    icon={<CheckCircleOutlined />}
                    onClick={() => void handleValidate()}
                  >
                    运行安全校验
                  </Button>
                  <Button
                    loading={savingDraft}
                    icon={<SaveOutlined />}
                    onClick={openDraftModal}
                  >
                    保存草稿
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      localStorage.removeItem(STORAGE_KEY);
                      setCode(DEFAULT_CODE);
                      setResult(null);
                      setSavedAt("新草稿");
                    }}
                  >
                    重置
                  </Button>
                  <span className="strategy-code-stats">
                    {code.split("\n").length} 行 · {code.length} 字符
                  </span>
                </div>
              </QuantGlowCard>
            </>
          )}

          <QuantGlowCard
            className="strategy-diagnostics"
            title={
              <SectionHeader
                title="校验与诊断"
                description={
                  result
                    ? `${issues.length} 个问题 · ${result.source}`
                    : "语法、安全、编译与前视偏差"
                }
              />
            }
          >
            {!result && (
              <div className="strategy-empty">
                <CheckCircleOutlined />
                <strong>代码尚未校验</strong>
                <span>运行后将展示可点击定位的诊断结果。</span>
              </div>
            )}
            {result && (
              <>
                <div className="strategy-check-grid">
                  <div
                    className={result.validation.valid ? "is-pass" : "is-fail"}
                  >
                    <span>01</span>
                    <strong>语法与安全</strong>
                    <em>
                      {result.validation.valid
                        ? "通过"
                        : `${result.validation.errors.length} 个问题`}
                    </em>
                  </div>
                  <div
                    className={result.lookahead.clean ? "is-pass" : "is-fail"}
                  >
                    <span>02</span>
                    <strong>前视偏差</strong>
                    <em>
                      {result.lookahead.clean
                        ? "未发现"
                        : `${result.lookahead.findings.length} 个风险`}
                    </em>
                  </div>
                  <div
                    className={
                      result.compilable === false ? "is-fail" : "is-pass"
                    }
                  >
                    <span>03</span>
                    <strong>编译检查</strong>
                    <em>{result.compilable === false ? "失败" : "可执行"}</em>
                  </div>
                </div>
                {(result.error || result.compile_error) && (
                  <div className="strategy-error-banner">
                    {result.error ?? result.compile_error}
                  </div>
                )}
                {issues.length > 0 ? (
                  <div className="strategy-issue-list">
                    {issues.map((issue, index) => (
                      <button
                        type="button"
                        key={`${issue.line}-${issue.col}-${index}`}
                        onClick={() => focusLine(issue.line, issue.col)}
                      >
                        <span>
                          L{issue.line}:{issue.col}
                        </span>
                        <div>
                          <strong>{issue.message}</strong>
                          <small>{issue.suggestion ?? issue.rule}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="strategy-success">
                    <CheckCircleOutlined />
                    <div>
                      <strong>策略已通过准入检查</strong>
                      <span>
                        可以直接运行当前 DSL，验证真实交易与权益变化。
                      </span>
                    </div>
                    <Button
                      type="primary"
                      loading={backtesting}
                      onClick={() => void handleBacktest()}
                    >
                      快速回测
                    </Button>
                  </div>
                )}
              </>
            )}
          </QuantGlowCard>
          {backtest && (
            <QuantGlowCard
              className="strategy-backtest-card"
              title={
                <SectionHeader
                  title="当前 DSL 回测"
                  description={
                    backtest.ok
                      ? `${backtest.symbol} · ${backtest.total_candles} 根 K 线 · ${backtest.engine}`
                      : "执行失败"
                  }
                />
              }
            >
              {backtest.ok && backtest.metrics ? (
                <>
                  <div className="strategy-metric-grid">
                    <div>
                      <span>总收益</span>
                      <strong>
                        {backtest.metrics.total_return_pct.toFixed(2)}%
                      </strong>
                    </div>
                    <div>
                      <span>最大回撤</span>
                      <strong>
                        {backtest.metrics.max_drawdown_pct.toFixed(2)}%
                      </strong>
                    </div>
                    <div>
                      <span>Sharpe</span>
                      <strong>
                        {backtest.metrics.sharpe_ratio.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span>交易次数</span>
                      <strong>{backtest.metrics.total_trades}</strong>
                    </div>
                    <div>
                      <span>胜率</span>
                      <strong>{backtest.metrics.win_rate.toFixed(1)}%</strong>
                    </div>
                    <div>
                      <span>期末权益</span>
                      <strong>
                        {backtest.metrics.final_equity.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                  <div className="strategy-result-grid">
                    <div className="strategy-equity-panel">
                      <div>
                        <strong>权益曲线</strong>
                        <span>初始权益 10,000</span>
                      </div>
                      <svg
                        viewBox="0 0 600 140"
                        preserveAspectRatio="none"
                        role="img"
                        aria-label="DSL 回测权益曲线"
                      >
                        <line x1="0" y1="120" x2="600" y2="120" />
                        <polyline points={equityPoints} />
                      </svg>
                    </div>
                    <div className="strategy-trades-panel">
                      <strong>最近成交</strong>
                      {(backtest.trades ?? [])
                        .slice(-5)
                        .reverse()
                        .map((trade) => (
                          <div key={`${trade.ts}-${trade.side}`}>
                            <span
                              className={trade.side === "buy" ? "buy" : "sell"}
                            >
                              {trade.side.toUpperCase()}
                            </span>
                            <b>{trade.qty.toFixed(3)}</b>
                            <em>@ {trade.price.toFixed(2)}</em>
                          </div>
                        ))}
                      {!backtest.trades?.length && <p>该样本内没有触发成交</p>}
                    </div>
                  </div>
                </>
              ) : (
                <div className="strategy-error-banner">{backtest.message}</div>
              )}
              {backtest.ok && (
                <div className="strategy-backtest-footer">
                  <span>服务端已重新校验并执行；费用 10 bps，滑点 5 bps。</span>
                  <Button onClick={() => navigate("/backtests")}>
                    打开完整回测台
                  </Button>
                </div>
              )}
            </QuantGlowCard>
          )}
          <QuantGlowCard
            className="strategy-experiment-card"
            title={
              <SectionHeader
                title="稳健性实验控制台"
                description="统一执行基准回测、Walk-forward、PBO参数扰动与CPCV路径审计"
                action={
                  <Space>
                    <Button
                      type="primary"
                      loading={experimentLoading}
                      disabled={
                        !assetVersionId ||
                        ["queued", "running"].includes(experiment?.status ?? "")
                      }
                      onClick={() => void runFullExperiment()}
                    >
                      启动完整实验
                    </Button>
                    {experiment &&
                      ["queued", "running"].includes(experiment.status) && (
                        <Button
                          danger
                          onClick={() =>
                            void cancelStrategyExperiment(experiment.id).then(
                              setExperiment,
                            )
                          }
                        >
                          取消
                        </Button>
                      )}
                  </Space>
                }
              />
            }
          >
            {!assetVersionId && (
              <div className="strategy-empty">
                <SaveOutlined />
                <strong>请先发布一个策略版本</strong>
                <span>
                  完整实验必须绑定不可变版本，不能直接运行未保存草稿。
                </span>
              </div>
            )}
            {assetVersionId && !experiment && (
              <div className="strategy-experiment-ready">
                <span>版本已锁定</span>
                <strong>{assetVersionId.slice(0, 8)}</strong>
                <p>实验将在后台运行，页面会自动轮询阶段进度。</p>
              </div>
            )}
            {experiment && (
              <>
                <div className="strategy-experiment-status">
                  <div>
                    <span>任务状态</span>
                    <strong>{experiment.status.toUpperCase()}</strong>
                  </div>
                  <div>
                    <span>当前进度</span>
                    <strong>{experiment.progress}%</strong>
                  </div>
                  <div>
                    <span>晋级结论</span>
                    <strong>
                      {experiment.result?.promotion_ready == null
                        ? "待完成"
                        : experiment.result.promotion_ready
                          ? "可提交人工审批"
                          : "未通过自动门禁"}
                    </strong>
                  </div>
                </div>
                <div className="strategy-progress">
                  <i style={{ width: `${experiment.progress}%` }} />
                </div>
                {experiment.error && (
                  <div className="strategy-error-banner">
                    {experiment.error}
                  </div>
                )}
                <div className="strategy-experiment-body">
                  <div className="strategy-event-log">
                    {experiment.events
                      .slice()
                      .reverse()
                      .map((event, index) => (
                        <div key={`${event.created_at}-${index}`}>
                          <span>{event.progress}%</span>
                          <b>{event.phase}</b>
                          <p>{event.message}</p>
                        </div>
                      ))}
                  </div>
                  {experiment.result?.gates && (
                    <div className="strategy-gates">
                      <strong>自动门禁</strong>
                      {experiment.result.gates.map((gate) => (
                        <div
                          key={gate.gate}
                          className={gate.passed ? "pass" : "fail"}
                        >
                          <span>{gate.gate}</span>
                          <b>
                            {gate.value.toFixed(2)} {gate.operator}{" "}
                            {gate.threshold}
                          </b>
                          <em>{gate.passed ? "PASS" : "FAIL"}</em>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </QuantGlowCard>
          <QuantGlowCard
            className="strategy-version-card"
            title={
              <SectionHeader
                title="版本与实验记录"
                description={`保留最近 ${Math.min(versions.length, 20)} 个本地快照`}
              />
            }
          >
            {versions.length ? (
              <div className="strategy-version-table">
                <div className="strategy-version-row is-head">
                  <span>策略 / 版本</span>
                  <span>状态</span>
                  <span>参数摘要</span>
                  <span>回测结果</span>
                  <span>保存时间</span>
                  <span />
                </div>
                {versions.map((version) => (
                  <div className="strategy-version-row" key={version.id}>
                    <span>
                      <strong>{version.config.name}</strong>
                      <em>v{version.version}</em>
                    </span>
                    <span>
                      <StatusPill
                        tone={
                          version.status === "validated" ? "profit" : "neutral"
                        }
                      >
                        {version.status === "validated" ? "已准入" : "草稿"}
                      </StatusPill>
                    </span>
                    <span>
                      {MODEL_LABEL[version.config.model] ??
                        version.config.model}{" "}
                      · P{version.config.slow} · SL {version.config.stopLoss}% ·
                      TP {version.config.takeProfit}%
                    </span>
                    <span>
                      {version.returnPct == null
                        ? "未回测"
                        : `${version.returnPct.toFixed(2)}% / DD ${version.drawdownPct?.toFixed(2)}%`}
                    </span>
                    <span>
                      {new Date(version.savedAt).toLocaleString("zh-CN")}
                    </span>
                    <span>
                      <Button
                        size="small"
                        onClick={() => restoreVersion(version)}
                      >
                        恢复
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="strategy-empty">
                <SaveOutlined />
                <strong>尚未保存策略版本</strong>
                <span>版本会记录配置、准入状态和最近回测结果。</span>
              </div>
            )}
          </QuantGlowCard>
          <QuantGlowCard
            className="strategy-asset-library"
            title={
              <SectionHeader
                title="策略资产库"
                description="SQLite持久化策略、不可变版本与参数差异"
                action={
                  <Space>
                    <Button
                      loading={assetLoading}
                      onClick={() => void refreshAssets()}
                    >
                      刷新
                    </Button>
                    {versions.length > 0 && (
                      <Button
                        type="primary"
                        loading={migrating}
                        onClick={() => void migrateLocalVersions()}
                      >
                        迁移 {versions.length} 个本地版本
                      </Button>
                    )}
                  </Space>
                }
              />
            }
          >
            <div className="strategy-library-grid">
              <aside>
                <div className="strategy-library-sidehead">
                  <strong>全部策略</strong>
                  <span>{assets.length}</span>
                </div>
                {assets.map((asset) => (
                  <button
                    type="button"
                    key={asset.id}
                    className={assetDetail?.id === asset.id ? "active" : ""}
                    onClick={() =>
                      void fetchStrategyAsset(asset.id).then((detail) => {
                        setAssetDetail(detail);
                        setCompareIds([]);
                      })
                    }
                  >
                    <strong>{asset.name}</strong>
                    <span>
                      {asset.version_count} 个版本 · {asset.status}
                    </span>
                    <em>
                      {new Date(asset.updated_at).toLocaleDateString("zh-CN")}
                    </em>
                  </button>
                ))}
                {!assets.length && <p>暂无后台策略资产</p>}
              </aside>
              <div className="strategy-library-detail">
                {assetDetail ? (
                  <>
                    <div className="strategy-library-head">
                      <div>
                        <strong>{assetDetail.name}</strong>
                        <span>{assetDetail.description || "无描述"}</span>
                      </div>
                      <Button danger type="text" onClick={confirmDeleteAsset}>
                        删除策略
                      </Button>
                    </div>
                    <div className="strategy-selection-note">
                      {compareIds.length === 0
                        ? "勾选两个版本进行参数对比"
                        : compareIds.length === 1
                          ? "已选择 1 个版本，请至少再选择 1 个"
                          : `已选择 ${compareIds.length} 个版本进行并行对比（最多 8 个）`}
                    </div>
                    <div className="strategy-version-history">
                      <div className="is-head">
                        <span />
                        <span>版本</span>
                        <span>状态</span>
                        <span>变更说明</span>
                        <span>保存时间</span>
                        <span>操作</span>
                      </div>
                      {assetDetail.versions.map((item) => {
                        const checked = compareIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            className={checked ? "is-selected" : ""}
                          >
                            <span>
                              <input
                                type="checkbox"
                                aria-label={`选择 v${item.version}`}
                                checked={checked}
                                onChange={() =>
                                  setCompareIds((current) =>
                                    checked
                                      ? current.filter((id) => id !== item.id)
                                      : current.length < 8
                                        ? [...current, item.id]
                                        : current,
                                  )
                                }
                              />
                            </span>
                            <strong>v{item.version}</strong>
                            <span>
                              <StatusPill
                                tone={
                                  item.status === "draft" ? "neutral" : "profit"
                                }
                              >
                                {item.status === "draft" ? "草稿" : item.status}
                              </StatusPill>
                            </span>
                            <em>{item.change_reason || "无变更说明"}</em>
                            <time>
                              {new Date(item.created_at).toLocaleString(
                                "zh-CN",
                                {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </time>
                            <span className="strategy-row-actions">
                              <Button
                                type="link"
                                size="small"
                                onClick={() => setPreviewVersion(item)}
                              >
                                预览
                              </Button>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => openRemoteVersion(item)}
                              >
                                打开
                              </Button>
                              <Popconfirm
                                title={`永久删除 v${item.version}？`}
                                description="仅未关联实验的草稿版本可以删除，此操作无法恢复。"
                                okText="确认删除"
                                cancelText="取消"
                                okButtonProps={{
                                  danger: true,
                                  loading: deletingVersionId === item.id,
                                }}
                                onConfirm={() => void removeVersion(item)}
                              >
                                <Button
                                  type="link"
                                  danger
                                  size="small"
                                  loading={deletingVersionId === item.id}
                                >
                                  删除
                                </Button>
                              </Popconfirm>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="strategy-compare">
                      <div className="strategy-compare-controls">
                        <div>
                          <strong>参数矩阵</strong>
                          <span>
                            {comparedVersions.length >= 2
                              ? `${comparedVersions.length} 个版本 · ${comparisonRows.length} 项参数`
                              : "至少选择两个版本"}
                          </span>
                        </div>
                        <Input
                          size="small"
                          allowClear
                          value={compareSearch}
                          placeholder="搜索参数"
                          onChange={(event) =>
                            setCompareSearch(event.target.value)
                          }
                        />
                        <Select
                          size="small"
                          value={compareGroup}
                          onChange={setCompareGroup}
                          options={[
                            { label: "全部分组", value: "all" },
                            { label: "信号参数", value: "signal" },
                            { label: "数据范围", value: "data" },
                            { label: "仓位与风险", value: "risk" },
                            { label: "执行假设", value: "execution" },
                          ]}
                        />
                        <Segmented
                          size="small"
                          value={diffOnly ? "diff" : "all"}
                          options={[
                            { label: "仅看差异", value: "diff" },
                            { label: "全部参数", value: "all" },
                          ]}
                          onChange={(value) => setDiffOnly(value === "diff")}
                        />
                        <Button
                          size="small"
                          disabled={!compareIds.length}
                          onClick={() => setCompareIds([])}
                        >
                          清空选择
                        </Button>
                      </div>
                      {comparedVersions.length < 2 ? (
                        <p>
                          请在版本列表中勾选 2～8
                          个版本，对比结果将在这里自动生成。
                        </p>
                      ) : comparisonRows.length ? (
                        <div
                          className="strategy-compare-matrix"
                          style={
                            {
                              "--version-count": comparedVersions.length,
                            } as CSSProperties
                          }
                        >
                          <div className="is-head">
                            <strong>参数名称</strong>
                            {comparedVersions.map((version) => (
                              <span key={version.id}>v{version.version}</span>
                            ))}
                            <b>状态</b>
                          </div>
                          {comparisonRows.map((row) => (
                            <div key={row.key}>
                              <code>{row.key}</code>
                              {row.values.map((value, index) => (
                                <span key={comparedVersions[index].id}>
                                  {value === undefined
                                    ? "—"
                                    : JSON.stringify(value)}
                                </span>
                              ))}
                              <b>{row.changed ? "已修改" : "无变化"}</b>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>
                          {diffOnly
                            ? "所选版本的结构与参数完全一致"
                            : "没有符合当前筛选条件的参数"}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="strategy-empty">
                    <SaveOutlined />
                    <strong>选择一个策略资产</strong>
                    <span>查看版本历史并对比结构化参数。</span>
                  </div>
                )}
              </div>
            </div>
          </QuantGlowCard>
        </div>
      </section>
      <Modal
        title="保存策略草稿"
        open={draftModalOpen}
        confirmLoading={savingDraft}
        okText="保存到策略资产库"
        cancelText="取消"
        onOk={() => void saveBuilderDraft()}
        onCancel={() => setDraftModalOpen(false)}
        destroyOnHidden
      >
        <div className="strategy-save-dialog">
          <label>
            策略名称
            <Input
              value={draftName}
              maxLength={60}
              autoFocus
              placeholder="例如：BTC 4小时趋势策略"
              onChange={(event) => setDraftName(event.target.value)}
            />
          </label>
          <label>
            策略说明
            <Input.TextArea
              rows={3}
              maxLength={240}
              placeholder="说明策略目标、适用市场或本次修改内容"
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
            />
          </label>
          <div>
            <span>保存内容</span>
            <p>
              完整策略配置、当前DSL代码和草稿状态将写入SQLite策略资产库，并生成新的不可变版本。
            </p>
          </div>
        </div>
      </Modal>
      <Modal
        title={
          previewVersion
            ? `${assetDetail?.name ?? "策略"} · v${previewVersion.version}`
            : "版本预览"
        }
        open={Boolean(previewVersion)}
        footer={
          <Space>
            <Button onClick={() => setPreviewVersion(null)}>关闭</Button>
            <Button
              type="primary"
              onClick={() => {
                if (previewVersion) openRemoteVersion(previewVersion);
                setPreviewVersion(null);
              }}
            >
              打开编辑
            </Button>
          </Space>
        }
        onCancel={() => setPreviewVersion(null)}
        width={760}
        destroyOnHidden
      >
        {previewVersion && (
          <div className="strategy-version-preview">
            <div className="strategy-preview-meta">
              <span>
                状态<strong>{previewVersion.status}</strong>
              </span>
              <span>
                版本<strong>v{previewVersion.version}</strong>
              </span>
              <span>
                保存时间
                <strong>
                  {new Date(previewVersion.created_at).toLocaleString("zh-CN")}
                </strong>
              </span>
            </div>
            <div>
              <strong>变更说明</strong>
              <p>{previewVersion.change_reason || "无变更说明"}</p>
            </div>
            <div>
              <strong>结构化策略规格</strong>
              <pre>{JSON.stringify(previewVersion.spec, null, 2)}</pre>
            </div>
            <div>
              <strong>DSL代码</strong>
              <pre>{previewVersion.dsl_code}</pre>
            </div>
          </div>
        )}
      </Modal>
    </TradingPageShell>
  );
}
