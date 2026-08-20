/**
 * middleware/logger.js
 * 
 * Global logging middleware for Express.js application.
 * Captures request & response metadata, redacts sensitive information,
 * calculates duration and response size, tracks network throughput,
 * and passes completed logs to logService.
 */

const crypto = require("crypto");
const { addLog } = require("../services/logService");
const { recordNetworkActivity } = require("../services/networkService");

// Track current active in-flight requests
let activeRequests = 0;

// Configurable slow request threshold in milliseconds (default: 500ms)
const SLOW_REQUEST_THRESHOLD_MS = parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10) || 500;

// Service/App Name
const SERVICE_NAME = process.env.SERVICE_NAME || "express-app";

/**
 * List of sensitive key patterns to redact recursively from request body.
 */
const SENSITIVE_KEYS = [
  "password",
  "pass",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "auth",
  "apikey",
  "api_key",
  "secret",
  "cookie",
  "cookies",
  "creditcard",
  "card_number",
  "cardnumber",
  "cvv",
  "ssn",
];

/**
 * Deeply sanitizes an object by replacing sensitive fields with [REDACTED].
 * 
 * @param {any} body 
 * @returns {any}
 */
function sanitizeBody(body) {
  if (!body || typeof body !== "object") {
    return body;
  }

  if (Array.isArray(body)) {
    return body.map((item) => sanitizeBody(item));
  }

  const safeBody = {};
  for (const key of Object.keys(body)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));

    if (isSensitive) {
      safeBody[key] = "[REDACTED]";
    } else if (typeof body[key] === "object" && body[key] !== null) {
      safeBody[key] = sanitizeBody(body[key]);
    } else {
      safeBody[key] = body[key];
    }
  }

  return safeBody;
}

/**
 * Global HTTP Logger Middleware
 */
const logger = (req, res, next) => {
  // Exclude dashboard page & dashboard API polling routes from log history to prevent log spamming
  const isDashboardRoute = req.originalUrl === "/logs" || req.originalUrl.startsWith("/api/logs");
  
  if (isDashboardRoute) {
    return next();
  }

  const startTime = Date.now();
  activeRequests++;

  // 1. Generate Unique Request ID
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId; // Attach to req for downstream usage

  // Estimate incoming request payload size (bytes)
  const incomingContentLength = parseInt(req.headers["content-length"], 10) || 0;
  const incomingEstimatedBytes = incomingContentLength || (req.body ? JSON.stringify(req.body).length : 0);

  // Hook into response methods to capture outgoing body size accurately
  let outgoingBytes = 0;

  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk, encoding, callback) {
    if (chunk) {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      outgoingBytes += chunkBuffer.length;
    }
    return originalWrite.apply(res, arguments);
  };

  res.end = function (chunk, encoding, callback) {
    if (chunk) {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      outgoingBytes += chunkBuffer.length;
    }
    return originalEnd.apply(res, arguments);
  };

  // Pre-populate log object structure
  const log = {
    requestId,
    service: SERVICE_NAME,
    route: req.originalUrl || req.url,
    method: req.method,
    ip: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1",
    userAgent: req.get("user-agent") || "Unknown",
    requestBody: sanitizeBody(req.body),
    userId: req.user?.id || req.userId || req.headers["x-user-id"] || null,
    startedAt: new Date(startTime).toISOString(),
    activeRequestsAtStart: activeRequests,
    
    // Updated upon completion
    completedAt: null,
    statusCode: null,
    responseTime: null,
    responseTimeMs: 0,
    responseSize: 0,
    logLevel: "INFO",
    error: null,
  };

  let finished = false;

  const onResponseFinished = () => {
    if (finished) return;
    finished = true;

    activeRequests = Math.max(0, activeRequests - 1);

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    log.statusCode = res.statusCode;
    log.responseTimeMs = durationMs;
    log.responseTime = `${durationMs}ms`;
    log.completedAt = new Date(endTime).toISOString();
    
    // Response size calculation (from buffer intercept or Content-Length header)
    const headerContentLength = parseInt(res.getHeader("content-length"), 10) || 0;
    log.responseSize = outgoingBytes || headerContentLength || 0;

    // Attach error message if passed down via req.logError or res error
    if (req.logError) {
      log.error = typeof req.logError === "string" ? req.logError : (req.logError.message || String(req.logError));
    }

    // Determine log level automatically
    // INFO  -> 2xx and 3xx
    // WARN  -> 4xx or slow requests
    // ERROR -> 5xx or application errors
    if (res.statusCode >= 500 || log.error) {
      log.logLevel = "ERROR";
    } else if (res.statusCode >= 400 || durationMs > SLOW_REQUEST_THRESHOLD_MS) {
      log.logLevel = "WARN";
    } else {
      log.logLevel = "INFO";
    }

    // Persist log entry
    addLog(log);

    // Record network statistics
    recordNetworkActivity(incomingEstimatedBytes, log.responseSize);
  };

  res.on("finish", onResponseFinished);
  res.on("close", onResponseFinished);

  next();
};

/**
 * Get current active in-flight request count.
 * 
 * @returns {number}
 */
const getActiveRequests = () => {
  return activeRequests;
};

module.exports = {
  logger,
  getActiveRequests,
  SLOW_REQUEST_THRESHOLD_MS,
};