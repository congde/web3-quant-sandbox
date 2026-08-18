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
  WarningOutlined,
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

type CourseKey = "math" | "backtest" | "kline" | "diagnosis" | "assets" | "risk";

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
  formulaCount?: number;
  chapterCount?: number;
};

const COURSES: Course[] = [
  {
    key: "math",
    title: "量化数学学堂",
    subtitle: "从数学基础到量化模型",
    description: "系统覆盖微积分、线性代数、概率统计、随机过程、回归、时间序列、机器学习、组合优化、期权、执行与 Web3。",
    icon: <CalculatorOutlined />,
    lessons: ["微积分、线代、概率与统计", "推断、回归、时间序列与随机过程", "技术指标、机器学习与组合优化", "期权 Greeks、执行与 Web3"],
    outcome: "能够独立解释收益、波动和概率，不把单个指标当作确定答案。",
    path: "/math-learning",
    action: "进入系统公式课",
    formulaCount: 72,
    chapterCount: 17,
  },
  {
    key: "backtest",
    title: "回测学堂",
    subtitle: "用历史数据检验规则",
    description: "系统学习净值、成本、基准、回撤和交易质量公式，再用样本与偏差方法检验可靠性。",
    icon: <BarChartOutlined />,
    lessons: ["收益、净值与年化公式", "换手、手续费与滑点公式", "基准、绩效与回撤指标", "交易质量、偏差与稳健性"],
    outcome: "能够判断一份回测是否可信，并说清它不能证明什么。",
    path: "/backtest-learning",
    action: "进入回测公式课",
    formulaCount: 28,
    chapterCount: 8,
  },
  {
    key: "kline",
    title: "K线学堂",
    subtitle: "从 OHLCV 到可验证规则",
    description: "通过真实离线行情认识实体、影线、周期、成交量和技术指标。",
    icon: <LineChartOutlined />,
    lessons: ["OHLCV、周期聚合与时间边界", "实体影线、趋势结构与支撑阻力", "量价、动量、波动与通道指标", "形态算法化、数据质量与统计验证"],
    outcome: "能够从数据构造、价格行为和技术指标形成可计算规则，并用样本外证据检验，而不是背诵形态口诀。",
    path: "/kline-learning",
    action: "进入系统 K 线课程",
    formulaCount: 40,
    chapterCount: 10,
  },
  {
    key: "diagnosis",
    title: "诊断分析学堂",
    subtitle: "把观点拆成证据",
    description: "从市场、资金、链上、消息和风险多个维度诊断标的，避免只看单一信号。",
    icon: <FundProjectionScreenOutlined />,
    lessons: ["从观点到可证伪问题", "价格、成交量与市场状态", "资金、链上与基本证据", "消息、事件与时间证据", "冲突证据与诊断结论"],
    outcome: "能够形成带来源、时间和反方证据的诊断记录。",
    path: "/diagnosis-learning",
    action: "进入诊断分析课程",
    chapterCount: 5,
  },
  {
    key: "assets",
    title: "资产管理学堂",
    subtitle: "从单笔交易走向组合",
    description: "学习仓位、分散、相关性、再平衡、回撤预算和组合绩效。",
    icon: <WalletOutlined />,
    lessons: ["目标、期限与约束", "资本配置与风险预算", "分散、相关与集中度", "再平衡、成本与治理", "回撤、绩效与组合复核"],
    outcome: "能够从组合整体评估风险，不让单个标的决定全部结果。",
    path: "/asset-management-learning",
    action: "进入资产管理课程",
    chapterCount: 5,
  },
  {
    key: "risk",
    title: "风控学堂",
    subtitle: "先活下来，再讨论收益",
    description: "系统学习暴露、定仓、盈亏结构、组合集中度、回撤与尾部风险公式，并转化为门禁规则。",
    icon: <WarningOutlined />,
    lessons: ["暴露、权重与杠杆公式", "风险预算与定仓公式", "盈亏结构与组合集中度", "回撤、VaR、CVaR 与熔断"],
    outcome: "能够在下单前计算最坏损失，并说明系统何时应该预警、拒单或熔断。",
    path: "/risk-learning",
    action: "进入风控公式课",
    formulaCount: 29,
    chapterCount: 8,
  },
];

const JOURNEY = [
  { title: "选股 / 选币", subtitle: "学习价格与候选规则", icon: <SearchOutlined />, courseKey: "kline" as CourseKey },
  { title: "诊股 / 诊币", subtitle: "学习证据核验方法", icon: <FundProjectionScreenOutlined />, courseKey: "diagnosis" as CourseKey },
  { title: "交易验证", subtitle: "学习规则与回测", icon: <SwapOutlined />, courseKey: "backtest" as CourseKey },
  { title: "资产管理", subtitle: "学习组合与再平衡", icon: <WalletOutlined />, courseKey: "assets" as CourseKey },
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
              <button type="button" onClick={() => setActiveKey(step.courseKey)}>
                <i>{step.icon}</i>
                <span><strong>{step.title}</strong><small>{step.subtitle}</small></span>
              </button>
              {index < JOURNEY.length - 1 ? <ArrowRightOutlined className="academy-journey-arrow" /> : null}
            </div>
          ))}
        </div>
        <button type="button" className="academy-risk-floor" onClick={() => navigate("/risk-learning")}>
          <SafetyOutlined />
          <strong>风控底座</strong>
          <span>数据质量 · 仓位上限 · 止损纪律 · 回撤控制 · 执行边界</span>
          <ArrowRightOutlined />
        </button>
      </QuantGlowCard>

      <section className="academy-course-section">
        <SectionHeader title="六大学堂" description="六门系统课程全部开放：公式课程讲清定义、历史与边界，应用课程用证据框架、案例推演和知识检查验证理解" />
        <div className="academy-depth-strip">
          <div><strong>169</strong><span>核心公式</span><small>从定义到使用边界</small></div>
          <div><strong>43</strong><span>章节导学</span><small>目标、先修与预计用时</small></div>
          <div><strong>43</strong><span>复算任务</span><small>用小样本验证理解</small></div>
          <div><strong>18</strong><span>权威资料</span><small>教材、论文与官方文档</small></div>
          <div><strong>10</strong><span>应用课程章节</span><small>诊断与资产管理案例</small></div>
        </div>
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
              {course.formulaCount ? <em>{course.chapterCount} 章 · {course.formulaCount} 个公式</em> : course.path ? <em>{course.chapterCount} 章 · 系统课程已开放</em> : <em>课程纲要</em>}
            </button>
          ))}
        </div>
      </section>

      <QuantGlowCard
        className="academy-course-detail"
        title={<SectionHeader title={active.title} description={active.description} />}
        badge={<StatusPill tone="profit">{active.formulaCount ? "系统公式课" : "系统应用课"}</StatusPill>}
      >
        {active.formulaCount ? <div className="academy-formula-strip"><CalculatorOutlined /><strong>系统公式手册</strong><span>{active.chapterCount} 章 · {active.formulaCount} 个核心公式</span><i>导学</i><b>→</b><i>公式</i><b>→</b><i>复算</i><b>→</b><i>来源</i></div> : null}
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
              <Button disabled>完整课程正在补充，本页先学习课程纲要</Button>
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
