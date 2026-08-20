/**
 * memoryService.js
 * 
 * Periodically samples Node.js process memory via process.memoryUsage()
 * and maintains a historical snapshot array for visualization on Chart.js.
 */

const MAX_MEMORY_HISTORY = 60; // 60 data points (every 3 seconds = 3 minutes window)
const memoryHistory = [];

/**
 * Get current process memory usage metrics in bytes and MB formats.
 * 
 * @returns {Object}
 */
function getCurrentMemory() {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    heapTotal: mem.heapTotal,
    heapUsed: mem.heapUsed,
    external: mem.external || 0,
    arrayBuffers: mem.arrayBuffers || 0,
    // Formatted in MB for easy presentation
    rssMB: (mem.rss / (1024 * 1024)).toFixed(2),
    heapTotalMB: (mem.heapTotal / (1024 * 1024)).toFixed(2),
    heapUsedMB: (mem.heapUsed / (1024 * 1024)).toFixed(2),
    externalMB: ((mem.external || 0) / (1024 * 1024)).toFixed(2),
  };
}

/**
 * Periodically sample memory to maintain history.
 */
setInterval(() => {
  const current = getCurrentMemory();
  const timestamp = new Date();
  const timeLabel = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  memoryHistory.push({
    time: timeLabel,
    timestamp: timestamp.toISOString(),
    heapUsedMB: parseFloat(current.heapUsedMB),
    heapTotalMB: parseFloat(current.heapTotalMB),
    rssMB: parseFloat(current.rssMB),
    heapUsed: current.heapUsed,
    heapTotal: current.heapTotal,
    rss: current.rss,
  });

  if (memoryHistory.length > MAX_MEMORY_HISTORY) {
    memoryHistory.shift();
  }
}, 3000);

/**
 * Return memory metrics and history timeline.
 * 
 * @returns {Object}
 */
function getMemoryMetrics() {
  const current = getCurrentMemory();
  return {
    ...current,
    history: [...memoryHistory],
  };
}

module.exports = {
  getCurrentMemory,
  getMemoryMetrics,
};
