// === Statistics ===
let statsData = null;
let currentPeriod = 'today';

async function loadStatistics() {
  try {
    const res = await fetch(BASE_PATH + '/api/statistics');
    statsData = await res.json();
    renderStatistics(currentPeriod);
  } catch (e) {
    console.error('Failed to load statistics:', e);
  }
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function renderStatistics(period) {
  if (!statsData) return;
  
  let sessions, focusTime, breakdown;
  
  switch (period) {
    case 'today':
      sessions = statsData.todaySessions;
      focusTime = statsData.todayFocusTime;
      breakdown = statsData.todayBreakdown;
      break;
    case 'week':
      sessions = statsData.weekSessions;
      focusTime = statsData.weekFocusTime;
      breakdown = statsData.weekBreakdown;
      break;
    case 'month':
      sessions = statsData.monthSessions;
      focusTime = statsData.monthFocusTime;
      breakdown = statsData.monthBreakdown;
      break;
    default:
      sessions = statsData.totalSessions;
      focusTime = statsData.totalFocusTime;
      breakdown = statsData.categoryBreakdown;
  }
  
  $('statSessions').textContent = sessions;
  $('statTime').textContent = formatDuration(focusTime);
  $('statStreak').textContent = `${statsData.currentStreak} day${statsData.currentStreak !== 1 ? 's' : ''}`;
  $('statBestStreak').textContent = `${statsData.longestStreak} day${statsData.longestStreak !== 1 ? 's' : ''}`;
  
  drawWeeklyChart();
  drawCategoryChart(breakdown);
}

// === Helper: draw a rounded rect path (compatible alternative to ctx.roundRect) ===
function roundRect(ctx, x, y, w, h, radii) {
  const r = Array.isArray(radii) ? radii : [radii, radii, radii, radii];
  const [tl, tr, br, bl] = r.map(v => Math.min(v || 0, Math.min(w, h) / 2));
  
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

// === Helper: get resolved CSS variable value for canvas ===
function cssVar(name, fallback = '#999') {
  try {
    const val = getComputedStyle(document.body).getPropertyValue(name).trim();
    return val || fallback;
  } catch (e) {
    return fallback;
  }
}

// === Weekly Chart (Bar chart) ===
function drawWeeklyChart() {
  const canvas = $('weeklyChart');
  if (!canvas || !statsData) return;
  const ctx = canvas.getContext('2d');
  
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 10, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Clear
  ctx.clearRect(0, 0, width, height);
  
  const days = statsData.last7Days || [];
  if (days.length === 0) {
    ctx.fillStyle = cssVar('--text-muted', '#999');
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', width / 2, height / 2);
    return;
  }
  
  const maxTime = Math.max(...days.map(d => d.totalTime), 1);
  const barWidth = chartWidth / days.length * 0.6;
  const gap = chartWidth / days.length * 0.4;
  
  // Get computed style for colors
  const textColor = cssVar('--text-secondary', '#666');
  
  days.forEach((day, i) => {
    const x = padding.left + (chartWidth / days.length) * i + gap / 2;
    const barHeight = (day.totalTime / maxTime) * chartHeight;
    const y = padding.top + chartHeight - barHeight;
    
    // Bar
    const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)');
    gradient.addColorStop(1, 'rgba(231, 76, 60, 0.2)');
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, barWidth, barHeight, [4, 4, 0, 0]);
    ctx.fill();
    
    // Day label
    ctx.fillStyle = textColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(day.dayName, x + barWidth / 2, padding.top + chartHeight + 18);
    
    // Time label
    if (barHeight > 20) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatDurationShort(day.totalTime), x + barWidth / 2, y + 14);
    }
  });
}

function formatDurationShort(seconds) {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h`;
  }
  return `${minutes}m`;
}

// === Category Chart (Doughnut) ===
function drawCategoryChart(breakdown) {
  const canvas = $('categoryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = rect.height;
  
  ctx.clearRect(0, 0, width, height);
  
  if (!breakdown || breakdown.length === 0) {
    ctx.fillStyle = cssVar('--text-muted', '#999');
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', width / 2, height / 2);
    return;
  }
  
  const centerX = width / 2 - 50;
  const centerY = height / 2;
  const radius = Math.min(width * 0.3, height * 0.35);
  const innerRadius = radius * 0.55;
  const total = breakdown.reduce((sum, b) => sum + b.totalTime, 0);
  
  // Draw doughnut
  let startAngle = -Math.PI / 2;
  
  breakdown.forEach(item => {
    const sliceAngle = (item.totalTime / total) * Math.PI * 2;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    
    ctx.fillStyle = item.categoryColor;
    ctx.fill();
    
    startAngle += sliceAngle;
  });
  
  // Center text
  ctx.fillStyle = cssVar('--text', '#333');
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  
  // Show in minutes as a number for the center
  const totalMinutes = Math.floor(total / 60);
  ctx.fillText(totalMinutes, centerX, centerY - 6);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = cssVar('--text-muted', '#999');
  ctx.fillText('minutes', centerX, centerY + 14);
  
  // Legend
  const legendX = width - 120;
  const legendY = 20;
  const itemHeight = 24;
  
  const legendTextColor = cssVar('--text-secondary', '#666');
  
  breakdown.slice(0, 5).forEach((item, i) => {
    const y = legendY + i * itemHeight;
    
    ctx.fillStyle = item.categoryColor;
    ctx.beginPath();
    ctx.arc(legendX + 6, y + 6, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = legendTextColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    const label = `${item.categoryIcon || '📌'} ${item.categoryName}`;
    ctx.fillText(label, legendX + 16, y + 10);
  });
}

// === Stats Tab Switching ===
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.stats-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPeriod = tab.dataset.period;
      renderStatistics(currentPeriod);
    });
  });
});

// Handle resize
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (document.querySelector('.nav-btn[data-view="statistics"]').classList.contains('active')) {
      loadStatistics();
    }
  }, 200);
});

// Export
window.loadStatistics = loadStatistics;
