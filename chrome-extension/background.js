/**
 * IngredientIQ Background Service Worker
 * Handles extension lifecycle, badge updates, and message routing.
 */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // Set defaults on first install
    chrome.storage.sync.set({
      enabled:        true,
      apiKey:         '',
      warningStyle:   'modal',
      sensitivity:    'concern',
      allergenProfile: [],
      snoozeUntil:    0,
      warningCount:   0,
    });

    // Open onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html')
    });
  }
});

// Update extension badge to show warning count for the active tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'WARNING_SHOWN') {
    chrome.action.setBadgeText({
      text: msg.count > 0 ? String(msg.count) : '',
      tabId: sender.tab.id
    });
    chrome.action.setBadgeBackgroundColor({
      color: msg.color || '#E24B4A',
      tabId: sender.tab.id
    });

    // Increment total warning count in storage
    chrome.storage.sync.get('warningCount', ({ warningCount = 0 }) => {
      chrome.storage.sync.set({ warningCount: warningCount + 1 });
    });

    sendResponse({ ok: true });
  }

  if (msg.type === 'CLEAR_BADGE') {
    chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
    sendResponse({ ok: true });
  }

  return true; // keep channel open for async
});

// Clear badge when user navigates away
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
