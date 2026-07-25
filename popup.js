// Popup controller for Gemini AI Translator
// Requires shared.js to be loaded first (see popup.html).
document.addEventListener("DOMContentLoaded", () => {
  const S = window.GTShared;
  if (!S) {
    console.error("[Gemini Translator] shared.js was not loaded; popup aborted.");
    return;
  }

  const sourceText = document.getElementById("source-text");
  const outputText = document.getElementById("output-text");
  const sourceLang = document.getElementById("source-lang");
  const targetLang = document.getElementById("target-lang");
  const toneSelect = document.getElementById("tone-select");
  const swapLangsBtn = document.getElementById("swap-langs-btn");
  const translateSubmitBtn = document.getElementById("translate-submit-btn");
  const clearTextBtn = document.getElementById("clear-text-btn");
  const copyResultBtn = document.getElementById("copy-result-btn");
  const ttsResultBtn = document.getElementById("tts-result-btn");
  const charCount = document.getElementById("char-count");
  const activeModelBadge = document.getElementById("active-model-badge");
  const statusMsg = document.getElementById("status-msg");

  const tabTranslateBtn = document.getElementById("tab-translate-btn");
  const tabHistoryBtn = document.getElementById("tab-history-btn");
  const openOptionsBtn = document.getElementById("open-options-btn");
  const translateView = document.getElementById("translate-view");
  const historyView = document.getElementById("history-view");
  const historyList = document.getElementById("history-list");
  const clearHistoryBtn = document.getElementById("clear-history-btn");

  const PLACEHOLDER_MARKERS = ["استریم می‌شود", "در حال ترجمه", "در حال اتصال"];
  const PLACEHOLDER_HTML =
    '<div class="placeholder-text">ترجمه در این قسمت به صورت زنده استریم می‌شود...</div>';

  let activeAbortController = null;

  function isPlaceholder(text) {
    if (!text || !text.trim()) return true;
    return PLACEHOLDER_MARKERS.some((marker) => text.includes(marker));
  }

  function setStatus(text, resetAfter) {
    statusMsg.innerText = text;
    if (resetAfter) {
      setTimeout(() => (statusMsg.innerText = "آماده"), resetAfter);
    }
  }

  // ---------------------------------------------------------------------------
  // Initial settings
  // ---------------------------------------------------------------------------

  S.getSettings().then((settings) => {
    if (settings.defaultSourceLang) sourceLang.value = settings.defaultSourceLang;
    if (settings.defaultTargetLang) targetLang.value = settings.defaultTargetLang;
    if (settings.defaultTone) toneSelect.value = settings.defaultTone;

    activeModelBadge.innerText = "مدل: " + (settings.selectedModel || S.DEFAULT_MODEL);
  });

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------

  tabTranslateBtn.addEventListener("click", () => {
    tabTranslateBtn.classList.add("active");
    tabHistoryBtn.classList.remove("active");
    translateView.classList.add("active");
    historyView.classList.remove("active");
  });

  tabHistoryBtn.addEventListener("click", () => {
    tabHistoryBtn.classList.add("active");
    tabTranslateBtn.classList.remove("active");
    historyView.classList.add("active");
    translateView.classList.remove("active");
    loadHistory();
  });

  openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

  // ---------------------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------------------

  sourceText.addEventListener("input", () => {
    const val = sourceText.value;
    charCount.innerText = val.length + " کاراکتر";
    clearTextBtn.style.display = val.length > 0 ? "block" : "none";
    S.applyTextDirection(sourceText, val);
  });

  // Ctrl+Enter (or Cmd+Enter on macOS) starts the translation.
  sourceText.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      translateSubmitBtn.click();
    }
  });

  clearTextBtn.addEventListener("click", () => {
    sourceText.value = "";
    charCount.innerText = "0 کاراکتر";
    clearTextBtn.style.display = "none";
    outputText.innerHTML = PLACEHOLDER_HTML;
    S.applyTextDirection(sourceText, "");
    sourceText.focus();
  });

  swapLangsBtn.addEventListener("click", () => {
    const srcVal = sourceLang.value;
    const tgtVal = targetLang.value;

    if (srcVal === "auto") {
      setStatus("برای جابه‌جایی، زبان مبدأ را از حالت خودکار خارج کنید", 2000);
      return;
    }

    sourceLang.value = tgtVal;
    targetLang.value = srcVal;
  });

  copyResultBtn.addEventListener("click", () => {
    const text = outputText.innerText;
    if (isPlaceholder(text)) return;

    navigator.clipboard.writeText(text).then(() => {
      const orig = copyResultBtn.innerText;
      copyResultBtn.innerText = "✓";
      setStatus("متن کپی شد!");
      setTimeout(() => {
        copyResultBtn.innerText = orig;
        statusMsg.innerText = "آماده";
      }, 1500);
    });
  });

  ttsResultBtn.addEventListener("click", () => {
    const text = outputText.innerText;
    if (isPlaceholder(text)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = S.getTtsLangTag(targetLang.value);
    utterance.onend = () => (statusMsg.innerText = "آماده");

    window.speechSynthesis.speak(utterance);
    setStatus("در حال پخش صوتی...");
  });

  translateSubmitBtn.addEventListener("click", () => {
    const text = sourceText.value.trim();
    if (!text) {
      setStatus("لطفاً ابتدا متنی وارد کنید", 2000);
      return;
    }
    performTranslation(text);
  });

  // ---------------------------------------------------------------------------
  // Translation
  // ---------------------------------------------------------------------------

  async function performTranslation(text) {
    setStatus("در حال اتصال به Gemini...");
    outputText.innerHTML = `
      <div class="popup-loading">
        <div class="popup-spinner"></div>
        <span>در حال ترجمه هوشمند...</span>
      </div>
    `;

    if (activeAbortController) activeAbortController.abort();
    activeAbortController = new AbortController();
    const controller = activeAbortController;

    const tgtL = targetLang.value;

    try {
      const result = await S.streamTranslation({
        text,
        targetLang: tgtL,
        sourceLang: sourceLang.value,
        tone: toneSelect.value,
        signal: controller.signal,
        onChunk: (partial) => {
          if (controller.signal.aborted) return;
          outputText.innerText = partial;
          S.applyTextDirection(outputText, partial);
          statusMsg.innerText = "در حال استریم پاسخ...";
        }
      });

      if (controller.signal.aborted) return;

      if (!result) {
        outputText.innerText = "پاسخی از مدل دریافت نشد.";
        setStatus("بدون نتیجه", 2000);
        return;
      }

      outputText.innerText = result;
      S.applyTextDirection(outputText, result);
      setStatus("ترجمه تکمیل شد ✓");

      await S.saveToHistory({
        source: text,
        result,
        sourceLang: sourceLang.value,
        targetLang: tgtL
      });
    } catch (err) {
      if (err && err.name === "AbortError") return;

      if (err && err.code === "MISSING_API_KEY") {
        outputText.innerHTML =
          '<div class="error-text">⚠️ ' + S.escapeHtml(err.message) + "</div>";
        setStatus("خطای کلید API");
        return;
      }

      outputText.innerHTML = '<div class="error-text">❌ ' + S.escapeHtml(err.message) + "</div>";
      setStatus("خطا در ترجمه");
    }
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  async function loadHistory() {
    const history = await S.getHistory();

    if (history.length === 0) {
      historyList.innerHTML =
        '<div class="empty-history">هیچ ترجمه‌ای در تاریخچه ثبت نشده است.</div>';
      return;
    }

    historyList.innerHTML = "";

    history.forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `
        <div class="history-src" dir="${S.detectTextDirection(item.source)}">متن: ${S.escapeHtml(S.truncate(item.source, 160))}</div>
        <div class="history-res" dir="${S.detectTextDirection(item.result)}">ترجمه: ${S.escapeHtml(S.truncate(item.result, 160))}</div>
        <div class="history-footer">
          <span class="history-time">${S.escapeHtml(S.formatHistoryTime(item))} · ${S.escapeHtml(S.LANG_LABELS[item.targetLang] || item.targetLang)}</span>
          <div class="history-actions">
            <button class="mini-copy-btn" title="کپی ترجمه">📋 کپی</button>
            <button class="mini-del-btn" title="حذف این مورد">🗑</button>
          </div>
        </div>
      `;

      div.querySelector(".mini-copy-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(item.result).then(() => {
          setStatus("ترجمه کپی شد ✓", 1500);
        });
      });

      // Delete a single record instead of wiping the whole history.
      div.querySelector(".mini-del-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        await S.deleteHistoryItem(item.id);
        setStatus("مورد حذف شد ✓", 1500);
        loadHistory();
      });

      div.addEventListener("click", () => {
        sourceText.value = item.source;
        S.applyTextDirection(sourceText, item.source);
        outputText.innerText = item.result;
        S.applyTextDirection(outputText, item.result);
        charCount.innerText = item.source.length + " کاراکتر";
        clearTextBtn.style.display = "block";
        if (item.targetLang) targetLang.value = item.targetLang;
        tabTranslateBtn.click();
      });

      historyList.appendChild(div);
    });
  }

  clearHistoryBtn.addEventListener("click", async () => {
    if (!confirm("آیا از پاک کردن تمام تاریخچه اطمینان دارید؟")) return;
    await S.clearHistory();
    loadHistory();
  });
});
