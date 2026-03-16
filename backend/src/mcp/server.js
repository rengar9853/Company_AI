const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod/v4");

const { query } = require("../db");

const MCP_TOOL_NAMES = [
  "get_platform_overview",
  "list_internal_users",
  "get_user_profile",
  "list_conversations",
  "get_conversation_transcript",
  "list_uploaded_files",
  "list_recent_usage",
  "create_internal_user"
];

function getServerInfo() {
  return {
    name: process.env.MCP_SERVER_NAME || "company-ai-mcp",
    version: process.env.MCP_SERVER_VERSION || "0.2.0"
  };
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampLimit(value, fallback = 20, max = 100) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function clampDays(value, fallback = 7, max = 90) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return value;
  }
}

function formatBytes(bytes) {
  const numeric = toNumber(bytes);
  if (numeric === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(Math.floor(Math.log(numeric) / Math.log(1024)), units.length - 1);
  const value = numeric / 1024 ** power;
  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

function toToolResult(title, data, lines = []) {
  const sections = [title, ...lines];
  const text = `${sections.join("\n")}\n\n${JSON.stringify(data, null, 2)}`;
  return {
    content: [{ type: "text", text }],
    structuredContent: data
  };
}

function buildWhereClause(conditions) {
  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

async function resolveUser({ userId, email }) {
  if (!userId && !email) {
    return null;
  }

  const rows = await query(
    "SELECT id, email, role, status, created_at, last_login_at FROM users WHERE id = COALESCE(?, id) AND email = COALESCE(?, email) LIMIT 1",
    [userId || null, email || null]
  );

  return rows[0] || null;
}

async function getPlatformOverview() {
  const [userRows, conversationRows, messageRows, fileRows, usageRows] = await Promise.all([
    query(
      "SELECT COUNT(*) AS total_users, SUM(status = 'active') AS active_users, SUM(role = 'admin') AS admin_users FROM users"
    ),
    query("SELECT COUNT(*) AS total_conversations FROM conversations"),
    query("SELECT COUNT(*) AS total_messages FROM messages"),
    query(
      "SELECT COUNT(*) AS total_files, SUM(status = 'indexed') AS indexed_files, SUM(size) AS total_bytes FROM files"
    ),
    query(
      "SELECT model, COUNT(*) AS request_count, COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens, COALESCE(SUM(tool_calls), 0) AS tool_calls FROM usage_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY model ORDER BY request_count DESC"
    )
  ]);

  const users = userRows[0] || {};
  const conversations = conversationRows[0] || {};
  const messages = messageRows[0] || {};
  const files = fileRows[0] || {};

  return {
    users: {
      total: toNumber(users.total_users),
      active: toNumber(users.active_users),
      admins: toNumber(users.admin_users)
    },
    conversations: {
      total: toNumber(conversations.total_conversations)
    },
    messages: {
      total: toNumber(messages.total_messages)
    },
    files: {
      total: toNumber(files.total_files),
      indexed: toNumber(files.indexed_files),
      totalBytes: toNumber(files.total_bytes),
      totalSizeText: formatBytes(files.total_bytes)
    },
    usageLast7Days: usageRows.map((row) => ({
      model: row.model,
      requestCount: toNumber(row.request_count),
      inputTokens: toNumber(row.input_tokens),
      outputTokens: toNumber(row.output_tokens),
      toolCalls: toNumber(row.tool_calls)
    }))
  };
}

function registerTools(server) {
  server.registerTool(
    "get_platform_overview",
    {
      title: "平台总览",
      description: "汇总平台里的用户、会话、消息、文件和最近 7 天的调用情况。"
    },
    async () => {
      const data = await getPlatformOverview();
      return toToolResult("Company AI 平台总览", data, [
        `用户 ${data.users.total} 个，激活 ${data.users.active} 个，管理员 ${data.users.admins} 个。`,
        `会话 ${data.conversations.total} 个，消息 ${data.messages.total} 条。`,
        `文件 ${data.files.total} 个，其中已索引 ${data.files.indexed} 个，总大小 ${data.files.totalSizeText}。`
      ]);
    }
  );

  server.registerTool(
    "list_internal_users",
    {
      title: "列出内部用户",
      description: "按状态或角色列出后台用户账号。",
      inputSchema: {
        status: z.enum(["all", "active", "disabled"]).default("all"),
        role: z.enum(["all", "admin", "user"]).default("all"),
        limit: z.number().int().min(1).max(100).default(20)
      }
    },
    async ({ status = "all", role = "all", limit = 20 }) => {
      const safeLimit = clampLimit(limit);
      const conditions = [];
      const params = [];

      if (status !== "all") {
        conditions.push("status = ?");
        params.push(status);
      }

      if (role !== "all") {
        conditions.push("role = ?");
        params.push(role);
      }

      const rows = await query(
        `SELECT id, email, role, status, created_at, last_login_at,
            (SELECT COUNT(*) FROM conversations WHERE user_id = users.id) AS conversation_count,
            (SELECT COUNT(*) FROM files WHERE user_id = users.id) AS file_count
          FROM users
          ${buildWhereClause(conditions)}
          ORDER BY created_at DESC
          LIMIT ?`,
        [...params, safeLimit]
      );

      const data = {
        filters: { status, role, limit: safeLimit },
        users: rows.map((row) => ({
          id: row.id,
          email: row.email,
          role: row.role,
          status: row.status,
          createdAt: row.created_at,
          lastLoginAt: row.last_login_at,
          conversationCount: toNumber(row.conversation_count),
          fileCount: toNumber(row.file_count)
        }))
      };

      return toToolResult("内部用户列表", data, [`本次返回 ${data.users.length} 个用户。`]);
    }
  );

  server.registerTool(
    "get_user_profile",
    {
      title: "查询用户详情",
      description: "根据用户 ID 或邮箱查看账号详情、会话量、消息量和文件量。",
      inputSchema: {
        userId: z.string().optional(),
        email: z.string().email().optional()
      }
    },
    async ({ userId, email }) => {
      const user = await resolveUser({ userId, email });
      if (!user) {
        throw new Error("未找到对应用户，请提供有效的 userId 或 email。");
      }

      const [conversationRows, messageRows, fileRows, usageRows] = await Promise.all([
        query("SELECT COUNT(*) AS total FROM conversations WHERE user_id = ?", [user.id]),
        query(
          "SELECT COUNT(*) AS total FROM messages INNER JOIN conversations ON conversations.id = messages.conversation_id WHERE conversations.user_id = ?",
          [user.id]
        ),
        query("SELECT COUNT(*) AS total, COALESCE(SUM(size), 0) AS total_bytes FROM files WHERE user_id = ?", [user.id]),
        query(
          "SELECT model, COUNT(*) AS request_count, COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens FROM usage_logs WHERE user_id = ? GROUP BY model ORDER BY request_count DESC",
          [user.id]
        )
      ]);

      const data = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at
        },
        metrics: {
          conversations: toNumber(conversationRows[0]?.total),
          messages: toNumber(messageRows[0]?.total),
          files: toNumber(fileRows[0]?.total),
          totalFileBytes: toNumber(fileRows[0]?.total_bytes),
          totalFileSizeText: formatBytes(fileRows[0]?.total_bytes)
        },
        usageByModel: usageRows.map((row) => ({
          model: row.model,
          requestCount: toNumber(row.request_count),
          inputTokens: toNumber(row.input_tokens),
          outputTokens: toNumber(row.output_tokens)
        }))
      };

      return toToolResult("用户详情", data, [
        `${data.user.email} 当前角色为 ${data.user.role}，状态为 ${data.user.status}。`,
        `共有 ${data.metrics.conversations} 个会话、${data.metrics.messages} 条消息、${data.metrics.files} 个文件。`
      ]);
    }
  );

  server.registerTool(
    "list_conversations",
    {
      title: "列出会话",
      description: "按用户或标题关键字列出最近的会话。",
      inputSchema: {
        userId: z.string().optional(),
        email: z.string().email().optional(),
        titleQuery: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20)
      }
    },
    async ({ userId, email, titleQuery, limit = 20 }) => {
      const safeLimit = clampLimit(limit);
      const conditions = [];
      const params = [];

      if (userId || email) {
        const user = await resolveUser({ userId, email });
        if (!user) {
          throw new Error("未找到对应用户，请提供有效的 userId 或 email。");
        }
        conditions.push("conversations.user_id = ?");
        params.push(user.id);
      }

      if (titleQuery) {
        conditions.push("COALESCE(conversations.title, '') LIKE ?");
        params.push(`%${titleQuery}%`);
      }

      const rows = await query(
        `SELECT conversations.id, conversations.title, conversations.user_id, conversations.created_at, conversations.updated_at, conversations.last_message_at, users.email,
            (SELECT COUNT(*) FROM messages WHERE messages.conversation_id = conversations.id) AS message_count
          FROM conversations
          INNER JOIN users ON users.id = conversations.user_id
          ${buildWhereClause(conditions)}
          ORDER BY conversations.updated_at DESC
          LIMIT ?`,
        [...params, safeLimit]
      );

      const data = {
        filters: {
          userId: userId || null,
          email: email || null,
          titleQuery: titleQuery || null,
          limit: safeLimit
        },
        conversations: rows.map((row) => ({
          id: row.id,
          title: row.title,
          userId: row.user_id,
          email: row.email,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastMessageAt: row.last_message_at,
          messageCount: toNumber(row.message_count)
        }))
      };

      return toToolResult("会话列表", data, [`本次返回 ${data.conversations.length} 个会话。`]);
    }
  );

  server.registerTool(
    "get_conversation_transcript",
    {
      title: "获取会话记录",
      description: "读取某个会话的完整消息记录。",
      inputSchema: {
        conversationId: z.string(),
        limit: z.number().int().min(1).max(200).default(100)
      }
    },
    async ({ conversationId, limit = 100 }) => {
      const safeLimit = clampLimit(limit, 100, 200);
      const conversationRows = await query(
        "SELECT conversations.id, conversations.title, conversations.user_id, conversations.created_at, conversations.updated_at, conversations.last_message_at, conversations.vector_store_id, users.email FROM conversations INNER JOIN users ON users.id = conversations.user_id WHERE conversations.id = ? LIMIT 1",
        [conversationId]
      );

      const conversation = conversationRows[0];
      if (!conversation) {
        throw new Error("未找到对应会话。");
      }

      const messageRows = await query(
        "SELECT id, role, content, metadata, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?",
        [conversationId, safeLimit]
      );

      const data = {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          userId: conversation.user_id,
          email: conversation.email,
          vectorStoreId: conversation.vector_store_id,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
          lastMessageAt: conversation.last_message_at
        },
        messages: messageRows.map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          metadata: safeJsonParse(row.metadata),
          createdAt: row.created_at
        }))
      };

      return toToolResult("会话转录", data, [`会话 ${conversation.id} 共返回 ${data.messages.length} 条消息。`]);
    }
  );

  server.registerTool(
    "list_uploaded_files",
    {
      title: "列出文件",
      description: "按用户或索引状态列出上传的文件。",
      inputSchema: {
        userId: z.string().optional(),
        email: z.string().email().optional(),
        status: z.enum(["all", "uploaded", "indexed", "failed"]).default("all"),
        limit: z.number().int().min(1).max(100).default(20)
      }
    },
    async ({ userId, email, status = "all", limit = 20 }) => {
      const safeLimit = clampLimit(limit);
      const conditions = [];
      const params = [];

      if (userId || email) {
        const user = await resolveUser({ userId, email });
        if (!user) {
          throw new Error("未找到对应用户，请提供有效的 userId 或 email。");
        }
        conditions.push("files.user_id = ?");
        params.push(user.id);
      }

      if (status !== "all") {
        conditions.push("files.status = ?");
        params.push(status);
      }

      const rows = await query(
        `SELECT files.id, files.user_id, files.original_name, files.mime_type, files.size, files.status, files.path, files.openai_file_id, files.openai_vector_store_id, files.created_at, users.email
          FROM files
          INNER JOIN users ON users.id = files.user_id
          ${buildWhereClause(conditions)}
          ORDER BY files.created_at DESC
          LIMIT ?`,
        [...params, safeLimit]
      );

      const data = {
        filters: {
          userId: userId || null,
          email: email || null,
          status,
          limit: safeLimit
        },
        files: rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          email: row.email,
          originalName: row.original_name,
          mimeType: row.mime_type,
          sizeBytes: toNumber(row.size),
          sizeText: formatBytes(row.size),
          status: row.status,
          path: row.path,
          openaiFileId: row.openai_file_id,
          openaiVectorStoreId: row.openai_vector_store_id,
          createdAt: row.created_at
        }))
      };

      return toToolResult("文件列表", data, [`本次返回 ${data.files.length} 个文件。`]);
    }
  );

  server.registerTool(
    "list_recent_usage",
    {
      title: "查看近期调用",
      description: "查看最近 N 天内的模型调用统计。",
      inputSchema: {
        days: z.number().int().min(1).max(90).default(7),
        limit: z.number().int().min(1).max(100).default(20)
      }
    },
    async ({ days = 7, limit = 20 }) => {
      const safeDays = clampDays(days);
      const safeLimit = clampLimit(limit);
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
      const rows = await query(
        `SELECT users.email, usage_logs.model, COUNT(*) AS request_count, COALESCE(SUM(usage_logs.input_tokens), 0) AS input_tokens, COALESCE(SUM(usage_logs.output_tokens), 0) AS output_tokens, COALESCE(SUM(usage_logs.tool_calls), 0) AS tool_calls, MAX(usage_logs.created_at) AS last_used_at
          FROM usage_logs
          INNER JOIN users ON users.id = usage_logs.user_id
          WHERE usage_logs.created_at >= ?
          GROUP BY users.email, usage_logs.model
          ORDER BY last_used_at DESC
          LIMIT ?`,
        [since, safeLimit]
      );

      const data = {
        since,
        rows: rows.map((row) => ({
          email: row.email,
          model: row.model,
          requestCount: toNumber(row.request_count),
          inputTokens: toNumber(row.input_tokens),
          outputTokens: toNumber(row.output_tokens),
          toolCalls: toNumber(row.tool_calls),
          lastUsedAt: row.last_used_at
        }))
      };

      return toToolResult("近期调用统计", data, [
        `统计窗口为最近 ${safeDays} 天，本次返回 ${data.rows.length} 条聚合记录。`
      ]);
    }
  );

  server.registerTool(
    "create_internal_user",
    {
      title: "创建内部用户",
      description: "创建新的后台内部账号。",
      inputSchema: {
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "user"]).default("user")
      }
    },
    async ({ email, password, role = "user" }) => {
      const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
      if (existing.length > 0) {
        throw new Error("该邮箱已存在。");
      }

      const id = uuidv4();
      const passwordHash = await bcrypt.hash(password, 10);
      await query(
        "INSERT INTO users (id, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')",
        [id, email, passwordHash, role]
      );

      const data = {
        user: {
          id,
          email,
          role,
          status: "active"
        }
      };

      return toToolResult("用户创建成功", data, [`已创建 ${email}，角色为 ${role}。`]);
    }
  );
}

