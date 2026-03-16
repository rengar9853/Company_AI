import React, { useState } from "react";
import { api } from "../api.js";

export default function VoicePanel() {
  const [status, setStatus] = useState("idle");
  const [token, setToken] = useState(null);
  const [provider, setProvider] = useState(null);
  const [webrtcUrl, setWebrtcUrl] = useState(null);

  async function handleInit() {
    setStatus("loading");
    try {
      const session = await api.realtimeToken();
      setToken(session?.client_secret?.value || "ready");
      setProvider(session?.provider || null);
      setWebrtcUrl(session?.webrtc_url || null);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <div className="voice-panel">
      <div className="panel-title">
        <span className="title-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3v10m0 0a3 3 0 0 1-3-3V6a3 3 0 1 1 6 0v4a3 3 0 0 1-3 3zm6 0a6 6 0 0 1-12 0m6 6v3m-4 0h8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h3>语音 / 实时会话</h3>
      </div>
      <p className="muted small">
        该面板用于准备 Realtime 会话令牌，后续可对接 WebRTC 语音通话。
      </p>
      <button className="btn secondary" onClick={handleInit} disabled={status === "loading"}>
        {status === "loading" ? "准备中..." : "创建实时会话"}
      </button>
      {status === "ready" && <div className="notice">Realtime 会话已就绪</div>}
      {status === "error" && <div className="error">创建会话失败</div>}
      {provider && <div className="muted small">当前提供方：{provider}</div>}
      {webrtcUrl && <div className="token">WebRTC: {webrtcUrl}</div>}
      {token && <div className="token">令牌: {token}</div>}
    </div>
  );
}
