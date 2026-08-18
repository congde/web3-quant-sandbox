import { BookOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";

import { TradingPageShell } from "../trading/TradingPageShell";
import { FormulaHandbook } from "./FormulaHandbook";
import { LearningCourseNav } from "./LearningCourseNav";
import "./learning-layout.css";

export default function MathLearningPage() {
  const navigate = useNavigate();

  return (
    <TradingPageShell
      eyebrow="QUANT MATH · 17 类 · 72 个核心公式"
      title="量化数学学堂"
      description="从微积分、概率统计、随机过程和回归时间序列，到机器学习、组合优化、期权定价、执行与 Web3。按知识树系统学习每个公式的用途、符号、例题和使用边界。"
      actions={
        <>
          <Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button>
          <Button onClick={() => navigate("/backtest-learning")}>继续回测公式</Button>
        </>
      }
    >
      <LearningCourseNav />
      <FormulaHandbook domain="math" />
    </TradingPageShell>
  );
}
