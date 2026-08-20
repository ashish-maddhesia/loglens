/**
 * metricsService.js
 * 
 * Computes top-level KPI metrics for the summary dashboard cards:
 * - Total Logs count
 * - Active Requests count
 * - Successful Requests count (2xx/3xx)
 * - Client Errors count (4xx)
 * - Server Errors count (5xx)
 * - Average Response Time (ms)
 */

const { getAllLogs } = require('./logService');

/**
 * Get summary stats for dashboard cards.
 * 
 * @param {number} activeRequests Current count of active in-flight HTTP requests
 * @returns {Object}
 */
function getStats(activeRequests = 0) {
  const logs = getAllLogs();
  const totalLogs = logs.length;

  let successfulRequests = 0;
  let clientErrors = 0;
  let serverErrors = 0;
  let totalResponseTimeMs = 0;
  let countWithResponseTime = 0;

  logs.forEach(l => {
    // Status counts
    if (l.statusCode >= 200 && l.statusCode < 400) {
      successfulRequests++;
    } else if (l.statusCode >= 400 && l.statusCode < 500) {
      clientErrors++;
    } else if (l.statusCode >= 500) {
      serverErrors++;
    }

    // Response time calculation
    if (typeof l.responseTimeMs === 'number') {
      totalResponseTimeMs += l.responseTimeMs;
      countWithResponseTime++;
    } else if (typeof l.responseTime === 'string') {
      const parsed = parseFloat(l.responseTime);
      if (!isNaN(parsed)) {
        totalResponseTimeMs += parsed;
        countWithResponseTime++;
      }
    }
  });

  const averageResponseTime = countWithResponseTime > 0
    ? Math.round(totalResponseTimeMs / countWithResponseTime)
    : 0;

  return {
    totalLogs,
    activeRequests: Math.max(0, activeRequests),
    successfulRequests,
    clientErrors,
    serverErrors,
    averageResponseTime,
  };
}

module.exports = {
  getStats,
};
