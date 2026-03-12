import React, { useEffect, useState } from "react";
import { api } from "../api.js";

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
      setError("Failed to load users");
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
      setNotice("User created");
      await loadUsers();
    } catch (err) {
      setError("Create failed");
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
      setError("Password must be at least 6 characters");
      return;
    }
    await api.updateUser(user.id, { password: newPassword });
    setResetPasswords((prev) => ({ ...prev, [user.id]: "" }));
    setNotice("Password updated");
  }

  return (
    <section className="admin-panel">
      <header className="admin-header">
        <div>
          <h2>Admin Console</h2>
          <p className="muted small">Manage internal users</p>
        </div>
        <button className="ghost" onClick={loadUsers} disabled={loading}>
          Refresh
        </button>
      </header>

      <form className="admin-form" onSubmit={handleCreate}>
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button className="primary" type="submit">
          Create User
        </button>
      </form>

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <div className="user-table">
        <div className="user-row header">
          <div>Email</div>
          <div>Role</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        {users.map((user) => (
          <div className="user-row" key={user.id}>
            <div>
              <div className="strong">{user.email}</div>
              <div className="muted small">{user.id}</div>
            </div>
            <div>{user.role}</div>
            <div>{user.status}</div>
            <div className="row-actions">
              <button
                className="secondary"
                onClick={() => handleToggleStatus(user)}
                disabled={user.id === currentUser.id}
              >
                {user.status === "active" ? "Disable" : "Enable"}
              </button>
              <button
                className="ghost"
                onClick={() => handleToggleRole(user)}
                disabled={user.id === currentUser.id}
              >
                {user.role === "admin" ? "Make User" : "Make Admin"}
              </button>
              <div className="reset">
                <input
                  type="password"
                  placeholder="New password"
                  value={resetPasswords[user.id] || ""}
                  onChange={(e) =>
                    setResetPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))
                  }
                />
                <button className="primary" onClick={() => handleResetPassword(user)}>
                  Reset
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
