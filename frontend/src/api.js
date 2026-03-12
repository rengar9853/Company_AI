const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (email, password) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  logout: () => apiFetch("/auth/logout", { method: "POST" }),
  me: () => apiFetch("/auth/me"),
  listChats: () => apiFetch("/chats"),
  createChat: (title) =>
    apiFetch("/chats", { method: "POST", body: JSON.stringify({ title }) }),
  getChat: (id) => apiFetch(`/chats/${id}`),
  sendMessage: (id, payload) =>
    apiFetch(`/chats/${id}/messages`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  uploadFile: async (file, conversationId) => {
    const form = new FormData();
    form.append("file", file);
    if (conversationId) form.append("conversationId", conversationId);
    const res = await fetch(`${API_BASE}/files`, {
      method: "POST",
      body: form,
      credentials: "include"
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  },
  realtimeToken: () =>
    apiFetch("/realtime/token", {
      method: "POST"
    }),
  listUsers: () => apiFetch("/admin/users"),
  createUser: (payload) =>
    apiFetch("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateUser: (id, payload) =>
    apiFetch(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    })
};

export async function streamMessage(chatId, payload, onToken, onDone) {
  const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true })
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const lines = part.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (event === "message" && data) {
        const payload = JSON.parse(data);
        onToken?.(payload.text || "");
      }
      if (event === "done") {
        onDone?.();
      }
    }
  }
}
