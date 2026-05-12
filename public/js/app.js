// === Base path for subdirectory deployment (e.g., /Pomodoro) ===
// Auto-detected from the page URL so it works both locally and on the server
const BASE_PATH = (() => {
  const path = window.location.pathname;
  // Remove trailing slash if present
  let dir = path.endsWith('/') ? path.slice(0, -1) : path;
  // If we have a filename (like index.html), remove the filename portion
  const lastSegment = dir.split('/').pop() || '';
  if (lastSegment.includes('.')) {
    // Remove the /filename.ext from the end
    dir = dir.slice(0, -lastSegment.length - 1);
  }
  // dir is now like '/Pomodoro' or '' for root
  return dir;
})();

// === State ===
let state = {
  settings: {
    focusDuration: 1500,
    shortBreak: 300,
    longBreak: 900,
    longBreakInterval: 4,
    soundEnabled: true
  },
  timer: {
    isRunning: false,
    isPaused: false,
    phase: 'focus', // 'focus', 'shortBreak', 'longBreak'
    timeLeft: 1500,
    totalTime: 1500,
    completedPomodoros: 0,
    selectedCategoryId: null,
    intervalId: null
  }
};

// === DOM References ===
const $ = (id) => document.getElementById(id);
const timerDisplay = $('timerDisplay');
const timerPhase = $('timerPhase');
const timerCategory = $('timerCategory');
const timerCategories = $('timerCategories');
const pomodoroCount = $('pomodoroCount');
const sessionStatus = $('sessionStatus');
const startBtn = $('startBtn');
const pauseBtn = $('pauseBtn');
const resetBtn = $('resetBtn');
const progressBar = document.querySelector('.progress-bar');
const darkModeToggle = $('darkModeToggle');

// === Audio Beep ===
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);

    // Second beep
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.frequency.value = 1000;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.5, audioCtx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.65);
    osc2.start(audioCtx.currentTime + 0.15);
    osc2.stop(audioCtx.currentTime + 0.65);
  } catch (e) {
    // Silently fail if audio isn't available
  }
}

// === Notification ===
function sendNotification(title, message) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body: message, icon: '🍅' });
  }
  playBeep();
}

// === Timer SVG Progress Ring ===
function updateProgress() {
  const circumference = 2 * Math.PI * 125; // r=125
  const offset = state.timer.isRunning || state.timer.isPaused
    ? circumference * (1 - state.timer.timeLeft / state.timer.totalTime)
    : 0;
  progressBar.style.strokeDashoffset = offset;
}

// === Timer Display ===
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(state.timer.timeLeft);
  
  const phases = {
    focus: 'Focus',
    shortBreak: 'Short Break',
    longBreak: 'Long Break'
  };
  timerPhase.textContent = phases[state.timer.phase];
  
  // Use category color if one is selected, otherwise phase defaults
  const selectedCat = state.timer.selectedCategoryId
    ? window.allCategories?.find(c => c.id === state.timer.selectedCategoryId)
    : null;
  
  let timerColor;
  if (selectedCat) {
    timerColor = selectedCat.color;
  } else {
    const defaultColors = {
      focus: 'var(--primary)',
      shortBreak: '#4CAF50',
      longBreak: '#2196F3'
    };
    timerColor = defaultColors[state.timer.phase];
  }
  
  progressBar.style.stroke = timerColor;
  timerPhase.style.color = timerColor;
  
  updateProgress();
  updateSessionStatus();
}

function updateSessionStatus() {
  if (state.timer.isRunning) {
    sessionStatus.textContent = state.timer.isPaused ? 'Paused' : 'Focusing...';
  } else {
    if (state.timer.phase === 'focus') {
      sessionStatus.textContent = 'Ready to focus';
    } else {
      sessionStatus.textContent = 'Break time';
    }
  }
}

// === Timer Controls ===
function startTimer() {
  if (state.timer.isRunning && !state.timer.isPaused) return;
  
  if (state.timer.isPaused) {
    state.timer.isPaused = false;
  } else {
    if (state.timer.timeLeft <= 0) {
      resetTimer();
    }
  }
  
  state.timer.isRunning = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  
  state.timer.intervalId = setInterval(() => {
    state.timer.timeLeft--;
    updateTimerDisplay();
    
    if (state.timer.timeLeft <= 0) {
      clearInterval(state.timer.intervalId);
      state.timer.isRunning = false;
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      onTimerComplete();
    }
  }, 1000);
}

function pauseTimer() {
  if (!state.timer.isRunning || state.timer.isPaused) return;
  state.timer.isPaused = true;
  clearInterval(state.timer.intervalId);
  state.timer.isRunning = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  updateSessionStatus();
}

function resetTimer() {
  clearInterval(state.timer.intervalId);
  state.timer.isRunning = false;
  state.timer.isPaused = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  
  const durations = {
    focus: state.settings.focusDuration,
    shortBreak: state.settings.shortBreak,
    longBreak: state.settings.longBreak
  };
  state.timer.timeLeft = durations[state.timer.phase];
  state.timer.totalTime = durations[state.timer.phase];
  updateTimerDisplay();
}

// This needs to be exported/shared - define on window
function switchPhase(phase) {
  clearInterval(state.timer.intervalId);
  state.timer.isRunning = false;
  state.timer.isPaused = false;
  state.timer.phase = phase;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  
  const durations = {
    focus: state.settings.focusDuration,
    shortBreak: state.settings.shortBreak,
    longBreak: state.settings.longBreak
  };
  state.timer.timeLeft = durations[phase];
  state.timer.totalTime = durations[phase];
  updateTimerDisplay();
}

