import {
  ArrowRightOutlined,
  BarChartOutlined,
  CalculatorOutlined,
  CodeOutlined,
  CompassOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  FundProjectionScreenOutlined,
  LineChartOutlined,
  ReadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
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

type CourseKey = "math" | "machine" | "backtest" | "kline" | "diagnosis" | "assets" | "risk";

type Course = {
  key: CourseKey;
  title: string;
  subtitle: string;
  track: string;
  description: string;
  icon: ReactNode;
  lessons: string[];
  outcome: string;
  path?: string;
  action?: string;
  formulaCount?: number;
  chapterCount?: number;
  algorithmCount?: number;
};

const COURSES: Course[] = [
  {
    key: "math",
    title: "量化数学学堂",
    subtitle: "从研究问题到数学决策",
    track: "数理基础",
    description: "先通过 10 课交互方法主线理解收益、推断、时间序列、蒙特卡洛、优化和模型验证，再查阅 17 类 72 个公式。",
    icon: <CalculatorOutlined />,
    lessons: ["尺度、复利与概率分布", "样本误差、推断与相关回归", "时间序列与风险蒙特卡洛", "优化、机器学习与样本外泛化", "期权非线性、执行与 Web3"],
    outcome: "能够从问题选择数学工具，独立复算结果，并说明假设、误差和失效边界。",
    path: "/math-learning",
    action: "进入数学方法课",
    formulaCount: 72,
    chapterCount: 17,
  },
  {
    key: "machine",
    title: "机器学习学堂",
    subtitle: "从概率模型到动态推断",
    track: "模型研究",
    description: "以 Murphy 的概率机器学习体系为知识骨架，把线性模型、生成模型、稀疏学习、核方法、集成、HMM、Monte Carlo 和结构发现重组成量化研究课程。",
    icon: <RobotOutlined />,
    lessons: ["任务、标签与时间验证契约", "概率、贝叶斯与线性基准", "生成模型、降维、稀疏与核方法", "树、Boosting、集成与动态状态", "Monte Carlo、结构发现与模型治理"],
    outcome: "能够从任务和数据约束选择模型族，解释训练与推断过程，并用样本外、不确定性、成本和稳定性决定模型去留。",
    path: "/machine-learning",
    action: "进入机器学习课程",
    chapterCount: 10,
    algorithmCount: 51,
  },
  {
    key: "backtest",
    title: "回测学堂",
    subtitle: "从样本构建到蒙特卡洛",
    track: "策略验证",
    description: "从可追溯样本、时序模拟和成本模型开始，完成样本外验证、参数稳健性、多重检验、Bootstrap 与蒙特卡洛压力测试。",
    icon: <BarChartOutlined />,
    lessons: ["样本合同、预热与时间切分", "逐时模拟、成交与成本模型", "基准、绩效与交易质量", "Hold-out、Walk-forward 与多重检验", "Bootstrap、蒙特卡洛与决策门槛"],
    outcome: "能够独立构建样本、完成样本外与蒙特卡洛验证，并用明确门槛判断一份回测是否值得进入仿真观察。",
    path: "/backtest-learning",
    action: "进入进阶回测方法课",
    formulaCount: 36,
    chapterCount: 10,
  },
  {
    key: "kline",
    title: "K线学堂",
    subtitle: "从 OHLCV 到可验证规则",
    track: "行情语言",
    description: "用真实离线行情完成 OHLCV、周期、结构、量价、动量、波动、形态算法化和样本外验证。",
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
    track: "研究方法",
    description: "从可证伪问题、数据谱系、价格链上和事件证据，到因果边界、置信度校准与冲突证据决策。",
    icon: <FundProjectionScreenOutlined />,
    lessons: ["可证伪问题与市场状态", "链上、事件与时间证据", "数据谱系与质量门禁", "因果、反事实与替代解释", "置信度校准与冲突证据决策"],
    outcome: "能够形成可追溯、可校准、带反证和复核期限的诊断记录。",
    path: "/diagnosis-learning",
    action: "进入诊断分析课程",
    chapterCount: 8,
  },
  {
    key: "assets",
    title: "资产管理学堂",
    subtitle: "从单笔交易走向组合",
    track: "组合治理",
    description: "从目标与资本配置出发，完成风险预算、分散、再平衡、压力路径、绩效归因和投资政策治理。",
    icon: <WalletOutlined />,
    lessons: ["目标、期限与流动性约束", "资本配置、风险预算与分散", "再平衡、成本和组合复核", "压力情景与目标达成概率", "绩效归因、政策例外与恢复治理"],
    outcome: "能够建立含压力路径、成本、责任边界和恢复规则的组合管理制度。",
    path: "/asset-management-learning",
    action: "进入资产管理课程",
    chapterCount: 8,
  },
  {
    key: "risk",
    title: "风控学堂",
    subtitle: "从风险预算到熔断恢复",
    track: "安全底线",
    description: "从风险数据和阈值校准开始，完成暴露预算、流动性容量、VaR/ES、联合压力、风险蒙特卡洛、链上清算与恢复治理。",
    icon: <WarningOutlined />,
    lessons: ["风险数据与阈值校准", "暴露、仓位与止损预算", "流动性、VaR/ES 与联合压力", "风险蒙特卡洛与 Web3 清算", "门禁、熔断与分级恢复"],
    outcome: "能够用样本和压力路径校准风险红线，并把结果转成预警、缩量、拒单、熔断和恢复证据。",
    path: "/risk-learning",
    action: "进入系统风控方法课",
    formulaCount: 37,
    chapterCount: 10,
  },
];

const JOURNEY = [
  { title: "选股 / 选币", subtitle: "学习价格与候选规则", icon: <SearchOutlined />, courseKey: "kline" as CourseKey },
  { title: "诊股 / 诊币", subtitle: "学习证据核验方法", icon: <FundProjectionScreenOutlined />, courseKey: "diagnosis" as CourseKey },
  { title: "模型研究", subtitle: "学习算法与验证边界", icon: <RobotOutlined />, courseKey: "machine" as CourseKey },
  { title: "交易验证", subtitle: "学习规则与回测", icon: <SwapOutlined />, courseKey: "backtest" as CourseKey },
  { title: "资产管理", subtitle: "学习组合与再平衡", icon: <WalletOutlined />, courseKey: "assets" as CourseKey },
];

const FORMULA_COUNT = COURSES.reduce((total, course) => total + (course.formulaCount ?? 0), 0);
const FORMULA_CHAPTER_COUNT = COURSES.reduce(
  (total, course) => total + (course.formulaCount ? course.chapterCount ?? 0 : 0),
  0,
);
const APPLICATION_CHAPTER_COUNT = COURSES.reduce(
  (total, course) => total + (!course.formulaCount ? course.chapterCount ?? 0 : 0),
  0,
);
const ALGORITHM_COUNT = COURSES.reduce((total, course) => total + (course.algorithmCount ?? 0), 0);

const PRINCIPLES = [
  { title: "固定样本", description: "断网也能重复课程结果", icon: <DatabaseOutlined /> },
  { title: "代码可运行", description: "概念对应真实函数和页面", icon: <CodeOutlined /> },
  { title: "证据可追溯", description: "标注来源、窗口与假设", icon: <FileSearchOutlined /> },
  { title: "安全边界", description: "只做教学和模拟验证", icon: <SafetyCertificateOutlined /> },
];

export default function AcademyPage() {
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState<CourseKey>("math");
  const active = useMemo(() => COURSES.find((course) => course.key === activeKey) ?? COURSES[0], [activeKey]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const previewCourse = (courseKey: CourseKey, scroll = false) => {
    setActiveKey(courseKey);
    if (scroll) {
      window.requestAnimationFrame(() => scrollTo("academy-course-detail"));
    }
  };

  return (
    <TradingPageShell
      eyebrow="PUBLIC LEARNING · FREE & REPRODUCIBLE"
      title="公益学堂"
      description="面向普通学习者的免费投资研究课程。用固定样本、可运行代码和风险边界，帮助学习者建立自己的判断过程。"
      actions={(
        <>
          <Button type="primary" icon={<ReadOutlined />} onClick={() => navigate("/math-learning")}>开始第一课</Button>
          <Button icon={<CompassOutlined />} onClick={() => scrollTo("academy-courses")}>浏览课程</Button>
        </>
      )}
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
              <button
                type="button"
                className={activeKey === step.courseKey ? "active" : ""}
                aria-pressed={activeKey === step.courseKey}
                aria-controls="academy-course-detail"
                onClick={() => previewCourse(step.courseKey, true)}
              >
                <b>{String(index + 1).padStart(2, "0")}</b>
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

      <section className="academy-course-section" id="academy-courses">
        <SectionHeader title="七大学堂" description="七门系统课程全部开放：公式、机器学习与应用课程分别用复算、交互实验、案例推演和知识检查验证理解" />
        <div className="academy-depth-strip">
          <div><strong>{FORMULA_COUNT}</strong><span>核心公式</span><small>从定义到使用边界</small></div>
          <div><strong>{FORMULA_CHAPTER_COUNT}</strong><span>公式课章节</span><small>目标、先修与预计用时</small></div>
          <div><strong>{FORMULA_CHAPTER_COUNT}</strong><span>复算任务</span><small>用小样本验证理解</small></div>
          <div><strong>18</strong><span>权威资料</span><small>教材、论文与官方文档</small></div>
          <div><strong>{APPLICATION_CHAPTER_COUNT}</strong><span>应用课章节</span><small>诊断与资产管理案例</small></div>
          <div><strong>{ALGORITHM_COUNT}</strong><span>机器学习算法</span><small>可运行、实验与理论分级</small></div>
        </div>
        <div className="academy-course-grid">
          {COURSES.map((course, index) => (
            <button
              type="button"
              key={course.key}
              className={`academy-course-card${activeKey === course.key ? " active" : ""}`}
              aria-pressed={activeKey === course.key}
              aria-controls="academy-course-detail"
              onClick={() => previewCourse(course.key)}
            >
              <span className="academy-course-top">
                <span className="academy-course-track">{course.track}</span>
                <span className="academy-course-number">0{index + 1}</span>
              </span>
              <i>{course.icon}</i>
              <strong>{course.title}</strong>
              <small>{course.subtitle}</small>
              <span className="academy-course-footer">
                {course.formulaCount ? <em>{course.chapterCount} 章 · {course.formulaCount} 个公式</em> : course.algorithmCount ? <em>{course.chapterCount} 章 · {course.algorithmCount} 个算法</em> : course.path ? <em>{course.chapterCount} 章 · 案例与练习</em> : <em>课程纲要</em>}
                <ArrowRightOutlined />
              </span>
            </button>
          ))}
        </div>
      </section>

      <QuantGlowCard
        className="academy-course-detail"
        id="academy-course-detail"
        title={<SectionHeader title={active.title} description={active.description} />}
        badge={<StatusPill tone="profit">{active.formulaCount ? "系统公式课" : active.algorithmCount ? "系统算法课" : "系统应用课"}</StatusPill>}
      >
        <div className="academy-detail-content" key={active.key} aria-live="polite">
          <div className="academy-course-summary">
            <i>{active.icon}</i>
            <div>
              <span>{active.track} · 学习结构</span>
              <strong>{active.chapterCount} 章{active.formulaCount ? ` · ${active.formulaCount} 个核心公式` : active.algorithmCount ? ` · ${active.algorithmCount} 个算法条目` : " · 案例推演与知识检查"}</strong>
              <small>{active.formulaCount ? "导学、公式、复算与来源相互校验" : active.algorithmCount ? "问题、算法、实验、边界与知识检查逐步推进" : "框架、案例、练习与知识检查逐步推进"}</small>
            </div>
          </div>
          {active.formulaCount ? <div className="academy-formula-strip"><CalculatorOutlined /><strong>系统公式手册</strong><span>每个公式都讲清用途与边界</span><i>导学</i><b>→</b><i>公式</i><b>→</b><i>复算</i><b>→</b><i>来源</i></div> : null}
          <div className="academy-detail-layout">
            <div className="academy-syllabus">
              <div><strong>课程大纲</strong><span>{active.lessons.length} 个学习模块</span></div>
              <ol>
                {active.lessons.map((lesson, index) => (
                  <li key={lesson}><b>{String(index + 1).padStart(2, "0")}</b><span>{lesson}</span></li>
                ))}
              </ol>
            </div>
            <aside>
              <span>学完你应该能够</span>
              <p>{active.outcome}</p>
              {active.path ? (
                <Button type="primary" onClick={() => active.path && navigate(active.path)}>{active.action}<ArrowRightOutlined /></Button>
              ) : (
                <Button disabled>完整课程正在补充，本页先学习课程纲要</Button>
              )}
              <small><SafetyOutlined /> 教学内容不构成投资建议</small>
            </aside>
          </div>
        </div>
      </QuantGlowCard>

      <section className="academy-principles">
        {PRINCIPLES.map((principle) => (
          <div key={principle.title}><i>{principle.icon}</i><span><strong>{principle.title}</strong><small>{principle.description}</small></span></div>
        ))}
      </section>
    </TradingPageShell>
  );
}
