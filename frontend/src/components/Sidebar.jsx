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
    const created = await api.createChat("New Conversation");
    await loadChats();
    onSelectChat(created.id);
    onSetView("chat");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">GPT</div>
        <div>
          <div className="brand-title">Control Room</div>
          <div className="muted small">{user.email}</div>
        </div>
      </div>
      <button className="secondary" onClick={handleNewChat}>
        New Chat
      </button>
      {user.role === "admin" && (
        <button
          className={view === "admin" ? "primary" : "ghost"}
          onClick={() => onSetView("admin")}
        >
          Admin Console
        </button>
      )}
      <div className="chat-list">
        {loading && <div className="muted">Loading...</div>}
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
              {chat.title || "Untitled"}
            </button>
          ))}
      </div>
      <button className="ghost" onClick={onLogout}>
        Logout
      </button>
    </aside>
  );
}
