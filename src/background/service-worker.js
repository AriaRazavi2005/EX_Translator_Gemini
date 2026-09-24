// ============================================================================
// Gemini AI Translator - Background service worker
// ----------------------------------------------------------------------------
// Owns the context menu, the global keyboard shortcut and the default settings
// seeding. Runs as a Manifest V3 service worker, so it must stay stateless
// between events.
// ============================================================================

const DEFAULT_API_KEY = "";
const CONTEXT_MENU_ID = "translate_gemini_selection";
const PAGE_MENU_ID = "translate_gemini_page";
const TRANSLATE_COMMAND = "translate-selection";
const TRANSLATE_PAGE_COMMAND = "translate-page";

/**
 * Files injected on demand when a tab was open before the extension was
 * installed or reloaded. Paths are relative to the extension root, and the
 * shared core MUST come first.
 */
const CONTENT_SCRIPT_FILES = [
  "src/shared/shared.js",
  "src/content/content.js"
];

const DEFAULT_SETTINGS = {
  apiKey: DEFAULT_API_KEY,
  selectedModel: "gemini-flash-latest",
  defaultSourceLang: "auto",
  defaultTargetLang: "fa",
  defaultTone: "general",
  defaultMode: "translate",
  autoShowTooltip: true,
  autoDictionary: true,
  enableCache: true,
  customProxyUrl: "",
  theme: "auto",
  maxOutputTokens: 3072,
  glossary: [],
  history: []
};

chrome.runtime.onInstalled.addListener(() => {
  // Context menu entries: current selection, and whole-page translation.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "ترجمه با هوش مصنوعی Gemini ✦",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: PAGE_MENU_ID,
      title: "ترجمه کل این صفحه با Gemini 🌐",
      contexts: ["page"]
    });
  });

  // Seed any missing default without overwriting existing user values.
  chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), (result) => {
    const update = {};

    Object.keys(DEFAULT_SETTINGS).forEach((key) => {
      if (result[key] === undefined) {
        update[key] = DEFAULT_SETTINGS[key];
      }
    });

    if (Object.keys(update).length > 0) {
      chrome.storage.local.set(update, () => {
        console.log("Gemini Translator defaults initialized:", Object.keys(update));
      });
    }
  });
});

/**
 * Sends a message to a tab's content script, injecting the scripts first when
 * the tab was open before the extension loaded.
 *
 * When `text` is omitted for a selection request, the content script falls
 * back to the live DOM selection, which is what the keyboard shortcut relies
 * on.
 */
async function sendToContent(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  } catch (err) {
    console.warn("Content script not reachable, injecting…", err && err.message);
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_SCRIPT_FILES
    });
    await chrome.tabs.sendMessage(tabId, message);
  } catch (injectErr) {
    console.error("Could not inject the Gemini Translator content script.", injectErr);
  }
}

function requestTranslation(tabId, text) {
  return sendToContent(tabId, { action: "TRANSLATE_SELECTION", text });
}

function requestPageTranslation(tabId) {
  return sendToContent(tabId, { action: "TRANSLATE_PAGE" });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === CONTEXT_MENU_ID) {
    if (!info.selectionText) return;
    requestTranslation(tab.id, info.selectionText.trim());
  } else if (info.menuItemId === PAGE_MENU_ID) {
    requestPageTranslation(tab.id);
  }
});

// Global keyboard shortcuts.
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    if (command === TRANSLATE_COMMAND) {
      // No text is passed: the content script reads the live selection itself.
      await requestTranslation(tab.id);
    } else if (command === TRANSLATE_PAGE_COMMAND) {
      await requestPageTranslation(tab.id);
    }
  } catch (err) {
    console.error("Could not handle a Gemini Translator command.", err);
  }
});

// Allow other extension pages to read settings or trigger a page translation.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === "GET_SETTINGS") {
    chrome.storage.local.get(null, (items) => sendResponse(items));
    return true; // Keep the channel open for the async response.
  }

  if (request && request.action === "TRANSLATE_ACTIVE_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (tab && tab.id) requestPageTranslation(tab.id);
    });
    return false;
  }

  return false;
});
