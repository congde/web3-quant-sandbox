import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExperimentOutlined,
  LinkOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "../trading/TradingPageShell";
import type { AppliedCourse } from "./AppliedLearningContent";
import { LearningCourseNav } from "./LearningCourseNav";
import "./applied-learning.css";
import "./learning-layout.css";

const masteryKey = (course: AppliedCourse) => `applied-mastery:v1:${course.key}`;

function clamp(value: number, lower = 0, upper = 100) {
  return Math.min(upper, Math.max(lower, value));
}

function AppliedSlider({ label, value, min = 0, max = 100, step = 1, suffix = "", onChange }: { label: string; value: number; min?: number; max?: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="applied-workbench-slider"><span>{label}<b>{value}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function DiagnosisWorkbench({ lessonTitle }: { lessonTitle: string }) {
  const [quality, setQuality] = useState(78);
  const [independence, setIndependence] = useState(62);
  const [support, setSupport] = useState(70);
  const [counter, setCounter] = useState(34);
  const [freshness, setFreshness] = useState(76);
  const score = clamp(quality * 0.25 + independence * 0.2 + support * 0.4 + freshness * 0.15 - counter * 0.3);
  const conclusion = score >= 70 ? "支持" : score >= 50 ? "部分支持" : score >= 35 ? "证据不足" : "反对";
  const tone = score >= 70 ? "profit" : score >= 50 ? "neutral" : score >= 35 ? "ai" : "loss";
  const conflict = Math.min(support, counter);
  return <section className="applied-workbench"><header><div><span>DIAGNOSIS WORKBENCH</span><strong>证据置信度校准台</strong><small>当前主题：{lessonTitle}</small></div><StatusPill tone={tone}>{conclusion}</StatusPill></header><div className="applied-workbench-body"><div className="applied-slider-grid"><AppliedSlider label="来源质量" value={quality} onChange={setQuality} /><AppliedSlider label="证据独立性" value={independence} onChange={setIndependence} /><AppliedSlider label="支持证据强度" value={support} onChange={setSupport} /><AppliedSlider label="反方证据强度" value={counter} onChange={setCounter} /><AppliedSlider label="信息新鲜度" value={freshness} onChange={setFreshness} /></div><div className="applied-decision-panel"><div><span>校准置信分</span><strong>{score.toFixed(1)}</strong><small>不是上涨概率，而是当前证据质量评分</small></div><div className="applied-decision-metrics"><p><span>证据冲突度</span><b>{conflict.toFixed(0)}</b></p><p><span>来源 × 独立性</span><b>{Math.sqrt(quality * independence).toFixed(0)}</b></p><p><span>复核优先级</span><b>{freshness < 50 || conflict > 50 ? "高" : "常规"}</b></p></div></div></div><footer>结论必须同时保存输入快照、反证、未知项、有效期和下一次复核条件；评分变化不能静默覆盖旧结论。</footer></section>;
}

function AssetWorkbench({ lessonTitle }: { lessonTitle: string }) {
  const [liquidity, setLiquidity] = useState(12);
  const [concentration, setConcentration] = useState(28);
  const [stressLoss, setStressLoss] = useState(18);
  const [drawdownLimit, setDrawdownLimit] = useState(25);
  const [cost, setCost] = useState(0.8);
  const blocked = liquidity < 6 || concentration > 40 || stressLoss > drawdownLimit;
  const warned = !blocked && (liquidity < 12 || concentration > 25 || stressLoss > drawdownLimit * 0.8 || cost > 1.5);
  const decision = blocked ? "BLOCK" : warned ? "WATCH" : "ALLOW";
  const tone = blocked ? "loss" : warned ? "ai" : "profit";
  const capacity = Math.max(0, drawdownLimit - stressLoss);
  return <section className="applied-workbench"><header><div><span>PORTFOLIO WORKBENCH</span><strong>组合约束与情景门禁</strong><small>当前主题：{lessonTitle}</small></div><StatusPill tone={tone}>{decision}</StatusPill></header><div className="applied-workbench-body"><div className="applied-slider-grid"><AppliedSlider label="流动性覆盖" value={liquidity} min={0} max={36} suffix=" 月" onChange={setLiquidity} /><AppliedSlider label="最大单项权重" value={concentration} min={0} max={80} suffix="%" onChange={setConcentration} /><AppliedSlider label="联合压力损失" value={stressLoss} min={0} max={60} suffix="%" onChange={setStressLoss} /><AppliedSlider label="最大回撤上限" value={drawdownLimit} min={5} max={60} suffix="%" onChange={setDrawdownLimit} /><AppliedSlider label="预计调仓成本" value={cost} min={0} max={5} step={0.1} suffix="%" onChange={setCost} /></div><div className="applied-decision-panel"><div><span>组合门禁</span><strong>{decision}</strong><small>{blocked ? "至少一项硬约束已突破" : warned ? "接近预算边界，需要缩量或复核" : "当前输入满足示例约束"}</small></div><div className="applied-decision-metrics"><p><span>剩余回撤容量</span><b>{capacity.toFixed(1)}%</b></p><p><span>流动性门禁</span><b>{liquidity >= 12 ? "通过" : liquidity >= 6 ? "观察" : "阻断"}</b></p><p><span>集中度门禁</span><b>{concentration <= 25 ? "通过" : concentration <= 40 ? "观察" : "阻断"}</b></p></div></div></div><footer>组合决策应同时记录目标、风险预算、压力情景、执行成本和批准人；硬约束不能通过临时修改目标权重规避。</footer></section>;
}

function AppliedWorkbench({ course, lessonTitle }: { course: AppliedCourse; lessonTitle: string }) {
  return course.key === "diagnosis" ? <DiagnosisWorkbench lessonTitle={lessonTitle} /> : <AssetWorkbench lessonTitle={lessonTitle} />;
}

function readMastery(course: AppliedCourse) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const saved = JSON.parse(window.localStorage.getItem(masteryKey(course)) ?? "[]");
    const validTitles = new Set(course.lessons.map((lesson) => lesson.title));
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string" && validTitles.has(item)) : [];
  } catch {
    return [];
  }
}

