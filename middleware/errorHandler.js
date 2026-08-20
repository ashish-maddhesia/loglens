/**
 * middleware/errorHandler.js
 * 
 * Express error-handling middleware.
 * Connects application errors directly to the current HTTP request log,
 * ensures 5xx status code is recorded, and returns a safe JSON error response.
 */

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode >= 400 ? res.statusCode : 500;
  
  // Attach error details to req so logger middleware records it in the log object
  req.logError = err.message || "Internal Server Error";

  const isDevelopment = process.env.NODE_ENV !== "production";

  // Build clean error payload
  const errorResponse = {
    error: err.message || "Internal Server Error",
    requestId: req.requestId || null,
    statusCode,
  };

  if (isDevelopment && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
