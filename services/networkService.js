/**
 * networkService.js
 * 
 * Tracks network metrics for HTTP requests handled by the application:
 * - Total request count
 * - Requests per second (RPS)
 * - Incoming request payload bytes
 * - Outgoing response bytes
 * - Data transfer timeline history for graph visualization
 */

let totalRequests = 0;
let totalIncomingBytes = 0;
let totalOutgoingBytes = 0;

// Rolling window for RPS calculation
let requestsInCurrentSecond = 0;
let currentRPS = 0;

// History snapshots for graph plotting (max 60 points = 2 minutes of 2s ticks)
const MAX_HISTORY_POINTS = 60;
const history = [];

// Reset RPS counter every second
setInterval(() => {
  currentRPS = requestsInCurrentSecond;
  requestsInCurrentSecond = 0;

  // Add snapshot to history
  const snapshot = {
    timestamp: new Date().toISOString(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    rps: currentRPS,
    incomingBytes: totalIncomingBytes,
    outgoingBytes: totalOutgoingBytes,
    totalTransferred: totalIncomingBytes + totalOutgoingBytes,
  };

  history.push(snapshot);
  if (history.length > MAX_HISTORY_POINTS) {
    history.shift();
  }
}, 2000);

/**
 * Record a request network event.
 * 
 * @param {number} reqBytes Incoming byte size
 * @param {number} resBytes Outgoing byte size
 */
function recordNetworkActivity(reqBytes = 0, resBytes = 0) {
  totalRequests++;
  requestsInCurrentSecond++;
  totalIncomingBytes += Math.max(0, reqBytes || 0);
  totalOutgoingBytes += Math.max(0, resBytes || 0);
}

/**
 * Get current network metrics summary.
 * 
 * @returns {Object}
 */
function getNetworkMetrics() {
  return {
    totalRequests,
    requestsPerSecond: currentRPS,
    incomingBytes: totalIncomingBytes,
    outgoingBytes: totalOutgoingBytes,
    totalTransferred: totalIncomingBytes + totalOutgoingBytes,
    history: [...history],
  };
}

module.exports = {
  recordNetworkActivity,
  getNetworkMetrics,
};
