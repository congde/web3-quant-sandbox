import type { KlineCandle } from "../../types";

export type KlineStudySeries = {
  label: string;
  values: Array<number | null>;
  color: string;
  scale: "price" | "indicator" | "volume";
};

export type KlineStudyMarker = {
  index: number;
  label: string;
  color: string;
  position: "aboveBar" | "belowBar";
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
};

export type KlineStudy = {
  formulaName: string;
  visualTitle: string;
  explanation: string;
  currentLabel: string;
  currentValue: string;
  series: KlineStudySeries[];
  markers: KlineStudyMarker[];
  showVolume: boolean;
};

export type KlineStudyParameterKey = "window" | "threshold" | "multiplier" | "horizon";
export type KlineStudyParameters = Partial<Record<KlineStudyParameterKey, number>>;
export type KlineStudyControl = {
  key: KlineStudyParameterKey;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
};

const WINDOW_DEFAULTS: Record<string, number> = {
  "简单移动平均 SMA": 20,
  "指数移动平均 EMA": 20,
  "结构高低点": 20,
  "滚动阻力": 20,
  "滚动支撑": 20,
  "突破距离": 20,
  "通道宽度": 20,
  "成交量均线": 20,
  "量比": 20,
  "变化率 ROC": 10,
  "相对强弱 RSI": 14,
  "随机指标 %K": 14,
  "平均真实波幅 ATR": 14,
  "归一化 ATR": 14,
  "布林带": 20,
};

export function getDefaultKlineStudyParameters(formulaName: string): KlineStudyParameters {
  const result: KlineStudyParameters = {};
  if (WINDOW_DEFAULTS[formulaName]) result.window = WINDOW_DEFAULTS[formulaName];
  if (formulaName === "突破距离") result.threshold = .5;
  if (formulaName === "布林带") result.multiplier = 2;
  if (formulaName === "十字星规则") result.threshold = .1;
  if (formulaName === "锤子线规则") { result.threshold = .35; result.multiplier = 2; }
  if (formulaName === "吞没规则") result.threshold = 0;
  if (formulaName === "条件远期收益") { result.threshold = .1; result.horizon = 5; }
  if (formulaName === "形态命中率与期望") { result.threshold = .1; result.horizon = 1; }
  return result;
}

export function getKlineStudyControls(formulaName: string): KlineStudyControl[] {
  const controls: KlineStudyControl[] = [];
  if (WINDOW_DEFAULTS[formulaName]) controls.push({ key: "window", label: "回看窗口 n", min: 3, max: 60, step: 1, suffix: "根" });
  if (formulaName === "突破距离") controls.push({ key: "threshold", label: "突破确认阈值", min: 0, max: 2, step: .1, suffix: "ATR" });
  if (["十字星规则", "锤子线规则", "条件远期收益", "形态命中率与期望"].includes(formulaName)) controls.push({ key: "threshold", label: "实体占比上限", min: .02, max: .5, step: .01, suffix: "" });
  if (formulaName === "锤子线规则") controls.push({ key: "multiplier", label: "下影/实体倍数", min: 1, max: 5, step: .25, suffix: "×" });
  if (formulaName === "布林带") controls.push({ key: "multiplier", label: "标准差倍数 k", min: 1, max: 4, step: .25, suffix: "σ" });
  if (["条件远期收益", "形态命中率与期望"].includes(formulaName)) controls.push({ key: "horizon", label: "远期观察 h", min: 1, max: 20, step: 1, suffix: "根" });
  return controls;
}

const nullable = (values: number[]) => values.map((value) => Number.isFinite(value) ? value : null);
const safeDiv = (a: number, b: number) => b === 0 ? 0 : a / b;
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function rolling(values: number[], window: number, reducer: (sample: number[]) => number) {
  return values.map((_, index) => index + 1 < window ? null : reducer(values.slice(index + 1 - window, index + 1)));
}

function sma(values: number[], window: number) {
  return rolling(values, window, mean);
}

function ema(values: number[], window: number) {
  const alpha = 2 / (window + 1);
  let previous = values[0] ?? 0;
  return values.map((value, index) => {
    previous = index === 0 ? value : alpha * value + (1 - alpha) * previous;
    return previous;
  });
}

