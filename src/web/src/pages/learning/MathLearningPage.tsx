import {
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExperimentOutlined,
} from "@ant-design/icons";
import { Button, Segmented, Slider } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "../trading/TradingPageShell";
import { FormulaHandbook } from "./FormulaHandbook";
import { LearningCourseNav } from "./LearningCourseNav";
import "./learning-layout.css";
import "./math-learning.css";

type ResultTone = "safe" | "warn" | "block" | "neutral";

type MathControl = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  suffix?: string;
};

type MathResult = { label: string; value: string; note: string; tone?: ResultTone };

type MathLesson = {
  phase: string;
  title: string;
  short: string;
  question: string;
  overview: string;
  workflow: string[];
  formulas: string[];
  boundary: string;
  controls: MathControl[];
  calculate: (values: Record<string, number>) => MathResult[];
  quiz: { question: string; options: string[]; answer: number; reason: string };
};

const percent = (value: number, digits = 2) => `${value.toFixed(digits)}%`;
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)));
  return sorted[index] ?? 0;
}

const MATH_LESSONS: MathLesson[] = [
  {
    phase: "数值语言",
    title: "尺度、收益与复利",
    short: "先统一单位，再讨论增长",
    question: "为什么先涨 20% 再跌 20% 并没有回到原点？",
    overview: "量化研究首先要统一价格、收益、百分比、基点和年化口径。简单收益适合解释单期持有结果，对数收益便于时间聚合，净值必须按路径复利。",
    workflow: ["确认单位与频率", "从价格生成收益", "按时间递推净值", "再做年化比较"],
    formulas: ["Rₜ = Pₜ / Pₜ₋₁ − 1", "Wealth = ∏ₜ(1 + Rₜ)", "rlog = ln(Pₜ / Pₜ₋₁)"],
    boundary: "不同频率、币种和复权口径不能直接混合；年化是尺度变换，不会增加样本信息。",
    controls: [
      { key: "r1", label: "第一期收益", min: -50, max: 50, step: 1, initial: 20, suffix: "%" },
      { key: "r2", label: "第二期收益", min: -50, max: 50, step: 1, initial: -20, suffix: "%" },
    ],
    calculate: ({ r1, r2 }) => {
      const compounded = ((1 + r1 / 100) * (1 + r2 / 100) - 1) * 100;
      return [
        { label: "简单相加", value: percent(r1 + r2), note: "只作直觉比较，不能代表财富终值", tone: "warn" },
        { label: "复合收益", value: percent(compounded), note: `100 元最终变为 ${(100 * (1 + compounded / 100)).toFixed(2)} 元`, tone: compounded >= 0 ? "safe" : "block" },
        { label: "路径差异", value: percent(compounded - (r1 + r2)), note: "来自收益作用于变化后的本金", tone: "neutral" },
      ];
    },
    quiz: { question: "多期简单收益可以直接相加得到最终财富收益吗？", options: ["始终可以", "不可以，应按每期收益复利连接", "只有亏损时不可以"], answer: 1, reason: "每一期收益作用在更新后的财富上，最终结果应计算收益因子的连乘。" },
  },
  {
    phase: "不确定性",
    title: "概率、期望与完整分布",
    short: "正期望不等于下一次盈利",
    question: "一个胜率不高的策略为什么仍可能有正期望？",
    overview: "概率描述重复条件下的相对频率，期望是分布的加权平均。研究结论必须同时报告期望、离散程度、尾部和样本数量。",
    workflow: ["列出互斥结果", "校验概率和为 1", "计算收益加权期望", "检查尾部与破产条件"],
    formulas: ["E[R] = Σᵢ pᵢRᵢ", "Var(R) = E[(R−μ)²]", "pBE = Loss / (Win + Loss)"],
    boundary: "历史胜率和赔率会随市场状态变化，少量交易的经验概率不等于稳定真实概率。",
    controls: [
      { key: "p", label: "胜率", min: 5, max: 95, step: 1, initial: 42, suffix: "%" },
      { key: "win", label: "平均盈利", min: 0.1, max: 5, step: 0.1, initial: 2, suffix: "R" },
      { key: "loss", label: "平均亏损", min: 0.1, max: 3, step: 0.1, initial: 1, suffix: "R" },
    ],
    calculate: ({ p, win, loss }) => {
      const expectation = p / 100 * win - (1 - p / 100) * loss;
      const breakeven = loss / (win + loss) * 100;
      return [
        { label: "单笔期望", value: `${expectation.toFixed(3)}R`, note: "长期平均，不是下一笔预测", tone: expectation > 0 ? "safe" : "block" },
        { label: "盈亏平衡胜率", value: percent(breakeven, 1), note: "未计手续费和滑点", tone: "neutral" },
        { label: "胜率安全垫", value: percent(p - breakeven, 1), note: "过小意味着参数稍变即失效", tone: p - breakeven >= 5 ? "safe" : "warn" },
      ];
    },
    quiz: { question: "看到正期望后，最稳妥的下一步是什么？", options: ["直接满仓", "继续检查分布、尾部、成本和样本外稳定性", "删除亏损样本"], answer: 1, reason: "期望压缩了完整分布，不能替代尾部和稳定性检查。" },
  },
  {
    phase: "统计推断",
    title: "样本、误差与置信区间",
    short: "估计值必须带不确定性",
    question: "同样 2% 的样本均值，20 个样本和 500 个样本可信度一样吗？",
    overview: "统计推断关心样本结果离总体真值可能有多远。标准误、置信区间、有效样本量和多重检验共同决定证据强度。",
    workflow: ["冻结样本规则", "检查独立性与自相关", "计算估计量和标准误", "报告区间而非单点"],
    formulas: ["SE(x̄) = s / √n", "CI95 ≈ x̄ ± 1.96SE", "Neff ≈ n(1−ρ)/(1+ρ)"],
    boundary: "金融序列常有自相关、异方差和厚尾，普通独立样本区间可能过窄。",
    controls: [
      { key: "mean", label: "样本均值", min: -5, max: 10, step: 0.1, initial: 2, suffix: "%" },
      { key: "sd", label: "样本标准差", min: 1, max: 50, step: 1, initial: 12, suffix: "%" },
      { key: "n", label: "样本数量", min: 10, max: 1000, step: 10, initial: 120 },
      { key: "rho", label: "一阶自相关", min: -0.5, max: 0.9, step: 0.05, initial: 0.25 },
    ],
    calculate: ({ mean, sd, n, rho }) => {
      const neff = Math.max(2, n * (1 - rho) / (1 + rho));
      const se = sd / Math.sqrt(neff);
      const low = mean - 1.96 * se;
      const high = mean + 1.96 * se;
      return [
        { label: "有效样本量", value: neff.toFixed(0), note: `名义样本 ${n.toFixed(0)}`, tone: neff >= 100 ? "safe" : "warn" },
        { label: "均值标准误", value: percent(se), note: "已做 AR(1) 粗略修正", tone: "neutral" },
        { label: "95% 区间", value: `[${low.toFixed(2)}%, ${high.toFixed(2)}%]`, note: low > 0 ? "区间未跨过 0" : "仍包含非正结果", tone: low > 0 ? "safe" : "warn" },
      ];
    },
    quiz: { question: "序列存在正自相关时，直接使用名义样本数会怎样？", options: ["低估标准误", "高估标准误", "没有影响"], answer: 0, reason: "正自相关意味着观测包含重复信息，有效样本量更小，普通标准误通常偏低。" },
  },
  {
    phase: "关系建模",
    title: "相关、回归与因子暴露",
    short: "共同变化不等于因果",
    question: "两个资产相关性很低，是否一定能够稳定分散风险？",
    overview: "协方差和相关描述共同变化，回归把收益拆成系统暴露与残差。研究必须区分描述、预测和因果三类任务。",
    workflow: ["统一时间和频率", "检查散点与异常值", "估计相关和回归", "跨窗口复核稳定性"],
    formulas: ["ρ = Cov(X,Y)/(σXσY)", "R = α + βF + ε", "σp² = wᵀΣw"],
    boundary: "相关会随市场状态改变；遗漏变量、共同趋势和选择窗口都可能制造虚假关系。",
    controls: [
      { key: "wa", label: "资产 A 权重", min: 0, max: 100, step: 1, initial: 50, suffix: "%" },
      { key: "sa", label: "资产 A 波动", min: 1, max: 80, step: 1, initial: 20, suffix: "%" },
      { key: "sb", label: "资产 B 波动", min: 1, max: 80, step: 1, initial: 35, suffix: "%" },
      { key: "rho", label: "两资产相关", min: -1, max: 1, step: 0.05, initial: 0.3 },
    ],
    calculate: ({ wa, sa, sb, rho }) => {
      const a = wa / 100;
      const b = 1 - a;
      const vol = Math.sqrt(a * a * sa * sa + b * b * sb * sb + 2 * a * b * rho * sa * sb);
      const naive = a * sa + b * sb;
      return [
        { label: "组合波动", value: percent(vol), note: "包含协方差影响", tone: vol <= 25 ? "safe" : "warn" },
        { label: "波动加权和", value: percent(naive), note: "忽略分散时的对照值", tone: "neutral" },
        { label: "分散贡献", value: percent(naive - vol), note: rho > 0.7 ? "高相关下分散有限" : "来自不完全同步变化", tone: rho > 0.7 ? "warn" : "safe" },
      ];
    },
    quiz: { question: "相关系数为零能否证明两个变量独立？", options: ["能", "不能，只能说明无线性相关", "样本超过 100 就能"], answer: 1, reason: "变量可能存在非线性依赖，零相关也不代表没有共同风险来源。" },
  },
  {
    phase: "动态模型",
    title: "时间序列与波动更新",
    short: "顺序、滞后和状态不能打乱",
    question: "为什么时间序列不能随机打乱后再做普通交叉验证？",
    overview: "金融数据按时间到达，滞后、结构突变和波动聚集使独立同分布假设失效。滚动窗口和 EWMA 只是动态估计工具，不是永远有效的规律。",
    workflow: ["按时间排序并对齐", "检查差分与滞后", "滚动估计参数", "用未来窗口验证"],
    formulas: ["ΔXₜ = Xₜ − Xₜ₋₁", "ρₖ = Corr(Xₜ,Xₜ₋ₖ)", "σₜ² = λσₜ₋₁² + (1−λ)rₜ₋₁²"],
    boundary: "窗口和衰减率是研究假设；结构变化时，历史估计可能快速失效。",
    controls: [
      { key: "lambda", label: "旧波动权重 λ", min: 0.5, max: 0.99, step: 0.01, initial: 0.94 },
      { key: "previous", label: "前期波动", min: 1, max: 100, step: 1, initial: 25, suffix: "%" },
      { key: "shock", label: "最新收益冲击", min: -30, max: 30, step: 1, initial: -12, suffix: "%" },
    ],
    calculate: ({ lambda, previous, shock }) => {
      const updated = Math.sqrt(lambda * previous * previous + (1 - lambda) * shock * shock);
      return [
        { label: "更新后波动", value: percent(updated), note: "单期 EWMA 更新", tone: updated > previous * 1.1 ? "warn" : "neutral" },
        { label: "最新冲击权重", value: percent((1 - lambda) * 100, 1), note: "λ 越高，响应越慢", tone: "neutral" },
        { label: "风险变化", value: percent(updated - previous), note: shock * shock > previous * previous ? "冲击高于历史波动" : "冲击低于历史波动", tone: updated > previous ? "warn" : "safe" },
      ];
    },
    quiz: { question: "使用全样本均值回填到历史每一时点会造成什么问题？", options: ["降低计算速度", "未来信息泄漏", "增加交易成本"], answer: 1, reason: "全样本统计量包含未来观测，历史时点并不可能知道。" },
  },
  {
    phase: "路径模拟",
    title: "随机过程与蒙特卡洛",
    short: "规则冻结后观察可能路径",
    question: "什么时候才应该使用蒙特卡洛？",
    overview: "当样本、策略规则、成本和依赖结构已经核验后，蒙特卡洛用于研究路径顺序、连亏和尾部范围。它不能修复脏数据，也不能证明未来收益。",
    workflow: ["冻结可信输入", "选择重采样或参数模型", "生成足够多路径", "读取分位与触线率"],
    formulas: ["Wₜ = Wₜ₋₁(1 + Rₜ)", "Pbreach ≈ N触线 / M", "P05 / P50 / P95"],
    boundary: "模拟概率只在输入模型下成立；厚尾、状态切换和交易相关若被忽略，路径数再多也只是精确地重复错误。",
    controls: [
      { key: "p", label: "经验胜率", min: 10, max: 90, step: 1, initial: 46, suffix: "%" },
      { key: "win", label: "盈利幅度", min: 0.1, max: 5, step: 0.1, initial: 1.4, suffix: "%" },
      { key: "loss", label: "亏损幅度", min: 0.1, max: 5, step: 0.1, initial: 1, suffix: "%" },
      { key: "trades", label: "每条路径交易数", min: 30, max: 400, step: 10, initial: 180 },
      { key: "paths", label: "模拟路径数", min: 200, max: 3000, step: 200, initial: 1200 },
    ],
    calculate: ({ p, win, loss, trades, paths }) => {
      const random = seededRandom(20260819);
      const endings: number[] = [];
      const drawdowns: number[] = [];
      let breaches = 0;
      for (let path = 0; path < paths; path += 1) {
        let equity = 100;
        let peak = 100;
        let maxDrawdown = 0;
        for (let trade = 0; trade < trades; trade += 1) {
          equity *= 1 + (random() < p / 100 ? win : -loss) / 100;
          peak = Math.max(peak, equity);
          maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100);
        }
        endings.push(equity - 100);
        drawdowns.push(maxDrawdown);
        if (maxDrawdown >= 20) breaches += 1;
      }
      return [
        { label: "P05 终值收益", value: percent(percentile(endings, 0.05)), note: "偏悲观路径分位", tone: percentile(endings, 0.05) >= 0 ? "safe" : "block" },
        { label: "P50 最大回撤", value: percent(percentile(drawdowns, 0.5)), note: "中位路径风险", tone: percentile(drawdowns, 0.5) < 15 ? "safe" : "warn" },
        { label: "P95 最大回撤", value: percent(percentile(drawdowns, 0.95)), note: "尾部回撤范围", tone: percentile(drawdowns, 0.95) < 20 ? "safe" : "block" },
        { label: "触及 20% 红线", value: percent(breaches / paths * 100, 1), note: "输入模型下的经验频率", tone: breaches / paths < 0.05 ? "safe" : "block" },
      ];
    },
    quiz: { question: "基础样本存在未来函数时，增加蒙特卡洛路径数有用吗？", options: ["有，路径越多越可靠", "没有，只会重复被污染的输入", "只要超过一万条就有用"], answer: 1, reason: "蒙特卡洛依赖输入可信度，无法替代数据和回测时序核验。" },
  },
  {
    phase: "组合决策",
    title: "优化、约束与风险预算",
    short: "最优解首先必须可执行",
    question: "为什么无约束优化经常给出极端权重？",
    overview: "优化器会放大预期收益和协方差中的微小估计误差。可靠决策必须明确目标函数、可行域、集中度、换手和流动性约束。",
    workflow: ["定义决策目标", "估计收益与风险", "加入现实约束", "做参数与成本压力"],
    formulas: ["min wᵀΣw", "RCᵢ = wᵢ(Σw)ᵢ/σp", "fKelly = p − (1−p)/b"],
    boundary: "优化输出不是事实；权重对输入敏感时，应使用收缩、上限、稳健优化或更简单规则。",
    controls: [
      { key: "p", label: "胜率估计", min: 5, max: 95, step: 1, initial: 55, suffix: "%" },
      { key: "odds", label: "净赔率", min: 0.2, max: 5, step: 0.1, initial: 1 },
      { key: "fraction", label: "Kelly 折扣", min: 0.1, max: 1, step: 0.1, initial: 0.5 },
      { key: "cap", label: "仓位硬上限", min: 1, max: 50, step: 1, initial: 15, suffix: "%" },
    ],
    calculate: ({ p, odds, fraction, cap }) => {
      const fullKelly = Math.max(0, p / 100 - (1 - p / 100) / odds) * 100;
      const discounted = fullKelly * fraction;
      const final = Math.min(discounted, cap);
      return [
        { label: "理论 Kelly", value: percent(fullKelly), note: "高度依赖胜率和赔率估计", tone: fullKelly > 30 ? "warn" : "neutral" },
        { label: "折扣后比例", value: percent(discounted), note: `${fraction.toFixed(1)} × Kelly`, tone: "neutral" },
        { label: "约束后仓位", value: percent(final), note: final < discounted ? "由硬上限约束" : "由风险折扣约束", tone: final <= 15 ? "safe" : "warn" },
      ];
    },
    quiz: { question: "优化器输出极端权重时，最先应该检查什么？", options: ["把小数位调多", "输入估计稳定性和现实约束", "删除低权重资产"], answer: 1, reason: "极端结果通常暴露输入误差和约束不足，而不是精度不够。" },
  },
  {
    phase: "预测验证",
    title: "机器学习、损失与泛化",
    short: "训练分数不是研究结论",
    question: "模型样本内准确率很高，为什么仍可能完全不可交易？",
    overview: "机器学习必须从目标定义、可用时点、时间切分、损失函数、概率校准和成本后评价建立完整证据链。复杂度只有在样本外稳定改善时才有价值。",
    workflow: ["冻结标签和可用时点", "按时间切分数据", "只在训练区调参", "最终测试一次并含成本"],
    formulas: ["MSE = mean((y−ŷ)²)", "LogLoss = −mean[ylnp+(1−y)ln(1−p)]", "IC = Corr(score, future return)"],
    boundary: "随机 K-fold、全样本标准化、反复查看测试集和大量试验挑最好结果都会制造虚假泛化。",
    controls: [
      { key: "train", label: "训练集指标", min: -1, max: 1, step: 0.01, initial: 0.32 },
      { key: "test", label: "测试集指标", min: -1, max: 1, step: 0.01, initial: 0.08 },
      { key: "trials", label: "尝试模型数量", min: 1, max: 200, step: 1, initial: 40 },
      { key: "cost", label: "成本侵蚀比例", min: 0, max: 100, step: 1, initial: 35, suffix: "%" },
    ],
    calculate: ({ train, test, trials, cost }) => {
      const decay = train === 0 ? 0 : (train - test) / Math.abs(train) * 100;
      const net = test * (1 - cost / 100);
      return [
        { label: "样本外衰减", value: percent(decay, 1), note: "越高说明训练表现越不可复现", tone: decay <= 30 ? "safe" : "block" },
        { label: "成本后指标", value: net.toFixed(3), note: "用简化比例展示成本侵蚀", tone: net > 0.05 ? "safe" : "warn" },
        { label: "试验搜索压力", value: trials.toFixed(0), note: trials > 20 ? "需要多重检验与完整试验日志" : "仍需保留全部试验", tone: trials > 20 ? "warn" : "neutral" },
      ];
    },
    quiz: { question: "最终测试集可以用来反复挑参数吗？", options: ["可以", "不可以，否则它已经变成训练信息", "模型简单时可以"], answer: 1, reason: "反复查看和选择会让测试结果参与决策，失去独立验证作用。" },
  },
  {
    phase: "非线性风险",
    title: "期权、敏感度与近似误差",
    short: "Greeks 是局部风险快照",
    question: "为什么只看 Delta 无法覆盖大幅行情中的期权风险？",
    overview: "期权价值对标的、波动、期限和利率呈非线性。Delta、Gamma、Vega 等 Greeks 是局部导数，需要随市场变化持续重算。",
    workflow: ["确认合约与价格输入", "计算一阶敏感度", "加入曲率与波动冲击", "用全量重估核对近似"],
    formulas: ["ΔV ≈ Delta·ΔS + ½Gamma·ΔS²", "Vega = ∂V/∂σ", "C − P = S − Ke⁻ʳᵀ"],
    boundary: "大跳跃、临近到期、波动曲面变化和流动性不足时，局部 Greeks 近似可能迅速失效。",
    controls: [
      { key: "delta", label: "Delta", min: -1, max: 1, step: 0.05, initial: 0.55 },
      { key: "gamma", label: "Gamma", min: 0, max: 0.2, step: 0.005, initial: 0.04 },
      { key: "move", label: "标的价格变化", min: -20, max: 20, step: 1, initial: -8 },
      { key: "contracts", label: "合约数量", min: 1, max: 100, step: 1, initial: 10 },
    ],
    calculate: ({ delta, gamma, move, contracts }) => {
      const linear = delta * move * contracts;
      const convex = 0.5 * gamma * move * move * contracts;
      const total = linear + convex;
      return [
        { label: "Delta 近似", value: linear.toFixed(2), note: "只含一阶价格敏感度", tone: linear >= 0 ? "safe" : "block" },
        { label: "Gamma 修正", value: convex.toFixed(2), note: "曲率项随价格变化平方放大", tone: "neutral" },
        { label: "二阶近似损益", value: total.toFixed(2), note: "大幅行情仍应全量重估", tone: total >= 0 ? "safe" : "block" },
      ];
    },
    quiz: { question: "Greeks 在建仓后是否保持不变？", options: ["保持不变", "不会，会随价格、波动和时间变化", "只有 Delta 会变"], answer: 1, reason: "Greeks 是当前状态下的局部导数，市场和时间变化都会改变它们。" },
  },
  {
    phase: "可执行性",
    title: "执行成本与 Web3 机制",
    short: "信号必须穿过真实市场",
    question: "为什么中间价上的正收益不一定能够成交？",
    overview: "研究信号要转换成订单并穿过点差、深度、冲击、手续费、资金费、Gas、MEV 和预言机机制，最终才是可获得的净结果。",
    workflow: ["定义真实订单规模", "读取点差和深度", "估计全部执行成本", "压力测试拥堵与抢跑"],
    formulas: ["NetEdge = GrossEdge − Fees − Slippage − Impact", "VWAP = ΣPQ/ΣQ", "x·y = k"],
    boundary: "历史成交价不是策略可获得价格；链上模拟还要考虑区块排序、失败交易、Gas 波动和协议状态。",
    controls: [
      { key: "edge", label: "信号毛优势", min: -2, max: 5, step: 0.05, initial: 1.2, suffix: "%" },
      { key: "fee", label: "手续费", min: 0, max: 2, step: 0.05, initial: 0.15, suffix: "%" },
      { key: "slippage", label: "滑点与冲击", min: 0, max: 5, step: 0.05, initial: 0.45, suffix: "%" },
      { key: "web3", label: "Gas / MEV / 资金费", min: 0, max: 5, step: 0.05, initial: 0.25, suffix: "%" },
    ],
    calculate: ({ edge, fee, slippage, web3 }) => {
      const totalCost = fee + slippage + web3;
      const net = edge - totalCost;
      return [
        { label: "总执行成本", value: percent(totalCost), note: "简化为同一收益口径", tone: totalCost > edge * 0.5 ? "warn" : "neutral" },
        { label: "成本后优势", value: percent(net), note: net > 0 ? "仍需样本外验证" : "毛优势已被成本吞噬", tone: net > 0 ? "safe" : "block" },
        { label: "优势保留率", value: edge > 0 ? percent(finite(net / edge * 100)) : "—", note: "压力情景下应再次计算", tone: edge > 0 && net / edge >= 0.5 ? "safe" : "warn" },
      ];
    },
    quiz: { question: "回测只按中间价成交会主要遗漏什么？", options: ["点差、深度、冲击和订单可得性", "公式字体", "K 线颜色"], answer: 0, reason: "中间价通常不是可直接成交的价格，大额订单还会消耗深度并产生冲击。" },
  },
];

