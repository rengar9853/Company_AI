const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createRealtimeSession } = require("../services/openai");

const router = express.Router();

router.post("/token", requireAuth, async (req, res) => {
  try {
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const session = await createRealtimeSession(model);
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Realtime error" });
  }
});

module.exports = router;