function registerResources(server) {
  server.registerResource(
    "company-ai-platform-guide",
    "company-ai://platform/guide",
    {
      title: "Company AI 平台说明",
      description: "介绍可用的 MCP tools 和适合的使用方式。",
      mimeType: "text/markdown"
    },
    async () => ({
      contents: [
        {
          uri: "company-ai://platform/guide",
          mimeType: "text/markdown",
          text: [
            "# Company AI MCP",
            "",
            "这个 MCP Server 主要面向管理员和运营同学，帮助你在 ChatGPT 里直接查询后台数据。",
            "",
            "## 可用工具",
            ...MCP_TOOL_NAMES.map((name) => `- \`${name}\``),
            "",
            "## 建议用法",
            "- 先用 `get_platform_overview` 做全局扫描。",
            "- 再按用户、会话、文件逐层下钻。",
            "- 如果你要新增后台账号，可调用 `create_internal_user`。"
          ].join("\n")
        }
      ]
    })
  );
}

function registerPrompts(server) {
  server.registerPrompt(
    "platform_audit_assistant",
    {
      title: "平台审计助手",
      description: "生成适合管理员审计平台状态的起始提示词。",
      argsSchema: {
        focus: z.string().optional()
      }
    },
    async ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `请作为 Company AI 平台的运维分析助手，优先调用合适的 MCP tools，对平台运行情况做一次审计。重点关注：${
              focus || "用户活跃度、会话分布、文件索引状态和近期模型调用"
            }。先给出事实，再给出改进建议。`
          }
        }
      ]
    })
  );
}

