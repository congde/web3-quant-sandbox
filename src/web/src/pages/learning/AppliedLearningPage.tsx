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
