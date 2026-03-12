import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Sidebar({
  user,
  selectedChat,
  onSelectChat,
  onLogout,
  view,
  onSetView
}) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadChats = async () => {
    setLoading(true);
    try {
      const data = await api.listChats();
      setChats(data);
      if (!selectedChat && data.length > 0) {
        onSelectChat(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  async function handleNewChat() {
    const created = await api.createChat("新对话");
    await loadChats();
    onSelectChat(created.id);
    onSetView("chat");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">AI</div>
        <div>
          <div className="brand-title">中控台</div>
          <div className="muted small">{user.email}</div>
        </div>
      </div>

      <button className="btn primary" onClick={handleNewChat}>
        <span className="icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        新建对话
      </button>

      {user.role === "admin" && (
        <button
          className={view === "admin" ? "btn secondary" : "btn ghost"}
          onClick={() => onSetView("admin")}
        >
          <span className="icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3l7 4v5c0 5-3.5 9-7 11-3.5-2-7-6-7-11V7l7-4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          管理员控制台
        </button>
      )}

      <div className="section-title">对话列表</div>
      <div className="chat-list">
        {loading && <div className="muted">加载中...</div>}
        {!loading &&
          chats.map((chat) => (
            <button
              key={chat.id}
              className={`chat-item ${selectedChat === chat.id ? "active" : ""}`}
              onClick={() => {
                onSelectChat(chat.id);
                onSetView("chat");
              }}
            >
              <span className="chat-dot" />
              {chat.title || "未命名对话"}
            </button>
          ))}
      </div>

      <button className="btn ghost" onClick={onLogout}>
        <span className="icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 12h6m0 0l-3-3m3 3l-3 3M4 5h7a2 2 0 0 1 2 2v3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        退出登录
      </button>
    </aside>
  );
}
