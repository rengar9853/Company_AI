import React, { useState } from "react";
import { api } from "../api.js";

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await api.login(email, password);
      onSuccess(user);
    } catch (err) {
      setError("登录失败，请检查账号或密码");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page center">
      <div className="card login-card">
        <div className="login-badge">内部账号</div>
        <h1>欢迎回来</h1>
        <p className="muted">企业级 AI 中控台 · 安全登录</p>
        <form onSubmit={handleSubmit} className="form">
          <label>
            邮箱
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="name@company.com"
              required
            />
          </label>
          <label>
            密码
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="请输入密码"
              required
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary" disabled={loading} type="submit">
            <span className="icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 12h12m0 0l-4-4m4 4l-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <div className="login-footer muted small">仅管理员可创建或启用账号</div>
      </div>
    </div>
  );
}