export function AppliedLearningPage({ course }: { course: AppliedCourse }) {
  const navigate = useNavigate();
  const [lessonIndex, setLessonIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>([null, null]);
  const [submitted, setSubmitted] = useState(false);
  const [mastered, setMastered] = useState<string[]>(() => readMastery(course));
  const lesson = course.lessons[lessonIndex];
  const passed = lesson.quizzes.every((quiz, index) => answers[index] === quiz.answer);
  const progress = Math.round((mastered.length / course.lessons.length) * 100);

  useEffect(() => {
    setAnswers(lesson.quizzes.map(() => null));
    setSubmitted(false);
  }, [lessonIndex, lesson.quizzes]);

  const sourceProviders = useMemo(
    () => Array.from(new Set(course.lessons.flatMap((item) => item.sources.map((source) => source.provider)))),
    [course.lessons],
  );

  const selectLesson = (index: number) => {
    setLessonIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () => {
    if (answers.some((answer) => answer === null)) return;
    setSubmitted(true);
    if (!passed || mastered.includes(lesson.title)) return;
    const next = [...mastered, lesson.title];
    setMastered(next);
    window.localStorage.setItem(masteryKey(course), JSON.stringify(next));
  };

  const nextLesson = () => {
    if (lessonIndex < course.lessons.length - 1) selectLesson(lessonIndex + 1);
    else navigate(course.nextPath);
  };

  return (
    <TradingPageShell
      eyebrow={course.eyebrow}
      title={course.title}
      description={course.description}
      actions={<Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button>}
      aside={
        <QuantGlowCard className="applied-progress-card">
          <span>知识掌握进度</span>
          <strong>{mastered.length} / {course.lessons.length} 章</strong>
          <div aria-label={`学习进度 ${progress}%`}><i style={{ width: `${progress}%` }} /></div>
          <small>必须通过章节知识检查才计入进度</small>
        </QuantGlowCard>
      }
    >
      <LearningCourseNav />

      <main className="learning-full-width applied-learning" data-course={course.key}>
        <QuantGlowCard className="applied-outcome-card">
          <div>
            <span><SafetyOutlined /> 课程能力目标</span>
            <strong>{course.outcome}</strong>
          </div>
          <aside><b>{course.lessons.length}</b><span>系统章节</span><b>{sourceProviders.length}</b><span>资料机构</span></aside>
        </QuantGlowCard>

        <nav className="applied-lesson-nav" aria-label={`${course.title}章节导航`}>
          {course.lessons.map((item, index) => (
            <button
              type="button"
              key={item.title}
              className={lessonIndex === index ? "active" : undefined}
              onClick={() => selectLesson(index)}
              aria-current={lessonIndex === index ? "step" : undefined}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <span><strong>{item.title}</strong><em>{item.short}</em></span>
              {mastered.includes(item.title) ? <CheckCircleFilled aria-label="已掌握" /> : null}
            </button>
          ))}
        </nav>

        <QuantGlowCard
          className="applied-lesson-card"
          title={<SectionHeader title={lesson.title} description={lesson.short} />}
          badge={<StatusPill tone="profit">第 {lessonIndex + 1} 章</StatusPill>}
        >
          <section className="applied-introduction">
            <div><span>本章目标</span><strong>{lesson.objective}</strong></div>
            <p>{lesson.overview}</p>
          </section>

          <section className="applied-section">
            <SectionHeader title="判断框架" description="按顺序完成四步，避免从结论倒推证据" />
            <div className="applied-framework">
              {lesson.framework.map((step, index) => (
                <article key={step.title}><b>{String(index + 1).padStart(2, "0")}</b><strong>{step.title}</strong><p>{step.detail}</p></article>
              ))}
            </div>
          </section>

          <section className="applied-section applied-case">
            <SectionHeader title="案例推演" description={lesson.caseStudy.question} />
            <div className="applied-evidence-grid">
              {lesson.caseStudy.evidence.map((item) => (
                <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><p>{item.interpretation}</p></article>
              ))}
            </div>
            <div className="applied-case-result">
              <p><b>可辩护结论</b>{lesson.caseStudy.conclusion}</p>
              <p><b>证据边界</b>{lesson.caseStudy.limits}</p>
            </div>
          </section>

          <AppliedWorkbench key={`${course.key}-${lesson.title}`} course={course} lessonTitle={lesson.title} />

          <div className="applied-two-column">
            <section><h3><CheckCircleFilled /> 可复用检查表</h3><ul>{lesson.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h3><CloseCircleFilled /> 常见误区</h3><ul>{lesson.pitfalls.map((item) => <li key={item}>{item}</li>)}</ul></section>
          </div>

          <section className="applied-sources">
            <span><LinkOutlined /> 本章资料来源</span>
            {lesson.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><strong>{source.label}</strong><small>{source.provider}</small></a>)}
          </section>
        </QuantGlowCard>

        <QuantGlowCard
          className="applied-check-card"
          title={<SectionHeader title="章节知识检查" description="不是签到：两题全部答对后才记录本章掌握" />}
          badge={mastered.includes(lesson.title) ? <StatusPill tone="profit">已掌握</StatusPill> : <StatusPill tone="neutral">待验证</StatusPill>}
        >
          <div className="applied-quiz-grid">
            {lesson.quizzes.map((quiz, quizIndex) => (
              <fieldset key={quiz.question}>
                <legend><b>0{quizIndex + 1}</b>{quiz.question}</legend>
                {quiz.options.map((option, optionIndex) => {
                  const checked = answers[quizIndex] === optionIndex;
                  const resultClass = submitted && checked ? (optionIndex === quiz.answer ? "correct" : "wrong") : "";
                  return <label className={resultClass} key={option}><input type="radio" name={`${course.key}-${lessonIndex}-${quizIndex}`} checked={checked} onChange={() => { const next = [...answers]; next[quizIndex] = optionIndex; setAnswers(next); setSubmitted(false); }} /><span>{option}</span></label>;
                })}
                {submitted ? <p className={answers[quizIndex] === quiz.answer ? "correct" : "wrong"}>{answers[quizIndex] === quiz.answer ? <CheckCircleFilled /> : <CloseCircleFilled />} {quiz.reason}</p> : null}
              </fieldset>
            ))}
          </div>
          <div className="applied-check-actions">
            <span>{submitted ? (passed ? "验证通过：本章已计入学习进度。" : "仍有答案需要修正，请结合解释重试。") : "先独立作答，再查看解释。"}</span>
            <Button type="primary" icon={<ExperimentOutlined />} disabled={answers.some((answer) => answer === null)} onClick={submit}>{submitted && !passed ? "重新验证" : "提交答案"}</Button>
          </div>
        </QuantGlowCard>

        <footer className="applied-footer-actions">
          <Button icon={<ArrowLeftOutlined />} disabled={lessonIndex === 0} onClick={() => selectLesson(lessonIndex - 1)}>上一章</Button>
          <Button type="primary" onClick={nextLesson}>{lessonIndex === course.lessons.length - 1 ? course.nextLabel : "下一章"}<ArrowRightOutlined /></Button>
        </footer>
      </main>
    </TradingPageShell>
  );
}
