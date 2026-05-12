const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'sessions.json');

// Ensure data directory exists
const DATA_DIR = path.dirname(DATA_FILE);
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { categories: [], sessions: [], settings: {} };
  }
}

function writeData(data) {
  // Ensure directory exists before writing
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// === Settings ===
app.get('/api/settings', (req, res) => {
  const data = readData();
  res.json(data.settings);
});

app.put('/api/settings', (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  writeData(data);
  res.json(data.settings);
});

// === Categories ===
app.get('/api/categories', (req, res) => {
  const data = readData();
  res.json(data.categories);
});

app.post('/api/categories', (req, res) => {
  const data = readData();
  const category = {
    id: crypto.randomUUID(),
    name: req.body.name,
    color: req.body.color || '#4CAF50',
    icon: req.body.icon || '📌'
  };
  data.categories.push(category);
  writeData(data);
  res.json(category);
});

app.put('/api/categories/:id', (req, res) => {
  const data = readData();
  const idx = data.categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  data.categories[idx] = { ...data.categories[idx], ...req.body };
  writeData(data);
  res.json(data.categories[idx]);
});

app.delete('/api/categories/:id', (req, res) => {
  const data = readData();
  data.categories = data.categories.filter(c => c.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

// === Sessions ===
app.get('/api/sessions', (req, res) => {
  const data = readData();
  res.json(data.sessions);
});

app.post('/api/sessions', (req, res) => {
  const data = readData();
  const session = {
    id: crypto.randomUUID(),
    categoryId: req.body.categoryId,
    duration: req.body.duration,
    completedAt: new Date().toISOString()
  };
  data.sessions.push(session);
  writeData(data);
  res.json(session);
});

app.delete('/api/sessions', (req, res) => {
  const data = readData();
  data.sessions = [];
  writeData(data);
  res.json({ success: true });
});

// === Statistics ===
app.get('/api/statistics', (req, res) => {
  const data = readData();
  const { sessions, categories } = data;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Today
  const todaySessions = sessions.filter(s => new Date(s.completedAt) >= today);

  // This week
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekSessions = sessions.filter(s => new Date(s.completedAt) >= weekStart);

  // This month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSessions = sessions.filter(s => new Date(s.completedAt) >= monthStart);

  // Category breakdown
  function categoryBreakdown(sessionList) {
    const breakdown = {};
    sessionList.forEach(s => {
      if (!breakdown[s.categoryId]) {
        breakdown[s.categoryId] = { count: 0, totalTime: 0 };
      }
      breakdown[s.categoryId].count++;
      breakdown[s.categoryId].totalTime += s.duration;
    });
    return Object.entries(breakdown).map(([catId, stats]) => {
      const cat = categories.find(c => c.id === catId);
      return {
        categoryId: catId,
        categoryName: cat ? cat.name : 'Unknown',
        categoryColor: cat ? cat.color : '#999',
        categoryIcon: cat ? cat.icon : '❓',
        ...stats
      };
    }).sort((a, b) => b.totalTime - a.totalTime);
  }

  // Streak calculation
  let currentStreak = 0;
  let checkDate = new Date(today);
  while (true) {
    const dayStart = new Date(checkDate);
    const dayEnd = new Date(checkDate);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const daySessions = sessions.filter(s => {
      const d = new Date(s.completedAt);
      return d >= dayStart && d < dayEnd;
    });
    if (daySessions.length > 0) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak
  let longestStreak = 0;
  let streakCount = 0;
  let streakDate = new Date(today);
  streakDate.setDate(streakDate.getDate() - 365); // look back 1 year
  const streakEnd = new Date(today);
  while (streakDate <= streakEnd) {
    const dayStart = new Date(streakDate);
    const dayEnd = new Date(streakDate);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const daySessions = sessions.filter(s => {
      const d = new Date(s.completedAt);
      return d >= dayStart && d < dayEnd;
    });
    if (daySessions.length > 0) {
      streakCount++;
      longestStreak = Math.max(longestStreak, streakCount);
    } else {
      streakCount = 0;
    }
    streakDate.setDate(streakDate.getDate() + 1);
  }

  // All-time favorites
  const allBreakdown = categoryBreakdown(sessions);

  // Last 7 days activity (for chart)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const daySessions = sessions.filter(s => {
      const d = new Date(s.completedAt);
      return d >= dayStart && d < dayEnd;
    });
    const totalTime = daySessions.reduce((sum, s) => sum + s.duration, 0);
    last7Days.push({
      date: day.toISOString().split('T')[0],
      dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
      sessions: daySessions.length,
      totalTime
    });
  }

  res.json({
    totalSessions: sessions.length,
    totalFocusTime: sessions.reduce((sum, s) => sum + s.duration, 0),
    todaySessions: todaySessions.length,
    todayFocusTime: todaySessions.reduce((sum, s) => sum + s.duration, 0),
    weekSessions: weekSessions.length,
    weekFocusTime: weekSessions.reduce((sum, s) => sum + s.duration, 0),
    monthSessions: monthSessions.length,
    monthFocusTime: monthSessions.reduce((sum, s) => sum + s.duration, 0),
    currentStreak,
    longestStreak,
    categoryBreakdown: allBreakdown,
    last7Days,
    todayBreakdown: categoryBreakdown(todaySessions),
    weekBreakdown: categoryBreakdown(weekSessions),
    monthBreakdown: categoryBreakdown(monthSessions)
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍅 Pomodoro App running at http://0.0.0.0:${PORT}`);
});
