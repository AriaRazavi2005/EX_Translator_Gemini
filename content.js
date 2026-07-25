// Content script for Gemini AI Translator
// Requires shared.js to be loaded first (see manifest content_scripts order).
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
          <span>ترجمه‌گر هوشمند Gemini</span>
        </div>
        <div class="gt-header-actions">
          <button id="gt-history-btn" class="gt-action-icon" title="تاریخچه اخیر">📜</button>
          <button id="gt-close-btn" class="gt-action-icon" title="بستن">&times;</button>
        </div>
      </div>

      <div id="gt-history-drawer" class="gt-drawer">
        <div class="gt-drawer-header">
          <span>📜 تاریخچه ترجمه‌های اخیر</span>
          <button id="gt-close-drawer-btn" class="gt-mini-close">&times;</button>
        </div>
        <div id="gt-history-drawer-list" class="gt-drawer-list"></div>
      </div>

      <div class="gt-body">
        <div class="gt-source-box">
          <div class="gt-box-title">متن اصلی:</div>
          <div class="gt-source-text" id="gt-source-content"></div>
        </div>

        <div class="gt-controls-bar">
          <div class="gt-control-item">
            <label>مقصد:</label>
            <select id="gt-target-lang">${S.buildLangOptions(S.TARGET_LANG_CODES)}</select>
          </div>
          <div class="gt-control-item">
            <label>لحن:</label>
            <select id="gt-tone-select">
              <option value="general">عمومی</option>
              <option value="formal">رسمی</option>
              <option value="informal">صمیمانه</option>
              <option value="technical">تخصصی</option>
            </select>
          </div>
          <button id="gt-retranslate-btn" class="gt-mini-btn" title="ترجمه مجدد">↻</button>
        </div>

        <div class="gt-result-box">
          <div class="gt-result-header">
            <span>ترجمه:</span>
            <div class="gt-result-actions">
              <button id="gt-tts-btn" class="gt-icon-btn" title="پخش صوتی">🔊</button>
              <button id="gt-copy-btn" class="gt-icon-btn" title="کپی متن">📋</button>
            </div>
          </div>
          <div class="gt-result-text" id="gt-result-content">
            <div class="gt-loading-spinner">
              <div class="gt-spinner"></div>
              <span>در حال ترجمه توسط Gemini...</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalWidget);

    document.getElementById("gt-close-btn").addEventListener("click", hideModalWidget);
    document.getElementById("gt-history-btn").addEventListener("click", toggleHistoryDrawer);
    document.getElementById("gt-close-drawer-btn").addEventListener("click", toggleHistoryDrawer);
    document.getElementById("gt-copy-btn").addEventListener("click", copyResult);
    document.getElementById("gt-tts-btn").addEventListener("click", playSpeech);

    document.getElementById("gt-retranslate-btn").addEventListener("click", () => {
      if (currentSelectedText) performTranslation(currentSelectedText);
    });

    // Re-translate automatically when the target language or tone changes.
    document.getElementById("gt-target-lang").addEventListener("change", () => {
      if (currentSelectedText) performTranslation(currentSelectedText);
    });
    document.getElementById("gt-tone-select").addEventListener("change", () => {
      if (currentSelectedText) performTranslation(currentSelectedText);
    });

    // Escape closes the widget.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalWidget && modalWidget.style.display === "block") {
        hideModalWidget();
      }
    });

    setupDragging();
  }

  function setupDragging() {
    const dragHandle = document.getElementById("gt-drag-handle");

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
    const drawer = document.getElementById("gt-history-drawer");
    historyDrawerOpen = !historyDrawerOpen;

    if (historyDrawerOpen) {
      drawer.style.display = "block";
      loadHistoryDrawer();
    } else {
      drawer.style.display = "none";
    }
  }

  async function loadHistoryDrawer() {
    const listElem = document.getElementById("gt-history-drawer-list");
    const history = await S.getHistory();

    if (history.length === 0) {
      listElem.innerHTML = '<div class="gt-empty-history">تاریخچه‌ای ثبت نشده است.</div>';
      return;
    }

    listElem.innerHTML = "";

    history.slice(0, 10).forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "gt-history-drawer-item";
      itemDiv.innerHTML = `
        <button class="gt-h-del" title="حذف این مورد">&times;</button>
        <div class="gt-h-src" dir="${S.detectTextDirection(item.source)}">${S.escapeHtml(S.truncate(item.source, 90))}</div>
        <div class="gt-h-res" dir="${S.detectTextDirection(item.result)}">${S.escapeHtml(S.truncate(item.result, 90))}</div>
      `;

      // Delete a single record without clearing the whole history.
      itemDiv.querySelector(".gt-h-del").addEventListener("click", async (e) => {
        e.stopPropagation();
        await S.deleteHistoryItem(item.id);
        loadHistoryDrawer();
      });

      itemDiv.addEventListener("click", () => {
        const srcElem = document.getElementById("gt-source-content");
        const resElem = document.getElementById("gt-result-content");

        currentSelectedText = item.source;
        srcElem.innerText = item.source;
        S.applyTextDirection(srcElem, item.source);
        resElem.innerText = item.result;
        S.applyTextDirection(resElem, item.result);

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

    const srcElem = document.getElementById("gt-source-content");
    srcElem.innerText = text;
    S.applyTextDirection(srcElem, text);

    const items = await S.getStorage(["defaultTargetLang", "defaultTone"]);
    if (items.defaultTargetLang) {
      document.getElementById("gt-target-lang").value = items.defaultTargetLang;
    }
    if (items.defaultTone) {
      document.getElementById("gt-tone-select").value = items.defaultTone;
    }

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

    performTranslation(text);
  }

  function hideModalWidget() {
    if (modalWidget) modalWidget.style.display = "none";

    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }

    window.speechSynthesis.cancel();

    historyDrawerOpen = false;
    const drawer = document.getElementById("gt-history-drawer");
    if (drawer) drawer.style.display = "none";
  }

  // ---------------------------------------------------------------------------
  // Result actions
  // ---------------------------------------------------------------------------

  function copyResult() {
    const resElem = document.getElementById("gt-result-content");
    const text = resElem.innerText;
    if (isPlaceholder(text)) return;

    navigator.clipboard.writeText(text).then(() => {
      const copyBtn = document.getElementById("gt-copy-btn");
      const orig = copyBtn.innerText;
      copyBtn.innerText = "✓";
      setTimeout(() => (copyBtn.innerText = orig), 1500);
    });
  }

  function playSpeech() {
    const resElem = document.getElementById("gt-result-content");
    const text = resElem.innerText;
    if (isPlaceholder(text)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = S.getTtsLangTag(document.getElementById("gt-target-lang").value);
    window.speechSynthesis.speak(utterance);
  }

  // ---------------------------------------------------------------------------
  // Translation
  // ---------------------------------------------------------------------------

  async function performTranslation(text) {
    const resElem = document.getElementById("gt-result-content");
    resElem.innerHTML = `
      <div class="gt-loading-spinner">
        <div class="gt-spinner"></div>
        <span>در حال پردازش و استریم ترجمه...</span>
      </div>
    `;

    if (activeAbortController) activeAbortController.abort();
    activeAbortController = new AbortController();
    const controller = activeAbortController;

    const targetLang = document.getElementById("gt-target-lang").value;
    const tone = document.getElementById("gt-tone-select").value;

    try {
      const result = await S.streamTranslation({
        text,
        targetLang,
        tone,
        signal: controller.signal,
        onChunk: (partial) => {
          if (controller.signal.aborted) return;
          resElem.innerText = partial;
          S.applyTextDirection(resElem, partial);
        }
      });

      if (controller.signal.aborted) return;

      if (!result) {
        resElem.innerText = "ترجمه‌ای دریافت نشد.";
        return;
      }

      resElem.innerText = result;
      S.applyTextDirection(resElem, result);
      S.saveToHistory({ source: text, result, targetLang });
    } catch (err) {
      if (err && err.name === "AbortError") return;

      if (err && err.code === "MISSING_API_KEY") {
        resElem.innerHTML = '<div class="gt-error">⚠️ ' + S.escapeHtml(err.message) + "</div>";
        return;
      }

      resElem.innerHTML = '<div class="gt-error">❌ ' + S.escapeHtml(err.message) + "</div>";
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
      const text = request.text || String(window.getSelection() || "").trim();
      if (text) {
        showModalWidget(text, window.innerWidth / 2 - 200, window.innerHeight / 4);
      }
    }
  });
})();
