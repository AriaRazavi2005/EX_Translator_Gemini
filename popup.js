// Popup JavaScript for Gemini AI Translator
document.addEventListener("DOMContentLoaded", () => {
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

  let activeAbortController = null;

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

  // RTL vs LTR Detection
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

  function sanitizeTranslationText(rawText) {
    if (!rawText) return "";
    let clean = rawText.trim();
    clean = clean.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
    clean = clean.replace(/^(Here is the translation|Translation|Here's the translated text|ترجمه):\s*/i, "");
    clean = clean.replace(/\n\s*\*?\([^)]*\)\*?/g, "");
    return clean.trim();
  }

  // Load Initial Settings
  chrome.storage.local.get(null, (settings) => {
    if (settings.defaultSourceLang) sourceLang.value = settings.defaultSourceLang;
    if (settings.defaultTargetLang) targetLang.value = settings.defaultTargetLang;
    if (settings.defaultTone) toneSelect.value = settings.defaultTone;

    const modelName = settings.selectedModel || "gemini-flash-latest";
    activeModelBadge.innerText = `مدل: ${modelName}`;
  });

  // Tab Switching
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

  // Open Options Page
  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Textarea Input Events
  sourceText.addEventListener("input", () => {
    const val = sourceText.value;
    const len = val.length;
    charCount.innerText = `${len} کاراکتر`;
    clearTextBtn.style.display = len > 0 ? "block" : "none";
    applyTextDirection(sourceText, val);
  });

  clearTextBtn.addEventListener("click", () => {
    sourceText.value = "";
    charCount.innerText = "0 کاراکتر";
    clearTextBtn.style.display = "none";
    outputText.innerHTML = `<div class="placeholder-text">ترجمه در این قسمت به صورت زنده استریم می‌شود...</div>`;
    applyTextDirection(sourceText, "");
  });

  // Swap Languages
  swapLangsBtn.addEventListener("click", () => {
    const srcVal = sourceLang.value;
    const tgtVal = targetLang.value;
    if (srcVal !== "auto") {
      sourceLang.value = tgtVal;
      targetLang.value = srcVal;
    }
  });

  // Copy Result
  copyResultBtn.addEventListener("click", () => {
    const text = outputText.innerText;
    if (text && !text.includes("استریم می‌شود") && !text.includes("در حال ترجمه")) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = copyResultBtn.innerText;
        copyResultBtn.innerText = "✓";
        statusMsg.innerText = "متن کپی شد!";
        setTimeout(() => {
          copyResultBtn.innerText = orig;
          statusMsg.innerText = "آماده";
        }, 1500);
      });
    }
  });

  // TTS Read Aloud
  ttsResultBtn.addEventListener("click", () => {
    const text = outputText.innerText;
    if (!text || text.includes("استریم می‌شود") || text.includes("در حال ترجمه")) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = targetLang.value;
    utterance.lang = lang === "fa" ? "fa-IR" : (lang === "en" ? "en-US" : lang);
    window.speechSynthesis.speak(utterance);
    statusMsg.innerText = "در حال پخش صوتی...";
    utterance.onend = () => statusMsg.innerText = "آماده";
  });

  // Main Submit Translation Trigger
  translateSubmitBtn.addEventListener("click", () => {
    const text = sourceText.value.trim();
    if (!text) {
      statusMsg.innerText = "لطفاً ابتدا متنی وارد کنید";
      return;
    }
    performTranslation(text);
  });

  // Perform Streaming Gemini Translation
  async function performTranslation(text) {
    statusMsg.innerText = "در حال اتصال به Gemini...";
    outputText.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #a5b4fc; padding: 10px 0;">
        <div style="width: 16px; height: 16px; border: 2px solid #818cf8; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <span>در حال ترجمه هوشمند...</span>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    try {
      const settings = await new Promise((res) => chrome.storage.local.get(null, res));
      const apiKey = settings.apiKey;
      const model = settings.selectedModel || "gemini-flash-latest";
      const srcL = sourceLang.value;
      const tgtL = targetLang.value;
      const tone = toneSelect.value;

      if (!apiKey) {
        outputText.innerHTML = `<div style="color: #f87171;">⚠️ کلید API تنظیم نشده است! برای وارد کردن کلید، به آیکون تنظیمات (⚙️) بروید.</div>`;
        statusMsg.innerText = "خطای کلید API";
        return;
      }

      const toneDesc = TONE_PROMPTS[tone] || TONE_PROMPTS.general;
      const targetLangName = LANG_NAMES[tgtL] || tgtL;
      const sourceLangName = srcL !== "auto" ? (LANG_NAMES[srcL] || srcL) : "the original language";

      const systemPrompt = `SYSTEM INSTRUCTION: You are a strict, ultra-precise direct translator from ${sourceLangName} into ${targetLangName}.
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

      outputText.innerText = "";
      statusMsg.innerText = "در حال استریم پاسخ...";

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
                outputText.innerText = cleanText;
                applyTextDirection(outputText, cleanText);
              }
            } catch (e) {
              // Ignore partial JSON
            }
          }
        }
      }

      const sanitizedResult = sanitizeTranslationText(fullTranslation);
      if (!sanitizedResult) {
        outputText.innerText = "پاسخی از مدل دریافت نشد.";
      } else {
        outputText.innerText = sanitizedResult;
        applyTextDirection(outputText, sanitizedResult);
        statusMsg.innerText = "ترجمه تکمیل شد ✓";
        saveToHistory(text, sanitizedResult, tgtL);
      }

    } catch (err) {
      if (err.name === "AbortError") return;
      outputText.innerHTML = `<div style="color: #f87171;">❌ ${err.message}</div>`;
      statusMsg.innerText = "خطا در ترجمه";
    }
  }

  // History Management
  function saveToHistory(source, result, targetL) {
    chrome.storage.local.get(["history"], (data) => {
      let history = data.history || [];
      history.unshift({
        id: Date.now(),
        source,
        result,
        targetL,
        time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
      });
      if (history.length > 50) history = history.slice(0, 50);
      chrome.storage.local.set({ history });
    });
  }

  function loadHistory() {
    chrome.storage.local.get(["history"], (data) => {
      const history = data.history || [];
      if (history.length === 0) {
        historyList.innerHTML = `<div style="text-align: center; color: #64748b; padding: 30px 0; font-size: 13px;">هیچ ترجمه‌ای در تاریخچه ثبت نشده است.</div>`;
        return;
      }

      historyList.innerHTML = "";
      history.forEach((item) => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
          <div class="history-src" dir="${detectTextDirection(item.source)}">متن: ${escapeHtml(item.source)}</div>
          <div class="history-res" dir="${detectTextDirection(item.result)}">ترجمه: ${escapeHtml(item.result)}</div>
          <div class="history-footer">
            <span class="history-time">${item.time}</span>
            <button class="mini-copy-btn" title="کپی ترجمه">📋 کپی</button>
          </div>
        `;
        
        div.querySelector(".mini-copy-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(item.result).then(() => {
            statusMsg.innerText = "ترجمه کپی شد ✓";
            setTimeout(() => statusMsg.innerText = "آماده", 1500);
          });
        });

        div.addEventListener("click", () => {
          sourceText.value = item.source;
          applyTextDirection(sourceText, item.source);
          outputText.innerText = item.result;
          applyTextDirection(outputText, item.result);
          charCount.innerText = `${item.source.length} کاراکتر`;
          tabTranslateBtn.click();
        });
        historyList.appendChild(div);
      });
    });
  }

  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("آیا از پاک کردن تمام تاریخچه اطمینان دارید؟")) {
      chrome.storage.local.set({ history: [] }, () => {
        loadHistory();
      });
    }
  });

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});
