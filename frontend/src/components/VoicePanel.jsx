import React, { useState } from "react";
import { api } from "../api.js";

export default function VoicePanel() {
  const [status, setStatus] = useState("idle");
  const [token, setToken] = useState(null);

  async function handleInit() {
    setStatus("loading");
    try {
      const session = await api.realtimeToken();
      setToken(session?.client_secret?.value || "ready");
      setStatus("ready");
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <div className="voice-panel">
      <h3>Voice / Realtime</h3>
      <p className="muted small">
        This panel prepares a Realtime session token for WebRTC integration.
      </p>
      <button className="secondary" onClick={handleInit} disabled={status === "loading"}>
        {status === "loading" ? "Preparing..." : "Create Realtime Session"}
      </button>
      {status === "ready" && <div className="notice">Realtime session ready</div>}
      {status === "error" && <div className="error">Failed to create session</div>}
      {token && <div className="token">Token: {token}</div>}
    </div>
  );
}
