/**
 * index.js
 * Main Express Application Entry Point
 * 
 * Sets up global logging middleware, mounts REST API & dashboard UI routes,
 * serves static frontend assets, and registers the global error handler.
 */

const express = require("express");
const path = require("path");

const { logger } = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");

const logsRouter = require("./routes/logs");
const apiLogsRouter = require("./routes/apiLogs");
const demoRouter = require("./routes/demo");

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets (CSS, JS) from /public directory
app.use(express.static(path.join(__dirname, "public")));

// Global HTTP Request Logger Middleware (captures metadata, redacts sensitive info)
app.use(logger);

// Dashboard UI Route (/logs)
app.use("/logs", logsRouter);

// Logging System REST API Routes (/api/logs/*)
app.use("/api/logs", apiLogsRouter);

// Interactive Demo Endpoints (/api/demo/*)
app.use("/api/demo", demoRouter);

// Standard Application Routes
app.get("/", (req, res) => {
  res.send("Server is running. Access the dashboard at /logs");
});

app.get("/hello", (req, res) => {
  res.json({
    message: "Hello World",
    timestamp: new Date().toISOString(),
  });
});

// Global Express Error Handling Middleware (must be registered last)
app.use(errorHandler);

// Start Server on all network interfaces
app.listen(PORT, "0.0.0.0", () => {
 
});

module.exports = app;