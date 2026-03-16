const express = require("express");
const { getMcpHealth, handleMethodNotAllowed, handleMcpRequest } = require("../mcp/server");

const router = express.Router();

router.get("/health", (_req, res) => {
  return res.json(getMcpHealth());
});

router.post("/", async (req, res) => {
  await handleMcpRequest(req, res);
});

router.get("/", handleMethodNotAllowed);
router.delete("/", handleMethodNotAllowed);

module.exports = router;
