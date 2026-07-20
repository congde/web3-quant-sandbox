import { AppstoreOutlined, ReloadOutlined, SearchOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Segmented, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWeb3KnowledgeGraph } from "../../api";
import type { Web3GraphNode, Web3GraphPayload } from "../../types";

function GraphCanvas({ nodes, edges, stages }: { nodes: Web3GraphNode[]; edges: Web3GraphPayload["edges"]; stages: string[] }) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [selectedNode, setSelectedNode] = useState<Web3GraphNode | null>(null);

  useEffect(() => {
    const draw = () => {
      const shell = shellRef.current; const canvas = canvasRef.current;
      if (!shell || !canvas) return;
      const rect = shell.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
      canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
      const context = canvas.getContext("2d"); if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, rect.width, rect.height); context.lineWidth = 1;
      edges.forEach(({ from, to }) => {
        const fromNode = nodeRefs.current[from]; const toNode = nodeRefs.current[to]; if (!fromNode || !toNode) return;
        const a = fromNode.getBoundingClientRect(); const b = toNode.getBoundingClientRect();
        const x1 = a.right - rect.left; const y1 = a.top + a.height / 2 - rect.top; const x2 = b.left - rect.left; const y2 = b.top + b.height / 2 - rect.top;
        const control = Math.max(24, (x2 - x1) * 0.45); context.beginPath(); context.moveTo(x1, y1); context.bezierCurveTo(x1 + control, y1, x2 - control, y2, x2, y2);
        context.strokeStyle = selectedNode && (selectedNode.id === from || selectedNode.id === to) ? "rgba(183,121,31,.78)" : "rgba(109,116,109,.24)"; context.stroke();
      });
    };
    draw(); const observer = new ResizeObserver(draw); if (shellRef.current) observer.observe(shellRef.current); return () => observer.disconnect();
  }, [edges, nodes, selectedNode]);

  return <div className="knowledge-graph-stage" ref={shellRef} style={{ gridTemplateColumns: `repeat(${Math.max(1, stages.length)}, minmax(135px, 1fr))` }}>
    <canvas ref={canvasRef} className="knowledge-edge-canvas" aria-hidden="true" />
    {stages.map((stage) => <div key={stage} className="knowledge-stage-column"><span className="knowledge-stage-label">{stage}</span><div className="knowledge-stage-nodes">{nodes.filter((node) => node.stage === stage).map((node) => <button key={node.id} ref={(element) => { nodeRefs.current[node.id] = element; }} type="button" className={`knowledge-node risk-${node.risk}${selectedNode?.id === node.id ? " active" : ""}`} onClick={() => setSelectedNode(node)}><strong>{node.label}</strong><span>{node.entities.slice(0, 3).join(" · ")}</span>{node.mentions ? <b>{node.mentions} 条新闻证据</b> : null}</button>)}</div></div>)}
    {selectedNode ? <aside className="knowledge-node-detail"><button type="button" aria-label="关闭详情" onClick={() => setSelectedNode(null)}>×</button><span>{selectedNode.domain}</span><h3>{selectedNode.label}</h3><p>{selectedNode.stage} · 风险等级 {selectedNode.risk}</p><strong>协议 / 资产</strong><div>{selectedNode.entities.map((entity) => <em key={entity}>{entity}</em>)}</div>{selectedNode.evidence.length ? <><strong>新闻证据</strong><div className="knowledge-evidence">{selectedNode.evidence.map((item) => <a key={`${item.url}-${item.title}`} href={item.url || undefined} target="_blank" rel="noreferrer">{item.title}</a>)}</div></> : null}</aside> : null}
  </div>;
}

export default function KnowledgeGraphView() {
  const [payload, setPayload] = useState<Web3GraphPayload | null>(null);
  const [domain, setDomain] = useState("全部 Web3"); const [query, setQuery] = useState(""); const [mode, setMode] = useState<"全景" | "泳道">("全景");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = (refresh = false) => { setLoading(true); setError(""); void fetchWeb3KnowledgeGraph({ refresh }).then(setPayload).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false)); };
  useEffect(() => load(), []);
  const nodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (payload?.nodes ?? []).filter((node) => (mode === "全景" || domain === "全部 Web3" || node.domain === domain) && (!needle || `${node.label} ${node.entities.join(" ")} ${node.domain}`.toLowerCase().includes(needle)));
  }, [domain, mode, payload, query]);
  const visibleIds = new Set(nodes.map((node) => node.id));
  const edges = (payload?.edges ?? []).filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));

  return <section className="research-paper knowledge-graph-view">
    <aside className="knowledge-sidebar"><div className="knowledge-sidebar-title"><strong>Web3 Knowledge Graph</strong><span>协议栈 · 资产映射 · 证据下钻</span></div>
      <div className="knowledge-stats"><div><b>{payload?.stats.nodes ?? 0}</b><span>NODES</span></div><div><b>{payload?.stats.edges ?? 0}</b><span>EDGES</span></div><div className="risk"><b>{payload?.stats.risks ?? 0}</b><span>HIGH RISKS</span></div><div><b>{payload?.stats.entities ?? 0}</b><span>ENTITIES</span></div></div>
      <span className="knowledge-domain-label">WEB3 DOMAINS</span><nav aria-label="Web3 知识图谱领域"><button type="button" className={domain === "全部 Web3" ? "active" : ""} onClick={() => { setDomain("全部 Web3"); setMode("全景"); }}><span>全部 Web3</span><b>{payload?.stats.nodes ?? 0}</b></button>{(payload?.domains ?? []).map((item) => <button key={item.name} type="button" className={domain === item.name ? "active" : ""} onClick={() => { setDomain(item.name); setMode("泳道"); }}><span>{item.name}</span><b>{item.count}</b></button>)}</nav>
      <p className="knowledge-help">选择领域进入泳道；搜索协议、代币或基础设施；点击节点查看实体和采集证据。</p>
    </aside>
    <div className="knowledge-main"><header className="knowledge-toolbar"><div><span>Web3</span><b>›</b><strong>{mode === "泳道" ? domain : "协议全景"}</strong></div><div><Segmented value={mode} onChange={(value) => setMode(value as "全景" | "泳道")} options={[{ label: "全景", value: "全景", icon: <AppstoreOutlined /> }, { label: "泳道", value: "泳道", icon: <UnorderedListOutlined /> }]} /><Input allowClear prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索协议 / 代币 / 基础设施" /><Button icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>刷新</Button></div></header>
      {error ? <Alert type="error" showIcon message="Web3 知识图谱加载失败" description={error} /> : null}{loading && !payload ? <div className="research-loading"><Spin tip="正在构建协议关系…" /></div> : null}{payload ? <GraphCanvas nodes={nodes} edges={edges} stages={payload.stages} /> : null}
    </div>
  </section>;
}
