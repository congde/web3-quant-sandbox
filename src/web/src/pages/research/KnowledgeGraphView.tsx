import {
  AppstoreOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  message,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  archiveWeb3GraphEvidence,
  archiveWeb3GraphEdge,
  archiveWeb3GraphNode,
  createWeb3GraphEdge,
  createWeb3GraphEvidence,
  createWeb3GraphNode,
  fetchWeb3KnowledgeGraph,
  fetchWeb3GraphAudit,
  fetchWeb3GraphCandidates,
  fetchWeb3GraphIngestionStatus,
  reviewWeb3GraphCandidate,
  runWeb3GraphIngestion,
  updateWeb3GraphSchedule,
  updateWeb3GraphNode,
} from "../../api";
import type {
  Web3GraphAuditEvent,
  Web3GraphCandidate,
  Web3GraphEdge,
  Web3GraphIngestionStatus,
  Web3GraphNode,
  Web3GraphPayload,
} from "../../types";

const RISK_OPTIONS = [
  { label: "正常", value: "normal" },
  { label: "关注", value: "medium" },
  { label: "高风险", value: "high" },
  { label: "严重", value: "critical" },
];

type GraphCanvasProps = {
  nodes: Web3GraphNode[];
  edges: Web3GraphEdge[];
  stages: string[];
  selectedId?: string;
  onSelect: (node: Web3GraphNode) => void;
};

