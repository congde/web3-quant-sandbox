import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExperimentOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";

import type { FormulaGroup, FormulaItem } from "./FormulaHandbook";
import { getFormulaStory } from "./FormulaStories";
import "./formula-mastery-check.css";

type Candidate = {
  formula: FormulaItem;
  groupTitle: string;
};

type MasteryQuestion = {
  id: string;
  title: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

function stableNumber(value: string) {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
}

function distinctValues(candidates: Candidate[], render: (candidate: Candidate) => string, excluded: string) {
  const values: string[] = [];
  for (const candidate of candidates) {
    const value = render(candidate);
    if (value !== excluded && !values.includes(value)) values.push(value);
    if (values.length === 2) break;
  }
  return values;
}

function arrangeOptions(correct: string, distractors: string[], seed: number) {
  const raw = [correct, ...distractors].slice(0, 3);
  const shift = raw.length ? seed % raw.length : 0;
  const options = [...raw.slice(shift), ...raw.slice(0, shift)];
  return { options, answer: options.indexOf(correct) };
}

function buildQuestions(group: FormulaGroup, allGroups: FormulaGroup[]): MasteryQuestion[] {
  const allCandidates = allGroups.flatMap((item) => item.formulas.map((formula) => ({ formula, groupTitle: item.title })));
  const otherCandidates = allCandidates.filter((candidate) => candidate.groupTitle !== group.title);
  const seed = stableNumber(group.title);
  const purposeTarget = group.formulas[seed % group.formulas.length];
  const boundaryTarget = group.formulas[(seed + 1) % group.formulas.length];
  const historyTarget = group.formulas[(seed + 2) % group.formulas.length];

  const purposeOptions = arrangeOptions(
    purposeTarget.equation,
    distinctValues(otherCandidates, (candidate) => candidate.formula.equation, purposeTarget.equation),
    seed,
  );
  const boundaryOptions = arrangeOptions(
    boundaryTarget.boundary,
    distinctValues(otherCandidates, (candidate) => candidate.formula.boundary, boundaryTarget.boundary),
    seed + 1,
  );
  const historyStory = getFormulaStory(historyTarget, group.title);
  const historyOptions = arrangeOptions(
    historyStory.attribution,
    distinctValues(
      otherCandidates,
      (candidate) => getFormulaStory(candidate.formula, candidate.groupTitle).attribution,
      historyStory.attribution,
    ),
    seed + 2,
  );

  return [
    {
      id: `${group.title}:purpose`,
      title: "公式识别",
      prompt: `哪条公式用于“${purposeTarget.purpose}”？`,
      ...purposeOptions,
      explanation: `${purposeTarget.name}：${purposeTarget.equation}。${purposeTarget.example}`,
    },
    {
      id: `${group.title}:boundary`,
      title: "边界判断",
      prompt: `使用“${boundaryTarget.name}”时，必须保留哪条限制？`,
      ...boundaryOptions,
      explanation: boundaryTarget.boundary,
    },
    {
      id: `${group.title}:history`,
      title: "历史来源",
      prompt: `关于“${historyTarget.name}”的形成，哪项描述与史档案一致？`,
      ...historyOptions,
      explanation: `${historyStory.attribution} 思想来源包括：${historyStory.intellectualRoots.join("；")}。`,
    },
  ];
}

export function FormulaMasteryCheck({
  group,
  allGroups,
  mastered,
  onMastered,
}: {
  group: FormulaGroup;
  allGroups: FormulaGroup[];
  mastered: boolean;
  onMastered: () => void;
}) {
  const questions = useMemo(() => buildQuestions(group, allGroups), [allGroups, group]);
  const [answers, setAnswers] = useState<Array<number | null>>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [practiceMode, setPracticeMode] = useState(!mastered);

  useEffect(() => {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
    setPracticeMode(!mastered);
  }, [group.title, mastered, questions]);

  const correctCount = questions.filter((question, index) => answers[index] === question.answer).length;
  const answeredAll = answers.every((answer) => answer !== null);

  function submit() {
    if (!answeredAll) return;
    setSubmitted(true);
    if (correctCount === questions.length) onMastered();
  }

  function retry() {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
    setPracticeMode(true);
  }

  if (mastered && !practiceMode) {
    return (
      <section className="formula-mastery formula-mastery-complete" aria-label={`${group.title}章节测验已通过`}>
        <CheckCircleFilled />
        <div><strong>章节掌握度已验证</strong><span>你已通过公式识别、使用边界和历史来源三类检查。</span></div>
        <button type="button" onClick={retry}><ReloadOutlined />重新练习</button>
      </section>
    );
  }

  return (
    <section className="formula-mastery" aria-labelledby={`mastery-${group.title}`}>
      <header>
        <div><ExperimentOutlined /><span><strong id={`mastery-${group.title}`}>章节掌握度检查</strong><small>完成不是手动勾选：三类题全部正确后记录本章进度</small></span></div>
        <b>{submitted ? `${correctCount} / ${questions.length}` : "待验证"}</b>
      </header>

      <div className="formula-mastery-questions">
        {questions.map((question, questionIndex) => {
          const selected = answers[questionIndex];
          const isCorrect = selected === question.answer;
          return (
            <article key={question.id} className={submitted ? (isCorrect ? "correct" : "wrong") : ""}>
              <div className="formula-mastery-question-title"><span>{String(questionIndex + 1).padStart(2, "0")}</span><b>{question.title}</b>{submitted ? (isCorrect ? <CheckCircleFilled /> : <CloseCircleFilled />) : null}</div>
              <p>{question.prompt}</p>
              <div className="formula-mastery-options" role="radiogroup" aria-label={question.prompt}>
                {question.options.map((option, optionIndex) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected === optionIndex}
                    className={selected === optionIndex ? "selected" : ""}
                    disabled={submitted}
                    key={option}
                    onClick={() => setAnswers((current) => current.map((answer, index) => index === questionIndex ? optionIndex : answer))}
                  >
                    <i>{String.fromCharCode(65 + optionIndex)}</i><span>{option}</span>
                  </button>
                ))}
              </div>
              {submitted ? <div className="formula-mastery-feedback"><b>{isCorrect ? "判断正确" : "需要重新理解"}</b><span>{question.explanation}</span></div> : null}
            </article>
          );
        })}
      </div>

      <footer>
        <span>{submitted && correctCount < questions.length ? "查看解释后重新作答；只有全部正确才会记录完成。" : "答案只保存在当前学习流程中，不构成投资建议。"}</span>
        {submitted && correctCount < questions.length
          ? <button type="button" onClick={retry}><ReloadOutlined />重新作答</button>
          : <button type="button" disabled={!answeredAll} onClick={submit}>提交学习证据</button>}
      </footer>
    </section>
  );
}
