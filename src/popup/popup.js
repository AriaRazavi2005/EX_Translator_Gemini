// ============================================================================
// Gemini AI Translator - Popup logic
// ----------------------------------------------------------------------------
// Depends on GTShared (../shared/shared.js), which is loaded first by
// popup.html.
// ============================================================================
(function () {
  "use strict";

  const S = window.GTShared;
  if (!S) {
    document.body.innerHTML =
      '<p style="padding:16px;font-family:sans-serif">shared.js لود نشد.</p>';
    return;
  }

  const PLACEHOLDER_MARKERS = ["استریم می‌شود", "در حال ترجمه", "در حال اتصال", "در حال پردازش"];

  const el = (id) => document.getElementById(id);

  const dom = {};
  let settings = {};
  let activeAbortController = null;
  let historyCache = [];

  function isPlaceholder(text) {
    if (!text || !text.trim()) return true;
    return PLACEHOLDER_MARKERS.some((marker) => text.includes(marker));
  }

  function setStatus(message, isError) {
    dom.statusMsg.innerText = message || "";
    dom.statusMsg.classList.toggle("error-text", isError === true);
    if (message) {
      setTimeout(() => {
        if (dom.statusMsg.innerText === message) dom.statusMsg.innerText = "";
      }, 3000);
    }
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  function cacheDom() {
    [
      "mode-select", "source-text", "output-text", "source-lang", "target-lang",
      "tone-select", "tone-wrapper", "swap-langs-btn", "translate-submit-btn",
      "clear-text-btn", "copy-result-btn", "tts-result-btn", "stop-btn",
      "cache-badge", "char-count", "active-model-badge", "status-msg",
      "output-title", "tab-translate-btn", "tab-history-btn", "open-options-btn",
      "translate-view", "history-view", "history-list", "clear-history-btn",
      "history-search", "history-mode-filter", "history-count"
    ].forEach((id) => {
      const key = id.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      dom[key] = el(id);
    });
  }

  async function init() {
    cacheDom();

    settings = await S.getSettings();

    // Language and mode selects are generated from the shared metadata.
    dom.sourceLang.innerHTML = S.buildLangOptions(
      S.SOURCE_LANG_CODES,
      settings.defaultSourceLang || "auto"
    );
    dom.targetLang.innerHTML = S.buildLangOptions(
      S.TARGET_LANG_CODES,
      settings.defaultTargetLang || "fa"
    );
    dom.modeSelect.innerHTML = S.buildModeOptions(settings.defaultMode || "translate");

    S.MODE_ORDER.forEach((id) => {
      const mode = S.MODES[id];
      const option = document.createElement("option");
      option.value = id;
      option.textContent = mode.icon + " " + mode.label;
      dom.historyModeFilter.appendChild(option);
    });

    if (settings.defaultTone) dom.toneSelect.value = settings.defaultTone;
    dom.activeModelBadge.innerText = settings.selectedModel || S.DEFAULT_MODEL;

    applyModeUi();
    bindEvents();
    restoreSelectionFromPage();
    dom.sourceText.focus();
  }

  /** Pre-fills the textarea with the current selection in the active tab. */
  function restoreSelectionFromPage() {
    if (!chrome.tabs || !chrome.scripting) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return;

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => String(window.getSelection() || "").trim()
        },
        (results) => {
          if (chrome.runtime.lastError) return;
          const selected = results && results[0] && results[0].result;
          if (selected && !dom.sourceText.value) {
            dom.sourceText.value = selected;
            updateCharCount();
            maybeAutoDictionary(selected);
          }
        }
      );
    });
  }

  /** Switches to dictionary mode when the input is a single word. */
  function maybeAutoDictionary(text) {
    if (settings.autoDictionary === false) return;
    if (dom.modeSelect.value !== (settings.defaultMode || "translate")) return;
    if (!S.isSingleWord(text)) return;

    dom.modeSelect.value = "dictionary";
    applyModeUi();
  }

  /** Reflects the capabilities of the selected mode in the UI. */
  function applyModeUi() {
    const mode = S.getMode(dom.modeSelect.value);

    dom.targetLang.disabled = !mode.usesTarget;
    dom.sourceLang.disabled = !mode.usesTarget;
    dom.swapLangsBtn.disabled = !mode.usesTarget;
    dom.toneSelect.disabled = !mode.usesTone;

    dom.toneWrapper.classList.toggle("is-disabled", !mode.usesTone);
    dom.targetLang.classList.toggle("is-disabled", !mode.usesTarget);
    dom.sourceLang.classList.toggle("is-disabled", !mode.usesTarget);

    dom.outputTitle.innerText = mode.icon + " " + mode.label;
    dom.translateSubmitBtn.querySelector(".btn-label").innerText =
      mode.icon + " " + mode.label;
  }

  function bindEvents() {
    dom.translateSubmitBtn.addEventListener("click", () => runAction());
    dom.modeSelect.addEventListener("change", applyModeUi);

    dom.sourceText.addEventListener("input", updateCharCount);

    // Ctrl/Cmd + Enter submits from anywhere in the textarea.
    dom.sourceText.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runAction();
      }
    });

    // Esc closes the popup, or first aborts a running stream.
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (activeAbortController) {
        stopStreaming();
        return;
      }
      window.close();
    });

    dom.clearTextBtn.addEventListener("click", () => {
      dom.sourceText.value = "";
      dom.outputText.innerText = "نتیجه زنده اینجا استریم می‌شود...";
      dom.outputText.classList.add("placeholder-text");
      setCacheBadge(false);
      updateCharCount();
      dom.sourceText.focus();
    });

    dom.swapLangsBtn.addEventListener("click", () => {
      const source = dom.sourceLang.value;
      const target = dom.targetLang.value;
      if (source === "auto") {
        setStatus("برای جابجایی، زبان مبدأ را مشخص کنید.", true);
        return;
      }
      dom.sourceLang.value = target;
      dom.targetLang.value = source;
    });

    dom.copyResultBtn.addEventListener("click", copyResult);
    dom.ttsResultBtn.addEventListener("click", playSpeech);
    dom.stopBtn.addEventListener("click", stopStreaming);

    dom.openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

    dom.tabTranslateBtn.addEventListener("click", () => switchView("translate"));
    dom.tabHistoryBtn.addEventListener("click", () => switchView("history"));

    dom.clearHistoryBtn.addEventListener("click", async () => {
      await S.clearHistory();
      historyCache = [];
      renderHistory();
      setStatus("تاریخچه پاک شد.");
    });

    dom.historySearch.addEventListener("input", renderHistory);
    dom.historyModeFilter.addEventListener("change", renderHistory);
  }

  function updateCharCount() {
    dom.charCount.innerText = dom.sourceText.value.length;
  }

  function switchView(view) {
    const isHistory = view === "history";

    dom.translateView.style.display = isHistory ? "none" : "flex";
    dom.historyView.style.display = isHistory ? "flex" : "none";
    dom.tabTranslateBtn.classList.toggle("active", !isHistory);
    dom.tabHistoryBtn.classList.toggle("active", isHistory);

    if (isHistory) loadHistory();
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  async function loadHistory() {
    historyCache = await S.getHistory();
    renderHistory();
  }

  function renderHistory() {
    const filtered = S.searchHistory(historyCache, {
      query: dom.historySearch.value,
      mode: dom.historyModeFilter.value || undefined
    });

    dom.historyCount.innerText = historyCache.length
      ? filtered.length + " از " + historyCache.length + " مورد"
      : "";

    if (filtered.length === 0) {
      dom.historyList.innerHTML = historyCache.length
        ? '<div class="empty-history">موردی با این فیلتر پیدا نشد.</div>'
        : '<div class="empty-history">هنوز چیزی ثبت نشده است.</div>';
      return;
    }

    dom.historyList.innerHTML = "";

    filtered.forEach((item) => {
      const mode = S.getMode(item.mode);
      const row = document.createElement("div");
      row.className = "history-item";
      row.innerHTML = `
        <div class="history-src" dir="${S.detectTextDirection(item.source)}">${S.escapeHtml(S.truncate(item.source, 110))}</div>
        <div class="history-res" dir="${S.detectTextDirection(item.result)}">${S.escapeHtml(S.truncate(item.result, 110))}</div>
        <div class="history-footer-row">
          <span class="history-mode-badge">${S.escapeHtml(mode.icon + " " + mode.label)}</span>
          <span class="history-time">${S.escapeHtml(S.formatHistoryTime(item))}</span>
          <div class="history-actions">
            <button class="mini-copy-btn" title="کپی نتیجه">📋</button>
            <button class="mini-del-btn" title="حذف این مورد">🗑</button>
          </div>
        </div>
      `;

      row.querySelector(".mini-copy-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(item.result);
        setStatus("کپی شد.");
      });

      // Remove a single record instead of clearing everything.
      row.querySelector(".mini-del-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        await S.deleteHistoryItem(item.id);
        historyCache = historyCache.filter((h) => String(h.id) !== String(item.id));
        renderHistory();
      });

      // Clicking a row reloads it into the editor.
      row.addEventListener("click", () => {
        dom.sourceText.value = item.source;
        dom.outputText.innerText = item.result;
        dom.outputText.classList.remove("placeholder-text");
        S.applyTextDirection(dom.outputText, item.result);

        dom.modeSelect.value = item.mode || "translate";
        if (item.targetLang) dom.targetLang.value = item.targetLang;

        applyModeUi();
        updateCharCount();
        setCacheBadge(false);
        switchView("translate");
      });

      dom.historyList.appendChild(row);
    });
  }

  // ---------------------------------------------------------------------------
  // Output actions
  // ---------------------------------------------------------------------------

  function copyResult() {
    const text = dom.outputText.innerText;
    if (isPlaceholder(text)) return;

    navigator.clipboard.writeText(text).then(() => setStatus("در کلیپ‌بورد کپی شد."));
  }

  function playSpeech() {
    const text = dom.outputText.innerText;
    if (isPlaceholder(text)) return;

    const mode = S.getMode(dom.modeSelect.value);
    const langCode = mode.usesTarget
      ? dom.targetLang.value
      : (S.detectTextDirection(text) === "rtl" ? "fa" : "en");

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = S.getTtsLangTag(langCode);
    window.speechSynthesis.speak(utterance);
  }

  function setStreamingState(isStreaming) {
    dom.stopBtn.style.display = isStreaming ? "flex" : "none";
    dom.translateSubmitBtn.disabled = isStreaming;
    dom.translateSubmitBtn.classList.toggle("is-busy", isStreaming);
  }

  function setCacheBadge(visible) {
    dom.cacheBadge.style.display = visible ? "inline-block" : "none";
  }

  /** Aborts the stream, keeping any text already received. */
  function stopStreaming() {
    if (!activeAbortController) return;

    activeAbortController.abort();
    activeAbortController = null;
    setStreamingState(false);

    if (isPlaceholder(dom.outputText.innerText)) {
      dom.outputText.innerText = "درخواست متوقف شد.";
    }
    setStatus("درخواست متوقف شد.");
  }

  // ---------------------------------------------------------------------------
  // Running an AI action
  // ---------------------------------------------------------------------------

  async function runAction() {
    const text = dom.sourceText.value.trim();
    if (!text) {
      setStatus("متنی برای پردازش وارد نشده.", true);
      dom.sourceText.focus();
      return;
    }

    const mode = S.getMode(dom.modeSelect.value);
    const targetLang = dom.targetLang.value;
    const sourceLang = dom.sourceLang.value;
    const tone = dom.toneSelect.value;

    setCacheBadge(false);
    setStreamingState(true);

    dom.outputText.classList.remove("placeholder-text");
    dom.outputText.innerHTML =
      '<div class="popup-loading"><div class="popup-spinner"></div><span>در حال اتصال به Gemini...</span></div>';

    if (activeAbortController) activeAbortController.abort();
    activeAbortController = new AbortController();
    const controller = activeAbortController;

    try {
      const result = await S.runAction({
        text,
        mode: mode.id,
        targetLang,
        sourceLang,
        tone,
        settings,
        signal: controller.signal,
        onCacheHit: () => setCacheBadge(true),
        onChunk: (partial) => {
          if (controller.signal.aborted) return;
          dom.outputText.innerText = partial;
          S.applyTextDirection(dom.outputText, partial);
        }
      });

      if (controller.signal.aborted) return;
      setStreamingState(false);

      if (!result) {
        dom.outputText.innerText = "پاسخی دریافت نشد.";
        return;
      }

      dom.outputText.innerText = result;
      S.applyTextDirection(dom.outputText, result);

      await S.saveToHistory({
        source: text,
        result,
        sourceLang,
        targetLang,
        mode: mode.id
      });
    } catch (err) {
      if (err && err.name === "AbortError") return;

      setStreamingState(false);
      dom.outputText.innerHTML =
        '<span class="error-text">' + S.escapeHtml(err.message) + "</span>";

      if (err && err.code === "MISSING_API_KEY") {
        setStatus("کلید API تنطیم نشده است.", true);
      }
    } finally {
      if (activeAbortController === controller) activeAbortController = null;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
