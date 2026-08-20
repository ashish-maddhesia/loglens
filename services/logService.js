/**
 * logService.js
 * 
 * Abstracted log storage service. Currently uses an in-memory ring-buffer
 * with a configurable max limit to avoid memory leaks.
 * 
 * To replace in-memory storage with PostgreSQL, MongoDB, Redis, or Elasticsearch,
 * update the storage methods inside this file without altering middleware or route consumers.
 */

const MAX_LOGS = 2000;
let logs = [];

/**
 * Add a completed request log entry.
 * Implements a ring buffer behavior by capping total stored logs at MAX_LOGS.
 * 
 * @param {Object} logEntry 
 */
function addLog(logEntry) {
  if (!logEntry) return;
  
  logs.unshift(logEntry); // Newest logs first
  
  if (logs.length > MAX_LOGS) {
    logs.pop(); // Remove oldest log
  }
}

/**
 * Get all stored logs (unfiltered array reference or shallow copy).
 * 
 * @returns {Array}
 */
function getAllLogs() {
  return logs;
}

/**
 * Filter, search, sort, and paginate logs.
 * 
 * @param {Object} queryOptions 
 * @returns {Object} { logs, total, page, limit, totalPages }
 */
function getLogs(queryOptions = {}) {
  const {
    search = '',
    method = '',
    logLevel = '',
    statusCode = '',
    service = '',
    timeRange = 'all',
    page = 1,
    limit = 50,
    sortBy = 'startedAt',
    sortOrder = 'desc',
  } = queryOptions;

  let filtered = [...logs];
  const now = Date.now();

  // Time range filtering
  if (timeRange !== 'all') {
    let cutoffMs = 0;
    switch (timeRange) {
      case '5m': cutoffMs = 5 * 60 * 1000; break;
      case '15m': cutoffMs = 15 * 60 * 1000; break;
      case '1h': cutoffMs = 60 * 60 * 1000; break;
      case '24h': cutoffMs = 24 * 60 * 60 * 1000; break;
      default: cutoffMs = 0;
    }
    if (cutoffMs > 0) {
      filtered = filtered.filter(l => {
        const logTime = new Date(l.startedAt || l.completedAt).getTime();
        return now - logTime <= cutoffMs;
      });
    }
  }

  // Text search (Route, Request ID, Client IP, Service, Error)
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(l => 
      (l.route && l.route.toLowerCase().includes(q)) ||
      (l.requestId && l.requestId.toLowerCase().includes(q)) ||
      (l.ip && l.ip.toLowerCase().includes(q)) ||
      (l.service && l.service.toLowerCase().includes(q)) ||
      (l.error && l.error.toLowerCase().includes(q)) ||
      (l.userId && String(l.userId).toLowerCase().includes(q))
    );
  }

  // HTTP Method filter
  if (method) {
    filtered = filtered.filter(l => l.method && l.method.toUpperCase() === method.toUpperCase());
  }

  // Log Level filter (INFO, WARN, ERROR)
  if (logLevel) {
    filtered = filtered.filter(l => l.logLevel && l.logLevel.toUpperCase() === logLevel.toUpperCase());
  }

  // Status Code filter (Exact match or category like 2xx, 4xx, 5xx)
  if (statusCode) {
    const sc = statusCode.toLowerCase();
    if (sc === '2xx') {
      filtered = filtered.filter(l => l.statusCode >= 200 && l.statusCode < 300);
    } else if (sc === '3xx') {
      filtered = filtered.filter(l => l.statusCode >= 300 && l.statusCode < 400);
    } else if (sc === '4xx') {
      filtered = filtered.filter(l => l.statusCode >= 400 && l.statusCode < 500);
    } else if (sc === '5xx') {
      filtered = filtered.filter(l => l.statusCode >= 500);
    } else {
      const codeNum = parseInt(statusCode, 10);
      if (!isNaN(codeNum)) {
        filtered = filtered.filter(l => l.statusCode === codeNum);
      }
    }
  }

  // Service Name filter
  if (service) {
    filtered = filtered.filter(l => l.service && l.service.toLowerCase() === service.toLowerCase());
  }

  // Sorting
  filtered.sort((a, b) => {
    let valA = a[sortBy] || '';
    let valB = b[sortBy] || '';

    if (sortBy === 'startedAt' || sortBy === 'completedAt') {
      valA = new Date(valA).getTime() || 0;
      valB = new Date(valB).getTime() || 0;
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limitNum) || 1;
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedLogs = filtered.slice(startIndex, startIndex + limitNum);

  return {
    logs: paginatedLogs,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
  };
}

/**
 * Get timeline data for charts (grouped counts over time).
 * 
 * @param {string} range '5m' | '15m' | '1h' | '24h'
 * @returns {Array} Array of { time: string, count: number }
 */
function getTimeline(range = '15m') {
  const now = Date.now();
  let durationMs = 15 * 60 * 1000; // default 15m
  let intervalMs = 60 * 1000;     // 1-minute intervals

  if (range === '5m') {
    durationMs = 5 * 60 * 1000;
    intervalMs = 15 * 1000; // 15-second intervals
  } else if (range === '1h') {
    durationMs = 60 * 60 * 1000;
    intervalMs = 2 * 60 * 1000; // 2-minute intervals
  } else if (range === '24h') {
    durationMs = 24 * 60 * 60 * 1000;
    intervalMs = 60 * 60 * 1000; // 1-hour intervals
  }

  const startTime = now - durationMs;
  const bucketMap = new Map();

  // Initialize time buckets
  for (let t = startTime; t <= now; t += intervalMs) {
    const timeKey = formatTimeBucket(t, range);
    if (!bucketMap.has(timeKey)) {
      bucketMap.set(timeKey, 0);
    }
  }

  // Count logs in buckets
  logs.forEach(l => {
    const logTime = new Date(l.startedAt || l.completedAt).getTime();
    if (logTime >= startTime && logTime <= now) {
      // Find matching bucket
      const bucketTime = Math.floor((logTime - startTime) / intervalMs) * intervalMs + startTime;
      const key = formatTimeBucket(bucketTime, range);
      if (bucketMap.has(key)) {
        bucketMap.set(key, bucketMap.get(key) + 1);
      }
    }
  });

  // Convert to array
  const timeline = [];
  bucketMap.forEach((count, time) => {
    timeline.push({ time, count });
  });

  return timeline;
}

/**
 * Helper to format timestamp into readable bucket label.
 */
function formatTimeBucket(timestamp, range) {
  const d = new Date(timestamp);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  if (range === '5m') {
    return `${hours}:${minutes}:${seconds}`;
  }
  if (range === '24h') {
    return `${hours}:00`;
  }
  return `${hours}:${minutes}`;
}

/**
 * Clear all logs (useful for reset or testing).
 */
function clearLogs() {
  logs = [];
}

module.exports = {
  addLog,
  getAllLogs,
  getLogs,
  getTimeline,
  clearLogs,
  MAX_LOGS,
};