function MathWorkbench({ lesson }: { lesson: MathLesson }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(lesson.controls.map((control) => [control.key, control.initial])));
  const results = useMemo(() => lesson.calculate(values), [lesson, values]);

  return <section className="math-workbench">
    <header><ExperimentOutlined /><div><strong>交互复算台</strong><span>调整输入，观察结论和边界如何变化</span></div></header>
    <div className="math-controls">{lesson.controls.map((control) => <label key={control.key}><span>{control.label}<b>{values[control.key]}{control.suffix}</b></span><Slider min={control.min} max={control.max} step={control.step} value={values[control.key]} onChange={(value) => setValues((current) => ({ ...current, [control.key]: value }))} /></label>)}</div>
    <div className="math-results">{results.map((result) => <div key={result.label} className={`math-result math-result-${result.tone ?? "neutral"}`}><span>{result.label}</span><strong>{result.value}</strong><small>{result.note}</small></div>)}</div>
  </section>;
}

function MathQuiz({ lesson }: { lesson: MathLesson }) {
  const [answer, setAnswer] = useState<number | null>(null);
  return <section className="math-inline-quiz">
    <header><div><strong>本课理解检查</strong><span>确认你掌握的是使用边界，而不只是公式结果</span></div><StatusPill tone="ai">1 题</StatusPill></header>
    <strong className="math-quiz-question">{lesson.quiz.question}</strong>
    <div className="math-quiz-options">{lesson.quiz.options.map((option, index) => <button type="button" key={option} className={answer === index ? (index === lesson.quiz.answer ? "correct" : "wrong") : ""} onClick={() => setAnswer(index)}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{answer === index ? (index === lesson.quiz.answer ? <CheckCircleFilled /> : <CloseCircleFilled />) : null}</button>)}</div>
    {answer !== null ? <div className={`math-quiz-feedback ${answer === lesson.quiz.answer ? "correct" : "wrong"}`}><strong>{answer === lesson.quiz.answer ? "判断正确" : "再检查一次边界"}</strong><span>{lesson.quiz.reason}</span></div> : null}
  </section>;
}

