/**
 * routes/demo.js
 * 
 * Interactive demo endpoints to populate logs and test various logging features:
 * - Successful 200 OK requests
 * - Sensitive body redaction (passwords, tokens, credit cards)
 * - Slow requests (>500ms trigger WARN log)
 * - 404 Not Found errors
 * - 500 Unhandled application exceptions
 */

const express = require("express");
const router = express.Router();

/**
 * GET /api/demo/users
 * Returns 200 OK response with user list.
 */
router.get("/users", (req, res) => {
  res.json({
    success: true,
    data: [
      { id: "usr_101", name: "Alice Vance", role: "Developer" },
      { id: "usr_102", name: "Bob Smith", role: "Admin" },
    ],
  });
});

/**
 * POST /api/demo/auth
 * Simulates authentication attempt with sensitive fields.
 * Tests deep redaction of passwords, tokens, API keys, and credit cards.
 */
router.post("/auth", (req, res) => {
  const { username } = req.body || {};
  res.json({
    success: true,
    message: `Authentication attempt processed for ${username || 'user'}`,
    userId: "usr_" + Math.floor(Math.random() * 900 + 100),
  });
});

/**
 * GET /api/demo/slow
 * Deliberately delays response to exceed the slow threshold (>500ms),
 * triggering a WARN log level automatically.
 */
router.get("/slow", async (req, res) => {
  const delayMs = 650; // Exceeds default 500ms threshold
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  
  res.json({
    success: true,
    message: `Response completed after artificial delay of ${delayMs}ms`,
  });
});

/**
 * GET /api/demo/not-found
 * Returns 404 Client Error.
 */
router.get("/not-found", (req, res) => {
  res.status(404).json({
    error: "Resource not found",
    code: "NOT_FOUND",
  });
});

/**
 * GET /api/demo/error
 * Throws an explicit error to test 500 status and Error Middleware integration.
 */
router.get("/error", (req, res, next) => {
  const error = new Error("Database connection pool timeout in demo service");
  error.statusCode = 500;
  next(error);
});

module.exports = router;
