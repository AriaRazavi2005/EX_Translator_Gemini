// Service worker for Gemini AI Translator

const DEFAULT_API_KEY = "";
const CONTEXT_MENU_ID = "translate_gemini_selection";
const CONTENT_SCRIPT_FILES = ["shared.js", "content.js"];

const DEFAULT_SETTINGS = {
  apiKey: DEFAULT_API_KEY,
  selectedModel: "gemini-flash-latest",
  defaultSourceLang: "auto",
  defaultTargetLang: "fa",
  defaultTone: "general",
  autoShowTooltip: true,
  customProxyUrl: "",
  history: []
};

chrome.runtime.onInstalled.addListener(() => {
  // Context menu entry for the current text selection.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "ترجمه با هوش مصنوعی Gemini ✦",
      contexts: ["selection"]
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

/** Sends the translate command, injecting the content scripts when needed. */
async function requestTranslation(tabId, text) {
  const message = { action: "TRANSLATE_SELECTION", text };

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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  if (!info.selectionText || !tab || !tab.id) return;

  requestTranslation(tab.id, info.selectionText.trim());
});

// Allow other extension pages to read the full settings object.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === "GET_SETTINGS") {
    chrome.storage.local.get(null, (items) => sendResponse(items));
    return true; // Keep the channel open for the async response.
  }
  return false;
});
