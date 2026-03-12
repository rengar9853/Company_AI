import React, { useEffect, useState } from "react";
import { api, streamMessage } from "../api.js";

const roleLabel = (role) => {
  switch (role) {
    case "user":
      return "你";
    case "assistant":
      return "助手";
    case "tool":
      return "工具";
    case "system":
      return "系统";
    default:
      return role;
  }
};

export default function Chat({ selectedChat, onSelectChat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!selectedChat) return;
    setLoading(true);
    api
      .getChat(selectedChat)
      .then((data) => setMessages(data.messages || []))
      .finally(() => setLoading(false));
  }, [selectedChat]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { id: `u-${Date.now()}`, role: "user", content: input };
    setMessages((prev) => [...prev, userMsg, { id: "assistant-stream", role: "assistant", content: "" }]);
    setInput("");

    try {
      if (streaming) {
        let accumulated = "";
        await streamMessage(
          selectedChat,
          { content: userMsg.content, useTools: true },
          (delta) => {
            accumulated += delta;
            setMessages((prev) => {
              const next = [...prev];
              const lastIndex = next.findIndex((m) => m.id === "assistant-stream");
              if (lastIndex >= 0) {
                next[lastIndex] = { ...next[lastIndex], content: accumulated };
              }
              return next;
            });
          },
          () => {
            setMessages((prev) => prev.filter((m) => m.id !== "assistant-stream"));
            setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: accumulated }]);
          }
        );
      } else {
        const result = await api.sendMessage(selectedChat, { content: userMsg.content, stream: false });
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== "assistant-stream"),
          { id: `a-${Date.now()}`, role: "assistant", content: result.text }
        ]);
      }
    } catch (err) {
      setNotice("消息发送失败，请稍后重试");
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    setUploading(true);
    try {
      await api.uploadFile(file, selectedChat);
      setNotice("文件已上传并完成索引");
    } catch (err) {
      setNotice("上传失败，请检查文件类型或大小");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (!selectedChat) {
    return <div className="empty">请选择或新建一个对话开始</div>;
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div>
          <div className="panel-title">
            <span className="title-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2>智能对话</h2>
          </div>
          <div className="muted small">
            工具已启用 · 模型: {import.meta.env.VITE_MODEL || "默认"}
          </div>
        </div>
        <div className="controls">
          <label className="toggle">
            <input type="checkbox" checked={streaming} onChange={() => setStreaming((s) => !s)} />
            <span>流式输出</span>
          </label>
          <label className="btn ghost upload">
            <input type="file" onChange={handleUpload} disabled={uploading} />
            <span className="icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {uploading ? "上传中..." : "上传文件"}
          </label>
        </div>
      </header>
      <div className="chat-body">
        {loading && <div className="muted">加载中...</div>}
        {!loading &&
          messages.map((m, idx) => (
            <div key={m.id || idx} className={`msg ${m.role}`}>
              <div className="role">{roleLabel(m.role)}</div>
              <div className="content">{m.content}</div>
            </div>
          ))}
      </div>
      {notice && <div className="notice">{notice}</div>}
      <form onSubmit={handleSend} className="chat-input">
        <input
          placeholder="输入你的问题或需求..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn primary" type="submit">
          <span className="icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 12l16-7-4.5 7L20 19 4 12z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          发送
        </button>
      </form>
    </section>
  );
}
