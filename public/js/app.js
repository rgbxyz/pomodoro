// === Base path for subdirectory deployment (e.g., /Pomodoro) ===
const BASE_PATH = (() => {
  const path = window.location.pathname;
  let dir = path.endsWith('/') ? path.slice(0, -1) : path;
  const lastSegment = dir.split('/').pop() || '';
  if (lastSegment.includes('.')) {
    dir = dir.slice(0, -lastSegment.length - 1);
  }
  return dir;
})();

// === Visualizer names for cycling ===
const VIZ_NAMES = ['classic', 'flip', 'gradient', 'glow', 'dashed', 'ripple', 'wave'];

// === State ===
let state = {
  settings: {
    focusDuration: 1500,
    shortBreak: 300,
    longBreak: 900,
    longBreakInterval: 4,
    soundEnabled: true,
    visualizer: 'classic'
  },
  timer: {
    isRunning: false,
    isPaused: false,
    phase: 'focus',
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
const progressBar = document.querySelector('[data-bar]');
const progressBarInner = document.querySelector('[data-bar-inner]');
const visualizerEl = $('timerVisualizer');
const timerDisplayEl = $('timerDisplayEl');
const rippleContainer = $('rippleContainer');
const darkModeToggle = $('darkModeToggle');
const vizToggleBtn = $('vizToggleBtn');
const fullscreenBtn = $('fullscreenBtn');
const fullscreenOverlay = $('fullscreenOverlay');
const fullscreenTimer = $('fullscreenTimer');
const fullscreenPhase = $('fullscreenPhase');
const fsStartBtn = $('fsStartBtn');
const fsPauseBtn = $('fsPauseBtn');
const fsResetBtn = $('fsResetBtn');
const fsCloseBtn = $('fsCloseBtn');
const fsPomodoroCount = $('fsPomodoroCount');
const fsSessionStatus = $('fsSessionStatus');

// Flip clock elements
const flipMinT = $('flipMinT');
const flipMinB = $('flipMinB');
const flipMinU = $('flipMinU');
const flipMinUB = $('flipMinUB');
const flipSecT = $('flipSecT');
const flipSecB = $('flipSecB');
const flipSecU = $('flipSecU');
const flipSecUB = $('flipSecUB');
const flipPhase = $('flipPhase');

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
  } catch (e) { /* silent fail */ }
}

// === Notification ===
function sendNotification(title, message) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body: message, icon: '\ud83c\udf45' });
  }
  playBeep();
}

// === Timer SVG Progress Ring ===
function updateProgress() {
  const circumference = 2 * Math.PI * 125;
  const offset = state.timer.isRunning || state.timer.isPaused
    ? circumference * (1 - state.timer.timeLeft / state.timer.totalTime)
    : 0;
  progressBar.style.strokeDashoffset = offset;

  if (progressBarInner.style.display !== 'none') {
    const innerCirc = 2 * Math.PI * 115;
    const innerOffset = state.timer.isRunning || state.timer.isPaused
      ? innerCirc * (1 - state.timer.timeLeft / state.timer.totalTime)
      : 0;
    progressBarInner.style.strokeDashoffset = innerOffset;
  }
}

// === Timer Display ===
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getTimerColor() {
  const selectedCat = state.timer.selectedCategoryId
    ? window.allCategories?.find(c => c.id === state.timer.selectedCategoryId)
    : null;
  if (selectedCat) return selectedCat.color;
  const defaultColors = {
    focus: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#e74c3c',
    shortBreak: '#4CAF50',
    longBreak: '#2196F3'
  };
  return defaultColors[state.timer.phase];
}

// === Flip Clock Update ===
function updateFlipClock() {
  const m = Math.floor(state.timer.timeLeft / 60);
  const s = state.timer.timeLeft % 60;
  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');

  flipMinT.textContent = mStr[0];
  flipMinB.textContent = mStr[0];
  flipMinU.textContent = mStr[1];
  flipMinUB.textContent = mStr[1];
  flipSecT.textContent = sStr[0];
  flipSecB.textContent = sStr[0];
  flipSecU.textContent = sStr[1];
  flipSecUB.textContent = sStr[1];
}

// === Visualizer Logic ===
function applyVisualizer(viz) {
  const vizClasses = VIZ_NAMES.map(v => 'viz-' + v);
  visualizerEl.classList.remove(...vizClasses);
  visualizerEl.classList.remove('running');

  progressBarInner.style.display = 'none';
  timerDisplayEl.style.background = '';
  timerDisplayEl.style.boxShadow = '';
  rippleContainer.style.display = 'none';
  rippleContainer.innerHTML = '';

  // Reset progress bar inline styles
  progressBar.style.strokeDasharray = '';

  const vizClass = 'viz-' + viz;
  visualizerEl.classList.add(vizClass);

  if (viz === 'gradient') {
    // handled in updateTimerDisplay
  } else if (viz === 'glow') {
    // CSS handles animation
  } else if (viz === 'dashed') {
    progressBar.style.strokeDasharray = '8 16';
  } else if (viz === 'ripple') {
    rippleContainer.style.display = 'block';
    for (let i = 0; i < 2; i++) {
      const ring = document.createElement('div');
      ring.className = 'ripple-ring';
      rippleContainer.appendChild(ring);
    }
  } else if (viz === 'flip') {
    updateFlipClock();
  }

  if (state.timer.isRunning && !state.timer.isPaused) {
    visualizerEl.classList.add('running');
  }

  updateTimerDisplay();
}

