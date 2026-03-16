const APP_RESOURCE_URI = "ui://company-ai/dashboard.html";
const APP_TOOL_NAMES = ["open_company_dashboard"];

function buildDashboardAppHtml() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Company AI ChatGPT App</title>
    <style>
      :root{color-scheme:light dark;--bg:#07111c;--panel:rgba(10,20,34,.82);--panel-2:rgba(15,28,47,.88);--line:rgba(176,214,255,.12);--text:#f4f8ff;--muted:#9db4cf;--accent:#79c0ff;--shadow:0 24px 70px rgba(0,0,0,.28);font-family:var(--font-sans,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif)}
      *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(circle at top left,rgba(94,170,255,.22),transparent 30%),linear-gradient(180deg,#08111b,#0d1725);color:var(--text)}
      body{padding:18px}.shell{max-width:1180px;margin:0 auto;display:grid;gap:16px}
      .hero,.panel,.card{border:1px solid var(--line);background:linear-gradient(180deg,var(--panel-2),var(--panel));box-shadow:var(--shadow)}
      .hero{border-radius:28px;padding:24px 24px 18px}.hero-top,.search-row,.grid,.panel-head,.stat{display:flex;align-items:center}
      .hero-top,.search-row,.grid,.panel-head,.stat{justify-content:space-between;gap:14px}.hero-top,.search-row,.grid{align-items:stretch}
      h1{margin:10px 0 0;font-size:clamp(28px,4vw,42px);line-height:1.05;letter-spacing:-.03em}p{margin:12px 0 0;max-width:680px;color:var(--muted);line-height:1.75;font-size:14px}
      .pill,.badge,.mini{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.05)}
      .pill{padding:9px 14px;font-size:13px;color:var(--muted)}.pill strong{color:#d8ebff}.toolbar,.search{display:flex;gap:10px;flex-wrap:wrap}.search{flex:1 1 420px}
      input{flex:1;height:46px;min-width:0;padding:0 14px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text);outline:none}
      input:focus{border-color:rgba(121,192,255,.65);box-shadow:0 0 0 3px rgba(121,192,255,.14)}input::placeholder{color:#88a0bc}
      button{height:44px;padding:0 16px;border:none;border-radius:14px;cursor:pointer;font-weight:700;transition:transform .12s ease,opacity .12s ease}
      button:hover{transform:translateY(-1px)}button:disabled{opacity:.58;cursor:wait;transform:none}
      .primary{background:linear-gradient(135deg,#72bcff,#b6deff);color:#0b1727}.secondary{background:rgba(255,255,255,.06);color:var(--text);border:1px solid var(--line)}
      .grid{flex-wrap:wrap}.main{flex:1 1 740px;display:grid;gap:16px}.side{width:min(360px,100%);display:grid;gap:16px}
      .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.card{border-radius:22px;padding:18px}
      .label{font-size:13px;color:var(--muted)}.value{margin-top:10px;font-size:clamp(26px,3vw,34px);font-weight:800;letter-spacing:-.03em}.meta{margin-top:10px;font-size:12px;color:var(--muted)}
      .panel{border-radius:24px;overflow:hidden}.panel-head{padding:18px 18px 0}.panel-title{display:grid;gap:6px}.panel-title strong{font-size:16px}.panel-title span{font-size:13px;color:var(--muted)}
      .panel-body{padding:18px}.actions{display:flex;gap:8px;flex-wrap:wrap}.mini{padding:7px 10px;font-size:12px;color:var(--text);cursor:pointer}
      .table{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:11px 8px;border-bottom:1px solid rgba(176,214,255,.08);text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600}
      tr:hover{background:rgba(255,255,255,.03)}.note{font-size:12px;color:var(--muted)}.status{padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.06);display:inline-flex;font-size:12px}
      .ok{color:#8de7c6}.warn{color:#ffd57f}.bad{color:#ff9c9c}.empty,.raw,.message{border:1px dashed var(--line);border-radius:18px;padding:18px;color:var(--muted)}
      .empty{text-align:center}.stats{display:grid;gap:12px}.stat{gap:12px}.meter{position:relative;flex:1;min-width:110px;height:10px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
      .meter>span{position:absolute;inset:0 auto 0 0;width:var(--fill,0%);background:linear-gradient(90deg,#6ebcff,#8ae8cc);border-radius:inherit}.detail{display:grid;gap:10px}.detail strong{display:block;font-size:14px;line-height:1.55}.detail span{font-size:12px;color:var(--muted)}
      .message{background:rgba(255,255,255,.03);border-style:solid}.message-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;font-size:12px;color:var(--muted)}.message-text{white-space:pre-wrap;line-height:1.72}
      .raw{font-family:var(--font-mono,"Consolas",monospace);white-space:pre-wrap;overflow:auto;font-size:12px;line-height:1.6}
      @media (max-width:920px){body{padding:14px}.hero{padding:20px 16px}.hero-top,.search-row{flex-direction:column;align-items:flex-start}.panel-head,.panel-body{padding-left:16px;padding-right:16px}}
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="hero-top">
          <div>
            <div class="pill"><strong>ChatGPT App</strong><span id="host">等待连接宿主</span></div>
            <h1>Company AI 管理控制台</h1>
            <p>这个 App 会把平台概览、近期用户、会话、文件与调用统计直接渲染在 ChatGPT 对话里，并支持继续下钻到用户详情与会话转录。</p>
          </div>
          <div class="toolbar">
            <button class="secondary" id="fullscreen" type="button">⤢ 全屏</button>
            <button class="primary" id="refresh" type="button">↻ 刷新概览</button>
          </div>
        </div>
        <div class="search-row" style="margin-top:18px;padding-top:18px;border-top:1px solid rgba(176,214,255,.08)">
          <form class="search" id="user-form">
            <input id="user-query" type="text" autocomplete="off" placeholder="输入邮箱或用户 ID，例如 admin@example.com" />
            <button class="secondary" type="submit">⌕ 查询用户</button>
          </form>
          <div class="note" id="status">等待初始工具结果...</div>
        </div>
      </section>
      <div class="grid">
        <main class="main">
          <section class="cards" id="cards"><div class="empty">等待平台概览...</div></section>
          <section class="panel">
            <div class="panel-head">
              <div class="panel-title"><strong>近期平台数据</strong><span>可以从表格继续查看用户详情或会话转录。</span></div>
              <div class="actions">
                <button class="mini" type="button" data-tool="list_internal_users">👥 用户</button>
                <button class="mini" type="button" data-tool="list_conversations">💬 会话</button>
                <button class="mini" type="button" data-tool="list_uploaded_files">📁 文件</button>
              </div>
            </div>
            <div class="panel-body" id="tables"><div class="empty">等待近期数据...</div></div>
          </section>
        </main>
        <aside class="side">
          <section class="panel">
            <div class="panel-head">
              <div class="panel-title"><strong>近期模型调用</strong><span>来自最近统计窗口。</span></div>
              <button class="mini" type="button" data-tool="list_recent_usage">📈 统计</button>
            </div>
            <div class="panel-body"><div class="stats" id="usage"><div class="empty">等待调用数据...</div></div></div>
          </section>
          <section class="panel">
            <div class="panel-head">
              <div class="panel-title"><strong>详情面板</strong><span>显示用户详情、会话转录或工具结果。</span></div>
              <span class="badge" id="detail-badge">空闲</span>
            </div>
            <div class="panel-body" id="detail"><div class="empty">点击表格按钮或输入用户信息开始下钻。</div></div>
          </section>
        </aside>
      </div>
    </div>
    <script>
      (() => {
        const PROTOCOL_VERSION = "2026-01-26";
        const DEFAULT_ARGS = { days: 7, userLimit: 6, conversationLimit: 6, fileLimit: 6 };
        const state = { nextId: 1, pending: new Map(), busy: false, dashboardArgs: { ...DEFAULT_ARGS } };
        const els = {
          host: document.getElementById("host"),
          status: document.getElementById("status"),
          cards: document.getElementById("cards"),
          tables: document.getElementById("tables"),
          usage: document.getElementById("usage"),
          detail: document.getElementById("detail"),
          detailBadge: document.getElementById("detail-badge"),
          refresh: document.getElementById("refresh"),
          fullscreen: document.getElementById("fullscreen"),
          userForm: document.getElementById("user-form"),
          userQuery: document.getElementById("user-query")
        };
        const esc = (value) => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
        const num = (value) => Number(value || 0).toLocaleString("zh-CN");
        const date = (value) => { if (!value) return "未记录"; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("zh-CN",{hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); };
        const badge = (value) => value === "active" || value === "indexed" ? "ok" : value === "disabled" || value === "failed" ? "bad" : "warn";
        const rawText = (result) => (Array.isArray(result?.content) ? result.content : []).filter((item) => item?.type === "text").map((item) => item.text || "").join("\\n\\n").trim();
        const setBusy = (busy, text) => { state.busy = busy; els.refresh.disabled = busy; els.fullscreen.disabled = busy; els.status.textContent = text || (busy ? "处理中..." : "就绪"); };
        const setDetailState = (label, className = "") => { els.detailBadge.textContent = label; els.detailBadge.className = "badge" + (className ? " " + className : ""); };
        const empty = (message) => '<div class="empty">' + esc(message) + "</div>";
        const post = (message) => window.parent.postMessage(message, "*");
        function request(method, params) {
          const id = state.nextId++;
          post({ jsonrpc: "2.0", id, method, params });
          return new Promise((resolve, reject) => {
            const timeout = window.setTimeout(() => { state.pending.delete(id); reject(new Error(method + " 请求超时")); }, 15000);
            state.pending.set(id, {
              resolve(result) { window.clearTimeout(timeout); resolve(result); },
              reject(error) { window.clearTimeout(timeout); reject(error); }
            });
          });
        }
        const renderCards = (overview) => {
          if (!overview) { els.cards.innerHTML = empty("等待平台概览..."); return; }
          const cards = [
            ["活跃用户", overview.users?.active, "总用户 " + num(overview.users?.total)],
            ["管理员", overview.users?.admins, "内部账号权限"],
            ["会话总数", overview.conversations?.total, "累计会话"],
            ["消息总数", overview.messages?.total, "累计消息"],
            ["已索引文件", overview.files?.indexed, "文件总数 " + num(overview.files?.total)],
            ["总文件体积", overview.files?.totalSizeText || "0 B", "本地文件长期保留"]
          ];
          els.cards.innerHTML = cards.map(([label, value, meta]) => '<article class="card"><div class="label">' + esc(label) + '</div><div class="value">' + esc(value ?? 0) + '</div><div class="meta">' + esc(meta) + "</div></article>").join("");
        };
        const usersTable = (rows) => rows?.length ? '<div class="table"><table><thead><tr><th>邮箱</th><th>角色</th><th>状态</th><th>会话</th><th>文件</th><th>操作</th></tr></thead><tbody>' + rows.map((row) => '<tr><td><strong>' + esc(row.email) + '</strong><br><span class="note">' + esc(row.id) + '</span></td><td>' + esc(row.role) + '</td><td><span class="status ' + badge(row.status) + '">' + esc(row.status) + '</span></td><td>' + esc(num(row.conversationCount)) + '</td><td>' + esc(num(row.fileCount)) + '</td><td><button class="mini" type="button" data-user="' + esc(row.email) + '">详情</button></td></tr>').join("") + "</tbody></table></div>" : empty("暂无用户数据。");
        const convTable = (rows) => rows?.length ? '<div class="table" style="margin-top:16px"><table><thead><tr><th>标题</th><th>用户</th><th>消息</th><th>更新时间</th><th>操作</th></tr></thead><tbody>' + rows.map((row) => '<tr><td><strong>' + esc(row.title || "未命名会话") + '</strong><br><span class="note">' + esc(row.id) + '</span></td><td>' + esc(row.email) + '</td><td>' + esc(num(row.messageCount)) + '</td><td>' + esc(date(row.updatedAt || row.lastMessageAt)) + '</td><td><button class="mini" type="button" data-conversation="' + esc(row.id) + '">转录</button></td></tr>').join("") + "</tbody></table></div>" : empty("暂无会话数据。");
        const fileTable = (rows) => rows?.length ? '<div class="table" style="margin-top:16px"><table><thead><tr><th>文件名</th><th>用户</th><th>大小</th><th>状态</th><th>上传时间</th></tr></thead><tbody>' + rows.map((row) => '<tr><td><strong>' + esc(row.originalName) + '</strong></td><td>' + esc(row.email) + '</td><td>' + esc(row.sizeText || row.sizeBytes) + '</td><td><span class="status ' + badge(row.status) + '">' + esc(row.status) + '</span></td><td>' + esc(date(row.createdAt)) + '</td></tr>').join("") + "</tbody></table></div>" : "";
        const renderUsage = (rows) => {
          if (!rows?.length) { els.usage.innerHTML = empty("当前窗口暂无调用统计。"); return; }
          const max = Math.max(...rows.map((row) => Number(row.requestCount || 0)), 1);
          els.usage.innerHTML = rows.map((row) => '<div class="stat"><div style="min-width:112px"><strong style="display:block">' + esc(row.model || "未知模型") + '</strong><span class="note">' + esc(num(row.requestCount)) + ' 次请求</span></div><div class="meter"><span style="--fill:' + Math.max(8, Math.round(Number(row.requestCount || 0) / max * 100)) + '%"></span></div><div style="min-width:76px;text-align:right"><strong style="display:block">' + esc(num(row.toolCalls || 0)) + '</strong><span class="note">工具调用</span></div></div>').join("");
        };
        const renderDashboard = (data) => {
          renderCards(data.overview);
          els.tables.innerHTML = usersTable(data.recentUsers) + convTable(data.recentConversations) + fileTable(data.recentFiles);
          renderUsage(data.usageRows || data.overview?.usageLast7Days || []);
          els.detail.innerHTML = '<div class="detail"><div><span>最近更新时间</span><strong>' + esc(date(data.generatedAt)) + '</strong></div><div><span>统计窗口</span><strong>最近 ' + esc(data.filters?.days || 7) + ' 天</strong></div><div><span>建议</span><strong>先观察活跃用户与文件索引状态，再决定是否查看具体会话转录。</strong></div></div>';
          setDetailState("仪表盘", "ok");
          els.status.textContent = "仪表盘已刷新";
        };
        const renderUser = (data) => {
          const user = data.user || {}; const metrics = data.metrics || {}; const usage = data.usageByModel || [];
          els.detail.innerHTML = '<div class="detail"><div><span>用户</span><strong>' + esc(user.email || user.id || "未知用户") + '</strong></div><div><span>身份</span><strong>' + esc((user.role || "-") + " / " + (user.status || "-")) + '</strong></div><div><span>注册时间</span><strong>' + esc(date(user.createdAt)) + '</strong></div><div><span>最近登录</span><strong>' + esc(date(user.lastLoginAt)) + '</strong></div><div><span>平台指标</span><strong>会话 ' + esc(num(metrics.conversations)) + ' · 消息 ' + esc(num(metrics.messages)) + ' · 文件 ' + esc(num(metrics.files)) + ' · 存储 ' + esc(metrics.totalFileSizeText || "0 B") + "</strong></div></div>" + (usage.length ? '<div class="table" style="margin-top:16px"><table><thead><tr><th>模型</th><th>请求数</th><th>输入 Token</th><th>输出 Token</th></tr></thead><tbody>' + usage.map((row) => '<tr><td>' + esc(row.model) + '</td><td>' + esc(num(row.requestCount)) + '</td><td>' + esc(num(row.inputTokens)) + '</td><td>' + esc(num(row.outputTokens)) + '</td></tr>').join("") + "</tbody></table></div>" : "");
          setDetailState("用户详情", "ok"); els.status.textContent = "用户详情已加载";
        };
        const renderTranscript = (data) => {
          const convo = data.conversation || {}; const messages = data.messages || [];
          els.detail.innerHTML = '<div class="detail"><div><span>会话标题</span><strong>' + esc(convo.title || "未命名会话") + '</strong></div><div><span>用户</span><strong>' + esc(convo.email || convo.userId || "未知用户") + '</strong></div><div><span>会话 ID</span><strong>' + esc(convo.id || "-") + '</strong></div><div><span>最后更新</span><strong>' + esc(date(convo.updatedAt || convo.lastMessageAt)) + '</strong></div></div><div style="display:grid;gap:12px;margin-top:16px">' + (messages.length ? messages.map((message) => '<div class="message"><div class="message-head"><strong>' + esc(message.role || "unknown") + '</strong><span>' + esc(date(message.createdAt)) + '</span></div><div class="message-text">' + esc(message.content || "") + '</div></div>').join("") : empty("这个会话还没有可显示的消息。")) + "</div>";
          setDetailState("会话转录", "ok"); els.status.textContent = "会话转录已加载";
        };
        const renderGeneric = (title, data, text) => {
          els.detail.innerHTML = '<div class="detail"><div><span>结果标题</span><strong>' + esc(title) + '</strong></div><div><span>结构化字段</span><strong>' + esc(data && typeof data === "object" ? Object.keys(data).join(" / ") || "空对象" : "无结构化数据") + '</strong></div></div><div class="raw" style="margin-top:16px">' + esc(text || JSON.stringify(data, null, 2) || "无文本内容") + "</div>";
          setDetailState("结果", "warn");
        };
        function applyResult(result, toolName) {
          const data = result?.structuredContent || null;
          const text = rawText(result);
          if (toolName === "open_company_dashboard" || data?.kind === "dashboard") { renderDashboard(data || {}); return; }
          if (data?.user) { renderUser(data); return; }
          if (Array.isArray(data?.messages) && data?.conversation) { renderTranscript(data); return; }
          if (Array.isArray(data?.users)) { els.detail.innerHTML = usersTable(data.users); setDetailState("用户列表", "ok"); els.status.textContent = "用户列表已加载"; return; }
          if (Array.isArray(data?.conversations)) { els.detail.innerHTML = convTable(data.conversations); setDetailState("会话列表", "ok"); els.status.textContent = "会话列表已加载"; return; }
          if (Array.isArray(data?.files)) { els.detail.innerHTML = fileTable(data.files); setDetailState("文件列表", "ok"); els.status.textContent = "文件列表已加载"; return; }
          if (Array.isArray(data?.rows)) { renderUsage(data.rows); renderGeneric("近期调用统计", data, text); els.status.textContent = "调用统计已加载"; return; }
          renderGeneric(toolName || "工具结果", data, text); els.status.textContent = "已收到工具结果";
        }
        async function callTool(name, args) {
          setBusy(true, "正在调用 " + name + " ...");
          try { const result = await request("tools/call", { name, arguments: args || {} }); applyResult(result, name); return result; }
          catch (error) { renderGeneric(name, null, error.message || String(error)); setDetailState("失败", "bad"); els.status.textContent = "工具调用失败"; throw error; }
          finally { setBusy(false, "就绪"); }
        }
        window.addEventListener("message", (event) => {
          const message = event.data;
          if (!message || message.jsonrpc !== "2.0") return;
          if (Object.prototype.hasOwnProperty.call(message, "id")) {
            const pending = state.pending.get(message.id); if (!pending) return; state.pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message || "未知错误")); else pending.resolve(message.result);
            return;
          }
          if (message.method === "ui/notifications/tool-input") { state.dashboardArgs = { ...DEFAULT_ARGS, ...(message.params?.arguments || {}) }; return; }
          if (message.method === "ui/notifications/tool-result") { applyResult(message.params, "open_company_dashboard"); return; }
        });
        document.addEventListener("click", async (event) => {
          const button = event.target.closest("button"); if (!button || state.busy) return;
          if (button.dataset.tool) { const args = button.dataset.tool === "list_recent_usage" ? { days: 7, limit: 12 } : { limit: 12 }; await callTool(button.dataset.tool, args); return; }
          if (button.dataset.user) { await callTool("get_user_profile", { email: button.dataset.user }); return; }
          if (button.dataset.conversation) { await callTool("get_conversation_transcript", { conversationId: button.dataset.conversation, limit: 60 }); }
        });
        els.refresh.addEventListener("click", () => callTool("open_company_dashboard", state.dashboardArgs || DEFAULT_ARGS));
        els.fullscreen.addEventListener("click", async () => { try { await request("ui/request-display-mode", { mode: "fullscreen" }); } catch (_error) { els.status.textContent = "当前宿主不支持切换全屏"; } });
        els.userForm.addEventListener("submit", async (event) => { event.preventDefault(); const identifier = els.userQuery.value.trim(); if (!identifier || state.busy) return; await callTool("get_user_profile", identifier.includes("@") ? { email: identifier } : { userId: identifier }); });
        (async () => {
          try {
            const init = await request("ui/initialize", {
              appInfo: { name: "company-ai-chatgpt-app", version: "1.0.0" },
              appCapabilities: { tools: {}, availableDisplayModes: ["inline", "fullscreen"] },
              protocolVersion: PROTOCOL_VERSION
            });
            els.host.textContent = "已连接 " + (init?.hostInfo?.name || "ChatGPT");
            post({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });
          } catch (error) {
            els.host.textContent = "宿主连接失败";
            renderGeneric("连接错误", null, error.message || String(error));
            setDetailState("连接失败", "bad");
          }
        })();
      })();
    </script>
  </body>
</html>`;
}

module.exports = {
  APP_RESOURCE_URI,
  APP_TOOL_NAMES,
  buildDashboardAppHtml
};