function std(values: number[]) {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function trueRanges(candles: KlineCandle[]) {
  return candles.map((candle, index) => index === 0
    ? candle.high - candle.low
    : Math.max(candle.high - candle.low, Math.abs(candle.high - candles[index - 1].close), Math.abs(candle.low - candles[index - 1].close)));
}

function wilder(values: number[], window: number) {
  let previous = values[0] ?? 0;
  return values.map((value, index) => {
    previous = index === 0 ? value : ((window - 1) * previous + value) / window;
    return previous;
  });
}

function format(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "样本不足";
  const digits = Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 10 ? 2 : 4;
  return `${value.toFixed(digits)}${suffix}`;
}

function marker(index: number, label: string, color: string, position: KlineStudyMarker["position"] = "aboveBar", shape: KlineStudyMarker["shape"] = "circle"): KlineStudyMarker {
  return { index, label, color, position, shape };
}

export function buildKlineStudy(candles: KlineCandle[], formulaName: string, selectedIndex: number, parameters: KlineStudyParameters = {}): KlineStudy {
  const opens = candles.map((item) => item.open);
  const highs = candles.map((item) => item.high);
  const lows = candles.map((item) => item.low);
  const closes = candles.map((item) => item.close);
  const volumes = candles.map((item) => item.volume);
  const bodies = candles.map((item) => Math.abs(item.close - item.open));
  const ranges = candles.map((item) => item.high - item.low);
  const uppers = candles.map((item) => item.high - Math.max(item.open, item.close));
  const lowers = candles.map((item) => Math.min(item.open, item.close) - item.low);
  const index = Math.max(0, Math.min(selectedIndex, candles.length - 1));
  const chosen = candles[index];
  const settings = { ...getDefaultKlineStudyParameters(formulaName), ...parameters };
  const period = Math.max(2, Math.round(settings.window ?? 20));
  const threshold = settings.threshold ?? .1;
  const multiplier = settings.multiplier ?? 2;
  const horizon = Math.max(1, Math.round(settings.horizon ?? 1));
  const base = (visualTitle: string, explanation: string, currentLabel: string, currentValue: string, series: KlineStudySeries[] = [], markers: KlineStudyMarker[] = [], showVolume = false): KlineStudy => ({
    formulaName, visualTitle, explanation, currentLabel, currentValue, series, markers, showVolume,
  });
  const line = (label: string, values: Array<number | null>, color: string, scale: KlineStudySeries["scale"] = "indicator"): KlineStudySeries => ({ label, values, color, scale });
  if (!chosen) return base("等待样本", "加载行情后显示公式结果。", "当前值", "—");

  switch (formulaName) {
    case "实体长度":
      return base("实体长度序列", "副图逐根计算 |C−O|，标记当前被解剖的 K 线。", "当前实体", format(bodies[index]), [line("实体长度", nullable(bodies), "#22c55e")], [marker(index, `实体 ${format(bodies[index])}`, "#22c55e")]);
    case "上下影线":
      return base("上下影线对比", "副图分别展示上影与下影长度，避免只凭蜡烛颜色判断。", "上影 / 下影", `${format(uppers[index])} / ${format(lowers[index])}`, [line("上影", nullable(uppers), "#f59e0b"), line("下影", nullable(lowers), "#22d3ee")], [marker(index, "影线样本", "#22d3ee")]);
    case "振幅": {
      const values = candles.map((item) => safeDiv(item.high - item.low, item.open) * 100);
      return base("振幅百分比", "副图把最高最低范围除以开盘价，显示不同价格尺度下的相对波动。", "当前振幅", format(values[index], "%"), [line("振幅 %", nullable(values), "#a78bfa")], [marker(index, `${format(values[index], "%")}`, "#a78bfa")]);
    }
    case "典型价格": {
      const values = candles.map((item) => (item.high + item.low + item.close) / 3);
      return base("典型价格轨迹", "青色价格线是每根 K 线的 (H+L+C)/3，不等同于真实 VWAP。", "当前 TP", format(values[index]), [line("TP", nullable(values), "#22d3ee", "price")], [marker(index, "TP 样本", "#22d3ee")]);
    }
    case "聚合开盘":
      return base("周期开盘轨迹", "突出每根聚合柱的首笔价格；切换右上角周期会重新请求并聚合样本。", "当前开盘", format(chosen.open), [line("Open", nullable(opens), "#38bdf8", "price")], [marker(index, "窗口首值", "#38bdf8")]);
    case "聚合高低":
      return base("聚合最高与最低", "两条边界线分别连接各聚合窗口的最高价和最低价。", "最高 / 最低", `${format(chosen.high)} / ${format(chosen.low)}`, [line("High", nullable(highs), "#f97316", "price"), line("Low", nullable(lows), "#22c55e", "price")], [marker(index, "窗口极值", "#f97316")]);
    case "聚合收盘":
      return base("周期收盘轨迹", "收盘线连接每个窗口的末值；未收盘柱的末值仍会变化。", "当前收盘", format(chosen.close), [line("Close", nullable(closes), "#60a5fa", "price")], [marker(index, "窗口末值", "#60a5fa")]);
    case "聚合成交量":
      return base("周期成交量", "底部柱对应当前周期内成交量之和，切换周期后柱数和量级都会改变。", "当前成交量", format(chosen.volume), [], [marker(index, "量聚合", "#22d3ee")], true);
    case "实体占比": {
      const values = bodies.map((value, i) => safeDiv(value, ranges[i]) * 100);
      return base("实体占总振幅比例", "副图把实体标准化到 0–100%，便于跨周期比较。", "当前实体占比", format(values[index], "%"), [line("BodyRatio", nullable(values), "#22c55e")], [marker(index, "实体比例", "#22c55e")]);
    }
    case "收盘位置 CLV": {
      const values = candles.map((item) => safeDiv((item.close - item.low) - (item.high - item.close), item.high - item.low));
      return base("CLV 收盘位置", "副图范围为 −1 到 1：越接近 1，收盘越靠近本柱最高。", "当前 CLV", format(values[index]), [line("CLV", nullable(values), "#22d3ee")], [marker(index, "CLV", "#22d3ee")]);
    }
    case "上影线占比": {
      const values = uppers.map((value, i) => safeDiv(value, ranges[i]) * 100);
      return base("上影线占比", "橙线显示上影线占整根振幅的比例。", "当前上影占比", format(values[index], "%"), [line("UpperRatio", nullable(values), "#f59e0b")], [marker(index, "上影比例", "#f59e0b")]);
    }
    case "下影线占比": {
      const values = lowers.map((value, i) => safeDiv(value, ranges[i]) * 100);
      return base("下影线占比", "青线显示下影线占整根振幅的比例。", "当前下影占比", format(values[index], "%"), [line("LowerRatio", nullable(values), "#22d3ee")], [marker(index, "下影比例", "#22d3ee")]);
    }
    case "单期收盘收益": {
      const values = closes.map((value, i) => i === 0 ? 0 : (value / closes[i - 1] - 1) * 100);
      return base("相邻收盘收益", "副图计算 Cₜ/Cₜ₋₁−1，展示每根柱相对前收的变化。", "当前收益", format(values[index], "%"), [line("Return %", nullable(values), "#a78bfa")], [marker(index, "本期收益", values[index] >= 0 ? "#22c55e" : "#ef4444", values[index] >= 0 ? "belowBar" : "aboveBar")]);
    }
    case "简单移动平均 SMA": {
      const values = sma(closes, period);
      return base(`SMA${period} 价格叠加`, `蓝线是最近 ${period} 根收盘价的等权均值。`, `当前 SMA${period}`, format(values[index]), [line(`SMA${period}`, values, "#60a5fa", "price")], [marker(index, "SMA 样本", "#60a5fa")]);
    }
    case "指数移动平均 EMA": {
      const values = ema(closes, period);
      return base(`EMA${period} 价格叠加`, `橙线按 n=${period} 提高近期收盘权重，但仍然只使用历史价格。`, `当前 EMA${period}`, format(values[index]), [line(`EMA${period}`, nullable(values), "#f59e0b", "price")], [marker(index, "EMA 样本", "#f59e0b")]);
    }
    case "结构高低点": {
      const lookback = period;
      const hits = candles.flatMap((item, i) => {
        if (i < lookback) return [];
        const pastHigh = Math.max(...highs.slice(i - lookback, i));
        const pastLow = Math.min(...lows.slice(i - lookback, i));
        if (item.high > pastHigh) return [marker(i, "HH", "#22c55e", "aboveBar", "arrowUp")];
        if (item.low < pastLow) return [marker(i, "LL", "#ef4444", "belowBar", "arrowDown")];
        return [];
      });
      return base("HH / LL 结构标记", `图中只标记突破此前 ${lookback} 根高点或低点的柱。`, "当前结构", hits.some((item) => item.index === index) ? hits.find((item) => item.index === index)?.label ?? "—" : "非新高低", [], hits);
    }
    case "滚动阻力":
    case "滚动支撑":
    case "通道宽度":
    case "突破距离": {
      const resistance = highs.map((_, i) => i < period ? null : Math.max(...highs.slice(i - period, i)));
      const support = lows.map((_, i) => i < period ? null : Math.min(...lows.slice(i - period, i)));
      if (formulaName === "滚动阻力") return base(`${period} 期滚动阻力`, `橙线只使用当前柱之前 ${period} 根最高价。`, "当前阻力", format(resistance[index]), [line("Resistance", resistance, "#f97316", "price")], [marker(index, "阻力观察", "#f97316")]);
      if (formulaName === "滚动支撑") return base(`${period} 期滚动支撑`, `绿线只使用当前柱之前 ${period} 根最低价。`, "当前支撑", format(support[index]), [line("Support", support, "#22c55e", "price")], [marker(index, "支撑观察", "#22c55e")]);
      if (formulaName === "通道宽度") {
        const width = resistance.map((high, i) => high == null || support[i] == null ? null : safeDiv(high - support[i]!, (high + support[i]!) / 2) * 100);
        return base("滚动通道与宽度", "价格图显示上下边界，副图显示通道相对中点的宽度。", "当前通道宽度", format(width[index], "%"), [line("Resistance", resistance, "#f97316", "price"), line("Support", support, "#22c55e", "price"), line("Width %", width, "#a78bfa")], [marker(index, "通道样本", "#a78bfa")]);
      }
      const atr = wilder(trueRanges(candles), 14);
      const breakout = resistance.map((value, i) => value == null ? null : safeDiv(closes[i] - value, atr[i]));
      const hits = breakout.flatMap((value, i) => value != null && value > threshold ? [marker(i, `${value.toFixed(2)} ATR`, "#22c55e", "aboveBar", "arrowUp")] : []);
      return base("ATR 标准化突破", `橙线是 ${period} 期历史阻力；超过 ${threshold.toFixed(1)} ATR 的收盘突破会在图上标记。`, "当前突破距离", format(breakout[index], " ATR"), [line("Resistance", resistance, "#f97316", "price"), line("Breakout ATR", breakout, "#22d3ee")], hits);
    }
    case "成交量均线": {
      const values = sma(volumes, period);
      return base(`成交量与 VMA${period}`, `成交量柱上叠加最近 ${period} 根的平均成交量。`, `当前 VMA${period}`, format(values[index]), [line(`VMA${period}`, values, "#22d3ee", "volume")], [marker(index, "均量样本", "#22d3ee")], true);
    }
    case "量比": {
      const average = sma(volumes, period);
      const values = volumes.map((value, i) => i === 0 || average[i - 1] == null ? null : safeDiv(value, average[i - 1]!));
      return base("当前量 / 历史均量", `副图展示量比；1 表示等于此前 ${period} 根平均成交量。`, "当前量比", format(values[index], "×"), [line("VolumeRatio", values, "#22d3ee")], [marker(index, "量比样本", "#22d3ee")], true);
    }
    case "成交量加权均价 VWAP": {
      let amount = 0;
      let volume = 0;
      const values = candles.map((item) => { amount += ((item.high + item.low + item.close) / 3) * item.volume; volume += item.volume; return safeDiv(amount, volume); });
      return base("锚定样本起点的 VWAP", "青线按典型价格与成交量累计，是 OHLCV 近似而非逐笔 VWAP。", "当前近似 VWAP", format(values[index]), [line("VWAP", nullable(values), "#22d3ee", "price")], [marker(index, "VWAP 样本", "#22d3ee")], true);
    }
    case "能量潮 OBV": {
      let total = 0;
      const values = closes.map((value, i) => { if (i > 0) total += Math.sign(value - closes[i - 1]) * volumes[i]; return total; });
      return base("OBV 累积方向量", "副图按收盘涨跌方向累加或扣减成交量。", "当前 OBV", format(values[index]), [line("OBV", nullable(values), "#a78bfa")], [marker(index, "OBV 样本", "#a78bfa")], true);
    }
    case "变化率 ROC": {
      const values = closes.map((value, i) => i < period ? null : (value / closes[i - period] - 1) * 100);
      return base(`ROC${period} 动量`, `副图显示当前收盘相对 ${period} 根前的百分比变化。`, `当前 ROC${period}`, format(values[index], "%"), [line(`ROC${period}`, values, "#a78bfa")], [marker(index, "ROC 样本", "#a78bfa")]);
    }
    case "相对强弱 RSI": {
      const changes = closes.map((value, i) => i === 0 ? 0 : value - closes[i - 1]);
      const gains = wilder(changes.map((value) => Math.max(value, 0)), period);
      const losses = wilder(changes.map((value) => Math.max(-value, 0)), period);
      const values = gains.map((gain, i) => losses[i] === 0 ? 100 : 100 - 100 / (1 + gain / losses[i]));
      return base(`RSI${period} 震荡指标`, "副图展示 Wilder 平滑后的相对涨跌强度；高于 70 不等于自动做空。", `当前 RSI${period}`, format(values[index]), [line(`RSI${period}`, nullable(values), "#a78bfa")], [marker(index, "RSI 样本", "#a78bfa")]);
    }
    case "随机指标 %K": {
      const highN = rolling(highs, period, (sample) => Math.max(...sample));
      const lowN = rolling(lows, period, (sample) => Math.min(...sample));
      const values = closes.map((value, i) => highN[i] == null || lowN[i] == null ? null : safeDiv(value - lowN[i]!, highN[i]! - lowN[i]!) * 100);
      return base(`Stochastic %K (${period})`, `副图显示收盘在最近 ${period} 根最高最低区间中的位置。`, "当前 %K", format(values[index]), [line("%K", values, "#22d3ee")], [marker(index, "%K 样本", "#22d3ee")]);
    }
    case "MACD": {
      const fast = ema(closes, 12);
      const slow = ema(closes, 26);
      const macd = fast.map((value, i) => value - slow[i]);
      const signal = ema(macd, 9);
      return base("MACD 与信号线", "副图同时展示 EMA12−EMA26 及其 9 期 EMA。", "MACD / Signal", `${format(macd[index])} / ${format(signal[index])}`, [line("MACD", nullable(macd), "#60a5fa"), line("Signal", nullable(signal), "#f59e0b")], [marker(index, "MACD 样本", "#60a5fa")]);
    }
    case "真实波幅 TR": {
      const values = trueRanges(candles);
      return base("真实波幅 TR", "副图取本柱振幅及相对前收跳空距离中的最大值。", "当前 TR", format(values[index]), [line("TR", nullable(values), "#f97316")], [marker(index, "TR 样本", "#f97316")]);
    }
    case "平均真实波幅 ATR": {
      const values = wilder(trueRanges(candles), period);
      return base(`ATR${period} 动态波动`, "副图对 TR 做 Wilder 平滑，输出绝对价格单位的波动尺度。", `当前 ATR${period}`, format(values[index]), [line(`ATR${period}`, nullable(values), "#f97316")], [marker(index, "ATR 样本", "#f97316")]);
    }
    case "归一化 ATR": {
      const atr = wilder(trueRanges(candles), period);
      const values = atr.map((value, i) => safeDiv(value, closes[i]) * 100);
      return base("NATR 百分比波动", "副图把 ATR 除以收盘价，便于跨价格尺度比较。", "当前 NATR", format(values[index], "%"), [line("NATR", nullable(values), "#f97316")], [marker(index, "NATR 样本", "#f97316")]);
    }
    case "布林带": {
      const middle = sma(closes, period);
      const deviation = rolling(closes, period, std);
      const upper = middle.map((value, i) => value == null || deviation[i] == null ? null : value + multiplier * deviation[i]!);
      const lower = middle.map((value, i) => value == null || deviation[i] == null ? null : value - multiplier * deviation[i]!);
      return base("布林带价格通道", `价格图显示 SMA${period} 以及上下 ${multiplier} 倍滚动标准差。`, "中轨 / 上轨 / 下轨", `${format(middle[index])} / ${format(upper[index])} / ${format(lower[index])}`, [line("Middle", middle, "#60a5fa", "price"), line("Upper", upper, "#a78bfa", "price"), line("Lower", lower, "#a78bfa", "price")], [marker(index, "布林样本", "#a78bfa")]);
    }
    case "十字星规则":
    case "锤子线规则":
    case "吞没规则": {
      const matches = candles.flatMap((item, i) => {
        const bodyRatio = safeDiv(bodies[i], ranges[i]);
        const isDoji = bodyRatio <= threshold;
        const isHammer = lowers[i] >= multiplier * bodies[i] && uppers[i] <= .5 * bodies[i] && bodyRatio <= threshold;
        const previous = candles[i - 1];
        const isEngulf = Boolean(previous && item.close > item.open && previous.close < previous.open && item.open <= previous.close && item.close >= previous.open);
        const hit = formulaName === "十字星规则" ? isDoji : formulaName === "锤子线规则" ? isHammer : isEngulf;
        return hit ? [marker(i, formulaName.replace("规则", ""), formulaName === "锤子线规则" ? "#22c55e" : "#a78bfa", "belowBar", formulaName === "锤子线规则" ? "arrowUp" : "circle")] : [];
      });
      return base(`${formulaName}命中标记`, `图中只标记满足当前数值条件的样本；阈值调整后重新计算全部 ${candles.length} 根。`, "当前柱", matches.some((item) => item.index === index) ? "满足条件" : "不满足条件", [], matches);
    }
    case "条件远期收益": {
      const values = closes.map((value, i) => i + horizon >= closes.length ? null : (closes[i + horizon] / value - 1) * 100);
      const hits = bodies.flatMap((body, i) => safeDiv(body, ranges[i]) <= threshold ? [marker(i, "条件样本", "#a78bfa", "belowBar")] : []);
      return base(`条件样本与 ${horizon} 期远期收益`, `标记实体占比≤${threshold.toFixed(2)} 的候选，并展示其后 ${horizon} 期收益；末端因未来未知而为空。`, "当前远期收益", format(values[index], "%"), [line(`Forward ${horizon}`, values, "#a78bfa")], hits);
    }
    case "OHLC 合法性": {
      const invalid = candles.flatMap((item, i) => item.high < Math.max(item.open, item.close) || item.low > Math.min(item.open, item.close) || item.high < item.low || item.volume < 0 ? [marker(i, "无效 OHLC", "#ef4444", "aboveBar", "square")] : []);
      return base("OHLC 数据约束检查", "红色方块标记不满足 H≥max(O,C)、L≤min(O,C)、H≥L、V≥0 的记录。", "当前记录", invalid.some((item) => item.index === index) ? "不合法" : "通过基本约束", [], invalid.length ? invalid : [marker(index, "✓ 合法", "#22c55e", "belowBar", "square")]);
    }
    case "缺失率": {
      const expected = candles.length > 1 ? Math.round((candles.at(-1)!.tsSec - candles[0].tsSec) / Math.max(1, candles[1].tsSec - candles[0].tsSec)) + 1 : candles.length;
      const missing = Math.max(0, expected - candles.length);
      return base("时间网格完整性", "图上标记当前样本末端，并根据相邻时间戳估计应有柱数。", "缺失率", format(safeDiv(missing, expected) * 100, "%"), [], [marker(index, `${missing}/${expected} 缺失`, missing ? "#ef4444" : "#22c55e", "aboveBar", "square")]);
    }
    case "信号滞后": {
      const signalIndex = Math.max(0, index - 1);
      return base("信号确认与下一期持仓", "紫色标记 t−1 已确认信号，绿色标记 t 才能使用的仓位，明确禁止同柱偷看。", "当前时序", `信号第 ${signalIndex + 1} 根 → 持仓第 ${index + 1} 根`, [], [marker(signalIndex, "Signal t−1", "#a78bfa", "aboveBar", "circle"), marker(index, "Position t", "#22c55e", "belowBar", "arrowUp")]);
    }
    case "形态命中率与期望": {
      const isPattern = bodies.map((body, i) => safeDiv(body, ranges[i]) <= threshold);
      const forward = closes.map((value, i) => i + horizon >= closes.length ? null : (closes[i + horizon] / value - 1) * 100);
      const samples = forward.filter((value, i): value is number => isPattern[i] && value != null);
      const hitRate = samples.length ? samples.filter((value) => value > 0).length / samples.length * 100 : 0;
      const expectancy = mean(samples);
      const hits = isPattern.flatMap((hit, i) => hit ? [marker(i, "Pattern", "#a78bfa", "belowBar")] : []);
      return base("形态样本的命中与期望", `以实体占比≤${threshold.toFixed(2)} 作条件，图上标记样本，副图展示 ${horizon} 期后收益。`, "命中率 / 平均收益", `${format(hitRate, "%")} / ${format(expectancy, "%")}`, [line(`Forward ${horizon}`, forward, "#a78bfa")], hits);
    }
    default:
      return base("当前公式样本定位", "选择公式后，这里会切换到对应的价格叠加、指标副图或条件标记。", "当前收盘", format(chosen.close), [], [marker(index, formulaName || "当前样本", "#22d3ee")], true);
  }
}
