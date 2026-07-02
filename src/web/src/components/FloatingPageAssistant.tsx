import {
  CloseOutlined,
  DragOutlined,
  MessageOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Button, Input, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

type AssistantPosition = {
  x: number;
  y: number;
};

const PAGE_LABELS: Record<string, string> = {
  "/trading": "市场总览",
  "/radar": "深度分析",
  "/backtests": "策略回测",
  "/live-trading": "模拟交易",
  "/data-sources": "数据源",
  "/risk": "风控中心",
  "/strategy": "策略 DSL",
  "/research": "市场情报",
};

const SUGGESTED_QUESTIONS = ["这个页面能做什么？", "有哪些关键指标？", "我下一步该看哪里？"];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getVisibleText(node: Element) {
  const style = window.getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden") {
    return "";
  }
  return compactText((node as HTMLElement).innerText ?? node.textContent ?? "");
}

function collectPageKnowledge() {
  const root = document.querySelector(".app-shell-content") ?? document.body;
  const title =
    compactText(document.querySelector(".app-shell-title")?.textContent ?? "") ||
    compactText(document.title) ||
    "当前页面";
  const candidates = Array.from(
    root.querySelectorAll(
      [
        "h1",
        "h2",
        "h3",
        ".ant-card-head-title",
        ".glow-card-title",
        ".stat-label",
        ".kpi-label",
        ".ant-tabs-tab",
        ".ant-table-thead th",
        ".ant-table-tbody td",
        "button",
        "label",
        "p",
      ].join(","),
    ),
  );

  const lines = candidates
    .map(getVisibleText)
    .filter((text) => text.length >= 2 && text.length <= 180)
    .filter((text, index, all) => all.indexOf(text) === index)
    .slice(0, 120);

  const body = compactText((root as HTMLElement).innerText ?? "");
  return {
    title,
    lines,
    body: body.slice(0, 8000),
  };
}

function tokenize(text: string) {
  const normalized = text.toLowerCase();
  const words = normalized.match(/[a-z0-9._-]+|[\u4e00-\u9fa5]{2,}/g) ?? [];
  const cjk = normalized.match(/[\u4e00-\u9fa5]/g) ?? [];
  const pairs = cjk.slice(0, -1).map((char, index) => `${char}${cjk[index + 1]}`);
  return Array.from(new Set([...words, ...pairs])).filter((token) => token.length > 1);
}

function scoreLine(line: string, queryTokens: string[]) {
  const lower = line.toLowerCase();
  return queryTokens.reduce((score, token) => score + (lower.includes(token) ? token.length : 0), 0);
}

function answerFromPage(question: string) {
  const knowledge = collectPageKnowledge();
  const pageName = PAGE_LABELS[window.location.pathname] ?? "当前页面";
  const questionTokens = tokenize(question);
  const headingLines = knowledge.lines.slice(0, 12);

  if (!knowledge.body && knowledge.lines.length === 0) {
    return "我还没有读到当前页面的可见内容。请等页面加载完成，或点击刷新上下文后再问。";
  }

  if (/页面|这里|当前|做什么|介绍|概览|总览/.test(question)) {
    const summary = headingLines.slice(0, 6).join("、");
    return `这是「${pageName}」页面。当前可见的主要信息包括：${summary || knowledge.title}。你可以继续问某个指标、表格字段或按钮的含义，我会只基于页面上可见内容回答。`;
  }

  const ranked = knowledge.lines
    .map((line) => ({ line, score: scoreLine(line, questionTokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.line);

  if (ranked.length > 0) {
    return `我从当前页面可见内容里找到这些相关信息：\n${ranked.map((line) => `- ${line}`).join("\n")}\n\n如果你问的是计算逻辑或数据来源，请点开对应卡片或表格后再问，我会重新读取页面上下文。`;
  }

  const fallback = headingLines.slice(0, 5).join("、");
  return `当前页面没有直接匹配到「${question}」的可见文本。可先关注这些区域：${fallback || knowledge.title}。你也可以换成页面上的具体指标名、表格列名或按钮名来问。`;
}

export default function FloatingPageAssistant() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [position, setPosition] = useState<AssistantPosition>({ x: 0, y: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "我可以读取当前页面上的可见内容。拖动顶部手柄移动我，然后直接问页面里的指标、表格或按钮。",
    },
  ]);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const dimensions = open ? { width: 360, height: 500 } : { width: 58, height: 58 };

  const pageLabel = useMemo(() => PAGE_LABELS[location.pathname] ?? "当前页面", [location.pathname]);

  useEffect(() => {
    const initial = {
      x: Math.max(18, window.innerWidth - dimensions.width - 28),
      y: Math.max(78, window.innerHeight - dimensions.height - 28),
    };
    setPosition(initial);
  }, []);

  useEffect(() => {
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text: `已切换到「${pageLabel}」。我会按这个页面当前可见内容回答。`,
      },
    ]);
  }, [pageLabel]);

  const keepInViewport = useCallback(
    (next: AssistantPosition) => ({
      x: clamp(next.x, 12, Math.max(12, window.innerWidth - dimensions.width - 12)),
      y: clamp(next.y, 12, Math.max(12, window.innerHeight - dimensions.height - 12)),
    }),
    [dimensions.height, dimensions.width],
  );

  useEffect(() => {
    const onResize = () => setPosition((current) => keepInViewport(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [keepInViewport]);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setPosition(
      keepInViewport({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      }),
    );
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const submitQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    const answer = answerFromPage(trimmed);
    setMessages((current) => [...current, { role: "user", text: trimmed }, { role: "assistant", text: answer }]);
    setInput("");
    setOpen(true);
  };

  const refreshContext = () => {
    const knowledge = collectPageKnowledge();
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text: `已重新读取「${pageLabel}」：识别到 ${knowledge.lines.length} 条可见页面信息。`,
      },
    ]);
  };

  const stopAssistantActionDrag = (event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    dragRef.current = null;
  };

  if (!open) {
    return (
      <Tooltip title="页面助手">
        <button
          type="button"
          className="page-assistant-bubble"
          style={{ left: position.x, top: position.y }}
          onClick={() => setOpen(true)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label="打开页面助手"
        >
          <MessageOutlined />
        </button>
      </Tooltip>
    );
  }

  return (
    <section className="page-assistant-panel" style={{ left: position.x, top: position.y }} aria-label="页面助手">
      <div
        className="page-assistant-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="page-assistant-title">
          <DragOutlined />
          页面助手
        </span>
        <div className="page-assistant-actions" onPointerDown={stopAssistantActionDrag}>
          <Tooltip title="刷新页面上下文">
            <button type="button" onClick={refreshContext} aria-label="刷新页面上下文">
              <ReloadOutlined />
            </button>
          </Tooltip>
          <Tooltip title="收起">
            <button type="button" onClick={() => setOpen(false)} aria-label="收起页面助手">
              <CloseOutlined />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="page-assistant-context">{pageLabel} · 仅基于当前页面可见内容</div>

      <div className="page-assistant-messages">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`page-assistant-message ${message.role}`}>
            {message.text}
          </div>
        ))}
      </div>

      <div className="page-assistant-suggestions">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button type="button" key={question} onClick={() => submitQuestion(question)}>
            {question}
          </button>
        ))}
      </div>

      <div className="page-assistant-input">
        <Input.TextArea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              submitQuestion(input);
            }
          }}
          placeholder="问页面上的知识..."
          autoSize={{ minRows: 1, maxRows: 3 }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={() => submitQuestion(input)} aria-label="发送问题" />
      </div>
    </section>
  );
}
