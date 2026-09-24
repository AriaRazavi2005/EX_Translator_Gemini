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
    floatingBtn.setAttribute("role", "button");
    floatingBtn.setAttribute("tabindex", "0");
    floatingBtn.setAttribute("aria-label", "ترجمه متن انتخاب‌شده");
    floatingBtn.innerHTML = '<span class="gt-sparkle">✦</span> <span>ترجمه</span>';
    document.body.appendChild(floatingBtn);

    floatingBtn.addEventListener("mousedown", (e) => e.stopPropagation());

    floatingBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        floatingBtn.click();
      }
    });

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
    modalWidget.setAttribute("role", "dialog");
    modalWidget.setAttribute("aria-label", "دستیار هوشمند Gemini");
    modalWidget.tabIndex = -1;

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

        <div class="gt-lang-row" id="gt-lang-row">
          <select id="gt-source-lang" aria-label="زبان مبدأ">${S.buildLangOptions(S.SOURCE_LANG_CODES, "auto")}</select>
          <button id="gt-swap-btn" class="gt-swap-btn" title="جابه‌جایی زبان‌ها" aria-label="جابه‌جایی زبان‌ها">⇄</button>
          <select id="gt-target-lang" aria-label="زبان مقصد">${S.buildLangOptions(S.TARGET_LANG_CODES)}</select>
        </div>

        <div class="gt-controls-bar">
          <div class="gt-control-item" id="gt-tone-wrap">
            <label>لحن:</label>
            <select id="gt-tone-select">
              <option value="general">عمومی</option>
              <option value="formal">رسمی</option>
              <option value="informal">صمیمانه</option>
              <option value="technical">تخصصی</option>
            </select>
          </div>
          <button id="gt-retranslate-btn" class="gt-mini-btn" title="اجرای مجدد (بی‌توجه به حافظه)">↻</button>
        </div>

        <div class="gt-result-box">
          <div class="gt-result-header">
            <span id="gt-result-title">نتیجه:</span>
            <span id="gt-cache-badge" class="gt-cache-badge" title="این نتیجه از حافظه محلی خوانده شد و سهمیه‌ای مصرف نکرد">⚡ از حافظه</span>
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
    el("gt-source-lang").addEventListener("change", () => {
      if (currentSelectedText) performAction(currentSelectedText);
    });
    el("gt-swap-btn").addEventListener("click", swapLangs);

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

    const langRow = el("gt-lang-row");
    const toneWrap = el("gt-tone-wrap");

    el("gt-target-lang").disabled = !mode.usesTarget;
    el("gt-source-lang").disabled = !mode.usesTarget;
    el("gt-swap-btn").disabled = !mode.usesTarget;
    el("gt-tone-select").disabled = !mode.usesTone;

    langRow.classList.toggle("gt-disabled", !mode.usesTarget);
    toneWrap.classList.toggle("gt-disabled", !mode.usesTone);

    el("gt-result-title").innerText = mode.icon + " " + mode.label + ":";
  }

  /** Swaps source and target languages, then re-runs. */
  function swapLangs() {
    const src = el("gt-source-lang");
    const tgt = el("gt-target-lang");
    if (!src || !tgt || src.value === "auto") return;

    const previous = src.value;
    src.value = tgt.value;
    tgt.value = previous;
    if (currentSelectedText) performAction(currentSelectedText);
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
        renderResult(resElem, item.result);

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
      "defaultSourceLang",
      "defaultTone",
      "defaultMode",
      "autoDictionary",
      "theme"
    ]);

    S.applyTheme(modalWidget, items.theme || "auto");
    if (floatingBtn) S.applyTheme(floatingBtn, items.theme || "auto");

    if (items.defaultTargetLang) el("gt-target-lang").value = items.defaultTargetLang;
    if (items.defaultSourceLang) el("gt-source-lang").value = items.defaultSourceLang;
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
    try { modalWidget.focus({ preventScroll: true }); } catch (e) { /* older engines */ }

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

  /** Renders a finished result as structured, bidi-aware rich text. */
  function renderResult(elem, text) {
    if (!elem) return;
    elem.classList.add("gt-rich");
    elem.innerHTML = S.renderRichText(text);
  }

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
    const sourceLang = el("gt-source-lang").value;
    const tone = el("gt-tone-select").value;

    try {
      const result = await S.runAction({
        text,
        mode: mode.id,
        targetLang,
        sourceLang,
        tone,
        forceRefresh: opts.forceRefresh === true,
        signal: controller.signal,
        onCacheHit: () => setCacheBadge(true),
        onChunk: (partial) => {
          if (controller.signal.aborted) return;
          resElem.classList.remove("gt-rich");
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

      renderResult(resElem, result);

      S.saveToHistory({ source: text, result, sourceLang, targetLang, mode: mode.id });
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

  // ---------------------------------------------------------------------------
  // Full-page translation
  // ---------------------------------------------------------------------------

  const SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1,
    KBD: 1, SAMP: 1, PRE: 1, OPTION: 1, SELECT: 1
  };
  const PAGE_NODE_LIMIT = 800;

  const pageState = { translated: false, busy: false, originals: [], abort: null };
  let pageToast = null;
  let toastAction = null;

  function toFa(value) {
    return String(value).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  }

  function ensureToast() {
    if (pageToast) return pageToast;
    pageToast = document.createElement("div");
    pageToast.id = "gt-page-toast";
    pageToast.innerHTML =
      '<span class="gt-toast-icon">🌐</span>' +
      '<span class="gt-toast-msg" id="gt-toast-msg"></span>' +
      '<button class="gt-toast-btn" id="gt-toast-action"></button>';
    document.body.appendChild(pageToast);
    el("gt-toast-action").addEventListener("click", () => {
      if (typeof toastAction === "function") toastAction();
    });
    return pageToast;
  }

  function showToast(message, opts) {
    const o = opts || {};
    ensureToast();
    S.applyTheme(pageToast, o.theme || "auto");
    pageToast.classList.toggle("gt-toast-error", o.error === true);
    el("gt-toast-msg").innerText = message;

    const btn = el("gt-toast-action");
    if (!o.done) { btn.innerText = "توقف"; toastAction = stopPageTranslation; }
    else if (o.canRestore) { btn.innerText = "نمایش متن اصلی"; toastAction = restorePage; }
    else { btn.innerText = "بستن"; toastAction = hideToast; }

    pageToast.style.display = "flex";
  }

  function updateToast(message) {
    const m = el("gt-toast-msg");
    if (m) m.innerText = message;
  }

  function hideToast() {
    if (pageToast) pageToast.style.display = "none";
  }

  function isTranslatableTextNode(node) {
    const text = node.nodeValue;
    if (!text || text.trim().length < 2) return false;
    if (!/\p{L}/u.test(text)) return false; // needs at least one letter

    const parent = node.parentElement;
    if (!parent) return false;
    if (SKIP_TAGS[parent.tagName]) return false;
    if (parent.isContentEditable) return false;
    if (parent.closest("#gt-modal-widget, #gt-floating-btn, #gt-page-toast")) return false;
    if (parent.getClientRects().length === 0) return false; // display:none / detached

    return true;
  }

  function collectPageTextNodes() {
    const nodes = [];
    if (!document.body) return nodes;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isTranslatableTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    let current;
    while ((current = walker.nextNode())) {
      nodes.push(current);
      if (nodes.length >= PAGE_NODE_LIMIT) break;
    }
    return nodes;
  }

  function stopPageTranslation() {
    if (pageState.abort) pageState.abort.abort();
  }

  function restorePage() {
    pageState.originals.forEach((o) => { o.node.nodeValue = o.text; });
    pageState.originals = [];
    pageState.translated = false;
    hideToast();
  }

  async function translatePage() {
    // A second trigger while translated restores the original page.
    if (pageState.busy) return;
    if (pageState.translated) { restorePage(); return; }

    const settings = await S.getStorage(["defaultTargetLang", "theme", "apiKey"]);
    const targetLang = settings.defaultTargetLang || "fa";
    const theme = settings.theme || "auto";

    if (!settings.apiKey || !String(settings.apiKey).trim()) {
      showToast("ابتدا کلید API را در تنظیمات افزونه وارد کنید.", { done: true, error: true, theme });
      return;
    }

    const nodes = collectPageTextNodes();
    if (!nodes.length) {
      showToast("متنی برای ترجمه در این صفحه پیدا نشد.", { done: true, theme });
      return;
    }
    const truncated = nodes.length >= PAGE_NODE_LIMIT;

    pageState.busy = true;
    pageState.abort = new AbortController();
    pageState.originals = nodes.map((node) => ({ node, text: node.nodeValue }));
    const segments = pageState.originals.map((o) => o.text.trim());

    showToast("در حال ترجمه صفحه… " + toFa(0) + "٪", { theme });

    try {
      const translations = await S.translatePageSegments(segments, {
        targetLang,
        signal: pageState.abort.signal,
        onProgress: (done, total) => {
          updateToast("در حال ترجمه صفحه… " + toFa(Math.round((done / total) * 100)) + "٪");
        }
      });

      pageState.originals.forEach((o, i) => {
        const translated = translations[i];
        if (translated && translated !== o.text.trim()) {
          const lead = (o.text.match(/^\s*/) || [""])[0];
          const trail = (o.text.match(/\s*$/) || [""])[0];
          o.node.nodeValue = lead + translated + trail;
        }
      });

      pageState.translated = true;
      showToast(
        truncated
          ? "بخش ابتدایی صفحه ترجمه شد (به سقف تعداد رسید)."
          : "ترجمه صفحه کامل شد.",
        { done: true, canRestore: true, theme }
      );
    } catch (err) {
      if (err && err.name === "AbortError") {
        restorePage();
        showToast("ترجمه صفحه متوقف شد.", { done: true, theme });
      } else {
        pageState.originals = [];
        pageState.translated = false;
        showToast("خطا در ترجمه صفحه: " + ((err && err.message) || ""), { done: true, error: true, theme });
      }
    } finally {
      pageState.busy = false;
      pageState.abort = null;
    }
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (!request) return;

    if (request.action === "TRANSLATE_SELECTION") {
      hideFloatingButton();

      // The keyboard shortcut sends no text, so fall back to the live selection.
      const text = request.text || String(window.getSelection() || "").trim();
      if (text) {
        showModalWidget(text, window.innerWidth / 2 - 200, window.innerHeight / 4);
      }
    } else if (request.action === "TRANSLATE_PAGE") {
      hideFloatingButton();
      translatePage();
    }
  });

  // Keep any open UI in sync when the theme changes elsewhere, or when the OS
  // preference changes while the theme is set to "auto".
  function reapplyTheme(theme) {
    if (modalWidget) S.applyTheme(modalWidget, theme);
    if (floatingBtn) S.applyTheme(floatingBtn, theme);
    if (pageToast) S.applyTheme(pageToast, theme);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.theme) reapplyTheme(changes.theme.newValue || "auto");
  });

  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => {
      const stored = (await S.getStorage(["theme"])).theme || "auto";
      if (stored === "auto") reapplyTheme("auto");
    });
  } catch (e) { /* matchMedia change events unsupported */ }
})();
