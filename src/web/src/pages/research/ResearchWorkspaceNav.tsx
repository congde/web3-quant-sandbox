import {
  ApartmentOutlined,
  FileSearchOutlined,
  FundProjectionScreenOutlined,
  GlobalOutlined,
} from "@ant-design/icons";

export type ResearchWorkspaceView = "overview" | "themes" | "macro" | "graph";

const WORKSPACE_ITEMS = [
  { key: "overview" as const, label: "综合研判", hint: "行情、信号与消息", icon: <FileSearchOutlined /> },
  { key: "themes" as const, label: "主题研究", hint: "产业主题与催化", icon: <FundProjectionScreenOutlined /> },
  { key: "macro" as const, label: "宏观观察", hint: "利率、流动性与资产", icon: <GlobalOutlined /> },
  { key: "graph" as const, label: "知识图谱", hint: "链定位与上下游", icon: <ApartmentOutlined /> },
];

export function ResearchWorkspaceNav({
  value,
  onChange,
}: {
  value: ResearchWorkspaceView;
  onChange: (value: ResearchWorkspaceView) => void;
}) {
  return (
    <nav className="research-workspace-nav" aria-label="市场情报工作台">
      <div className="research-workspace-brand">
        <span>INTELLIGENCE DESK</span>
        <strong>市场情报</strong>
      </div>
      <div className="research-workspace-tabs">
        {WORKSPACE_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={value === item.key ? "active" : ""}
            aria-pressed={value === item.key}
            onClick={() => onChange(item.key)}
          >
            {item.icon}
            <span>
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
