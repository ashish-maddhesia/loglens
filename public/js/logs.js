/**
 * public/js/logs.js
 * 
 * Professional Observability Dashboard Client Logic
 * Written in Vanilla JavaScript & Chart.js.
 * Handles chart visualization, live API data fetching with fallbacks,
 * right-side sliding drawer panel, filters, and skeleton loaders.
 */

document.addEventListener('DOMContentLoaded', () => {

  // Dashboard State
  let currentPage = 1;
  let currentTimelineRange = '5m';
  let activeLogs = [];
  let selectedLog = null;
  let autoRefreshTimer = null;

  // Chart Instances
  let mainActivityChart = null;
  let sparklineNetwork = null;
  let sparklineMemory = null;

  // Sample production data fallback (clearly structured for offline/standalone preview)
  const SAMPLE_LOGS = [
    {
      requestId: 'req_8f1a29d4-1a90',
      timestamp: new Date(Date.now() - 1000 * 12).toISOString(),
      timeFormatted: '10:42:18',
      service: 'express-app',
      method: 'GET',
      route: '/api/users',
      statusCode: 200,
      responseTime: '24ms',
      responseTimeMs: 24,
      responseSize: 2450,
      logLevel: 'INFO',
      ip: '192.168.1.10',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      userId: 'usr_9401',
      activeRequestsAtStart: 3,
      requestBody: null
    },
    {
      requestId: 'req_3b7c91e0-442a',
      timestamp: new Date(Date.now() - 1000 * 45).toISOString(),
      timeFormatted: '10:41:52',
      service: 'express-app',
      method: 'POST',
      route: '/api/auth/login',
      statusCode: 401,
      responseTime: '82ms',
      responseTimeMs: 82,
      responseSize: 1200,
      logLevel: 'WARN',
      ip: '10.0.4.12',
      userAgent: 'PostmanRuntime/7.29.2',
      userId: null,
      activeRequestsAtStart: 5,
      requestBody: { email: 'user@example.com', password: '[REDACTED]' }
    },
    {
      requestId: 'req_99d12a0f-8c11',
      timestamp: new Date(Date.now() - 1000 * 110).toISOString(),
      timeFormatted: '10:40:31',
      service: 'express-app',
      method: 'GET',
      route: '/api/products',
      statusCode: 500,
      responseTime: '1.2s',
      responseTimeMs: 1200,
      responseSize: 4800,
      logLevel: 'ERROR',
      error: 'Database connection pool timeout in query runner',
      ip: '172.16.0.8',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      userId: 'usr_1022',
      activeRequestsAtStart: 12,
      requestBody: null
    },
    {
      requestId: 'req_14e5a9b2-3f7c',
      timestamp: new Date(Date.now() - 1000 * 180).toISOString(),
      timeFormatted: '10:39:15',
      service: 'express-app',
      method: 'PUT',
      route: '/api/users/profile',
      statusCode: 200,
      responseTime: '45ms',
      responseTimeMs: 45,
      responseSize: 850,
      logLevel: 'INFO',
      ip: '192.168.1.15',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)',
      userId: 'usr_8831',
      activeRequestsAtStart: 2,
      requestBody: { name: 'Alice Vance', avatar: 'https://example.com/avatar.png' }
    },
    {
      requestId: 'req_62c8d1e3-99b1',
      timestamp: new Date(Date.now() - 1000 * 240).toISOString(),
      timeFormatted: '10:38:04',
      service: 'express-app',
      method: 'DELETE',
      route: '/api/sessions/current',
      statusCode: 204,
      responseTime: '12ms',
      responseTimeMs: 12,
      responseSize: 0,
      logLevel: 'INFO',
      ip: '192.168.1.10',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      userId: 'usr_9401',
      activeRequestsAtStart: 1,
      requestBody: null
    }
  ];

  // Initialize
  initCharts();
  bindEvents();
  fetchDashboardData();
  startAutoRefresh(3000);

  // ==========================================
  // 1. Chart Initialization
  // ==========================================

  function initCharts() {
    // Common Minimal Chart Config
    const commonScales = {
      x: {
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } },
        grid: { color: '#1c2638', drawBorder: false }
      },
      y: {
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } },
        grid: { color: '#1c2638', drawBorder: false },
        beginAtZero: true
      }
    };

    // 1. Main Request Activity Line Chart
    const ctxMain = document.getElementById('chart-request-activity').getContext('2d');
    const mainGradient = ctxMain.createLinearGradient(0, 0, 0, 180);
    mainGradient.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    mainGradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    mainActivityChart = new Chart(ctxMain, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Requests',
          data: [],
          borderColor: '#38bdf8',
          backgroundColor: mainGradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0e1420',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            borderColor: '#26344d',
            borderWidth: 1,
            padding: 10,
            displayColors: false
          }
        },
        scales: commonScales
      }
    });

    // 2. Compact Network Sparkline Chart
    const ctxNet = document.getElementById('chart-sparkline-network').getContext('2d');
    sparklineNetwork = new Chart(ctxNet, {
      type: 'line',
      data: {
        labels: ['', '', '', '', '', '', '', ''],
        datasets: [{
          data: [12, 19, 15, 25, 22, 30, 28, 35],
          borderColor: '#10b981',
          borderWidth: 1.5,
          fill: false,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: getSparklineOptions()
    });

    // 3. Compact Memory Sparkline Chart
    const ctxMem = document.getElementById('chart-sparkline-memory').getContext('2d');
    sparklineMemory = new Chart(ctxMem, {
      type: 'line',
      data: {
        labels: ['', '', '', '', '', '', '', ''],
        datasets: [{
          data: [42, 43, 41, 44, 45, 43, 44, 46],
          borderColor: '#a855f7',
          borderWidth: 1.5,
          fill: false,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: getSparklineOptions()
    });
  }

  function getSparklineOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } }
    };
  }

  // ==========================================
  // 2. Data Fetching & Syncing
  // ==========================================

  async function fetchDashboardData() {
    try {
      // Attempt API calls to backend server endpoints
      const [resStats, resTimeline, resNet, resMem, resLogs] = await Promise.allSettled([
        fetch('/api/logs/stats'),
        fetch(`/api/logs/timeline?range=${currentTimelineRange}`),
        fetch('/api/logs/network'),
        fetch('/api/logs/memory'),
        fetchLogsApi()
      ]);

      // Update Horizontal Metrics Bar
      if (resStats.status === 'fulfilled' && resStats.value.ok) {
        const stats = await resStats.value.json();
        updateMetricsBar({
          totalRequests: stats.totalLogs,
          activeNow: stats.activeRequests,
          avgResponseTime: `${stats.averageResponseTime}ms`,
          errorRate: calculateErrorRate(stats.totalLogs, stats.clientErrors, stats.serverErrors)
        });
      } else {
        // Fallback sample data
        updateMetricsBar({
          totalRequests: '1,245',
          activeNow: '12',
          avgResponseTime: '42ms',
          errorRate: '2.4%'
        });
      }

      // Update Main Request Activity Timeline Graph
      if (resTimeline.status === 'fulfilled' && resTimeline.value.ok) {
        const timeline = await resTimeline.value.json();
        mainActivityChart.data.labels = timeline.map(t => t.time);
        mainActivityChart.data.datasets[0].data = timeline.map(t => t.count);
        mainActivityChart.update('none');
      } else {
        // Sample graph fallback
        mainActivityChart.data.labels = ['10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30', '10:35', '10:40'];
        mainActivityChart.data.datasets[0].data = [14, 28, 45, 32, 60, 48, 85, 92, 110];
        mainActivityChart.update('none');
      }

      // Update Network & Memory System Metrics
      if (resNet.status === 'fulfilled' && resNet.value.ok) {
        const net = await resNet.value.json();
        document.getElementById('net-rps').textContent = `${net.requestsPerSecond} req/s`;
        document.getElementById('net-incoming').textContent = formatBytes(net.incomingBytes);
        document.getElementById('net-outgoing').textContent = formatBytes(net.outgoingBytes);
        if (net.history && net.history.length > 0) {
          sparklineNetwork.data.datasets[0].data = net.history.map(h => h.rps);
          sparklineNetwork.update('none');
        }
      } else {
        document.getElementById('net-rps').textContent = '14 req/s';
        document.getElementById('net-incoming').textContent = '1.2 MB';
        document.getElementById('net-outgoing').textContent = '4.8 MB';
      }

      if (resMem.status === 'fulfilled' && resMem.value.ok) {
        const mem = await resMem.value.json();
        document.getElementById('mem-heap-used').textContent = `${mem.heapUsedMB} MB`;
        document.getElementById('mem-heap-val').textContent = `${mem.heapUsedMB} MB`;
        document.getElementById('mem-rss-val').textContent = `${mem.rssMB} MB`;
        document.getElementById('mem-ext-val').textContent = `${mem.externalMB} MB`;
        if (mem.history && mem.history.length > 0) {
          sparklineMemory.data.datasets[0].data = mem.history.map(h => h.heapUsedMB);
          sparklineMemory.update('none');
        }
      } else {
        document.getElementById('mem-heap-used').textContent = '48.2 MB';
        document.getElementById('mem-heap-val').textContent = '48.2 MB';
        document.getElementById('mem-rss-val').textContent = '94.1 MB';
        document.getElementById('mem-ext-val').textContent = '8.5 MB';
      }

      // Update Last Updated timestamp
      document.getElementById('last-updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (err) {
      console.warn('Using sample fallback data for frontend preview:', err);
    }
  }

  async function fetchLogsApi() {
    const search = document.getElementById('input-search').value;
    const method = document.getElementById('filter-method').value;
    const logLevel = document.getElementById('filter-level').value;
    const statusCode = document.getElementById('filter-status').value;

    const params = new URLSearchParams({
      search, method, logLevel, statusCode, page: currentPage, limit: 25
    });

    const res = await fetch(`/api/logs?${params.toString()}`);
    if (!res.ok) throw new Error('API fetch failed');
    const data = await res.json();
    
    activeLogs = data.logs;
    renderLogsTable(data.logs, data.total, data.page, data.totalPages);
    return data;
  }

  // Update Horizontal Metrics Text
  function updateMetricsBar(metrics) {
    document.getElementById('metric-total-requests').textContent = metrics.totalRequests;
    document.getElementById('metric-active-requests').textContent = metrics.activeNow;
    document.getElementById('metric-avg-response').textContent = metrics.avgResponseTime;
    document.getElementById('metric-error-rate').textContent = metrics.errorRate;
  }

  // Render Table Rows
  function renderLogsTable(logs, total, page, totalPages) {
    const tbody = document.getElementById('logs-table-body');
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state-cell">
            <div class="empty-state-title">No logs yet</div>
            <div class="empty-state-sub">Requests to your application will appear here.</div>
          </td>
        </tr>`;
      updatePaginationControls(0, 1, 1);
      return;
    }

    logs.forEach(log => {
      const tr = document.createElement('tr');
      tr.addEventListener('click', () => openLogDrawer(log));

      const timeStr = log.timeFormatted || formatTime(log.startedAt);
      const statusBadge = getStatusBadgeClass(log.statusCode);
      const levelBadge = `badge-level-${log.logLevel || 'INFO'}`;
      const methodBadge = `badge-method-${log.method || 'GET'}`;

      tr.innerHTML = `
        <td class="code-text" style="color: var(--text-secondary);">${timeStr}</td>
        <td><span class="badge ${methodBadge}">${log.method}</span></td>
        <td class="code-text" style="font-weight: 500;">${escapeHtml(log.route)}</td>
        <td><span class="badge ${statusBadge}">${log.statusCode}</span></td>
        <td class="code-text">${log.responseTime || '0ms'}</td>
        <td class="code-text" style="color: var(--text-secondary);">${formatBytes(log.responseSize)}</td>
        <td><span class="badge ${levelBadge}">${log.logLevel}</span></td>
      `;

      tbody.appendChild(tr);
    });

    updatePaginationControls(total, page, totalPages);
  }

  // Pagination Control State
  function updatePaginationControls(total, page, totalPages) {
    currentPage = page;
    const paginationInfo = document.getElementById('pagination-info');
    const pageDisplay = document.getElementById('page-display');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    paginationInfo.textContent = `Showing ${total > 0 ? (page - 1) * 25 + 1 : 0} - ${Math.min(page * 25, total)} of ${total} logs`;
    pageDisplay.textContent = `Page ${page} of ${totalPages || 1}`;

    btnPrev.disabled = page <= 1;
    btnNext.disabled = page >= totalPages;
  }

  // ==========================================
  // 3. Right-Side Sliding Inspector Drawer
  // ==========================================

  function openLogDrawer(log) {
    selectedLog = log;
    const drawer = document.getElementById('log-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const body = document.getElementById('drawer-body-content');

    const statusBadge = getStatusBadgeClass(log.statusCode);
    const levelBadge = `badge-level-${log.logLevel || 'INFO'}`;
    const methodBadge = `badge-method-${log.method || 'GET'}`;

    body.innerHTML = `
      <div class="drawer-section">
        <div class="drawer-main-route">
          <span class="badge ${methodBadge}">${log.method}</span>
          <span>${escapeHtml(log.route)}</span>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Status & Duration</div>
        <div class="drawer-kv-grid">
          <div class="drawer-kv-item">
            <span class="drawer-kv-label">Status</span>
            <span class="drawer-kv-val"><span class="badge ${statusBadge}">${log.statusCode}</span></span>
          </div>
          <div class="drawer-kv-item">
            <span class="drawer-kv-label">Duration</span>
            <span class="drawer-kv-val">${log.responseTime || '0ms'}</span>
          </div>
          <div class="drawer-kv-item">
            <span class="drawer-kv-label">Response Size</span>
            <span class="drawer-kv-val">${formatBytes(log.responseSize)}</span>
          </div>
          <div class="drawer-kv-item">
            <span class="drawer-kv-label">Log Level</span>
            <span class="drawer-kv-val"><span class="badge ${levelBadge}">${log.logLevel}</span></span>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Request Info</div>
        <div class="drawer-kv-grid">
          <div class="drawer-kv-item" style="grid-column: span 2">
            <span class="drawer-kv-label">Request ID</span>
            <span class="drawer-kv-val">${log.requestId || '-'}</span>
          </div>
          <div class="drawer-kv-item">
            <span class="drawer-kv-label">IP Address</span>
            <span class="drawer-kv-val">${escapeHtml(log.ip || '127.0.0.1')}</span>
          </div>
          <div class="drawer-kv-item">
            <span class="drawer-kv-label">User ID</span>
            <span class="drawer-kv-val">${escapeHtml(log.userId ? String(log.userId) : 'None')}</span>
          </div>
          <div class="drawer-kv-item" style="grid-column: span 2">
            <span class="drawer-kv-label">User Agent</span>
            <span class="drawer-kv-val" style="font-size:0.75rem">${escapeHtml(log.userAgent || 'Unknown')}</span>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Timing</div>
        <div class="drawer-kv-grid">
          <div class="drawer-kv-item">
            <span class="drawer-kv-label">Started</span>
            <span class="drawer-kv-val" style="font-size:0.75rem">${log.startedAt || log.timestamp || '-'}</span>
          </div>
          <div class="drawer-kv-item">
            <span class="drawer-kv-label">Completed</span>
            <span class="drawer-kv-val" style="font-size:0.75rem">${log.completedAt || '-'}</span>
          </div>
        </div>
      </div>

      ${log.error ? `
        <div class="drawer-section">
          <div class="drawer-section-title" style="color:#f87171">Error Details</div>
          <div class="code-block" style="color:#f87171; border-color: rgba(239, 68, 68, 0.3);">${escapeHtml(log.error)}</div>
        </div>
      ` : ''}

      <div class="drawer-section">
        <div class="drawer-section-title">Request Body</div>
        <pre class="code-block">${log.requestBody ? escapeHtml(JSON.stringify(log.requestBody, null, 2)) : 'No body'}</pre>
      </div>
    `;

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('active');
  }

  function closeLogDrawer() {
    const drawer = document.getElementById('log-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('active');
  }

  // ==========================================
  // 4. Event Controls
  // ==========================================

  function bindEvents() {
    // Refresh Button
    document.getElementById('btn-refresh').addEventListener('click', () => {
      fetchDashboardData();
    });

    // Time Tab Switcher
    document.querySelectorAll('.time-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        currentTimelineRange = e.target.getAttribute('data-range');
        fetchDashboardData();
      });
    });

    // Search input (debounce)
    let searchTimeout = null;
    document.getElementById('input-search').addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1;
        fetchLogsWithFallback();
      }, 250);
    });

    // Filter dropdowns
    ['filter-method', 'filter-level', 'filter-status'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        currentPage = 1;
        fetchLogsWithFallback();
      });
    });

    // Clear filters
    document.getElementById('btn-clear-filters').addEventListener('click', () => {
      document.getElementById('input-search').value = '';
      document.getElementById('filter-method').value = '';
      document.getElementById('filter-level').value = '';
      document.getElementById('filter-status').value = '';
      currentPage = 1;
      fetchLogsWithFallback();
    });

    // Pagination
    document.getElementById('btn-prev-page').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchLogsWithFallback();
      }
    });

    document.getElementById('btn-next-page').addEventListener('click', () => {
      currentPage++;
      fetchLogsWithFallback();
    });

    // Sliding Drawer Close Handlers
    document.getElementById('btn-close-drawer').addEventListener('click', closeLogDrawer);
    document.getElementById('drawer-backdrop').addEventListener('click', closeLogDrawer);
  }

  async function fetchLogsWithFallback() {
    try {
      await fetchLogsApi();
    } catch {
      // Local client-side filter fallback on sample data
      const search = document.getElementById('input-search').value.toLowerCase();
      const method = document.getElementById('filter-method').value;
      const level = document.getElementById('filter-level').value;
      const status = document.getElementById('filter-status').value;

      let filtered = SAMPLE_LOGS.filter(l => {
        const matchesSearch = !search || (l.route.toLowerCase().includes(search) || l.requestId.toLowerCase().includes(search));
        const matchesMethod = !method || l.method === method;
        const matchesLevel = !level || l.logLevel === level;
        let matchesStatus = true;
        if (status === '2xx') matchesStatus = l.statusCode >= 200 && l.statusCode < 300;
        if (status === '3xx') matchesStatus = l.statusCode >= 300 && l.statusCode < 400;
        if (status === '4xx') matchesStatus = l.statusCode >= 400 && l.statusCode < 500;
        if (status === '5xx') matchesStatus = l.statusCode >= 500;

        return matchesSearch && matchesMethod && matchesLevel && matchesStatus;
      });

      renderLogsTable(filtered, filtered.length, 1, 1);
    }
  }

  function startAutoRefresh(ms) {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(fetchDashboardData, ms);
  }

  // ==========================================
  // 5. Utility Helpers
  // ==========================================

  function getStatusBadgeClass(code) {
    if (code >= 200 && code < 300) return 'badge-status-2xx';
    if (code >= 300 && code < 400) return 'badge-status-3xx';
    if (code >= 400 && code < 500) return 'badge-status-4xx';
    return 'badge-status-5xx';
  }

  function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatTime(isoString) {
    if (!isoString) return '10:00:00';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function calculateErrorRate(total, clientErr, serverErr) {
    if (!total || total === 0) return '0%';
    const rate = (((clientErr + serverErr) / total) * 100).toFixed(1);
    return `${rate}%`;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

});