function GraphCanvas({ nodes, edges, stages, selectedId, onSelect }: GraphCanvasProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const draw = () => {
      const shell = shellRef.current;
      const canvas = canvasRef.current;
      if (!shell || !canvas) return;
      const rect = shell.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      context.lineWidth = 1;
      edges.forEach((edge) => {
        const fromNode = nodeRefs.current[edge.from];
        const toNode = nodeRefs.current[edge.to];
        if (!fromNode || !toNode) return;
        const a = fromNode.getBoundingClientRect();
        const b = toNode.getBoundingClientRect();
        const x1 = a.right - rect.left;
        const y1 = a.top + a.height / 2 - rect.top;
        const x2 = b.left - rect.left;
        const y2 = b.top + b.height / 2 - rect.top;
        const control = Math.max(24, (x2 - x1) * 0.45);
        context.beginPath();
        context.moveTo(x1, y1);
        context.bezierCurveTo(x1 + control, y1, x2 - control, y2, x2, y2);
        context.strokeStyle =
          selectedId && (selectedId === edge.from || selectedId === edge.to)
            ? "rgba(183,121,31,.88)"
            : "rgba(109,116,109,.24)";
        context.stroke();
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    if (shellRef.current) observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, [edges, nodes, selectedId]);

  if (!nodes.length) {
    return <Empty className="knowledge-empty" description="没有匹配的实体" />;
  }

  return (
    <div
      className="knowledge-graph-stage"
      ref={shellRef}
      style={{
        gridTemplateColumns: `repeat(${Math.max(1, stages.length)}, minmax(150px, 1fr))`,
      }}
    >
      <canvas ref={canvasRef} className="knowledge-edge-canvas" aria-hidden="true" />
      {stages.map((stage) => (
        <div key={stage} className="knowledge-stage-column">
          <span className="knowledge-stage-label">{stage}</span>
          <div className="knowledge-stage-nodes">
            {nodes
              .filter((node) => node.stage === stage)
              .map((node) => (
                <button
                  key={node.id}
                  ref={(element) => {
                    nodeRefs.current[node.id] = element;
                  }}
                  type="button"
                  className={`knowledge-node risk-${node.risk}${selectedId === node.id ? " active" : ""}`}
                  onClick={() => onSelect(node)}
                >
                  <strong>{node.label}</strong>
                  <span>{node.entities.slice(0, 3).join(" · ") || node.node_type}</span>
                  <b>{node.mentions} 条证据 · v{node.version}</b>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function KnowledgeGraphView() {
  const [payload, setPayload] = useState<Web3GraphPayload | null>(null);
  const [domain, setDomain] = useState("全部 Web3");
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("");
  const [mode, setMode] = useState<"全景" | "泳道">("全景");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [nodeModal, setNodeModal] = useState<"create" | "edit" | null>(null);
  const [edgeModal, setEdgeModal] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<Web3GraphAuditEvent[]>([]);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [ingestionStatus, setIngestionStatus] =
    useState<Web3GraphIngestionStatus | null>(null);
  const [candidates, setCandidates] = useState<Web3GraphCandidate[]>([]);
  const [nodeForm] = Form.useForm();
  const [edgeForm] = Form.useForm();
  const [evidenceForm] = Form.useForm();
  const [messageApi, messageContext] = message.useMessage();

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError("");
      try {
        const next = await fetchWeb3KnowledgeGraph({ refresh });
        setPayload(next);
        setSelectedId((current) =>
          current && next.nodes.some((node) => node.id === current) ? current : undefined,
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "知识图谱加载失败");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const nodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (payload?.nodes ?? []).filter(
      (node) =>
        (mode === "全景" || domain === "全部 Web3" || node.domain === domain) &&
        (!risk || node.risk === risk) &&
        (!needle ||
          `${node.label} ${node.entities.join(" ")} ${node.domain} ${node.description}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [domain, mode, payload, query, risk]);
  const visibleIds = new Set(nodes.map((node) => node.id));
  const edges = (payload?.edges ?? []).filter(
    (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to),
  );
  const stages = (payload?.stages ?? []).filter((stage) =>
    nodes.some((node) => node.stage === stage),
  );
  const selectedNode = payload?.nodes.find((node) => node.id === selectedId);
  const selectedEdges = (payload?.edges ?? []).filter(
    (edge) => edge.from === selectedId || edge.to === selectedId,
  );

  const openAudit = async () => {
    setAuditOpen(true);
    setAuditLoading(true);
    try {
      const result = await fetchWeb3GraphAudit();
      setAuditEvents(result.events);
    } catch (reason) {
      messageApi.error(reason instanceof Error ? reason.message : "审计日志加载失败");
    } finally {
      setAuditLoading(false);
    }
  };

  const refreshPipeline = async () => {
    setPipelineLoading(true);
    try {
      const [status, queue] = await Promise.all([
        fetchWeb3GraphIngestionStatus(),
        fetchWeb3GraphCandidates("pending"),
      ]);
      setIngestionStatus(status);
      setCandidates(queue.candidates);
    } catch (reason) {
      messageApi.error(reason instanceof Error ? reason.message : "采集队列加载失败");
    } finally {
      setPipelineLoading(false);
    }
  };

  const openPipeline = async () => {
    setPipelineOpen(true);
    await refreshPipeline();
  };

  const runPipeline = async () => {
    setPipelineRunning(true);
    try {
      const result = await runWeb3GraphIngestion({
        refresh: true,
        useLlm: true,
      });
      messageApi.success(
        `已处理 ${result.items_seen} 条来源，新增 ${result.candidates_created} 个候选`,
      );
      await Promise.all([refreshPipeline(), load()]);
    } catch (reason) {
      messageApi.error(reason instanceof Error ? reason.message : "采集任务失败");
    } finally {
      setPipelineRunning(false);
    }
  };

  const reviewCandidate = async (
    candidate: Web3GraphCandidate,
    decision: "approve" | "reject",
  ) => {
    try {
      await reviewWeb3GraphCandidate(candidate.id, decision);
      messageApi.success(decision === "approve" ? "候选已写入正式图谱" : "候选已驳回");
      await Promise.all([refreshPipeline(), load()]);
    } catch (reason) {
      messageApi.error(reason instanceof Error ? reason.message : "审核操作失败");
    }
  };

  const updateSchedule = async (enabled: boolean, intervalMinutes?: number) => {
    const interval =
      intervalMinutes ?? ingestionStatus?.schedule.interval_minutes ?? 240;
    try {
      const result = await updateWeb3GraphSchedule(enabled, interval);
      setIngestionStatus((current) =>
        current ? { ...current, schedule: result.schedule } : current,
      );
      messageApi.success(enabled ? "定时采集已开启" : "定时采集已关闭");
    } catch (reason) {
      messageApi.error(reason instanceof Error ? reason.message : "调度配置保存失败");
    }
  };

  const submitNode = async () => {
    const values = await nodeForm.validateFields();
    setSaving(true);
    try {
      if (nodeModal === "edit" && selectedNode) {
        await updateWeb3GraphNode(selectedNode.id, {
          ...values,
          entities: String(values.entities || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          expected_version: selectedNode.version,
        });
        messageApi.success("实体已更新并写入审计日志");
      } else {
        await createWeb3GraphNode({
          ...values,
          entities: String(values.entities || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        });
        messageApi.success("实体已创建");
      }
      setNodeModal(null);
      nodeForm.resetFields();
      await load();
    } catch (reason) {
      messageApi.error(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const openCreateNode = () => {
    nodeForm.resetFields();
    nodeForm.setFieldsValue({ risk: "normal", node_type: "protocol" });
    setNodeModal("create");
  };

  const openEditNode = () => {
    if (!selectedNode) return;
    nodeForm.setFieldsValue({
      ...selectedNode,
      entities: selectedNode.entities.join(", "),
    });
    setNodeModal("edit");
  };

  const submitEdge = async () => {
    const values = await edgeForm.validateFields();
    setSaving(true);
    try {
      await createWeb3GraphEdge(values);
      edgeForm.resetFields();
      setEdgeModal(false);
      messageApi.success("关系已创建");
      await load();
    } catch (reason) {
      messageApi.error(reason instanceof Error ? reason.message : "关系创建失败");
    } finally {
      setSaving(false);
    }
  };

  const submitEvidence = async () => {
    if (!selectedNode) return;
    const values = await evidenceForm.validateFields();
    setSaving(true);
    try {
      await createWeb3GraphEvidence({ ...values, node_id: selectedNode.id });
      evidenceForm.resetFields();
      setEvidenceModal(false);
      messageApi.success("证据已保存并关联实体");
      await load();
    } catch (reason) {
      messageApi.error(reason instanceof Error ? reason.message : "证据保存失败");
    } finally {
      setSaving(false);
    }
  };

  const archiveSelectedNode = async () => {
    if (!selectedNode) return;
    try {
      await archiveWeb3GraphNode(selectedNode.id);
      setSelectedId(undefined);
      messageApi.success("实体及相关关系已归档");
      await load();
    } catch (reason) {
      messageApi.error(reason instanceof Error ? reason.message : "归档失败");
    }
  };

  return (
    <section className="research-paper knowledge-graph-view">
      {messageContext}
      <aside className="knowledge-sidebar">
        <div className="knowledge-sidebar-title">
          <strong>Web3 Knowledge Graph</strong>
          <span>持久化实体 · 关系 · 证据 · 审计</span>
        </div>
        <div className="knowledge-storage-badge">
          <i />
          SQLite 在线
          <span>{payload?.database ?? "knowledge_graph.db"}</span>
        </div>
        <div className="knowledge-stats">
          <div><b>{payload?.stats.nodes ?? 0}</b><span>NODES</span></div>
          <div><b>{payload?.stats.edges ?? 0}</b><span>EDGES</span></div>
          <div className="risk"><b>{payload?.stats.risks ?? 0}</b><span>HIGH RISKS</span></div>
          <div><b>{payload?.stats.evidence ?? 0}</b><span>EVIDENCE</span></div>
        </div>
        <span className="knowledge-domain-label">WEB3 DOMAINS</span>
        <nav aria-label="Web3 知识图谱领域">
          <button
            type="button"
            className={domain === "全部 Web3" ? "active" : ""}
            onClick={() => {
              setDomain("全部 Web3");
              setMode("全景");
            }}
          >
            <span>全部 Web3</span><b>{payload?.stats.nodes ?? 0}</b>
          </button>
          {(payload?.domains ?? []).map((item) => (
            <button
              key={item.name}
              type="button"
              className={domain === item.name ? "active" : ""}
              onClick={() => {
                setDomain(item.name);
                setMode("泳道");
              }}
            >
              <span>{item.name}</span><b>{item.count}</b>
            </button>
          ))}
        </nav>
        <p className="knowledge-help">
          所有编辑都会持久化并记录审计事件。删除采用可恢复的软归档。
        </p>
      </aside>

      <div className="knowledge-main">
        <header className="knowledge-toolbar">
          <div>
            <span>Web3</span><b>›</b><strong>{mode === "泳道" ? domain : "协议全景"}</strong>
          </div>
          <div>
            <Segmented
              value={mode}
              onChange={(value) => setMode(value as "全景" | "泳道")}
              options={[
                { label: "全景", value: "全景", icon: <AppstoreOutlined /> },
                { label: "泳道", value: "泳道", icon: <UnorderedListOutlined /> },
              ]}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索实体 / 代币 / 描述"
            />
            <Select
              allowClear
              value={risk || undefined}
              onChange={(value) => setRisk(value ?? "")}
              placeholder="风险等级"
              options={RISK_OPTIONS}
            />
            <Button icon={<LinkOutlined />} onClick={() => setEdgeModal(true)}>
              新建关系
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateNode}>
              新建实体
            </Button>
            <Button
              icon={<CloudSyncOutlined />}
              onClick={() => void openPipeline()}
            >
              采集与审核
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void load(true)}
              loading={loading}
            >
              同步证据
            </Button>
          </div>
        </header>
        <div className="knowledge-data-strip">
          <span>持久层：{payload?.storage ?? "—"}</span>
          <span>审计事件：{payload?.stats.audit_events ?? 0}</span>
          <span>最近更新：{payload?.updated_at?.slice(0, 19).replace("T", " ") ?? "—"}</span>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => void openAudit()}
          >
            查看审计
          </Button>
        </div>
        {error ? (
          <Alert type="error" showIcon message="Web3 知识图谱加载失败" description={error} />
        ) : null}
        {loading && !payload ? (
          <div className="research-loading"><Spin tip="正在加载持久化图谱…" /></div>
        ) : null}
        {payload ? (
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            stages={stages}
            selectedId={selectedId}
            onSelect={(node) => setSelectedId(node.id)}
          />
        ) : null}
      </div>

      <Drawer
        width={470}
        open={Boolean(selectedNode)}
        onClose={() => setSelectedId(undefined)}
        title={selectedNode ? `${selectedNode.label} · v${selectedNode.version}` : ""}
        extra={
          selectedNode ? (
            <Space>
              <Button icon={<EditOutlined />} onClick={openEditNode}>编辑</Button>
              <Popconfirm
                title="归档实体"
                description="相关关系也会归档，证据和审计记录保留。"
                onConfirm={() => void archiveSelectedNode()}
              >
                <Button danger icon={<DeleteOutlined />}>归档</Button>
              </Popconfirm>
            </Space>
          ) : null
        }
      >
        {selectedNode ? (
          <div className="knowledge-commercial-detail">
            <div className="knowledge-detail-tags">
              <Tag color="gold">{selectedNode.domain}</Tag>
              <Tag>{selectedNode.stage}</Tag>
              <Tag color={selectedNode.risk === "critical" ? "red" : "orange"}>
                {selectedNode.risk}
              </Tag>
            </div>
            <p>{selectedNode.description || "暂无研究描述，可通过编辑补充。"}</p>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="实体ID">{selectedNode.id}</Descriptions.Item>
              <Descriptions.Item label="类型">{selectedNode.node_type}</Descriptions.Item>
              <Descriptions.Item label="别名">
                {selectedNode.entities.join("、") || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="官网">
                {selectedNode.website ? (
                  <a href={selectedNode.website} target="_blank" rel="noreferrer">
                    {selectedNode.website}
                  </a>
                ) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {selectedNode.updated_at.slice(0, 19).replace("T", " ")}
              </Descriptions.Item>
            </Descriptions>

            <div className="knowledge-detail-heading">
              <strong>关系</strong><span>{selectedEdges.length}</span>
            </div>
            <List
              size="small"
              dataSource={selectedEdges}
              locale={{ emptyText: "暂无关系" }}
              renderItem={(edge) => {
                const peerId = edge.from === selectedNode.id ? edge.to : edge.from;
                const peer = payload?.nodes.find((node) => node.id === peerId);
                return (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="archive"
                        title="归档这条关系？"
                        onConfirm={async () => {
                          try {
                            await archiveWeb3GraphEdge(edge.id);
                            messageApi.success("关系已归档");
                            await load();
                          } catch (reason) {
                            messageApi.error(
                              reason instanceof Error ? reason.message : "关系归档失败",
                            );
                          }
                        }}
                      >
                        <Button type="text" danger size="small">归档</Button>
                      </Popconfirm>,
                    ]}
                  >
                    <span>{edge.from === selectedNode.id ? "→" : "←"} {edge.relation}</span>
                    <Button type="link" onClick={() => setSelectedId(peerId)}>
                      {peer?.label ?? peerId}
                    </Button>
                  </List.Item>
                );
              }}
            />

            <div className="knowledge-detail-heading">
              <strong>来源证据</strong>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setEvidenceModal(true)}>
                添加证据
              </Button>
            </div>
            <List
              className="knowledge-evidence-list"
              dataSource={selectedNode.evidence}
              locale={{ emptyText: "暂无证据，请关联官方文档或可信来源。" }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Popconfirm
                      key="archive"
                      title="归档这条证据？"
                      onConfirm={async () => {
                        await archiveWeb3GraphEvidence(item.id);
                        await load();
                      }}
                    >
                      <Button type="text" danger size="small">归档</Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={<a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>}
                    description={`${item.source} · 置信度 ${(item.confidence * 100).toFixed(0)}% · ${item.published_at?.slice(0, 10) ?? "日期未知"}`}
                  />
                </List.Item>
              )}
            />
          </div>
        ) : null}
      </Drawer>

      <Modal
        title={nodeModal === "edit" ? "编辑知识实体" : "新建知识实体"}
        open={Boolean(nodeModal)}
        onCancel={() => setNodeModal(null)}
        onOk={() => void submitNode()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={nodeForm} layout="vertical">
          <Form.Item name="id" label="唯一ID" rules={[{ required: true }]}>
            <Input disabled={nodeModal === "edit"} placeholder="例如 chainlink" />
          </Form.Item>
          <Form.Item name="label" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="knowledge-form-grid">
            <Form.Item name="node_type" label="类型" rules={[{ required: true }]}>
              <Select options={["protocol", "asset", "infrastructure", "organization"].map((value) => ({ label: value, value }))} />
            </Form.Item>
            <Form.Item name="risk" label="风险等级" rules={[{ required: true }]}>
              <Select options={RISK_OPTIONS} />
            </Form.Item>
          </div>
          <div className="knowledge-form-grid">
            <Form.Item name="stage" label="技术阶段" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="domain" label="研究领域" rules={[{ required: true }]}><Input /></Form.Item>
          </div>
          <Form.Item name="entities" label="别名 / 代币（逗号分隔）"><Input /></Form.Item>
          <Form.Item name="website" label="官方网站"><Input /></Form.Item>
          <Form.Item name="description" label="研究描述"><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建图谱关系"
        open={edgeModal}
        onCancel={() => setEdgeModal(false)}
        onOk={() => void submitEdge()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={edgeForm} layout="vertical" initialValues={{ confidence: 0.8 }}>
          <Form.Item name="source_id" label="起点" rules={[{ required: true }]}>
            <Select showSearch options={(payload?.nodes ?? []).map((node) => ({ label: node.label, value: node.id }))} />
          </Form.Item>
          <Form.Item name="relation" label="关系类型" rules={[{ required: true }]}><Input placeholder="例如：价格数据、部署、结算" /></Form.Item>
          <Form.Item name="target_id" label="终点" rules={[{ required: true }]}>
            <Select showSearch options={(payload?.nodes ?? []).map((node) => ({ label: node.label, value: node.id }))} />
          </Form.Item>
          <Form.Item name="confidence" label="置信度" rules={[{ required: true }]}>
            <InputNumber min={0} max={1} step={0.05} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`为 ${selectedNode?.label ?? ""} 添加证据`}
        open={evidenceModal}
        onCancel={() => setEvidenceModal(false)}
        onOk={() => void submitEvidence()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={evidenceForm} layout="vertical" initialValues={{ confidence: 0.8 }}>
          <Form.Item name="title" label="证据标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="url" label="来源URL" rules={[{ required: true, type: "url" }]}><Input /></Form.Item>
          <Form.Item name="source" label="来源名称" rules={[{ required: true }]}><Input placeholder="官方文档、审计报告、新闻机构…" /></Form.Item>
          <Form.Item name="published_at" label="发布日期"><Input type="date" /></Form.Item>
          <Form.Item name="confidence" label="置信度" rules={[{ required: true }]}>
            <InputNumber min={0} max={1} step={0.05} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="知识图谱审计日志"
        open={auditOpen}
        onCancel={() => setAuditOpen(false)}
        footer={null}
        width={720}
      >
        <List
          loading={auditLoading}
          dataSource={auditEvents}
          locale={{ emptyText: "暂无审计事件" }}
          renderItem={(event) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Tag color={event.action === "archive" ? "red" : "blue"}>
                    {event.action}
                  </Tag>
                }
                title={`${event.entity_type} · ${event.entity_id}`}
                description={`${event.actor} · ${event.created_at
                  .slice(0, 19)
                  .replace("T", " ")}`}
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title="知识采集与准入审核"
        open={pipelineOpen}
        onCancel={() => setPipelineOpen(false)}
        footer={null}
        width={900}
      >
        <Spin spinning={pipelineLoading}>
          <div className="knowledge-pipeline-summary">
            <div>
              <span>待审核</span>
              <strong>{ingestionStatus?.candidate_counts.pending ?? 0}</strong>
            </div>
            <div>
              <span>已批准</span>
              <strong>{ingestionStatus?.candidate_counts.approved ?? 0}</strong>
            </div>
            <div>
              <span>已驳回</span>
              <strong>{ingestionStatus?.candidate_counts.rejected ?? 0}</strong>
            </div>
            <div className="knowledge-pipeline-schedule">
              <span>定时采集</span>
              <Switch
                checked={ingestionStatus?.schedule.enabled ?? false}
                onChange={(checked) => void updateSchedule(checked)}
              />
              <Select
                value={ingestionStatus?.schedule.interval_minutes ?? 240}
                onChange={(value) =>
                  void updateSchedule(
                    ingestionStatus?.schedule.enabled ?? false,
                    value,
                  )
                }
                options={[
                  { label: "每小时", value: 60 },
                  { label: "每4小时", value: 240 },
                  { label: "每天", value: 1440 },
                ]}
              />
            </div>
          </div>

          <div className="knowledge-pipeline-actions">
            <div>
              <strong>候选准入队列</strong>
              <span>
                {ingestionStatus?.latest_run
                  ? `最近任务：${ingestionStatus.latest_run.extractor} · ${ingestionStatus.latest_run.items_seen} 条来源`
                  : "尚未运行采集任务"}
              </span>
            </div>
            <Button
              type="primary"
              icon={<CloudSyncOutlined />}
              loading={pipelineRunning}
              onClick={() => void runPipeline()}
            >
              立即采集并抽取
            </Button>
          </div>

          <List
            className="knowledge-candidate-list"
            dataSource={candidates}
            locale={{ emptyText: "暂无待审核候选，运行一次采集任务即可生成" }}
            renderItem={(candidate) => {
              const source = payload?.nodes.find(
                (node) => node.id === candidate.source_node_id,
              );
              const target = payload?.nodes.find(
                (node) => node.id === candidate.target_node_id,
              );
              const title =
                candidate.candidate_type === "edge"
                  ? `${source?.label ?? candidate.source_node_id} → ${candidate.relation} → ${target?.label ?? candidate.target_node_id}`
                  : `新实体 · ${candidate.proposed_node?.label ?? candidate.proposed_node?.id}`;
              return (
                <List.Item
                  actions={[
                    <Popconfirm
                      key="reject"
                      title="驳回这个候选？"
                      onConfirm={() => void reviewCandidate(candidate, "reject")}
                    >
                      <Button danger type="text">驳回</Button>
                    </Popconfirm>,
                    <Popconfirm
                      key="approve"
                      title="批准后将写入正式图谱"
                      description="系统会同时保存关系或实体及其来源证据。"
                      onConfirm={() => void reviewCandidate(candidate, "approve")}
                    >
                      <Button type="primary">批准准入</Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={title}
                    description={
                      <div className="knowledge-candidate-evidence">
                        <Space wrap>
                          <Tag>{candidate.extractor}</Tag>
                          <Tag color="gold">
                            置信度 {(candidate.confidence * 100).toFixed(0)}%
                          </Tag>
                        </Space>
                        <a
                          href={candidate.evidence.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {candidate.evidence.title}
                        </a>
                        <span>
                          {candidate.evidence.source} ·{" "}
                          {candidate.evidence.published_at?.slice(0, 10) ??
                            "日期未知"}
                        </span>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Spin>
      </Modal>
    </section>
  );
}
