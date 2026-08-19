import {
  ArrowRightOutlined,
  BarChartOutlined,
  BookOutlined,
  BulbOutlined,
  CalculatorOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  CodeOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SwapOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Alert, Button, Drawer, Progress, Select, Tag } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { QuantGlowCard, SectionHeader, StatusPill, TradingPageShell } from "../trading/TradingPageShell";
import { LearningCourseNav } from "./LearningCourseNav";
import { getAlgorithmDetail } from "./MachineLearningAlgorithmDetails";
import { getAlgorithmPractice } from "./MachineLearningPracticeProfiles";
import { getWorkedExample } from "./MachineLearningWorkedExamples";
import { ML_ALGORITHM_COUNT, ML_LESSONS, ML_STATUS_META, type MLAlgorithm, type MLAlgorithmStatus, type MLLesson } from "./MachineLearningCurriculum";
import "./learning-layout.css";
import "./machine-learning.css";

const MASTERY_KEY = "machine-learning-mastery:v1";

const ROUTER_TASKS = [
  { label: "方向 / 事件概率", value: "classification" },
  { label: "连续收益 / 风险", value: "regression" },
  { label: "市场状态识别", value: "regime" },
  { label: "资产结构发现", value: "discovery" },
  { label: "预测不确定性", value: "uncertainty" },
] as const;

type RouterTask = typeof ROUTER_TASKS[number]["value"];
type AlgorithmContext = { algorithm: MLAlgorithm; lesson: MLLesson };

const ROUTER_BASE: Record<RouterTask, Array<{ name: string; why: string; status: MLAlgorithmStatus }>> = {
  classification: [
    { name: "Logistic regression", why: "透明概率基准，便于校准和阈值决策", status: "engine" },
    { name: "朴素贝叶斯", why: "小样本下快速建立生成式基准", status: "engine" },
    { name: "Gradient boosting", why: "捕捉阈值和非线性交互", status: "engine" },
  ],
  regression: [
    { name: "Ridge regression", why: "稳定高相关量价特征的连续预测", status: "engine" },
    { name: "Elastic Net", why: "兼顾稀疏选择与相关特征组", status: "lab" },
    { name: "Gaussian process", why: "样本不大时同时估计均值与不确定性", status: "lab" },
  ],
  regime: [
    { name: "Gaussian mixture", why: "先检验多峰状态的静态基准", status: "lab" },
    { name: "Hidden Markov model", why: "显式描述状态持续和切换", status: "lab" },
    { name: "Kalman filter", why: "在线估计连续动态状态", status: "lab" },
  ],
  discovery: [
    { name: "PCA / SVD", why: "压缩共同变化并建立低维基准", status: "lab" },
    { name: "Spectral / hierarchical clustering", why: "发现非球形或层级资产结构", status: "lab" },
    { name: "Graphical lasso", why: "探索稀疏条件依赖网络", status: "theory" },
  ],
  uncertainty: [
    { name: "Bootstrap", why: "估计统计量的采样不确定性", status: "engine" },
    { name: "Gaussian process", why: "产生预测后验而不是单一点值", status: "lab" },
    { name: "Metropolis-Hastings", why: "复杂后验无法解析计算时进行 MCMC 抽样近似", status: "lab" },
  ],
};

function readMastery() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const saved = JSON.parse(window.localStorage.getItem(MASTERY_KEY) ?? "[]");
    const valid = new Set(ML_LESSONS.map((lesson) => lesson.id));
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string" && valid.has(item)) : [];
  } catch {
    return [];
  }
}

