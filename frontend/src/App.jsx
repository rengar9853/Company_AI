import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Chat from "./components/Chat.jsx";
import VoicePanel from "./components/VoicePanel.jsx";
import AdminPanel from "./components/AdminPanel.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [view, setView] = useState("chat");

  useEffect(() => {
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="page center">Loading...</div>;
  }

  if (!user) {
    return <Login onSuccess={setUser} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        onLogout={async () => {
          await api.logout();
          setUser(null);
        }}
        view={view}
        onSetView={setView}
      />
      <main className="main-panel">
        {view === "admin" && user.role === "admin" ? (
          <AdminPanel currentUser={user} />
        ) : (
          <Chat selectedChat={selectedChat} onSelectChat={setSelectedChat} />
        )}
      </main>
      <aside className="side-panel">
        <VoicePanel />
      </aside>
    </div>
  );
}
