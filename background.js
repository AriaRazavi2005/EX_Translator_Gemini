const DEFAULT_API_KEY = "";

chrome.runtime.onInstalled.addListener(async () => {
  // Create Context Menu Item
  chrome.contextMenus.create({
    id: "translate_gemini_selection",
    title: "ترجمه با هوش مصنوعی Gemini ✦",
    contexts: ["selection"]
  });

  // Initialize storage defaults if empty
  chrome.storage.local.get([
    "apiKey",
    "selectedModel",
    "defaultSourceLang",
    "defaultTargetLang",
    "defaultTone",
    "autoShowTooltip",
    "history"
  ], (result) => {
    let update = {};
    if (!result.apiKey) update.apiKey = DEFAULT_API_KEY;
    if (!result.selectedModel) update.selectedModel = "gemini-flash-latest";
    if (!result.defaultSourceLang) update.defaultSourceLang = "auto";
    if (!result.defaultTargetLang) update.defaultTargetLang = "fa";
    if (!result.defaultTone) update.defaultTone = "general";
    if (result.autoShowTooltip === undefined) update.autoShowTooltip = true;
    if (!result.history) update.history = [];

    if (Object.keys(update).length > 0) {
      chrome.storage.local.set(update, () => {
        console.log("Gemini Translator defaults initialized.");
      });
    }
  });
});

// Context Menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate_gemini_selection" && info.selectionText) {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: "TRANSLATE_SELECTION",
        text: info.selectionText.trim()
      }).catch(err => {
        console.warn("Could not send message to tab, injecting script...", err);
        // Script might not be loaded yet, inject and retry
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        }).then(() => {
          chrome.tabs.sendMessage(tab.id, {
            action: "TRANSLATE_SELECTION",
            text: info.selectionText.trim()
          });
        });
      });
    }
  }
});

// Listener for background requests from content scripts or popup if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_SETTINGS") {
    chrome.storage.local.get(null, (items) => {
      sendResponse(items);
    });
    return true; // Keep channel open for async response
  }
});