function LabSlider({ label, value, min, max, step = 1, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="ml-lab-slider"><span>{label}<b>{value}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function LessonLab({ lesson }: { lesson: MLLesson }) {
  const [a, setA] = useState(60);
  const [b, setB] = useState(30);
  const [c, setC] = useState(20);
  let title = "教学实验";
  let note = "这里展示算法关系和参数敏感性，不使用未来行情，也不产生交易建议。";
  let controls: ReactNode;
  let metrics: Array<{ label: string; value: string | number; detail: string; tone?: "profit" | "loss" | "neutral" }>;

  if (lesson.labKind === "contract") {
    const samples = 120 + a * 8;
    const horizon = Math.max(1, Math.round(b / 10));
    const validationPct = 10 + Math.round(c / 2);
    const validation = Math.round(samples * validationPct / 100);
    const holdout = Math.round(samples * 0.2);
    const train = samples - validation - holdout - horizon * 2;
    title = "时间样本合同计算器";
    controls = <><LabSlider label="总样本" value={samples} min={120} max={920} onChange={(value) => setA((value - 120) / 8)} /><LabSlider label="预测期" value={horizon} min={1} max={10} suffix=" bars" onChange={(value) => setB(value * 10)} /><LabSlider label="验证集" value={validationPct} min={10} max={50} suffix="%" onChange={(value) => setC((value - 10) * 2)} /></>;
    metrics = [
      { label: "发现集有效样本", value: train, detail: "扣除两处分段 purge" },
      { label: "验证集", value: validation, detail: "只负责模型选择" },
      { label: "最终留出", value: holdout, detail: "冠军确定后报告一次" },
      { label: "边界 purge", value: `${horizon} × 2`, detail: "避免标签跨越边界" },
    ];
  } else if (lesson.labKind === "bayes") {
    const prior = a / 100;
    const sensitivity = 0.55 + b / 250;
    const falsePositive = 0.05 + c / 200;
    const posterior = prior * sensitivity / Math.max(1e-9, prior * sensitivity + (1 - prior) * falsePositive);
    title = "Bayes 基础率更新器";
    controls = <><LabSlider label="事件先验" value={a} min={5} max={80} suffix="%" onChange={setA} /><LabSlider label="真事件触发率" value={Math.round(sensitivity * 100)} min={55} max={95} suffix="%" onChange={(value) => setB((value - 55) * 2.5)} /><LabSlider label="误触发率" value={Math.round(falsePositive * 100)} min={5} max={55} suffix="%" onChange={(value) => setC((value - 5) * 2)} /></>;
    metrics = [
      { label: "触发后验", value: `${(posterior * 100).toFixed(1)}%`, detail: "P(事件 | 信号)", tone: posterior >= 0.6 ? "profit" : "neutral" },
      { label: "先验赔率", value: (prior / (1 - prior)).toFixed(2), detail: "基础发生率不能省略" },
      { label: "似然比", value: (sensitivity / falsePositive).toFixed(2), detail: "信号带来的证据强度" },
      { label: "概率增量", value: `${((posterior - prior) * 100).toFixed(1)}pp`, detail: "不是收益率" },
    ];
  } else if (lesson.labKind === "linear") {
    const z = (a - 50) / 15;
    const weight = b / 20;
    const threshold = 0.5 + c / 250;
    const probability = 1 / (1 + Math.exp(-(z * weight)));
    const action = probability >= threshold ? "LONG" : probability <= 1 - threshold ? "SHORT" : "WAIT";
    title = "Logistic 分数与阈值";
    controls = <><LabSlider label="特征 z-score" value={Number(z.toFixed(1))} min={-3.3} max={3.3} step={0.1} onChange={(value) => setA(value * 15 + 50)} /><LabSlider label="模型权重" value={Number(weight.toFixed(2))} min={0} max={5} step={0.05} onChange={(value) => setB(value * 20)} /><LabSlider label="行动阈值" value={Math.round(threshold * 100)} min={50} max={90} suffix="%" onChange={(value) => setC((value - 50) * 2.5)} /></>;
    metrics = [
      { label: "线性分数", value: (z * weight).toFixed(3), detail: "wᵀx" },
      { label: "上涨概率", value: `${(probability * 100).toFixed(1)}%`, detail: "仍需校准" },
      { label: "决策", value: action, detail: "阈值控制交易频率", tone: action === "WAIT" ? "neutral" : "profit" },
      { label: "阈值余量", value: `${((probability - threshold) * 100).toFixed(1)}pp`, detail: "小于 0 时不满足做多" },
    ];
  } else if (lesson.labKind === "generative") {
    const separation = a / 25;
    const missing = b;
    const restarts = Math.max(1, Math.round(c / 5));
    const stability = Math.max(0, Math.min(100, 40 + separation * 18 - missing * 0.55 + Math.log2(restarts + 1) * 8));
    title = "混合状态可识别性";
    controls = <><LabSlider label="状态均值间距" value={Number(separation.toFixed(1))} min={0.4} max={4} step={0.1} suffix="σ" onChange={(value) => setA(value * 25)} /><LabSlider label="缺失比例" value={missing} min={0} max={70} suffix="%" onChange={setB} /><LabSlider label="EM 重启次数" value={restarts} min={1} max={20} onChange={(value) => setC(value * 5)} /></>;
    metrics = [
      { label: "状态稳定度", value: `${stability.toFixed(0)}%`, detail: "教学代理分，不是统计检验", tone: stability >= 70 ? "profit" : "neutral" },
      { label: "重叠风险", value: separation < 1.5 ? "高" : separation < 2.5 ? "中" : "低", detail: "间距越小越难区分" },
      { label: "局部最优审计", value: restarts >= 8 ? "充分" : "不足", detail: "比较多次初始化" },
      { label: "输出形式", value: "软概率", detail: "不要把状态硬编码为牛熊" },
    ];
  } else if (lesson.labKind === "sparse") {
    const featureCount = 20 + a;
    const sampleCount = 80 + b * 8;
    const lambda = c / 20;
    const active = Math.max(1, Math.round(featureCount * Math.exp(-lambda * 0.7)));
    const ratio = sampleCount / active;
    title = "稀疏选择自由度";
    controls = <><LabSlider label="候选特征" value={featureCount} min={20} max={120} onChange={(value) => setA(value - 20)} /><LabSlider label="训练样本" value={sampleCount} min={80} max={880} onChange={(value) => setB((value - 80) / 8)} /><LabSlider label="正则强度 λ" value={Number(lambda.toFixed(2))} min={0} max={5} step={0.05} onChange={(value) => setC(value * 20)} /></>;
    metrics = [
      { label: "活动特征", value: active, detail: "教学收缩曲线" },
      { label: "样本 / 自由度", value: ratio.toFixed(1), detail: "越高通常越稳", tone: ratio >= 10 ? "profit" : "neutral" },
      { label: "被收缩比例", value: `${((1 - active / featureCount) * 100).toFixed(0)}%`, detail: "需检查跨窗口选择频率" },
      { label: "建议", value: ratio < 5 ? "继续降维" : "滚动复核", detail: "不能按一次入选定论" },
    ];
  } else if (lesson.labKind === "kernel") {
    const distance = a / 20;
    const length = Math.max(0.2, b / 20);
    const noise = c / 100;
    const similarity = Math.exp(-(distance ** 2) / (2 * length ** 2));
    const uncertainty = Math.min(1, noise + (1 - similarity) * 0.75);
    title = "RBF 相似性与不确定性";
    controls = <><LabSlider label="样本距离" value={Number(distance.toFixed(2))} min={0} max={5} step={0.05} onChange={(value) => setA(value * 20)} /><LabSlider label="长度尺度" value={Number(length.toFixed(2))} min={0.2} max={5} step={0.05} onChange={(value) => setB(value * 20)} /><LabSlider label="观测噪声" value={c} min={0} max={80} suffix="%" onChange={setC} /></>;
    metrics = [
      { label: "RBF 相似度", value: similarity.toFixed(3), detail: "k(x,x′)" },
      { label: "不确定性代理", value: `${(uncertainty * 100).toFixed(1)}%`, detail: "远离样本或噪声高时上升", tone: uncertainty < 0.35 ? "profit" : "neutral" },
      { label: "局部性", value: length < 1 ? "很强" : length < 2.5 ? "适中" : "平滑", detail: "长度尺度决定有效邻域" },
      { label: "行动", value: uncertainty > 0.6 ? "拒绝 / 缩量" : "允许复核", detail: "不确定性应进入决策" },
    ];
  } else if (lesson.labKind === "ensemble") {
    const depth = Math.max(1, Math.round(a / 12));
    const trees = 10 + b * 3;
    const learningRate = Math.max(0.02, c / 200);
    const capacity = depth * Math.log2(trees + 1) * learningRate;
    const train = Math.min(99, 55 + capacity * 11);
    const gap = Math.max(2, capacity * 5 + Math.max(0, depth - 4) * 2);
    const validation = Math.max(50, train - gap);
    title = "Boosting 容量与泛化差距";
    controls = <><LabSlider label="树深" value={depth} min={1} max={8} onChange={(value) => setA(value * 12)} /><LabSlider label="树数量" value={trees} min={10} max={310} onChange={(value) => setB((value - 10) / 3)} /><LabSlider label="学习率" value={Number(learningRate.toFixed(2))} min={0.02} max={0.5} step={0.01} onChange={(value) => setC(value * 200)} /></>;
    metrics = [
      { label: "训练分", value: `${train.toFixed(1)}%`, detail: "教学容量代理" },
      { label: "验证分", value: `${validation.toFixed(1)}%`, detail: "必须按时间计算" },
      { label: "泛化差距", value: `${gap.toFixed(1)}pp`, detail: "越大越需简化", tone: gap < 10 ? "profit" : "loss" },
      { label: "审计建议", value: gap > 15 ? "降深度/轮数" : "继续 WFO", detail: "复杂度不是免费收益" },
    ];
  } else if (lesson.labKind === "regime") {
    const stayBull = 0.5 + a / 200;
    const bearToBull = b / 200;
    const evidence = (c - 50) / 12.5;
    const predicted = 0.55 * stayBull + 0.45 * bearToBull;
    const odds = predicted / Math.max(1e-9, 1 - predicted) * Math.exp(evidence);
    const filtered = odds / (1 + odds);
    title = "两状态过滤器";
    controls = <><LabSlider label="牛态保持率" value={Math.round(stayBull * 100)} min={50} max={100} suffix="%" onChange={(value) => setA((value - 50) * 2)} /><LabSlider label="熊→牛概率" value={Math.round(bearToBull * 100)} min={0} max={50} suffix="%" onChange={(value) => setB(value * 2)} /><LabSlider label="今日观测证据" value={Number(evidence.toFixed(1))} min={-4} max={4} step={0.1} onChange={(value) => setC(value * 12.5 + 50)} /></>;
    metrics = [
      { label: "转移后先验", value: `${(predicted * 100).toFixed(1)}%`, detail: "看今日观测之前" },
      { label: "过滤后牛态", value: `${(filtered * 100).toFixed(1)}%`, detail: "可用于当前决策", tone: filtered > 0.65 ? "profit" : "neutral" },
      { label: "期望持续期", value: `${(1 / Math.max(0.01, 1 - stayBull)).toFixed(1)} bars`, detail: "1 / (1-pₛₜₐᵧ)" },
      { label: "动作", value: filtered < 0.35 ? "防守" : filtered > 0.65 ? "进攻" : "中性", detail: "使用概率而非硬标签" },
    ];
  } else if (lesson.labKind === "monte") {
    const draws = 500 + a * 195;
    const rho = Math.min(0.95, b / 100);
    const sigma = c / 100;
    const ess = draws * (1 - rho) / (1 + rho);
    const se = sigma / Math.sqrt(Math.max(1, ess));
    title = "MCMC 有效样本量";
    controls = <><LabSlider label="链长度" value={draws} min={500} max={20000} onChange={(value) => setA((value - 500) / 195)} /><LabSlider label="滞后相关 ρ" value={Number(rho.toFixed(2))} min={0} max={0.95} step={0.01} onChange={(value) => setB(value * 100)} /><LabSlider label="统计量标准差" value={c} min={1} max={80} suffix="%" onChange={setC} /></>;
    metrics = [
      { label: "有效样本量 ESS", value: ess.toFixed(0), detail: "链长不等于信息量", tone: ess >= 1000 ? "profit" : "neutral" },
      { label: "信息利用率", value: `${(ess / draws * 100).toFixed(1)}%`, detail: "相关越高越低" },
      { label: "MC 标准误", value: `${(se * 100).toFixed(2)}%`, detail: "σ / √ESS" },
      { label: "建议", value: ess < 400 ? "改善混合" : "检查多链", detail: "不能只延长单链" },
    ];
  } else {
    const silhouette = (a - 50) / 50;
    const stability = b / 100;
    const turnover = c / 100;
    const evidence = Math.max(0, (silhouette + 1) / 2 * 0.35 + stability * 0.45 + (1 - turnover) * 0.2);
    title = "结构发现入库闸门";
    controls = <><LabSlider label="轮廓系数" value={Number(silhouette.toFixed(2))} min={-1} max={1} step={0.02} onChange={(value) => setA(value * 50 + 50)} /><LabSlider label="跨窗口稳定性" value={b} min={0} max={100} suffix="%" onChange={setB} /><LabSlider label="结构换手" value={c} min={0} max={100} suffix="%" onChange={setC} /></>;
    metrics = [
      { label: "综合证据分", value: `${(evidence * 100).toFixed(1)}`, detail: "教学闸门，不是收益概率", tone: evidence >= 0.7 ? "profit" : "neutral" },
      { label: "结构分离", value: silhouette > 0.5 ? "清晰" : silhouette > 0.2 ? "一般" : "弱", detail: "仍需外部标签验证" },
      { label: "可复现性", value: stability >= 0.7 ? "较高" : "不足", detail: "跨初始化与窗口" },
      { label: "结论", value: evidence >= 0.75 ? "进入外部验证" : "继续研究", detail: "不能直接进入交易" },
    ];
  }

  return (
    <section className="ml-concept-lab">
      <header><div><span>INTERACTIVE LAB</span><strong>{title}</strong><small>{note}</small></div><ExperimentOutlined /></header>
      <div className="ml-lab-body"><div className="ml-lab-controls">{controls}</div><div className="ml-lab-metrics">{metrics.map((metric) => <article key={metric.label} className={metric.tone ? `is-${metric.tone}` : undefined}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}</div></div>
    </section>
  );
}

function AlgorithmRouter({ onOpen }: { onOpen: (name: string) => void }) {
  const [task, setTask] = useState<RouterTask>("classification");
  const [samples, setSamples] = useState(300);
  const [features, setFeatures] = useState(30);
  const [needsUncertainty, setNeedsUncertainty] = useState(false);
  const recommendations = useMemo(() => {
    const rows = [...ROUTER_BASE[task]];
    if (features > samples / 5 && !rows.some((row) => row.name.includes("Ridge"))) rows.unshift({ name: "PCA / Elastic Net", why: "特征相对样本过多，先控制有效自由度", status: "lab" });
    if (samples < 250) rows.unshift({ name: "简单正则化基准", why: "小样本优先控制方差与可解释性", status: "engine" });
    if (needsUncertainty && !rows.some((row) => row.name.includes("Gaussian process"))) rows.push({ name: "Bootstrap / Gaussian process", why: "补充采样或预测不确定性", status: "lab" });
    return rows.slice(0, 4);
  }, [features, needsUncertainty, samples, task]);
  return (
    <QuantGlowCard className="ml-router-card" title={<SectionHeader title="算法路由器" description="从任务和数据约束出发推荐模型族；不按流行度选算法。" />}>
      <div className="ml-router-form">
        <label><span>研究任务</span><Select value={task} options={[...ROUTER_TASKS]} onChange={setTask} /></label>
        <LabSlider label="训练样本" value={samples} min={80} max={3000} step={20} onChange={setSamples} />
        <LabSlider label="特征数量" value={features} min={3} max={300} onChange={setFeatures} />
        <label className="ml-router-check"><input type="checkbox" checked={needsUncertainty} onChange={(event) => setNeedsUncertainty(event.target.checked)} /><span>决策必须显式报告不确定性</span></label>
      </div>
      <div className="ml-router-output">
        {recommendations.map((row, index) => <button type="button" aria-label={`查看 ${row.name} 的模型档案`} onClick={() => onOpen(row.name)} key={`${row.name}-${index}`}><b>0{index + 1}</b><div><strong>{row.name}</strong><p>{row.why}</p></div><Tag className={`ml-status-${row.status}`}>{ML_STATUS_META[row.status].label}</Tag><span>查看原理与用法 <ArrowRightOutlined /></span></button>)}
      </div>
      <footer><SafetyCertificateOutlined /> 推荐的是研究起点。最终选择必须由按时间样本外表现、成本、稳定性和可解释边界共同决定。</footer>
    </QuantGlowCard>
  );
}

function ModelComparisonLab({ contexts, onOpen }: { contexts: AlgorithmContext[]; onOpen: (name: string) => void }) {
  const [leftName, setLeftName] = useState("Ridge regression");
  const [rightName, setRightName] = useState("Gradient boosting");
  const left = contexts.find((item) => item.algorithm.name === leftName) ?? contexts[0];
  const right = contexts.find((item) => item.algorithm.name === rightName) ?? contexts[1];
  if (!left || !right) return null;
  const leftDetail = getAlgorithmDetail(left.algorithm, left.lesson);
  const rightDetail = getAlgorithmDetail(right.algorithm, right.lesson);
  const leftPractice = getAlgorithmPractice(left.algorithm, left.lesson);
  const rightPractice = getAlgorithmPractice(right.algorithm, right.lesson);
  const options = contexts.map(({ algorithm, lesson }) => ({ value: algorithm.name, label: `${algorithm.name} · ${lesson.number}章`, searchText: `${algorithm.name} ${algorithm.purpose} ${lesson.title}` }));
  const rows = [
    { label: "解决问题", left: leftDetail.question, right: rightDetail.question },
    { label: "核心公式", left: leftDetail.equation, right: rightDetail.equation, formula: true },
    { label: "输入要求", left: leftPractice.dataContract, right: rightPractice.dataContract },
    { label: "关键参数", left: leftPractice.parameters.join(" · "), right: rightPractice.parameters.join(" · ") },
    { label: "验证重点", left: leftPractice.evaluation.join(" · "), right: rightPractice.evaluation.join(" · ") },
    { label: "主要边界", left: leftDetail.boundary, right: rightDetail.boundary },
  ];

  const swap = () => {
    setLeftName(right.algorithm.name);
    setRightName(left.algorithm.name);
  };

  return (
    <QuantGlowCard className="ml-compare-card" title={<SectionHeader title="模型比较台" description="同一数据不等于同一问题；并排比较后再决定谁应成为基准、候选或被拒绝。" />} badge={<StatusPill tone="neutral">任意两模型</StatusPill>}>
      <div className="ml-compare-selectors">
        <label><span>模型 A</span><Select showSearch optionFilterProp="searchText" value={left.algorithm.name} options={options} onChange={setLeftName} /></label>
        <Button aria-label="交换左右模型" icon={<SwapOutlined />} onClick={swap}>交换</Button>
        <label><span>模型 B</span><Select showSearch optionFilterProp="searchText" value={right.algorithm.name} options={options} onChange={setRightName} /></label>
      </div>
      <div className="ml-compare-head">
        <article><div><strong>{left.algorithm.name}</strong><Tag className={`ml-status-${left.algorithm.status}`}>{ML_STATUS_META[left.algorithm.status].label}</Tag></div><p>{left.algorithm.purpose}</p><Button type="link" onClick={() => onOpen(left.algorithm.name)}>打开完整档案 <ArrowRightOutlined /></Button></article>
        <span>VS</span>
        <article><div><strong>{right.algorithm.name}</strong><Tag className={`ml-status-${right.algorithm.status}`}>{ML_STATUS_META[right.algorithm.status].label}</Tag></div><p>{right.algorithm.purpose}</p><Button type="link" onClick={() => onOpen(right.algorithm.name)}>打开完整档案 <ArrowRightOutlined /></Button></article>
      </div>
      <div className="ml-compare-table" role="table" aria-label={`${left.algorithm.name} 与 ${right.algorithm.name} 对比`}>
        {rows.map((row) => <div role="row" key={row.label}><b role="rowheader">{row.label}</b><p role="cell" className={row.formula ? "formula" : undefined}>{row.left}</p><p role="cell" className={row.formula ? "formula" : undefined}>{row.right}</p></div>)}
      </div>
      <div className="ml-compare-decision"><article><span>A 更适合在</span><p>{leftDetail.useWhen}</p></article><article><span>B 更适合在</span><p>{rightDetail.useWhen}</p></article></div>
    </QuantGlowCard>
  );
}

function AlgorithmDetailDrawer({ selected, onClose, onSelect }: { selected: AlgorithmContext | null; onClose: () => void; onSelect: (name: string) => void }) {
  const detail = selected ? getAlgorithmDetail(selected.algorithm, selected.lesson) : null;
  const practice = selected ? getAlgorithmPractice(selected.algorithm, selected.lesson) : null;
  const workedExample = selected ? getWorkedExample(selected.algorithm.name) : null;
  const related = selected?.lesson.algorithms.filter((item) => item.name !== selected.algorithm.name).slice(0, 4) ?? [];

  return (
    <Drawer
      className="ml-model-drawer"
      open={selected !== null}
      onClose={onClose}
      width="min(780px, 100vw)"
      title={selected ? <div className="ml-model-drawer-title"><span>{selected.lesson.number} · {selected.lesson.title}</span><strong>{selected.algorithm.name}</strong></div> : null}
    >
      {detail && practice && workedExample && selected ? (
        <div className="ml-model-detail">
          <section className="ml-model-hero">
            <div><Tag className={`ml-status-${selected.algorithm.status}`}>{ML_STATUS_META[selected.algorithm.status].label}</Tag><span>{detail.era}</span></div>
            <strong>{detail.question}</strong>
            <p>{selected.algorithm.purpose}</p>
          </section>

          <nav className="ml-model-reading-path" aria-label="模型详情阅读顺序">
            <span><b>01</b>来龙去脉</span><i>→</i><span><b>02</b>原理公式</span><i>→</i><span><b>03</b>怎么使用</span><i>→</i><span><b>04</b>验证效果</span><i>→</i><span><b>05</b>价值边界</span>
          </nav>

          <section className="ml-model-section">
            <header><HistoryOutlined /><div><strong>来龙去脉</strong><span>它为什么出现，解决什么旧问题</span></div></header>
            <p>{detail.origin}</p>
            <div className="ml-model-question"><b>原始问题</b><span>{detail.question}</span></div>
          </section>

          <section className="ml-model-section">
            <header><CalculatorOutlined /><div><strong>核心公式与直觉</strong><span>公式不是装饰：每个符号都要能映射到研究数据</span></div></header>
            <div className="ml-model-equation" aria-label={`${selected.algorithm.name} 核心公式`}>{detail.equation}</div>
            <div className="ml-model-variable-grid">{detail.variables.map((variable) => <span key={variable}>{variable}</span>)}</div>
            <div className="ml-model-intuition"><BulbOutlined /><div><b>不用背公式的理解</b><p>{detail.intuition}</p></div></div>
            <div className="ml-model-derivation"><strong>从问题到公式的推导链</strong><ol>{practice.derivation.map((step, index) => <li key={step}><b>{String(index + 1).padStart(2, "0")}</b><span>{step}</span></li>)}</ol></div>
            <div className="ml-model-worked-example">
              <header><CalculatorOutlined /><div><b>纸上算一遍</b><span>用具体数字检查自己是否真的理解公式</span></div></header>
              <div><article><span>已知条件</span><p>{workedExample.setup}</p></article><article><span>代入公式</span><p>{workedExample.substitution}</p></article><article><span>计算结果</span><strong>{workedExample.result}</strong></article></div>
              <footer><BulbOutlined /><p>{workedExample.interpretation}</p></footer>
            </div>
          </section>

          <section className="ml-model-section">
            <header><ExperimentOutlined /><div><strong>怎么使用</strong><span>从输入契约走到样本外验收</span></div></header>
            <div className="ml-model-use-when"><b>适用条件</b><p>{detail.useWhen}</p></div>
            <ol className="ml-model-steps">
              {detail.workflow.map((step, index) => <li key={step}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{step}</strong><span>{index === 0 ? "只使用决策时点已经可获得的数据，冻结标签与样本边界。" : index === detail.workflow.length - 1 ? "用从未参与调参的时间段复核，并保存参数、数据版本与失败结果。" : "只在训练段拟合这一环节，并把同一处理原样应用到随后验证段。"}</span></div></li>)}
            </ol>
            <div className="ml-model-case">
              <span>量化案例 · {detail.lesson.caseStudy.title}</span>
              <p><b>输入：</b>{detail.lesson.caseStudy.input}</p>
              <p><b>决策：</b>{detail.lesson.caseStudy.decision}</p>
            </div>
          </section>

          <section className="ml-model-section">
            <header><BarChartOutlined /><div><strong>怎样验证效果</strong><span>预测指标、交易价值和稳定性必须分开检查</span></div></header>
            <div className="ml-model-contract-grid">
              <article><span>INPUT · 输入契约</span><p>{practice.dataContract}</p></article>
              <article><span>OUTPUT · 输出契约</span><p>{practice.outputContract}</p></article>
              <article><span>BASELINE · 必比基准</span><p>{practice.baseline}</p></article>
            </div>
            <div className="ml-model-validation-grid">
              <article><strong>关键参数</strong><ul>{practice.parameters.map((item) => <li key={item}>{item}</li>)}</ul></article>
              <article><strong>效果指标</strong><ul>{practice.evaluation.map((item) => <li key={item}>{item}</li>)}</ul></article>
              <article><strong>压力测试</strong><ul>{practice.stressTests.map((item) => <li key={item}>{item}</li>)}</ul></article>
            </div>
            <div className="ml-model-code"><header><CodeOutlined /><div><b>可复制的研究伪代码</b><span>强调时点、折外预测和证据留痕</span></div></header><pre><code>{practice.pseudocode.join("\n")}</code></pre></div>
            <div className="ml-model-acceptance"><CheckCircleFilled /><div><b>进入下一阶段的闸门</b><p>{practice.acceptance}</p></div></div>
          </section>

          <section className="ml-model-section">
            <header><SafetyCertificateOutlined /><div><strong>价值、假设与失效方式</strong><span>知道它能贡献什么，也知道不能证明什么</span></div></header>
            <div className="ml-model-value"><b>研究价值</b><p>{detail.value}</p></div>
            <div className="ml-model-evidence-grid">
              <article><strong><CheckCircleFilled /> 使用前必须成立</strong><ul>{detail.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></article>
              <article><strong><WarningOutlined /> 常见失效方式</strong><ul>{detail.failureModes.map((item) => <li key={item}>{item}</li>)}</ul></article>
            </div>
          </section>

          <Alert
            type="info"
            showIcon
            message="知识来源与能力状态是两件事"
            description={`理论章节：Kevin P. Murphy《Machine Learning: A Probabilistic Perspective》${detail.lesson.book.replace("Murphy ", "")}；${ML_STATUS_META[selected.algorithm.status].description}。即使已有项目实现，也必须重新通过当前数据契约与时间样本外验证。`}
          />

          {related.length ? (
            <section className="ml-model-related">
              <header><strong>同章模型对比</strong><span>不要孤立选模型，先看相邻方法解决问题的差别</span></header>
              <div>{related.map((algorithm) => <button type="button" key={algorithm.name} onClick={() => onSelect(algorithm.name)}><span><b>{algorithm.name}</b><small>{algorithm.purpose}</small></span><Tag className={`ml-status-${algorithm.status}`}>{ML_STATUS_META[algorithm.status].label}</Tag><i>→</i></button>)}</div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export default function MachineLearningPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lessonIndex, setLessonIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>([null, null]);
  const [submitted, setSubmitted] = useState(false);
  const [mastered, setMastered] = useState<string[]>(readMastery);
  const algorithmContexts = useMemo(() => ML_LESSONS.flatMap((item) => item.algorithms.map((algorithm) => ({ algorithm, lesson: item }))), []);
  const selectedModelName = searchParams.get("model");
  const selectedAlgorithm = useMemo(() => algorithmContexts.find((item) => item.algorithm.name === selectedModelName) ?? null, [algorithmContexts, selectedModelName]);
  const lesson = ML_LESSONS[lessonIndex];
  const passed = lesson.quizzes.every((quiz, index) => answers[index] === quiz.answer);
  const progress = Math.round(mastered.length / ML_LESSONS.length * 100);
  const engineCount = algorithmContexts.filter((item) => item.algorithm.status === "engine").length;
  const theoryCount = algorithmContexts.filter((item) => item.algorithm.status === "theory").length;

  useEffect(() => {
    setAnswers(lesson.quizzes.map(() => null));
    setSubmitted(false);
  }, [lesson.id, lesson.quizzes]);

  useEffect(() => {
    if (!selectedAlgorithm) return;
    const index = ML_LESSONS.findIndex((item) => item.id === selectedAlgorithm.lesson.id);
    if (index >= 0 && index !== lessonIndex) setLessonIndex(index);
  }, [lessonIndex, selectedAlgorithm]);

  const selectLesson = (index: number) => {
    setLessonIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openAlgorithmByName = (name: string) => {
    const context = algorithmContexts.find((item) => item.algorithm.name === name);
    if (!context) return;
    const next = new URLSearchParams(searchParams);
    next.set("model", name);
    setSearchParams(next);
  };

  const closeAlgorithm = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("model");
    setSearchParams(next, { replace: true });
  };

  const submit = () => {
    if (answers.some((answer) => answer === null)) return;
    setSubmitted(true);
    if (!passed || mastered.includes(lesson.id)) return;
    const next = [...mastered, lesson.id];
    setMastered(next);
    window.localStorage.setItem(MASTERY_KEY, JSON.stringify(next));
  };

  return (
    <TradingPageShell
      eyebrow="PROBABILISTIC MACHINE LEARNING · QUANT TRACK"
      title="机器学习学堂"
      description="把概率模型、线性方法、稀疏学习、核方法、集成、动态状态与 Monte Carlo，重组成可验证的量化研究能力。"
      actions={<><Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button><Button type="primary" icon={<RobotOutlined />} onClick={() => navigate("/factor-mining")}>打开因子实验室</Button></>}
      aside={<QuantGlowCard className="ml-progress-card"><span>课程掌握进度</span><strong>{mastered.length} / {ML_LESSONS.length} 章</strong><Progress percent={progress} showInfo={false} /><small>完成两题知识检查才记录掌握</small></QuantGlowCard>}
    >
      <LearningCourseNav />
      <main className="learning-full-width ml-learning-page">
        <section className="ml-course-hero">
          <QuantGlowCard className="ml-course-positioning">
            <span>不是算法清单</span>
            <strong>问题 → 数据契约 → 基准 → 模型 → 不确定性 → 样本外 → 决策</strong>
            <p>课程以 Murphy 的概率机器学习体系为知识骨架，但全部案例、交互和验收任务按本项目的量化研究场景重新组织，不复制原书正文。</p>
          </QuantGlowCard>
          <div className="ml-course-stats"><div><b>10</b><span>量化模块</span></div><div><b>{ML_ALGORITHM_COUNT}</b><span>算法条目</span></div><div><b>{engineCount}</b><span>已接项目能力</span></div><div><b>3</b><span>能力等级</span></div></div>
        </section>

        <QuantGlowCard className="ml-knowledge-index" title={<SectionHeader title="模型与公式索引" description="学堂是独立知识库：搜索任一模型，在当前页面阅读完整档案，不跳出课程。" />} badge={<StatusPill tone="neutral">{ML_ALGORITHM_COUNT} 个可打开条目</StatusPill>}>
          <div className="ml-knowledge-search"><SearchOutlined /><Select showSearch allowClear value={selectedAlgorithm?.algorithm.name} placeholder="搜索模型、公式或用途，例如 Monte Carlo、稀疏、状态" optionFilterProp="searchText" onChange={(name) => name ? openAlgorithmByName(name) : closeAlgorithm()} options={algorithmContexts.map(({ algorithm, lesson: item }) => ({ value: algorithm.name, label: `${algorithm.name} · 第 ${item.number} 章`, searchText: `${algorithm.name} ${algorithm.purpose} ${item.title} ${item.short}` }))} /></div>
          <div className="ml-knowledge-index-meta"><span><b>{ML_ALGORITHM_COUNT}</b> 全部都有来龙去脉与公式</span><span><b>{engineCount}</b> 已有相关项目能力</span><span><b>{theoryCount}</b> 理论条目也有完整使用边界</span></div>
        </QuantGlowCard>

        <AlgorithmRouter onOpen={openAlgorithmByName} />

        <ModelComparisonLab contexts={algorithmContexts} onOpen={openAlgorithmByName} />

        <QuantGlowCard className="ml-map-card" title={<SectionHeader title="十章学习地图" description="从研究契约走到动态模型、近似推断和模型治理。" />}>
          <nav className="ml-lesson-map" aria-label="机器学习课程章节">
            {ML_LESSONS.map((item, index) => <button type="button" key={item.id} className={index === lessonIndex ? "active" : undefined} onClick={() => selectLesson(index)} aria-current={index === lessonIndex ? "step" : undefined}><b>{item.number}</b><span><strong>{item.title}</strong><small>{item.short}</small></span>{mastered.includes(item.id) ? <CheckCircleFilled /> : null}</button>)}
          </nav>
        </QuantGlowCard>

        <QuantGlowCard className="ml-lesson-card" title={<SectionHeader title={`${lesson.number} · ${lesson.title}`} description={lesson.short} />} badge={<StatusPill tone="neutral">{lesson.book}</StatusPill>}>
          <section className="ml-lesson-intro"><div><span>本章能力目标</span><strong>{lesson.objective}</strong></div><aside><span>先回答</span><p>{lesson.question}</p></aside></section>

          <section className="ml-section"><SectionHeader title="三个核心概念" description="先掌握问题结构，再进入算法细节。" /><div className="ml-concept-grid">{lesson.concepts.map((concept, index) => <article key={concept.title}><b>0{index + 1}</b><strong>{concept.title}</strong><p>{concept.detail}</p></article>)}</div></section>

          <section className="ml-section"><SectionHeader title="模型与公式档案" description="点击任一条目，在学堂内查看历史来源、核心公式、使用步骤、量化价值与失效边界。" /><div className="ml-algorithm-grid">{lesson.algorithms.map((algorithm) => <button type="button" key={algorithm.name} aria-label={`查看 ${algorithm.name} 的完整知识档案`} onClick={() => openAlgorithmByName(algorithm.name)}><div><strong>{algorithm.name}</strong><Tag className={`ml-status-${algorithm.status}`}>{ML_STATUS_META[algorithm.status].label}</Tag></div><p>{algorithm.purpose}</p><small>{algorithm.route ? "含相关项目实验，但详情首先在学堂内讲清楚" : ML_STATUS_META[algorithm.status].description}</small><span className="ml-algorithm-open"><BookOutlined /> 查看完整讲解 <ArrowRightOutlined /></span></button>)}</div></section>

          <section className="ml-workflow"><span>研究顺序</span>{lesson.workflow.map((step, index) => <div key={step}><b>{index + 1}</b><strong>{step}</strong>{index < lesson.workflow.length - 1 ? <ArrowRightOutlined /> : null}</div>)}</section>

          <LessonLab key={lesson.id} lesson={lesson} />

          <section className="ml-section ml-case-section"><SectionHeader title="量化案例" description={lesson.caseStudy.title} /><div className="ml-case-grid"><article><span>输入</span><p>{lesson.caseStudy.input}</p></article><article><span>可辩护决策</span><p>{lesson.caseStudy.decision}</p></article><article><span>解释边界</span><p>{lesson.caseStudy.boundary}</p></article></div></section>

          <div className="ml-audit-grid"><section><h3><CheckCircleFilled /> 研究检查表</h3><ul>{lesson.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3><CloseCircleFilled /> 常见误区</h3><ul>{lesson.pitfalls.map((item) => <li key={item}>{item}</li>)}</ul></section></div>

          <Alert type="info" showIcon message="知识来源与产品边界" description={`知识骨架：Kevin P. Murphy, Machine Learning: A Probabilistic Perspective，${lesson.book.replace("Murphy ", "")}。课程内容为量化场景的独立重组与教学实现；“进阶理论”不代表仓库已有生产算法。`} />
        </QuantGlowCard>

        <QuantGlowCard className="ml-quiz-card" title={<SectionHeader title="本章知识检查" description="两题全部答对才记录掌握；重点检查边界，而不是背算法名称。" />} badge={mastered.includes(lesson.id) ? <StatusPill tone="profit">已掌握</StatusPill> : <StatusPill tone="neutral">待验证</StatusPill>}>
          <div className="ml-quiz-grid">{lesson.quizzes.map((quiz, quizIndex) => <fieldset key={quiz.question}><legend><b>0{quizIndex + 1}</b>{quiz.question}</legend>{quiz.options.map((option, optionIndex) => { const checked = answers[quizIndex] === optionIndex; const resultClass = submitted && checked ? (optionIndex === quiz.answer ? "correct" : "wrong") : ""; return <label className={resultClass} key={option}><input type="radio" name={`${lesson.id}-${quizIndex}`} checked={checked} onChange={() => { const next = [...answers]; next[quizIndex] = optionIndex; setAnswers(next); setSubmitted(false); }} /><span>{option}</span></label>; })}{submitted ? <p className={answers[quizIndex] === quiz.answer ? "correct" : "wrong"}>{answers[quizIndex] === quiz.answer ? <CheckCircleFilled /> : <CloseCircleFilled />} {quiz.reason}</p> : null}</fieldset>)}</div>
          <div className="ml-quiz-actions"><Button type="primary" disabled={answers.some((answer) => answer === null)} onClick={submit}>提交检查</Button><Button disabled={lessonIndex === 0} onClick={() => selectLesson(lessonIndex - 1)}>上一章</Button>{lessonIndex < ML_LESSONS.length - 1 ? <Button onClick={() => selectLesson(lessonIndex + 1)}>下一章 <ArrowRightOutlined /></Button> : <Button icon={<RobotOutlined />} onClick={() => navigate("/factor-mining")}>进入因子实验室</Button>}</div>
          {submitted && !passed ? <Alert type="warning" showIcon message="还有边界没有掌握" description="查看每题解释后重新作答；错误答案不会记录进度。" /> : null}
        </QuantGlowCard>
      </main>
      <AlgorithmDetailDrawer selected={selectedAlgorithm} onClose={closeAlgorithm} onSelect={openAlgorithmByName} />
    </TradingPageShell>
  );
}
