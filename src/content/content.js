// ============================================================================
// Gemini AI Translator - Content script
// ----------------------------------------------------------------------------
// Renders the floating trigger button and the draggable AI widget on any page.
// Requires src/shared/shared.js to be loaded first (see manifest
// content_scripts order and CONTENT_SCRIPT_FILES in the service worker).
// ============================================================================
(function () {
  if (window.hasGeminiTranslatorInjected) return;
  window.hasGeminiTranslatorInjected = true;

  const S = window.GTShared;
  if (!S) {
    console.error("[Gemini Translator] shared.js was not loaded; content script aborted.");
    return;
  }

  const LOADING_MARKERS = ["در حال ترجمه", "در حال پردازش", "در حال استریم"];

  let currentSelectedText = "";
  let floatingBtn = null;
  let modalWidget = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let activeAbortController = null;
  let historyDrawerOpen = false;

  function isPlaceholder(text) {
    if (!text || !text.trim()) return true;
    return LOADING_MARKERS.some((marker) => text.includes(marker));
  }

  function el(id) {
    return document.getElementById(id);
  }

  // ---------------------------------------------------------------------------
  // Floating trigger button
  // ---------------------------------------------------------------------------

  function createFloatingButton() {
    if (floatingBtn) return;
    floatingBtn = document.createElement("div");
    floatingBtn.id = "gt-floating-btn";
    floatingBtn.className = "gt-glass-btn";
    floatingBtn.innerHTML = '<span class="gt-sparkle">✦</span> <span>ترجمه</span>';
    document.body.appendChild(floatingBtn);

    floatingBtn.addEventListener("mousedown", (e) => e.stopPropagation());

    floatingBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideFloatingButton();
      if (currentSelectedText) {
        showModalWidget(currentSelectedText, e.clientX, e.clientY);
      }
    });
  }

  function hideFloatingButton() {
    if (floatingBtn) floatingBtn.style.display = "none";
  }

  function showFloatingButton(x, y) {
    createFloatingButton();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let posX = x + scrollX + 10;
    let posY = y + scrollY - 35;
    if (posY < scrollY + 10) posY = y + scrollY + 20;

    floatingBtn.style.left = posX + "px";
    floatingBtn.style.top = posY + "px";
    floatingBtn.style.display = "flex";
  }

  // ---------------------------------------------------------------------------
  // Modal widget
  // ---------------------------------------------------------------------------

  function createModalWidget() {
    if (modalWidget) return;
    modalWidget = document.createElement("div");
    modalWidget.id = "gt-modal-widget";
    modalWidget.className = "gt-glass-panel";

    modalWidget.innerHTML = `
      <div class="gt-header" id="gt-drag-handle">
        <div class="gt-title">
          <span class="gt-icon">✦</span>
          <span>دستیار هوشمند Gemini</span>
        </div>
        <div class="gt-header-actions">
          <button id="gt-history-btn" class="gt-action-icon" title="تاریخچه اخیر">📜</button>
          <button id="gt-close-btn" class="gt-action-icon" title="بستن (Esc)">&times;</button>
        </div>
      </div>

      <div id="gt-history-drawer" class="gt-drawer">
        <div class="gt-drawer-header">
          <span>📜 تاریخچه اخیر</span>
          <button id="gt-close-drawer-btn" class="gt-mini-close">&times;</button>
        </div>
        <div id="gt-history-drawer-list" class="gt-drawer-list"></div>
      </div>

      <div class="gt-body">
        <div class="gt-source-box">
          <div class="gt-box-title">متن اصلی:</div>
          <div class="gt-source-text" id="gt-source-content"></div>
        </div>

        <div class="gt-mode-row">
          <label for="gt-mode-select">عملکرد:</label>
          <select id="gt-mode-select">${S.buildModeOptions("translate")}</select>
        </div>

        <div class="gt-controls-bar">
          <div class="gt-control-item" id="gt-target-wrap">
            <label>مقصد:</label>
            <select id="gt-target-lang">${S.buildLangOptions(S.TARGET_LANG_CODES)}</select>
          </div>
          <div class="gt-control-item" id="gt-tone-wrap">
            <label>لحن:</label>
            <select id="gt-tone-select">
              <option value="general">عمومی</option>
              <option value="formal">رسمی</option>
              <option value="informal">صمیمانه</option>
              <option value="technical">تخصصی</option>
            </select>
          </div>
          <button id="gt-retranslate-btn" class="gt-mini-btn" title="اجرای مجدد (بی‌توجه به حافطه)">↻</button>
        </div>

        <div class="gt-result-box">
          <div class="gt-result-header">
            <span id="gt-result-title">نتیجه:</span>
            <span id="gt-cache-badge" class="gt-cache-badge" title="این نتیجه از حافطه محلی خوانده شد و سهمیه‌ای مصرف نکرد">⚡ از حافطه</span>
            <div class="gt-result-actions">
              <button id="gt-stop-btn" class="gt-icon-btn gt-stop-btn" title="توقف">■</button>
              <button id="gt-tts-btn" class="gt-icon-btn" title="پخش صوتی">🔊</button>
              <button id="gt-copy-btn" class="gt-icon-btn" title="کپی متن">📋</button>
            </div>
          </div>
          <div class="gt-result-text" id="gt-result-content">
            <div class="gt-loading-spinner">
              <div class="gt-spinner"></div>
              <span>در حال پردازش توسط Gemini...</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalWidget);

    el("gt-close-btn").addEventListener("click", hideModalWidget);
    el("gt-history-btn").addEventListener("click", toggleHistoryDrawer);
    el("gt-close-drawer-btn").addEventListener("click", toggleHistoryDrawer);
    el("gt-copy-btn").addEventListener("click", copyResult);
    el("gt-tts-btn").addEventListener("click", playSpeech);
    el("gt-stop-btn").addEventListener("click", stopStreaming);

    // The refresh button deliberately bypasses the cache.
    el("gt-retranslate-btn").addEventListener("click", () => {
      if (currentSelectedText) performAction(currentSelectedText, { forceRefresh: true });
    });

    // Changing the mode re-runs the request with the new prompt.
    el("gt-mode-select").addEventListener("change", () => {
      applyModeUi();
      if (currentSelectedText) performAction(currentSelectedText);
    });

    // Re-run automatically when the target language or tone changes.
    el("gt-target-lang").addEventListener("change", () => {
      if (currentSelectedText) performAction(currentSelectedText);
    });
    el("gt-tone-select").addEventListener("change", () => {
      if (currentSelectedText) performAction(currentSelectedText);
    });

    // Escape closes the widget.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalWidget && modalWidget.style.display === "block") {
        hideModalWidget();
      }
    });

    setupDragging();
  }

  /** Enables or disables controls that the active mode does not use. */
  function applyModeUi() {
    const mode = S.getMode(el("gt-mode-select").value);

    const targetWrap = el("gt-target-wrap");
    const toneWrap = el("gt-tone-wrap");

    el("gt-target-lang").disabled = !mode.usesTarget;
    el("gt-tone-select").disabled = !mode.usesTone;
    targetWrap.classList.toggle("gt-disabled", !mode.usesTarget);
    toneWrap.classList.toggle("gt-disabled", !mode.usesTone);

    el("gt-result-title").innerText = mode.icon + " " + mode.label + ":";
  }

  function setupDragging() {
    const dragHandle = el("gt-drag-handle");

    dragHandle.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.tagName === "SELECT") return;
      isDragging = true;
      const rect = modalWidget.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging || !modalWidget) return;
      let left = e.clientX - dragOffsetX;
      let top = e.clientY - dragOffsetY;

      left = Math.max(10, Math.min(window.innerWidth - modalWidget.offsetWidth - 10, left));
      top = Math.max(10, Math.min(window.innerHeight - modalWidget.offsetHeight - 10, top));

      modalWidget.style.left = left + "px";
      modalWidget.style.top = top + "px";
      modalWidget.style.position = "fixed";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  // ---------------------------------------------------------------------------
  // History drawer
  // ---------------------------------------------------------------------------

  function toggleHistoryDrawer() {
    const drawer = el("gt-history-drawer");
    historyDrawerOpen = !historyDrawerOpen;

    if (historyDrawerOpen) {
      drawer.style.display = "block";
      loadHistoryDrawer();
    } else {
      drawer.style.display = "none";
    }
  }

  async function loadHistoryDrawer() {
    const listElem = el("gt-history-drawer-list");
    const history = await S.getHistory();

    if (history.length === 0) {
      listElem.innerHTML = '<div class="gt-empty-history">تاریخچه‌ای ثبت نشده است.</div>';
      return;
    }

    listElem.innerHTML = "";

    history.slice(0, 10).forEach((item) => {
      const mode = S.getMode(item.mode);
      const itemDiv = document.createElement("div");
      itemDiv.className = "gt-history-drawer-item";
      itemDiv.innerHTML = `
        <button class="gt-h-del" title="حذف این مورد">&times;</button>
        <div class="gt-h-src" dir="${S.detectTextDirection(item.source)}">${S.escapeHtml(S.truncate(item.source, 90))}</div>
        <div class="gt-h-res" dir="${S.detectTextDirection(item.result)}">${S.escapeHtml(S.truncate(item.result, 90))}</div>
        <div class="gt-h-meta">${S.escapeHtml(mode.icon + " " + mode.label)}</div>
      `;

      // Delete a single record without clearing the whole history.
      itemDiv.querySelector(".gt-h-del").addEventListener("click", async (e) => {
        e.stopPropagation();
        await S.deleteHistoryItem(item.id);
        loadHistoryDrawer();
      });

      itemDiv.addEventListener("click", () => {
        const srcElem = el("gt-source-content");
        const resElem = el("gt-result-content");

        currentSelectedText = item.source;
        srcElem.innerText = item.source;
        S.applyTextDirection(srcElem, item.source);
        resElem.innerText = item.result;
        S.applyTextDirection(resElem, item.result);

        el("gt-mode-select").value = item.mode || "translate";
        applyModeUi();
        toggleHistoryDrawer();
      });

      listElem.appendChild(itemDiv);
    });
  }

  // ---------------------------------------------------------------------------
  // Show / hide
  // ---------------------------------------------------------------------------

  async function showModalWidget(text, clickX, clickY) {
    createModalWidget();
    currentSelectedText = text;

    const srcElem = el("gt-source-content");
    srcElem.innerText = text;
    S.applyTextDirection(srcElem, text);

    const items = await S.getStorage([
      "defaultTargetLang",
      "defaultTone",
      "defaultMode",
      "autoDictionary"
    ]);

    if (items.defaultTargetLang) el("gt-target-lang").value = items.defaultTargetLang;
    if (items.defaultTone) el("gt-tone-select").value = items.defaultTone;

    // A single selected word is almost always a vocabulary lookup.
    let mode = items.defaultMode || "translate";
    if (items.autoDictionary !== false && S.isSingleWord(text)) {
      mode = "dictionary";
    }
    el("gt-mode-select").value = mode;
    applyModeUi();

    const width = 410;
    let left = clickX || window.innerWidth / 2 - width / 2;
    let top = clickY || window.innerHeight / 3;

    if (left + width > window.innerWidth - 20) left = window.innerWidth - width - 20;
    if (left < 20) left = 20;
    if (top < 20) top = 20;

    modalWidget.style.position = "fixed";
    modalWidget.style.left = left + "px";
    modalWidget.style.top = top + "px";
    modalWidget.style.display = "block";

    performAction(text);
  }

  function hideModalWidget() {
    if (modalWidget) modalWidget.style.display = "none";

    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }

    window.speechSynthesis.cancel();

    historyDrawerOpen = false;
    const drawer = el("gt-history-drawer");
    if (drawer) drawer.style.display = "none";
  }

  // ---------------------------------------------------------------------------
  // Result actions
  // ---------------------------------------------------------------------------

  function copyResult() {
    const resElem = el("gt-result-content");
    const text = resElem.innerText;
    if (isPlaceholder(text)) return;

    navigator.clipboard.writeText(text).then(() => {
      const copyBtn = el("gt-copy-btn");
      const orig = copyBtn.innerText;
      copyBtn.innerText = "✓";
      setTimeout(() => (copyBtn.innerText = orig), 1500);
    });
  }

  function playSpeech() {
    const resElem = el("gt-result-content");
    const text = resElem.innerText;
    if (isPlaceholder(text)) return;

    const mode = S.getMode(el("gt-mode-select").value);

    // Modes that keep the original language have no meaningful target select,
    // so the voice is picked from the produced text instead.
    const langCode = mode.usesTarget
      ? el("gt-target-lang").value
      : (S.detectTextDirection(text) === "rtl" ? "fa" : "en");

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = S.getTtsLangTag(langCode);
    window.speechSynthesis.speak(utterance);
  }

  /** Aborts the running stream but keeps whatever was already rendered. */
  function stopStreaming() {
    if (!activeAbortController) return;
    activeAbortController.abort();
    activeAbortController = null;
    setStreamingState(false);

    const resElem = el("gt-result-content");
    if (isPlaceholder(resElem.innerText)) {
      resElem.innerText = "درخواست متوقف شد.";
    }
  }

  function setStreamingState(isStreaming) {
    const stopBtn = el("gt-stop-btn");
    if (stopBtn) stopBtn.style.display = isStreaming ? "flex" : "none";
  }

  function setCacheBadge(visible) {
    const badge = el("gt-cache-badge");
    if (badge) badge.style.display = visible ? "inline-block" : "none";
  }

  // ---------------------------------------------------------------------------
  // Running an AI action
  // ---------------------------------------------------------------------------

  async function performAction(text, options) {
    const opts = options || {};
    const resElem = el("gt-result-content");
    const mode = S.getMode(el("gt-mode-select").value);

    setCacheBadge(false);
    setStreamingState(true);

    resElem.innerHTML = `
      <div class="gt-loading-spinner">
        <div class="gt-spinner"></div>
        <span>در حال پردازش و استریم پاسخ...</span>
      </div>
    `;

    if (activeAbortController) activeAbortController.abort();
    activeAbortController = new AbortController();
    const controller = activeAbortController;

    const targetLang = el("gt-target-lang").value;
    const tone = el("gt-tone-select").value;

    try {
      const result = await S.runAction({
        text,
        mode: mode.id,
        targetLang,
        tone,
        forceRefresh: opts.forceRefresh === true,
        signal: controller.signal,
        onCacheHit: () => setCacheBadge(true),
        onChunk: (partial) => {
          if (controller.signal.aborted) return;
          resElem.innerText = partial;
          S.applyTextDirection(resElem, partial);
        }
      });

      if (controller.signal.aborted) return;
      setStreamingState(false);

      if (!result) {
        resElem.innerText = "پاسخی دریافت نشد.";
        return;
      }

      resElem.innerText = result;
      S.applyTextDirection(resElem, result);

      S.saveToHistory({ source: text, result, targetLang, mode: mode.id });
    } catch (err) {
      if (err && err.name === "AbortError") return;
      setStreamingState(false);

      const icon = err && err.code === "MISSING_API_KEY" ? "⚠️" : "❌";
      resElem.innerHTML =
        '<div class="gt-error">' + icon + " " + S.escapeHtml(err.message) + "</div>";
    } finally {
      if (activeAbortController === controller) activeAbortController = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Page events
  // ---------------------------------------------------------------------------

  document.addEventListener("mouseup", (e) => {
    if ((modalWidget && modalWidget.contains(e.target)) ||
        (floatingBtn && floatingBtn.contains(e.target))) {
      return;
    }

    setTimeout(() => {
      const text = String(window.getSelection() || "").trim();

      if (text && text.length > 1) {
        currentSelectedText = text;
        chrome.storage.local.get(["autoShowTooltip"], (items) => {
          if (items.autoShowTooltip !== false) {
            showFloatingButton(e.clientX, e.clientY);
          }
        });
      } else {
        hideFloatingButton();
      }
    }, 10);
  });

  document.addEventListener("mousedown", (e) => {
    if (modalWidget && !modalWidget.contains(e.target) &&
        floatingBtn && !floatingBtn.contains(e.target)) {
      hideFloatingButton();
    }
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request && request.action === "TRANSLATE_SELECTION") {
      hideFloatingButton();

      // The keyboard shortcut sends no text, so fall back to the live selection.
      const text = request.text || String(window.getSelection() || "").trim();
      if (text) {
        showModalWidget(text, window.innerWidth / 2 - 200, window.innerHeight / 4);
      }
    }
  });
})();