function onTimerComplete() {
  if (state.timer.phase === 'focus') {
    // Save session
    state.timer.completedPomodoros++;
    pomodoroCount.textContent = `Pomodoro #${state.timer.completedPomodoros}`;
    
    if (state.timer.selectedCategoryId) {
      saveSession(state.timer.selectedCategoryId, state.settings.focusDuration);
    }
    
    sendNotification('Pomodoro Complete!', 'Great job! Time for a break.');
    
    // Decide break type
    if (state.timer.completedPomodoros % state.settings.longBreakInterval === 0) {
      switchPhase('longBreak');
    } else {
      switchPhase('shortBreak');
    }
  } else {
    sendNotification('Break Over', 'Time to focus again!');
    switchPhase('focus');
  }
}

async function saveSession(categoryId, duration) {
  try {
    await fetch(BASE_PATH + '/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, duration })
    });
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

// === Category Selector (Timer) ===
function renderTimerCategories(categories) {
  timerCategories.innerHTML = '';
  
  // "No category" option
  const noneChip = document.createElement('button');
  noneChip.className = `cat-chip${!state.timer.selectedCategoryId ? ' selected' : ''}`;
  noneChip.innerHTML = '<span>❌</span> None';
  noneChip.dataset.id = '';
  noneChip.addEventListener('click', () => selectTimerCategory(null));
  timerCategories.appendChild(noneChip);
  
  categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = `cat-chip${state.timer.selectedCategoryId === cat.id ? ' selected' : ''}`;
    chip.innerHTML = `<span class="cat-icon">${cat.icon || '📌'}</span> ${cat.name}`;
    chip.style.borderColor = cat.color;
    if (state.timer.selectedCategoryId === cat.id) {
      chip.style.background = cat.color;
    }
    chip.dataset.id = cat.id;
    chip.addEventListener('click', () => selectTimerCategory(cat.id));
    timerCategories.appendChild(chip);
  });
}

function selectTimerCategory(categoryId) {
  state.timer.selectedCategoryId = categoryId;
  const cat = window.allCategories.find(c => c.id === categoryId);
  timerCategory.textContent = cat ? `${cat.icon || '📌'} ${cat.name}` : 'Select a category';
  renderTimerCategories(window.allCategories);
  updateTimerDisplay();
}

// === Navigation ===
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    const view = document.getElementById(`view-${btn.dataset.view}`);
    if (view) view.classList.add('active');
    
    // Refresh data when switching views
    if (btn.dataset.view === 'categories') loadCategories();
    if (btn.dataset.view === 'statistics') loadStatistics();
  });
});

// === Dark Mode ===
darkModeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  darkModeToggle.textContent = isDark ? '🌙' : '☀️';
  saveSettings({ darkMode: !isDark });
});

// === Timer Events ===
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// === Load Settings ===
async function loadSettings() {
  try {
    const res = await fetch(BASE_PATH + '/api/settings');
    const settings = await res.json();
    state.settings = { ...state.settings, ...settings };
    
    // Apply dark mode
    if (settings.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      darkModeToggle.textContent = '☀️';
    }
    
    // Update timer with loaded settings
    const durations = {
      focus: state.settings.focusDuration,
      shortBreak: state.settings.shortBreak,
      longBreak: state.settings.longBreak
    };
    state.timer.timeLeft = durations[state.timer.phase];
    state.timer.totalTime = durations[state.timer.phase];
    updateTimerDisplay();
    
    // Populate settings form
    $('focusDuration').value = Math.floor(state.settings.focusDuration / 60);
    $('shortBreak').value = Math.floor(state.settings.shortBreak / 60);
    $('longBreak').value = Math.floor(state.settings.longBreak / 60);
    $('longBreakInterval').value = state.settings.longBreakInterval;
    $('soundEnabled').checked = state.settings.soundEnabled !== false;
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function saveSettings(updates) {
  try {
    const res = await fetch(BASE_PATH + '/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const settings = await res.json();
    state.settings = { ...state.settings, ...settings };
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// Save settings button
document.addEventListener('DOMContentLoaded', () => {
  $('saveSettingsBtn').addEventListener('click', async () => {
    const focusMin = parseInt($('focusDuration').value) || 25;
    const shortMin = parseInt($('shortBreak').value) || 5;
    const longMin = parseInt($('longBreak').value) || 15;
    const interval = parseInt($('longBreakInterval').value) || 4;
    const soundEnabled = $('soundEnabled').checked;
    
    await saveSettings({
      focusDuration: focusMin * 60,
      shortBreak: shortMin * 60,
      longBreak: longMin * 60,
      longBreakInterval: interval,
      soundEnabled
    });
    
    // Reset timer with new durations
    resetTimer();
    alert('Settings saved!');
  });
});

// === Request notification permission ===
if ('Notification' in window) {
  Notification.requestPermission();
}

// === Init ===
async function init() {
  await loadSettings();
  await loadCategories();
  updateTimerDisplay();
  pomodoroCount.textContent = 'Pomodoro #0';
}

// Export functions for other scripts
window.state = state;
window.renderTimerCategories = renderTimerCategories;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