function getGradientColor(ratio) {
  let r, g, b;
  if (ratio > 0.5) {
    const t = (ratio - 0.5) * 2;
    r = Math.round(76 + (255 - 76) * (1 - t));
    g = Math.round(175 + (193 - 175) * t);
    b = Math.round(80 + (0 - 80) * t);
  } else {
    const t = ratio * 2;
    r = Math.round(255 - (255 - 231) * t);
    g = Math.round(193 - (193 - 76) * t);
    b = 0;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function getWaveColor(ratio) {
  const intensity = Math.max(0, Math.min(1, 1 - ratio));
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    const r = Math.round(26 + (60 - 26) * intensity);
    const g = Math.round(26 + (20 - 26) * intensity);
    const b = Math.round(46 + (30 - 46) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const r = Math.round(255 - (50 - 255) * intensity);
    const g = Math.round(255 - (230 - 255) * intensity);
    const b = Math.round(255 - (240 - 255) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

// === Update Timer Display ===
function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(state.timer.timeLeft);
  fullscreenTimer.textContent = formatTime(state.timer.timeLeft);
  updateFlipClock();

  const phases = {
    focus: 'Focus',
    shortBreak: 'Short Break',
    longBreak: 'Long Break'
  };
  const phaseText = phases[state.timer.phase];
  timerPhase.textContent = phaseText;
  flipPhase.textContent = phaseText;
  fullscreenPhase.textContent = phaseText;

  const timerColor = getTimerColor();
  const currentViz = state.settings.visualizer || 'classic';
  const ratio = state.timer.totalTime > 0 ? state.timer.timeLeft / state.timer.totalTime : 1;

  if (currentViz === 'gradient') {
    const gradColor = getGradientColor(ratio);
    progressBar.style.stroke = gradColor;
    timerPhase.style.color = gradColor;
  } else if (currentViz === 'wave') {
    progressBar.style.stroke = timerColor;
    timerPhase.style.color = timerColor;
    timerDisplayEl.style.background = getWaveColor(ratio);
    timerDisplayEl.style.boxShadow = `0 2px 8px rgba(0,0,0,0.1), inset 0 0 60px ${getWaveColor(ratio)}40`;
  } else {
    progressBar.style.stroke = timerColor;
    timerPhase.style.color = timerColor;
    flipPhase.style.color = timerColor;
    document.querySelectorAll('.ripple-ring').forEach(r => {
      r.style.borderColor = timerColor;
    });
  }

  // Fullscreen timer color
  fullscreenTimer.style.color = timerColor;
  fullscreenPhase.style.color = timerColor;

  updateProgress();
  updateSessionStatus();
}

// === Session Status ===
function updateSessionStatus() {
  const text = state.timer.isRunning
    ? (state.timer.isPaused ? 'Paused' : 'Focusing...')
    : (state.timer.phase === 'focus' ? 'Ready to focus' : 'Break time');
  sessionStatus.textContent = text;
  fsSessionStatus.textContent = text;
}

// === Timer Controls ===
function startTimer() {
  if (state.timer.isRunning && !state.timer.isPaused) return;

  if (state.timer.isPaused) {
    state.timer.isPaused = false;
  } else {
    if (state.timer.timeLeft <= 0) resetTimer();
  }

  state.timer.isRunning = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  fsStartBtn.disabled = true;
  fsPauseBtn.disabled = false;
  visualizerEl.classList.add('running');

  state.timer.intervalId = setInterval(() => {
    state.timer.timeLeft--;
    updateTimerDisplay();

    if (state.timer.timeLeft <= 0) {
      clearInterval(state.timer.intervalId);
      state.timer.isRunning = false;
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      fsStartBtn.disabled = false;
      fsPauseBtn.disabled = true;
      visualizerEl.classList.remove('running');
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
  fsStartBtn.disabled = false;
  fsPauseBtn.disabled = true;
  visualizerEl.classList.remove('running');
  updateSessionStatus();
}

function resetTimer() {
  clearInterval(state.timer.intervalId);
  state.timer.isRunning = false;
  state.timer.isPaused = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  fsStartBtn.disabled = false;
  fsPauseBtn.disabled = true;
  visualizerEl.classList.remove('running');

  const durations = {
    focus: state.settings.focusDuration,
    shortBreak: state.settings.shortBreak,
    longBreak: state.settings.longBreak
  };
  state.timer.timeLeft = durations[state.timer.phase];
  state.timer.totalTime = durations[state.timer.phase];
  updateTimerDisplay();
}

function switchPhase(phase) {
  clearInterval(state.timer.intervalId);
  state.timer.isRunning = false;
  state.timer.isPaused = false;
  state.timer.phase = phase;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  fsStartBtn.disabled = false;
  fsPauseBtn.disabled = true;
  visualizerEl.classList.remove('running');

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
    state.timer.completedPomodoros++;
    pomodoroCount.textContent = `Pomodoro #${state.timer.completedPomodoros}`;
    fsPomodoroCount.textContent = `Pomodoro #${state.timer.completedPomodoros}`;

    if (state.timer.selectedCategoryId) {
      saveSession(state.timer.selectedCategoryId, state.settings.focusDuration);
    }

    sendNotification('Pomodoro Complete!', 'Great job! Time for a break.');

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

  const noneChip = document.createElement('button');
  noneChip.className = `cat-chip${!state.timer.selectedCategoryId ? ' selected' : ''}`;
  noneChip.innerHTML = '<span>\u274c</span> None';
  noneChip.dataset.id = '';
  noneChip.addEventListener('click', () => selectTimerCategory(null));
  timerCategories.appendChild(noneChip);

  categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = `cat-chip${state.timer.selectedCategoryId === cat.id ? ' selected' : ''}`;
    chip.innerHTML = `<span class="cat-icon">${cat.icon || '\ud83d\udccc'}</span> ${cat.name}`;
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
  timerCategory.textContent = cat ? `${cat.icon || '\ud83d\udccc'} ${cat.name}` : 'Select a category';
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

    if (btn.dataset.view === 'categories') loadCategories();
    if (btn.dataset.view === 'statistics') loadStatistics();
  });
});

// === Dark Mode ===
darkModeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  darkModeToggle.textContent = isDark ? '\ud83c\udf19' : '\u2600\ufe0f';
  saveSettings({ darkMode: !isDark });
});

// === Visualizer Quick Toggle ===
vizToggleBtn.addEventListener('click', () => {
  const current = state.settings.visualizer || 'classic';
  const idx = VIZ_NAMES.indexOf(current);
  const next = VIZ_NAMES[(idx + 1) % VIZ_NAMES.length];
  state.settings.visualizer = next;
  applyVisualizer(next);
  document.querySelectorAll('.viz-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.viz === next);
  });
  saveSettings({ visualizer: next });
});

// === Fullscreen ===
let isFullscreen = false;

function enterFullscreen() {
  isFullscreen = true;
  fullscreenOverlay.classList.remove('hidden');
  fullscreenTimer.textContent = formatTime(state.timer.timeLeft);
  fullscreenPhase.textContent = timerPhase.textContent;
  fsPomodoroCount.textContent = pomodoroCount.textContent;
  updateSessionStatus();

  const timerColor = getTimerColor();
  fullscreenTimer.style.color = timerColor;
  fullscreenPhase.style.color = timerColor;

  fsStartBtn.disabled = startBtn.disabled;
  fsPauseBtn.disabled = pauseBtn.disabled;
}

function exitFullscreen() {
  isFullscreen = false;
  fullscreenOverlay.classList.add('hidden');
}

fullscreenBtn.addEventListener('click', enterFullscreen);
fsCloseBtn.addEventListener('click', exitFullscreen);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isFullscreen) exitFullscreen();
});

