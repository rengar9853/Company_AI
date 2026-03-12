import React, { useEffect, useState } from "react";
import { api, streamMessage } from "../api.js";

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
        setMessages((prev) => [...prev.filter((m) => m.id !== "assistant-stream"), { id: `a-${Date.now()}`, role: "assistant", content: result.text }]);
      }
    } catch (err) {
      setNotice("Message failed");
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    setUploading(true);
    try {
      await api.uploadFile(file, selectedChat);
      setNotice("File uploaded and indexed");
    } catch (err) {
      setNotice("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (!selectedChat) {
    return <div className="empty">Create a conversation to start.</div>;
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div>
          <h2>Conversation</h2>
          <p className="muted small">Tools enabled, model: {import.meta.env.VITE_MODEL || "default"}</p>
        </div>
        <div className="controls">
          <label className="toggle">
            <input type="checkbox" checked={streaming} onChange={() => setStreaming((s) => !s)} />
            <span>Streaming</span>
          </label>
          <label className="upload">
            <input type="file" onChange={handleUpload} disabled={uploading} />
            <span>{uploading ? "Uploading..." : "Upload File"}</span>
          </label>
        </div>
      </header>
      <div className="chat-body">
        {loading && <div className="muted">Loading...</div>}
        {!loading &&
          messages.map((m, idx) => (
            <div key={m.id || idx} className={`msg ${m.role}`}>
              <div className="role">{m.role}</div>
              <div className="content">{m.content}</div>
            </div>
          ))}
      </div>
      {notice && <div className="notice">{notice}</div>}
      <form onSubmit={handleSend} className="chat-input">
        <input
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="primary" type="submit">
          Send
        </button>
      </form>
    </section>
  );
}
