import {
  ArrowRightOutlined,
  BarChartOutlined,
  CalculatorOutlined,
  FundProjectionScreenOutlined,
  LineChartOutlined,
  ReadOutlined,
  SafetyOutlined,
  SearchOutlined,
  SwapOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import {
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "../trading/TradingPageShell";
import "./academy.css";

type CourseKey = "math" | "backtest" | "kline" | "diagnosis" | "assets";

type Course = {
  key: CourseKey;
  title: string;
  subtitle: string;
  description: string;
  icon: ReactNode;
  lessons: string[];
  outcome: string;
  path?: string;
  action?: string;
};

const COURSES: Course[] = [
  {
    key: "math",
    title: "基础数学学堂",
    subtitle: "读懂数字，不被数字误导",
    description: "从收益率、复利和概率开始，逐步理解均值、方差、相关性与风险调整收益。",
    icon: <CalculatorOutlined />,
    lessons: ["百分比、收益率与复利", "均值、方差与标准差", "概率、条件概率与期望", "相关性不等于因果关系"],
    outcome: "能够独立解释收益、波动和概率，不把单个指标当作确定答案。",
  },
  {
    key: "backtest",
    title: "回测学堂",
    subtitle: "用历史数据检验规则",
    description: "学习样本、基准、手续费、滑点、前视偏差与过拟合，建立可复现的验证习惯。",
    icon: <BarChartOutlined />,
    lessons: ["回测能证明什么", "基准与评价指标", "前视偏差和数据污染", "样本外与稳定性检查"],
    outcome: "能够判断一份回测是否可信，并说清它不能证明什么。",
    path: "/backtests",
    action: "进入回测实验",
  },
  {
    key: "kline",
    title: "K线学堂",
    subtitle: "从 OHLCV 到可验证规则",
    description: "通过真实离线行情认识实体、影线、周期、成交量和技术指标。",
    icon: <LineChartOutlined />,
    lessons: ["认识一根 K 线", "周期与成交量", "组合与技术指标", "从观察到回测规则"],
    outcome: "能够区分价格事实、指标描述与交易推断，并写出无歧义规则。",
    path: "/kline-learning",
    action: "进入互动课程",
  },
  {
    key: "diagnosis",
    title: "诊断分析学堂",
    subtitle: "把观点拆成证据",
    description: "从市场、资金、链上、消息和风险多个维度诊断标的，避免只看单一信号。",
    icon: <FundProjectionScreenOutlined />,
    lessons: ["提出可证伪问题", "价格与量能诊断", "资金、链上和消息证据", "冲突证据与不确定性"],
    outcome: "能够形成带来源、时间和反方证据的诊断记录。",
    path: "/research",
    action: "进入市场情报",
  },
  {
    key: "assets",
    title: "资产管理学堂",
    subtitle: "从单笔交易走向组合",
    description: "学习仓位、分散、相关性、再平衡、回撤预算和组合绩效。",
    icon: <WalletOutlined />,
    lessons: ["目标、期限与风险承受力", "仓位与分散原则", "组合相关性与集中度", "再平衡和回撤管理"],
    outcome: "能够从组合整体评估风险，不让单个标的决定全部结果。",
    path: "/risk",
    action: "查看风控实验",
  },
];

const JOURNEY = [
  { title: "选股 / 选币", subtitle: "建立候选池", icon: <SearchOutlined />, path: "/radar" },
  { title: "诊股 / 诊币", subtitle: "核验证据", icon: <FundProjectionScreenOutlined />, path: "/research" },
  { title: "交易验证", subtitle: "规则与回测", icon: <SwapOutlined />, path: "/backtests" },
  { title: "资产管理", subtitle: "组合与再平衡", icon: <WalletOutlined />, path: "/risk" },
];

export default function AcademyPage() {
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState<CourseKey>("math");
  const active = useMemo(() => COURSES.find((course) => course.key === activeKey) ?? COURSES[0], [activeKey]);

  return (
    <TradingPageShell
      eyebrow="PUBLIC LEARNING · FREE & REPRODUCIBLE"
      title="公益学堂"
      description="面向普通学习者的免费投资研究课程。用固定样本、可运行代码和风险边界，帮助学习者建立自己的判断过程。"
      actions={<Button icon={<ReadOutlined />} onClick={() => setActiveKey("math")}>从基础开始</Button>}
      aside={
        <QuantGlowCard className="academy-public-card" variant="live">
          <div><TeamOutlined /><span>公益教学</span></div>
          <strong>免费开放 · 无需登录</strong>
          <p>不荐股、不承诺收益、不连接真实交易。</p>
        </QuantGlowCard>
      }
    >
      <QuantGlowCard
        className="academy-journey-card"
        title={<SectionHeader title="完整学习路径" description="研究不是猜涨跌，而是一条可复核的决策链" />}
        badge={<StatusPill tone="neutral">风控贯穿全程</StatusPill>}
      >
        <div className="academy-journey">
          {JOURNEY.map((step, index) => (
            <div className="academy-journey-step" key={step.title}>
              <button type="button" onClick={() => navigate(step.path)}>
                <i>{step.icon}</i>
                <span><strong>{step.title}</strong><small>{step.subtitle}</small></span>
              </button>
              {index < JOURNEY.length - 1 ? <ArrowRightOutlined className="academy-journey-arrow" /> : null}
            </div>
          ))}
        </div>
        <button type="button" className="academy-risk-floor" onClick={() => navigate("/risk")}>
          <SafetyOutlined />
          <strong>风控底座</strong>
          <span>数据质量 · 仓位上限 · 止损纪律 · 回撤控制 · 执行边界</span>
          <ArrowRightOutlined />
        </button>
      </QuantGlowCard>

      <section className="academy-course-section">
        <SectionHeader title="五大学堂" description="选择一个主题查看课程内容；K 线学堂已提供互动课程" />
        <div className="academy-course-grid">
          {COURSES.map((course, index) => (
            <button
              type="button"
              key={course.key}
              className={`academy-course-card${activeKey === course.key ? " active" : ""}`}
              onClick={() => setActiveKey(course.key)}
            >
              <span className="academy-course-number">0{index + 1}</span>
              <i>{course.icon}</i>
              <strong>{course.title}</strong>
              <small>{course.subtitle}</small>
              {course.key === "kline" ? <em>互动课已开放</em> : <em>课程纲要</em>}
            </button>
          ))}
        </div>
      </section>

      <QuantGlowCard
        className="academy-course-detail"
        title={<SectionHeader title={active.title} description={active.description} />}
        badge={<StatusPill tone={active.key === "kline" ? "profit" : "ai"}>{active.key === "kline" ? "互动课程" : "学习单元"}</StatusPill>}
      >
        <div className="academy-detail-layout">
          <ol>
            {active.lessons.map((lesson, index) => (
              <li key={lesson}><b>{String(index + 1).padStart(2, "0")}</b><span>{lesson}</span></li>
            ))}
          </ol>
          <aside>
            <span>学完你应该能够</span>
            <p>{active.outcome}</p>
            {active.path ? (
              <Button type="primary" onClick={() => active.path && navigate(active.path)}>{active.action}<ArrowRightOutlined /></Button>
            ) : (
              <Button onClick={() => setActiveKey("kline")}>继续 K 线基础课<ArrowRightOutlined /></Button>
            )}
          </aside>
        </div>
      </QuantGlowCard>

      <section className="academy-principles">
        <div><strong>固定样本</strong><span>断网也能重复课程结果</span></div>
        <div><strong>代码可运行</strong><span>概念对应真实函数和页面</span></div>
        <div><strong>证据可追溯</strong><span>标注来源、窗口与假设</span></div>
        <div><strong>安全边界</strong><span>只做教学和模拟验证</span></div>
      </section>
    </TradingPageShell>
  );
}
