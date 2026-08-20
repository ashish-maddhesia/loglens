/**
 * routes/apiLogs.js
 * 
 * Express API routes providing data endpoints for the logging dashboard:
 * - GET /api/logs
 * - GET /api/logs/stats
 * - GET /api/logs/timeline
 * - GET /api/logs/network
 * - GET /api/logs/memory
 */

const express = require("express");
const router = express.Router();

const { getLogs, getTimeline } = require("../services/logService");
const { getStats } = require("../services/metricsService");
const { getNetworkMetrics } = require("../services/networkService");
const { getMemoryMetrics } = require("../services/memoryService");
const { getActiveRequests } = require("../middleware/logger");

/**
 * GET /api/logs
 * Return all logs with support for search, filtering, pagination, and sorting.
 */
router.get("/", (req, res) => {
  const options = {
    search: req.query.search || "",
    method: req.query.method || "",
    logLevel: req.query.logLevel || "",
    statusCode: req.query.statusCode || "",
    service: req.query.service || "",
    timeRange: req.query.timeRange || "all",
    page: req.query.page || 1,
    limit: req.query.limit || 50,
    sortBy: req.query.sortBy || "startedAt",
    sortOrder: req.query.sortOrder || "desc",
  };

  const result = getLogs(options);
  res.json(result);
});

/**
 * GET /api/logs/stats
 * Return overall application KPI metrics.
 */
router.get("/stats", (req, res) => {
  const activeRequests = getActiveRequests();
  const stats = getStats(activeRequests);
  res.json(stats);
});

/**
 * GET /api/logs/timeline
 * Return log counts grouped by time intervals.
 */
router.get("/timeline", (req, res) => {
  const range = req.query.range || "15m";
  const timeline = getTimeline(range);
  res.json(timeline);
});

/**
 * GET /api/logs/network
 * Return current network request metrics & throughput history.
 */
router.get("/network", (req, res) => {
  const networkMetrics = getNetworkMetrics();
  res.json(networkMetrics);
});

/**
 * GET /api/logs/memory
 * Return process memory metrics & usage history over time.
 */
router.get("/memory", (req, res) => {
  const memoryMetrics = getMemoryMetrics();
  res.json(memoryMetrics);
});

module.exports = router;
