"use client";

import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { AgentEvent, ConversationMeta, Conversation } from "@/lib/types";

type TimelineItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool_call"; name: string; args: Record<string, unknown>; expanded: boolean }
  | { kind: "tool_result"; name: string; result: string; expanded: boolean }
  | { kind: "error"; message: string };

type ContextMessage = {
  role: string;
  content?: unknown;
  toolCallId?: string;
  toolName?: string;
  stopReason?: string;
  timestamp?: number;
};

function roleLabel(msg: ContextMessage) {
  if (msg.role === "user") return { label: "user", color: "text-blue-400" };
  if (msg.role === "assistant") return { label: "assistant", color: "text-emerald-400" };
  if (msg.role === "toolResult") return { label: `tool: ${msg.toolName ?? "?"}`, color: "text-amber-400" };
  return { label: msg.role, color: "text-gray-400" };
}

function contentPreview(msg: ContextMessage): string {
  if (msg.role === "toolResult") {
    const c = msg.content as Array<{ text?: string }> | undefined;
    return c?.[0]?.text?.slice(0, 120) ?? "";
  }
  if (typeof msg.content === "string") return msg.content.slice(0, 120);
  if (Array.isArray(msg.content)) {
    return (msg.content as Array<{ type: string; text?: string }>)
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ")
      .slice(0, 120);
  }
  return JSON.stringify(msg.content ?? "").slice(0, 120);
}

// Tool name → color scheme
const TOOL_COLORS: Record<string, { border: string; header: string; text: string; icon: string }> = {
  read:      { border: "border-sky-700",    header: "bg-sky-900/40 text-sky-300 hover:bg-sky-900/60",    text: "text-sky-300",    icon: "📖" },
  grep:      { border: "border-violet-700", header: "bg-violet-900/40 text-violet-300 hover:bg-violet-900/60", text: "text-violet-300", icon: "🔍" },
  glob:      { border: "border-indigo-700", header: "bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60", text: "text-indigo-300", icon: "📂" },
  bash:      { border: "border-orange-700", header: "bg-orange-900/40 text-orange-300 hover:bg-orange-900/60", text: "text-orange-300", icon: "💻" },
  run_code:  { border: "border-purple-700", header: "bg-purple-900/40 text-purple-300 hover:bg-purple-900/60", text: "text-purple-300", icon: "⚡" },
  write:     { border: "border-teal-700",   header: "bg-teal-900/40 text-teal-300 hover:bg-teal-900/60",   text: "text-teal-300",   icon: "✍️" },
  edit:      { border: "border-cyan-700",   header: "bg-cyan-900/40 text-cyan-300 hover:bg-cyan-900/60",   text: "text-cyan-300",   icon: "✏️" },
  TodoWrite: { border: "border-pink-700",   header: "bg-pink-900/40 text-pink-300 hover:bg-pink-900/60",   text: "text-pink-300",   icon: "✅" },
  webSearch: { border: "border-yellow-700", header: "bg-yellow-900/40 text-yellow-300 hover:bg-yellow-900/60", text: "text-yellow-300", icon: "🌐" },
  webFetch:  { border: "border-lime-700",   header: "bg-lime-900/40 text-lime-300 hover:bg-lime-900/60",   text: "text-lime-300",   icon: "🔗" },
};

const DEFAULT_TOOL_COLOR = { border: "border-gray-700", header: "bg-gray-800 text-gray-300 hover:bg-gray-700", text: "text-gray-300", icon: "🔧" };

