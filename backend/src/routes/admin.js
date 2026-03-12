const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { query } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "user"]).optional()
});

const updateSchema = z.object({
  status: z.enum(["active", "disabled"]).optional(),
  role: z.enum(["admin", "user"]).optional(),
  password: z.string().min(6).optional()
});

router.post("/users", requireAuth, requireAdmin, async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const { email, password, role } = parse.data;
  const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Email already exists" });
  }
  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  await query(
    "INSERT INTO users (id, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')",
    [id, email, hash, role || "user"]
  );
  return res.json({ id, email, role: role || "user" });
});

router.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await query(
    "SELECT id, email, role, status, created_at, last_login_at FROM users ORDER BY created_at DESC"
  );
  return res.json(rows);
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const updates = parse.data;
  if (!updates.status && !updates.role && !updates.password) {
    return res.status(400).json({ error: "No changes provided" });
  }
  const targetId = req.params.id;
  if (targetId === req.user.id && (updates.status || updates.role)) {
    return res.status(400).json({ error: "Cannot modify your own role/status" });
  }
  const existing = await query("SELECT id FROM users WHERE id = ? LIMIT 1", [targetId]);
  if (existing.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  if (updates.password) {
    const hash = await bcrypt.hash(updates.password, 10);
    await query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, targetId]);
  }
  if (updates.status || updates.role) {
    await query(
      "UPDATE users SET status = COALESCE(?, status), role = COALESCE(?, role) WHERE id = ?",
      [updates.status || null, updates.role || null, targetId]
    );
  }
  const rows = await query(
    "SELECT id, email, role, status, created_at, last_login_at FROM users WHERE id = ? LIMIT 1",
    [targetId]
  );
  return res.json(rows[0]);
});

module.exports = router;
