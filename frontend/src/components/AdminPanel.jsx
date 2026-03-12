import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const roleLabel = (role) => (role === "admin" ? "管理员" : "普通用户");
const statusLabel = (status) => (status === "active" ? "启用" : "禁用");

export default function AdminPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "user" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetPasswords, setResetPasswords] = useState({});

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      setError("加载用户失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api.createUser(form);
      setForm({ email: "", password: "", role: "user" });
      setNotice("用户创建成功");
      await loadUsers();
    } catch (err) {
      setError("创建失败，请检查输入");
    }
  }

  async function handleToggleStatus(user) {
    if (user.id === currentUser.id) return;
    const nextStatus = user.status === "active" ? "disabled" : "active";
    await api.updateUser(user.id, { status: nextStatus });
    await loadUsers();
  }

  async function handleToggleRole(user) {
    if (user.id === currentUser.id) return;
    const nextRole = user.role === "admin" ? "user" : "admin";
    await api.updateUser(user.id, { role: nextRole });
    await loadUsers();
  }

  async function handleResetPassword(user) {
    const newPassword = resetPasswords[user.id];
    if (!newPassword || newPassword.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    await api.updateUser(user.id, { password: newPassword });
    setResetPasswords((prev) => ({ ...prev, [user.id]: "" }));
    setNotice("密码已更新");
  }

  return (
    <section className="admin-panel">
      <header className="admin-header">
        <div className="panel-title">
          <span className="title-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3l7 4v5c0 5-3.5 9-7 11-3.5-2-7-6-7-11V7l7-4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <h2>管理员控制台</h2>
            <p className="muted small">管理内部账号与权限</p>
          </div>
        </div>
        <button className="btn ghost" onClick={loadUsers} disabled={loading}>
          刷新
        </button>
      </header>

      <form className="admin-form" onSubmit={handleCreate}>
        <input
          type="email"
          placeholder="邮箱"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="初始密码"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
        <button className="btn primary" type="submit">
          创建用户
        </button>
      </form>

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <div className="user-table">
        <div className="user-row header">
          <div>用户</div>
          <div>角色</div>
          <div>状态</div>
          <div>操作</div>
        </div>
        {users.map((user) => (
          <div className="user-row" key={user.id}>
            <div>
              <div className="strong">{user.email}</div>
              <div className="muted small">{user.id}</div>
            </div>
            <div>{roleLabel(user.role)}</div>
            <div>
              <span className={`status ${user.status}`}>{statusLabel(user.status)}</span>
            </div>
            <div className="row-actions">
              <button
                className="btn secondary"
                onClick={() => handleToggleStatus(user)}
                disabled={user.id === currentUser.id}
              >
                {user.status === "active" ? "禁用" : "启用"}
              </button>
              <button
                className="btn ghost"
                onClick={() => handleToggleRole(user)}
                disabled={user.id === currentUser.id}
              >
                {user.role === "admin" ? "设为普通用户" : "设为管理员"}
              </button>
              <div className="reset">
                <input
                  type="password"
                  placeholder="新密码"
                  value={resetPasswords[user.id] || ""}
                  onChange={(e) =>
                    setResetPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))
                  }
                />
                <button className="btn primary" onClick={() => handleResetPassword(user)}>
                  重置
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
