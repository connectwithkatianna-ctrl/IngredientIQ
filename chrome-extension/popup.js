/**
 * IngredientIQ Popup Script
 */

const SUPPORTED_SITES = [
  'myfitnesspal.com',
  'app.macrosfirst.com',
  'cronometer.com',
  'loseit.com',
];

const SITE_NAMES = {
  'myfitnesspal.com':    'MyFitnessPal',
  'app.macrosfirst.com': 'MacrosFirst',
  'cronometer.com':      'Cronometer',
  'loseit.com':          'Lose It!',
};

let currentSettings = {
  enabled: true,
  apiKey: '',
  apiBaseUrl: 'http://localhost:8787/v1',
  warningStyle: 'modal',
  sensitivity: 'concern',
  allergenProfile: [],
  warningCount: 0,
};

// ── Load saved settings ─────────────────────────────────────────────────────

chrome.storage.sync.get([
  'enabled', 'apiKey', 'apiBaseUrl', 'warningStyle', 'sensitivity', 'allergenProfile', 'warningCount'
], (stored) => {
  Object.assign(currentSettings, stored);
  renderUI();
});

// ── Detect current tab site ─────────────────────────────────────────────────

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab || !tab.url) return;

  let url;
  try { url = new URL(tab.url); } catch (_) { return; }
  const host = url.hostname;

  const match = SUPPORTED_SITES.find(s => host.includes(s));
  const dot  = document.getElementById('site-dot');
  const text = document.getElementById('site-text');

  if (match) {
    dot.className = 'site-dot active';
    text.textContent = `Active on ${SITE_NAMES[match]}`;
  } else {
    dot.className = 'site-dot unsupported';
    text.textContent = 'Not a supported nutrition app';
  }
});

// ── Render UI from settings ─────────────────────────────────────────────────

function renderUI() {
  // Master toggle
  const toggle = document.getElementById('enable-toggle');
  const label  = document.getElementById('enable-label');
  toggle.className = 'toggle-bg' + (currentSettings.enabled ? ' on' : '');
  label.textContent = currentSettings.enabled ? 'On' : 'Off';

  // Warning style
  setPillActive('style', currentSettings.warningStyle);

  // Sensitivity
  setPillActive('sensitivity', currentSettings.sensitivity);

  // Allergens
  const allergens = currentSettings.allergenProfile || [];
  document.querySelectorAll('[data-allergen]').forEach(pill => {
    pill.classList.toggle('on', allergens.includes(pill.dataset.allergen));
  });

  // API base URL
  const baseUrlInput = document.getElementById('api-base-url-input');
  baseUrlInput.value = currentSettings.apiBaseUrl || 'http://localhost:8787/v1';

  // API key
  const keyInput = document.getElementById('api-key-input');
  if (currentSettings.apiKey) {
    keyInput.value = currentSettings.apiKey;
    updateApiStatus(true);
  }

  // Stats
  document.getElementById('stat-warnings').textContent =
    currentSettings.warningCount ?? 0;
}

// ── Toggle enabled ──────────────────────────────────────────────────────────

function toggleEnabled() {
  currentSettings.enabled = !currentSettings.enabled;
  const toggle = document.getElementById('enable-toggle');
  const label  = document.getElementById('enable-label');
  toggle.className = 'toggle-bg' + (currentSettings.enabled ? ' on' : '');
  label.textContent = currentSettings.enabled ? 'On' : 'Off';
}

// ── Pill selection helpers ──────────────────────────────────────────────────

function setPill(el, group) {
  setPillActive(group, el.dataset.value);
  if (group === 'style') currentSettings.warningStyle = el.dataset.value;
  if (group === 'sensitivity') currentSettings.sensitivity = el.dataset.value;
}

function setPillActive(group, value) {
  document.querySelectorAll(`[data-group="${group}"]`).forEach(p => {
    p.classList.toggle('on', p.dataset.value === value);
  });
}

// ── Allergen toggles ────────────────────────────────────────────────────────

function toggleAllergen(el) {
  const a = el.dataset.allergen;
  const profile = currentSettings.allergenProfile || [];
  if (profile.includes(a)) {
    currentSettings.allergenProfile = profile.filter(x => x !== a);
  } else {
    currentSettings.allergenProfile = [...profile, a];
  }
  el.classList.toggle('on', currentSettings.allergenProfile.includes(a));
}

// ── API key status ──────────────────────────────────────────────────────────

document.getElementById('api-key-input').addEventListener('input', (e) => {
  const key = e.target.value.trim();
  currentSettings.apiKey = key;
  updateApiStatus(key.startsWith('sk-ant-') && key.length > 20);
});

function updateApiStatus(hasKey) {
  const dot  = document.querySelector('.api-status-dot');
  const text = document.getElementById('api-status-text');
  if (hasKey) {
    dot.style.background = '#34c759';
    text.textContent = 'API key set — full ingredient lookup enabled';
  } else {
    dot.style.background = '#8e8e93';
    text.textContent = 'No API key — local DB only (107 ingredients)';
  }
}

// ── Save settings ───────────────────────────────────────────────────────────

function saveSettings() {
  const keyInput = document.getElementById('api-key-input');
  currentSettings.apiKey = keyInput.value.trim();

  const baseUrlInput = document.getElementById('api-base-url-input');
  currentSettings.apiBaseUrl = baseUrlInput.value.trim() || 'http://localhost:8787/v1';

  chrome.storage.sync.set({
    enabled:         currentSettings.enabled,
    apiKey:          currentSettings.apiKey,
    apiBaseUrl:      currentSettings.apiBaseUrl,
    warningStyle:    currentSettings.warningStyle,
    sensitivity:     currentSettings.sensitivity,
    allergenProfile: currentSettings.allergenProfile,
  }, () => {
    const msg = document.getElementById('saved-msg');
    msg.textContent = 'Settings saved';
    setTimeout(() => { msg.textContent = ''; }, 1800);
  });
}
