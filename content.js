// Content script for Gemini AI Translator
(function () {
  if (window.hasGeminiTranslatorInjected) return;
  window.hasGeminiTranslatorInjected = true;

  let currentSelectedText = "";
  let floatingBtn = null;
  let modalWidget = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let activeAbortController = null;
  let historyDrawerOpen = false;

  const LANG_NAMES = {
    fa: "فارسی (Persian)",
    en: "انگلیسی (English)",
    ar: "عربی (Arabic)",
    fr: "فرانسوی (French)",
    de: "آلمانی (German)",
    es: "اسپانیایی (Spanish)",
    auto: "تشخیص خودکار"
  };

  const TONE_PROMPTS = {
    general: "روان، طبیعی و دقیق بدون تکلف.",
    formal: "کامل رسمی، اداری و محترمانه.",
    informal: "صمیمانه، عامیانه و گفتاری.",
    technical: "تخصصی، علمی و متناسب با اصطلاحات رایج فن و دانش."
  };

  // Detect RTL vs LTR text direction
  function detectTextDirection(text) {
    if (!text) return "rtl";
    const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return rtlRegex.test(text) ? "rtl" : "ltr";
  }

  function applyTextDirection(element, text) {
    if (!element) return;
    const dir = detectTextDirection(text);
    element.setAttribute("dir", dir);
    element.style.textAlign = dir === "rtl" ? "right" : "left";
  }

  // Helper to sanitize translation output from LLM clutter
  function sanitizeTranslationText(rawText) {
    if (!rawText) return "";
    let clean = rawText.trim();
    clean = clean.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
    clean = clean.replace(/^(Here is the translation|Translation|Here's the translated text|ترجمه):\s*/i, "");
    clean = clean.replace(/\n\s*\*?\([^)]*\)\*?/g, "");
    return clean.trim();
  }

  // Create floating icon trigger button
  function createFloatingButton() {
    if (floatingBtn) return;
    floatingBtn = document.createElement("div");
    floatingBtn.id = "gt-floating-btn";
    floatingBtn.className = "gt-glass-btn";
    floatingBtn.innerHTML = `<span class="gt-sparkle">✦</span> <span>ترجمه</span>`;
    document.body.appendChild(floatingBtn);

    floatingBtn.addEventListener("mousedown", (e) => {
      e.stopPropagation();
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
    if (floatingBtn) {
      floatingBtn.style.display = "none";
    }
  }

  function showFloatingButton(x, y) {
    createFloatingButton();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    let posX = x + scrollX + 10;
    let posY = y + scrollY - 35;
    if (posY < scrollY + 10) posY = y + scrollY + 20;

    floatingBtn.style.left = `${posX}px`;
    floatingBtn.style.top = `${posY}px`;
    floatingBtn.style.display = "flex";
  }

  // Create Modal Widget
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
            <select id="gt-target-lang">
              <option value="fa">فارسی</option>
              <option value="en">انگلیسی</option>
              <option value="ar">عربی</option>
              <option value="fr">فرانسوی</option>
              <option value="de">آلمانی</option>
            </select>
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

    // Event handlers
    document.getElementById("gt-close-btn").addEventListener("click", hideModalWidget);
    document.getElementById("gt-history-btn").addEventListener("click", toggleHistoryDrawer);
    document.getElementById("gt-close-drawer-btn").addEventListener("click", toggleHistoryDrawer);

    document.getElementById("gt-retranslate-btn").addEventListener("click", () => {
      if (currentSelectedText) performTranslation(currentSelectedText);
    });
    document.getElementById("gt-copy-btn").addEventListener("click", copyResult);
    document.getElementById("gt-tts-btn").addEventListener("click", playSpeech);

    // Setup dragging
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

      modalWidget.style.left = `${left}px`;
      modalWidget.style.top = `${top}px`;
      modalWidget.style.position = "fixed";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

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

  function loadHistoryDrawer() {
    const listElem = document.getElementById("gt-history-drawer-list");
    chrome.storage.local.get(["history"], (data) => {
      const history = data.history || [];
      if (history.length === 0) {
        listElem.innerHTML = `<div class="gt-empty-history">تاریخچه‌ای ثبت نشده است.</div>`;
        return;
      }
      listElem.innerHTML = "";
      history.slice(0, 10).forEach(item => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "gt-history-drawer-item";
        itemDiv.innerHTML = `
          <div class="gt-h-src" dir="${detectTextDirection(item.source)}">${escapeHtml(item.source)}</div>
          <div class="gt-h-res" dir="${detectTextDirection(item.result)}">${escapeHtml(item.result)}</div>
        `;
        itemDiv.addEventListener("click", () => {
          const srcElem = document.getElementById("gt-source-content");
          const resElem = document.getElementById("gt-result-content");
          srcElem.innerText = item.source;
          applyTextDirection(srcElem, item.source);
          resElem.innerText = item.result;
          applyTextDirection(resElem, item.result);
          toggleHistoryDrawer();
        });
        listElem.appendChild(itemDiv);
      });
    });
  }

  function showModalWidget(text, clickX, clickY) {
    createModalWidget();
    currentSelectedText = text;

    const srcElem = document.getElementById("gt-source-content");
    srcElem.innerText = text;
    applyTextDirection(srcElem, text);

    chrome.storage.local.get(["defaultTargetLang", "defaultTone"], (items) => {
      if (items.defaultTargetLang) {
        document.getElementById("gt-target-lang").value = items.defaultTargetLang;
      }
      if (items.defaultTone) {
        document.getElementById("gt-tone-select").value = items.defaultTone;
      }

      const width = 410;
      let left = clickX || (window.innerWidth / 2 - width / 2);
      let top = clickY || (window.innerHeight / 3);

      if (left + width > window.innerWidth - 20) left = window.innerWidth - width - 20;
      if (left < 20) left = 20;
      if (top < 20) top = 20;

      modalWidget.style.position = "fixed";
      modalWidget.style.left = `${left}px`;
      modalWidget.style.top = `${top}px`;
      modalWidget.style.display = "block";

      performTranslation(text);
    });
  }

  function hideModalWidget() {
    if (modalWidget) {
      modalWidget.style.display = "none";
    }
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    historyDrawerOpen = false;
    const drawer = document.getElementById("gt-history-drawer");
    if (drawer) drawer.style.display = "none";
  }

  function copyResult() {
    const resElem = document.getElementById("gt-result-content");
    const text = resElem.innerText;
    if (text && !text.includes("در حال ترجمه")) {
      navigator.clipboard.writeText(text).then(() => {
        const copyBtn = document.getElementById("gt-copy-btn");
        const orig = copyBtn.innerText;
        copyBtn.innerText = "✓";
        setTimeout(() => copyBtn.innerText = orig, 1500);
      });
    }
  }

  function playSpeech() {
    const resElem = document.getElementById("gt-result-content");
    const text = resElem.innerText;
    if (!text || text.includes("در حال ترجمه")) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = document.getElementById("gt-target-lang").value;
    utterance.lang = targetLang === "fa" ? "fa-IR" : (targetLang === "en" ? "en-US" : targetLang);
    window.speechSynthesis.speak(utterance);
  }

  async function performTranslation(text) {
    const resElem = document.getElementById("gt-result-content");
    resElem.innerHTML = `
      <div class="gt-loading-spinner">
        <div class="gt-spinner"></div>
        <span>در حال پردازش و استریم ترجمه...</span>
      </div>
    `;

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    try {
      const settings = await new Promise((resolve) => chrome.storage.local.get(null, resolve));
      const apiKey = settings.apiKey;
      const model = settings.selectedModel || "gemini-flash-latest";
      const targetLang = document.getElementById("gt-target-lang").value || settings.defaultTargetLang || "fa";
      const tone = document.getElementById("gt-tone-select").value || settings.defaultTone || "general";

      if (!apiKey) {
        resElem.innerHTML = `<div class="gt-error">⚠️ کلید API گوگل تنظیم نشده است. لطفاً وارد تنظیمات اکستنشن شوید.</div>`;
        return;
      }

      const toneDesc = TONE_PROMPTS[tone] || TONE_PROMPTS.general;
      const targetLangName = LANG_NAMES[targetLang] || targetLang;

      const systemPrompt = `SYSTEM INSTRUCTION: You are a strict, ultra-precise direct translator into ${targetLangName}.
CRITICAL CONSTRAINTS:
1. Output ONLY the pure, final translated text.
2. NEVER include markdown code fences (NO \`\`\`).
3. NEVER include conversational preambles or introductions (NO "Here is the translation:").
4. NEVER include explanatory notes, footnotes, or pronunciation guides.
5. PROPER NOUNS & BRAND NAMES RULE: For company names, software, tools, technologies, famous person names, or technical brand names, provide the translation/transliteration followed by the original English name in parentheses, e.g., 'گوگل (Google)', 'پایتون (Python)', 'مایکروسافت (Microsoft)', 'مایکل (Michael)'.
6. Tone requirement: ${toneDesc}`;

      let baseUrl = settings.customProxyUrl ? settings.customProxyUrl.trim().replace(/\/+$/, '') : "https://generativelanguage.googleapis.com";
      const url = `${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n[INPUT TEXT TO TRANSLATE]:\n${text}` }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 3072
          }
        }),
        signal: activeAbortController.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error?.message || response.statusText;
        throw new Error(`خطای API (${response.status}): ${errMsg}`);
      }

      resElem.innerText = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullTranslation = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const textPiece = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textPiece) {
                fullTranslation += textPiece;
                const cleanText = sanitizeTranslationText(fullTranslation);
                resElem.innerText = cleanText;
                applyTextDirection(resElem, cleanText);
              }
            } catch (e) {
              // Ignore partial JSON
            }
          }
        }
      }

      const sanitizedResult = sanitizeTranslationText(fullTranslation);
      if (!sanitizedResult) {
        resElem.innerText = "ترجمه‌ای دریافت نشد.";
      } else {
        resElem.innerText = sanitizedResult;
        applyTextDirection(resElem, sanitizedResult);
        saveToHistory(text, sanitizedResult, targetLang);
      }

    } catch (err) {
      if (err.name === "AbortError") return;
      resElem.innerHTML = `<div class="gt-error">❌ ${err.message}</div>`;
    }
  }

  function saveToHistory(source, result, targetLang) {
    chrome.storage.local.get(["history"], (data) => {
      let history = data.history || [];
      const item = {
        id: Date.now(),
        source,
        result,
        targetLang,
        timestamp: new Date().toISOString()
      };
      history.unshift(item);
      if (history.length > 50) history = history.slice(0, 50);
      chrome.storage.local.set({ history });
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  document.addEventListener("mouseup", (e) => {
    if ((modalWidget && modalWidget.contains(e.target)) || (floatingBtn && floatingBtn.contains(e.target))) {
      return;
    }

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

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
    if (modalWidget && !modalWidget.contains(e.target) && floatingBtn && !floatingBtn.contains(e.target)) {
      hideFloatingButton();
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TRANSLATE_SELECTION") {
      hideFloatingButton();
      const selection = window.getSelection();
      const text = request.text || selection.toString().trim();
      if (text) {
        showModalWidget(text, window.innerWidth / 2 - 200, window.innerHeight / 4);
      }
    }
  });
})();
