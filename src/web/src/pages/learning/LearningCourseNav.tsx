import {
  BarChartOutlined,
  BookOutlined,
  CalculatorOutlined,
  FundProjectionScreenOutlined,
  LineChartOutlined,
  RobotOutlined,
  SafetyOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { NavLink } from "react-router-dom";

const COURSES = [
  { path: "/academy", label: "学堂首页", subtitle: "课程地图", icon: <BookOutlined />, end: true },
  { path: "/math-learning", label: "数学学堂", subtitle: "量化基础", icon: <CalculatorOutlined />, end: false },
  { path: "/machine-learning", label: "机器学习", subtitle: "概率建模", icon: <RobotOutlined />, end: false },
  { path: "/kline-learning", label: "K线学堂", subtitle: "价格行为", icon: <LineChartOutlined />, end: false },
  { path: "/diagnosis-learning", label: "诊断学堂", subtitle: "证据判断", icon: <FundProjectionScreenOutlined />, end: false },
  { path: "/backtest-learning", label: "回测学堂", subtitle: "历史验证", icon: <BarChartOutlined />, end: false },
  { path: "/asset-management-learning", label: "资产学堂", subtitle: "组合治理", icon: <WalletOutlined />, end: false },
  { path: "/risk-learning", label: "风控学堂", subtitle: "风险边界", icon: <SafetyOutlined />, end: false },
] as const;

export function LearningCourseNav() {
  return (
    <nav className="learning-course-nav" aria-label="学堂课程导航">
      {COURSES.map((course, index) => (
        <NavLink
          key={course.path}
          to={course.path}
          end={course.end}
          className={({ isActive }) => isActive ? "active" : undefined}
        >
          <i>{course.icon}</i>
          <span><small>0{index + 1}</small><strong>{course.label}</strong><em>{course.subtitle}</em></span>
        </NavLink>
      ))}
    </nav>
  );
}