timerDisplayEl.addEventListener('click', enterFullscreen);

fsStartBtn.addEventListener('click', startTimer);
fsPauseBtn.addEventListener('click', pauseTimer);
fsResetBtn.addEventListener('click', resetTimer);

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

    if (settings.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      darkModeToggle.textContent = '\u2600\ufe0f';
    }

    const durations = {
      focus: state.settings.focusDuration,
      shortBreak: state.settings.shortBreak,
      longBreak: state.settings.longBreak
    };
    state.timer.timeLeft = durations[state.timer.phase];
    state.timer.totalTime = durations[state.timer.phase];

    const viz = state.settings.visualizer || 'classic';
    applyVisualizer(viz);

    document.querySelectorAll('.viz-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.viz === viz);
    });

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

    resetTimer();
    alert('Settings saved!');
  });

  document.querySelectorAll('.viz-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viz = btn.dataset.viz;
      document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.settings.visualizer = viz;
      applyVisualizer(viz);
      saveSettings({ visualizer: viz });
    });
  });
});

if ('Notification' in window) {
  Notification.requestPermission();
}

async function init() {
  await loadSettings();
  await loadCategories();
  updateTimerDisplay();
  pomodoroCount.textContent = 'Pomodoro #0';
  fsPomodoroCount.textContent = 'Pomodoro #0';
}

window.state = state;
window.renderTimerCategories = renderTimerCategories;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