export default function MathLearningPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"course" | "handbook">("course");
  const [lessonIndex, setLessonIndex] = useState(0);
  const lesson = MATH_LESSONS[lessonIndex];

  function move(index: number) {
    setViewMode("course");
    setLessonIndex(Math.max(0, Math.min(MATH_LESSONS.length - 1, index)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <TradingPageShell
    eyebrow="QUANT MATH · CONCEPT → CALCULATION → VALIDATION → DECISION"
    title="量化数学学堂"
    description="先通过 10 课方法主线理解数学工具解决什么问题、如何复算、何时失效，再进入 17 类、72 个公式的独立手册查阅细节。"
    actions={<><Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button><Button onClick={() => navigate("/backtest-learning")}>继续回测方法</Button></>}
    aside={<QuantGlowCard className="math-progress-card"><span>{viewMode === "course" ? "数学方法进度" : "公式参考手册"}</span><strong>{viewMode === "course" ? `${lessonIndex + 1} / ${MATH_LESSONS.length}` : "17 类 · 72 式"}</strong>{viewMode === "course" ? <div><i style={{ width: `${(lessonIndex + 1) / MATH_LESSONS.length * 100}%` }} /></div> : null}<small>{viewMode === "course" ? `${lesson.phase} · ${lesson.title}` : "导学 · 公式 · 复算 · 来源"}</small></QuantGlowCard>}
  >
    <LearningCourseNav />
    <section className="learning-full-width">
      <main className="math-learning-main">
        <section className="math-view-switch" aria-label="量化数学学堂内容视图"><div><strong>{viewMode === "course" ? "方法课程" : "公式手册"}</strong><span>{viewMode === "course" ? "从研究问题进入计算、验证和决策" : "按 17 类主题检索 72 个公式及来源"}</span></div><Segmented value={viewMode} onChange={(value) => setViewMode(value as "course" | "handbook")} options={[{ label: "方法课程", value: "course" }, { label: "公式手册", value: "handbook" }]} /></section>
        {viewMode === "course" ? <>
          <QuantGlowCard className="math-course-map" title={<SectionHeader title="量化数学决策链" description="不是按难度背公式，而是按研究工作中出现问题的顺序学习" />} badge={<StatusPill tone="neutral">10 课主线</StatusPill>}><nav aria-label="数学课程目录">{MATH_LESSONS.map((item, index) => <button type="button" key={item.title} className={lessonIndex === index ? "active" : ""} onClick={() => move(index)} aria-current={lessonIndex === index ? "step" : undefined}><b>{String(index + 1).padStart(2, "0")}</b><span><small>{item.phase}</small><strong>{item.title}</strong><em>{item.short}</em></span><ArrowRightOutlined /></button>)}</nav></QuantGlowCard>
          <QuantGlowCard title={<SectionHeader title={lesson.title} description={lesson.short} />} badge={<StatusPill tone="ai">{lesson.phase}</StatusPill>}>
            <div className="math-lesson-grid"><section className="math-method-copy"><span className="math-question">本课问题</span><h3>{lesson.question}</h3><p>{lesson.overview}</p><div className="math-workflow">{lesson.workflow.map((step, index) => <span key={step}><b>{String(index + 1).padStart(2, "0")}</b>{step}</span>)}</div><div className="math-formula-strip">{lesson.formulas.map((formula) => <code key={formula}>{formula}</code>)}</div><div className="math-boundary">{lesson.boundary}</div></section><MathWorkbench key={lesson.title} lesson={lesson} /></div>
            <MathQuiz key={`quiz-${lesson.title}`} lesson={lesson} />
          </QuantGlowCard>
          <div className="math-lesson-actions"><Button disabled={lessonIndex === 0} onClick={() => move(lessonIndex - 1)}>上一课</Button>{lessonIndex < MATH_LESSONS.length - 1 ? <Button type="primary" onClick={() => move(lessonIndex + 1)}>下一课 <ArrowRightOutlined /></Button> : <Button type="primary" onClick={() => setViewMode("handbook")}>进入公式手册 <ArrowRightOutlined /></Button>}</div>
        </> : <FormulaHandbook domain="math" />}
      </main>
    </section>
  </TradingPageShell>;
}
