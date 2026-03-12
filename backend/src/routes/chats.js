const express = require("express");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { createResponse } = require("../services/openai");

const router = express.Router();

const createSchema = z.object({
  title: z.string().optional()
});

const messageSchema = z.object({
  content: z.string().min(1),
  stream: z.boolean().optional(),
  fileIds: z.array(z.string()).optional(),
  useTools: z.boolean().optional()
});

router.get("/", requireAuth, async (req, res) => {
  const rows = await query(
    "SELECT id, title, created_at, updated_at, last_message_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
    [req.user.id]
  );
  return res.json(rows);
});

router.post("/", requireAuth, async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const id = uuidv4();
  await query(
    "INSERT INTO conversations (id, user_id, title, last_message_at) VALUES (?, ?, ?, NOW())",
    [id, req.user.id, parse.data.title || null]
  );
  return res.json({ id, title: parse.data.title || null });
});

router.get("/:id", requireAuth, async (req, res) => {
  const convo = await query(
    "SELECT id, title, created_at, updated_at, last_message_at FROM conversations WHERE id = ? AND user_id = ? LIMIT 1",
    [req.params.id, req.user.id]
  );
  if (!convo[0]) {
    return res.status(404).json({ error: "Not found" });
  }
  const messages = await query(
    "SELECT id, role, content, metadata, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [req.params.id]
  );
  return res.json({ conversation: convo[0], messages });
});

function buildTranscript(history, userMessage) {
  const lines = [];
  for (const msg of history) {
    lines.push(`${msg.role.toUpperCase()}: ${msg.content}`);
  }
  lines.push(`USER: ${userMessage}`);
  return lines.join("\n");
}

router.post("/:id/messages", requireAuth, async (req, res) => {
  const parse = messageSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const { content, stream, fileIds, useTools } = parse.data;

  const convo = await query(
    "SELECT id, vector_store_id FROM conversations WHERE id = ? AND user_id = ? LIMIT 1",
    [req.params.id, req.user.id]
  );
  if (!convo[0]) {
    return res.status(404).json({ error: "Not found" });
  }

  const userMsgId = uuidv4();
  await query(
    "INSERT INTO messages (id, conversation_id, user_id, role, content) VALUES (?, ?, ?, 'user', ?)",
    [userMsgId, req.params.id, req.user.id, content]
  );

  const history = await query(
    "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20",
    [req.params.id]
  );

  const tools = [];
  if (useTools !== false) {
    tools.push({ type: "web_search" });
    tools.push({ type: "code_interpreter" });
    tools.push({ type: "image_generation" });
    if (convo[0].vector_store_id) {
      tools.push({ type: "file_search", vector_store_ids: [convo[0].vector_store_id] });
    }
  }

  const input = buildTranscript(history, content);
  const payload = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input,
    tools
  };

  try {
    const result = await createResponse(payload);
    const outputText = result?.output_text || "";
    const assistantId = uuidv4();
    await query(
      "INSERT INTO messages (id, conversation_id, role, content, metadata) VALUES (?, ?, 'assistant', ?, ?)",
      [assistantId, req.params.id, outputText, JSON.stringify(result || {})]
    );
    await query("UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?", [req.params.id]);

    if (stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });
      res.write(`event: message\n`);
      res.write(`data: ${JSON.stringify({ text: outputText })}\n\n`);
      res.write(`event: done\n`);
      res.write(`data: {}\n\n`);
      return res.end();
    }
    return res.json({ text: outputText, raw: result });
  } catch (err) {
    return res.status(500).json({ error: err.message || "OpenAI error" });
  }
});

module.exports = router;
