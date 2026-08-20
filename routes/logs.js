/**
 * routes/logs.js
 * 
 * Serves the HTML view for the logging dashboard at /logs route.
 */

const express = require("express");
const path = require("path");
const router = express.Router();

/**
 * GET /logs
 * Renders the dashboard HTML interface.
 */
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/logs.html"));
});

module.exports = router;