// M1 — module-level, not re-declared on every render
function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function Page() {
  const [input, setInput] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<unknown[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contextBottomRef = useRef<HTMLDivElement>(null);
  // I2 — guard against duplicate title saves
  const titleSavedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline]);

  useEffect(() => {
    contextBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Load conversations on mount ────────────────────────────────
  useEffect(() => {
    loadConversations();
  }, []);

  // I4 — short-circuit when already active; C1 — error handling
  async function selectConversation(id: string) {
    if (id === conversationId) return;
    try {
      const r = await fetch(`/api/conversations/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const conv: Conversation = await r.json();
      setConversationId(id);
      titleSavedRef.current = false;
      setMessages(conv.messages as unknown[]);
      setTimeline(conv.timeline as TimelineItem[]);
    } catch (err) {
      console.error("[selectConversation] failed:", err);
    }
  }

  // C1 — error handling
  async function handleNewConversation() {
    try {
      const r = await fetch("/api/conversations", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const conv: Conversation = await r.json();
      setConversationId(conv.id);
      setMessages([]);
      setTimeline([]);
      setConversations((prev) => [conv, ...prev]);
      // I2 — reset title guard for new conversation
      titleSavedRef.current = false;
    } catch (err) {
      console.error("[handleNewConversation] failed:", err);
    }
  }

  // C1 — error handling
  async function loadConversations() {
    try {
      const r = await fetch("/api/conversations");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const list: ConversationMeta[] = await r.json();
      if (list.length > 0) {
        setConversations(list);
        const r2 = await fetch(`/api/conversations/${list[0].id}`);
        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
        const conv: Conversation = await r2.json();
        setConversationId(list[0].id);
        setMessages(conv.messages as unknown[]);
        setTimeline(conv.timeline as TimelineItem[]);
      } else {
        const r2 = await fetch("/api/conversations", { method: "POST" });
        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
        const conv: Conversation = await r2.json();
        setConversationId(conv.id);
        setConversations([conv]);
      }
    } catch (err) {
      console.error("[loadConversations] failed:", err);
    }
  }

  // C2 — error handling
  async function saveConversation(patch: { messages?: unknown[]; timeline?: unknown[]; title?: string }) {
    if (!conversationId) return;
    try {
      const r = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (err) {
      console.error("[saveConversation] failed:", err);
    }
  }

  function toggleExpand(index: number) {
    setTimeline((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (item.kind === "tool_call" || item.kind === "tool_result")
          return { ...item, expanded: !item.expanded };
        return item;
      })
    );
  }

  async function handleSend() {
    if (!input.trim() || loading || !conversationId) return;

    const userText = input.trim();
    // I2 — guard against duplicate title saves
    if (!titleSavedRef.current && (messages as unknown[]).length === 0) {
      titleSavedRef.current = true;
      const title = userText.slice(0, 60);
      saveConversation({ title });
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title } : c))
      );
    }
    setInput("");
    setLoading(true);

    // Include full conversation context so the model has memory of prior turns
    const newMessages = [
      ...messages,
      { role: "user", content: userText, timestamp: Date.now() },
    ];

    setTimeline((prev) => [...prev, { kind: "user", text: userText }]);
    setTimeline((prev) => [...prev, { kind: "assistant", text: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event: AgentEvent = JSON.parse(line.slice(6));
          handleEvent(event);
        }
      }
    } catch (err) {
      setTimeline((prev) => [...prev, { kind: "error", message: String(err) }]);
    } finally {
      setLoading(false);
    }
  }

  function handleEvent(event: AgentEvent) {
    switch (event.type) {
      case "text_delta":
        setTimeline((prev) => {
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].kind === "assistant") {
              copy[i] = { ...copy[i], text: (copy[i] as { kind: "assistant"; text: string }).text + event.delta };
              break;
            }
          }
          return copy;
        });
        break;

      case "tool_call":
        setTimeline((prev) => [
          ...prev,
          { kind: "tool_call", name: event.name, args: event.args, expanded: false },
        ]);
        break;

      case "tool_result":
        setTimeline((prev) => [
          ...prev,
          { kind: "tool_result", name: event.name, result: event.result, expanded: false },
          { kind: "assistant", text: "" },
        ]);
        break;

      case "error":
        setTimeline((prev) => [...prev, { kind: "error", message: event.message }]);
        break;

      case "context_update":
        // Server sends the authoritative full context after each turn — use this
        // as the messages to send on the next turn (multi-turn memory)
        setMessages(event.messages);
        saveConversation({ messages: event.messages });
        break;

      case "done": {
        let trimmed: TimelineItem[] = [];
        flushSync(() => {
          setTimeline((prev) => {
            const copy = [...prev];
            while (
              copy.length > 0 &&
              copy[copy.length - 1].kind === "assistant" &&
              (copy[copy.length - 1] as { text: string }).text === ""
            )
              copy.pop();
            trimmed = copy;
            return copy;
          });
        });
        if (conversationId) {
          saveConversation({ timeline: trimmed });
          // I3 — add .catch to the conversation list refresh
          fetch("/api/conversations")
            .then((r) => r.json())
            .then(setConversations)
            .catch((err) => console.error("[refreshConversations] failed:", err));
        }
        break;
      }
    }
  }

  const contextMessages = messages as ContextMessage[];

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">

      {/* ── 左侧面板 ── */}
      <div className="w-64 flex-shrink-0 border-r border-gray-800/80 flex flex-col bg-gray-950">

        {/* Conversations */}
        <div className="flex flex-col border-b border-gray-800/80" style={{ maxHeight: "50%" }}>
          <div className="px-3 py-2.5 border-b border-gray-800/60 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Conversations</span>
            {/* I1 — disable button while loading */}
            <button
              onClick={handleNewConversation}
              disabled={loading}
              className="text-[10px] text-gray-500 hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 rounded px-1.5 py-0.5 transition-colors"
            >
              新对话
            </button>
          </div>
          <div className="overflow-y-auto p-2 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`w-full text-left rounded-md px-2.5 py-2 border transition-colors ${
                  conv.id === conversationId
                    ? "bg-blue-900/30 border-blue-700/50"
                    : "bg-gray-900/70 border-gray-800/60 hover:border-gray-700/60"
                }`}
              >
                <div className="text-[11px] text-gray-300 truncate">{conv.title}</div>
                <div className="text-[9px] text-gray-600 mt-0.5">{formatRelativeTime(conv.updated_at)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Context */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-gray-800/80 flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Context</span>
            {contextMessages.length > 0 && (
              <span className="text-[10px] text-gray-600 bg-gray-800 rounded-full px-1.5 py-0.5">
                {contextMessages.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {contextMessages.length === 0 ? (
              <p className="text-xs text-gray-600 px-2 py-3 leading-relaxed">
                发送消息后，完整上下文会出现在这里
              </p>
            ) : (
              contextMessages.map((msg, i) => {
                const { label, color } = roleLabel(msg);
                const preview = contentPreview(msg);
                return (
                  <div key={i} className="rounded-md px-2.5 py-2 bg-gray-900/70 border border-gray-800/60 hover:border-gray-700/60 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
                      {msg.stopReason && (
                        <span className="text-[9px] text-gray-600 bg-gray-800 rounded px-1">{msg.stopReason}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 leading-relaxed break-words whitespace-pre-wrap">
                      {preview}{preview.length >= 120 ? "…" : ""}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={contextBottomRef} />
          </div>
        </div>
      </div>

      {/* ── 右侧聊天面板 ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header — M4: removed empty div */}
        <div className="px-5 py-3 border-b border-gray-800/80 flex items-center gap-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
          <h1 className="text-sm font-semibold text-gray-200 tracking-tight">Agent Loop Demo</h1>
          {loading && (
            <span className="ml-2 text-xs text-gray-500 animate-pulse">thinking…</span>
          )}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {timeline.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-600">试试：&quot;帮我搜索 MiniMax M2 模型的最新进展&quot;</p>
            </div>
          )}

          {timeline.map((item, i) => {
            if (item.kind === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[78%] text-sm leading-relaxed shadow-sm">
                    {item.text}
                  </div>
                </div>
              );
            }

            if (item.kind === "assistant") {
              if (!item.text) return null;
              return (
                <div key={i} className="flex justify-start">
                  <div
                    className="bg-gray-800/80 border border-gray-700/50 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm leading-relaxed shadow-sm prose prose-invert prose-sm"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(item.text) as string) }}
                  />
                </div>
              );
            }

            if (item.kind === "tool_call" || item.kind === "tool_result") {
              const isCall = item.kind === "tool_call";
              const c = TOOL_COLORS[item.name] ?? DEFAULT_TOOL_COLOR;
              return (
                <div key={i} className={`border ${c.border} rounded-xl overflow-hidden text-xs shadow-sm`}>
                  <button
                    onClick={() => toggleExpand(i)}
                    className={`w-full flex items-center justify-between px-3 py-2 ${c.header} transition-colors`}
                  >
                    <span className="flex items-center gap-2 font-mono">
                      <span>{c.icon}</span>
                      <span className="font-semibold">{isCall ? "tool_call" : "tool_result"}</span>
                      <span className="opacity-60">·</span>
                      <span>{item.name}</span>
                    </span>
                    <span className="text-[10px] opacity-50">{item.expanded ? "▲" : "▼"}</span>
                  </button>
                  {item.expanded && (
                    <pre className="px-3 py-2.5 bg-gray-950/80 text-gray-300 text-[11px] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                      {isCall
                        ? JSON.stringify((item as { args: unknown }).args, null, 2)
                        : (item as { result: string }).result}
                    </pre>
                  )}
                </div>
              );
            }

            if (item.kind === "error") {
              return (
                <div key={i} className="bg-red-950/40 border border-red-800/60 rounded-xl px-4 py-2.5 text-red-300 text-sm">
                  ⚠️ {item.message}
                </div>
              );
            }

            return null;
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-800/80 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <input
              className="flex-1 bg-gray-800/80 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-40 placeholder-gray-600 transition-colors"
              placeholder='试试 "搜索 Tavily API 的使用方法" 或 "列出项目里的 ts 文件"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors flex-shrink-0"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" />
                </span>
              ) : "发送"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