function createMcpServer() {
  const server = new McpServer(getServerInfo(), {
    capabilities: {
      logging: {},
      resources: {},
      prompts: {}
    }
  });

  registerResources(server);
  registerPrompts(server);
  registerTools(server);

  return server;
}

function isAuthorized(req) {
  const expected = (process.env.MCP_BEARER_TOKEN || "").trim();
  if (!expected) return true;

  const header = req.headers.authorization || "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return false;
  }

  return header.slice(7).trim() === expected;
}

function sendRpcError(res, status, message) {
  res.status(status).json({
    jsonrpc: "2.0",
    error: {
      code: status === 401 ? -32001 : -32603,
      message
    },
    id: null
  });
}

async function handleMcpRequest(req, res) {
  if (!isAuthorized(req)) {
    return sendRpcError(res, 401, "Unauthorized MCP request.");
  }

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      sendRpcError(res, 500, error.message || "Internal server error");
    }
  } finally {
    await Promise.allSettled([transport.close(), server.close()]);
  }
}

function handleMethodNotAllowed(req, res) {
  if (!isAuthorized(req)) {
    return sendRpcError(res, 401, "Unauthorized MCP request.");
  }

  return res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  });
}

function getMcpHealth() {
  return {
    ok: true,
    mcp: true,
    endpoint: "/mcp",
    transport: "streamable-http-json",
    authMode: (process.env.MCP_BEARER_TOKEN || "").trim() ? "bearer" : "none",
    server: getServerInfo(),
    tools: MCP_TOOL_NAMES
  };
}

module.exports = {
  getMcpHealth,
  handleMethodNotAllowed,
  handleMcpRequest
};
