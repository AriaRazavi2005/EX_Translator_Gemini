// ============================================================================
// Gemini AI Translator - Shared module
// ----------------------------------------------------------------------------
// Single source of truth for language metadata, tone prompts, API streaming,
// history management and text helpers.
//
// Loaded by:
//   - popup.html   (<script src="shared.js"></script> before popup.js)
//   - options.html (<script src="shared.js"></script> before options.js)
//   - manifest content_scripts ("shared.js" before "content.js")
//
// Exposed as `window.GTShared` / `self.GTShared`.
// ============================================================================
(function (global) {
  "use strict";

  // Idempotent: the file may be injected twice (content script + executeScript)
  if (global.GTShared) return;

  // --------------------------------------------------------------------------
  // Constants
  // --------------------------------------------------------------------------

  /** Full descriptive names, used inside the model prompt. */
  const LANG_NAMES = {
    auto: "the original language",
    fa: "Persian (فارسی)",
    en: "English",
    ar: "Arabic (العربية)",
    fr: "French (Français)",
    de: "German (Deutsch)",
    es: "Spanish (Español)",
    it: "Italian (Italiano)",
    ru: "Russian (Русский)",
    tr: "Turkish (Türkçe)",
    zh: "Chinese Mandarin (中文)",
    ja: "Japanese (日本語)",
    ko: "Korean (한국어)",
    hi: "Hindi (हिन्दी)",
    pt: "Portuguese (Português)"
  };

  /** Short Persian labels, used to build <select> options in the UI. */
  const LANG_LABELS = {
    auto: "تشخیص خودکار",
    fa: "فارسی",
    en: "انگلیسی",
    ar: "عربی",
    fr: "فرانسوی",
    de: "آلمانی",
    es: "اسپانیایی",
    it: "ایتالیایی",
    ru: "روسی",
    tr: "ترکی استانبولی",
    zh: "چینی",
    ja: "ژاپنی",
    ko: "کره‌ای",
    hi: "هندی",
    pt: "پرتغالی"
  };

  /** Ordered list of languages offered as a translation target. */
  const TARGET_LANG_CODES = [
    "fa", "en", "ar", "fr", "de", "es", "it",
    "ru", "tr", "zh", "ja", "ko", "hi", "pt"
  ];

  /** Ordered list of languages offered as a translation source. */
  const SOURCE_LANG_CODES = ["auto"].concat(TARGET_LANG_CODES);

  /** BCP-47 tags for the Web Speech API. */
  const TTS_LANG_TAGS = {
    fa: "fa-IR",
    en: "en-US",
    ar: "ar-SA",
    fr: "fr-FR",
    de: "de-DE",
    es: "es-ES",
    it: "it-IT",
    ru: "ru-RU",
    tr: "tr-TR",
    zh: "zh-CN",
    ja: "ja-JP",
    ko: "ko-KR",
    hi: "hi-IN",
    pt: "pt-BR"
  };

  const TONE_PROMPTS = {
    general: "روان، طبیعی و دقیق بدون تکلف.",
    formal: "کامل رسمی، اداری و محترمانه.",
    informal: "صمیمانه، عامیانه و گفتاری.",
    technical: "تخصصی، علمی و متناسب با اصطلاحات رایج فن و دانش."
  };

  const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
  const DEFAULT_MODEL = "gemini-flash-latest";
  const HISTORY_LIMIT = 50;

  const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;

  // --------------------------------------------------------------------------
  // Text helpers
  // --------------------------------------------------------------------------

  /** Returns "rtl" or "ltr" for the given text. */
  function detectTextDirection(text) {
    if (!text) return "rtl";
    return RTL_REGEX.test(text) ? "rtl" : "ltr";
  }

  /** Applies the detected direction and matching alignment to an element. */
  function applyTextDirection(element, text) {
    if (!element) return;
    const dir = detectTextDirection(text);
    element.setAttribute("dir", dir);
    element.style.textAlign = dir === "rtl" ? "right" : "left";
  }

  /** Strips code fences, preambles and trailing model notes from a response. */
  function sanitizeTranslationText(rawText) {
    if (!rawText) return "";
    let clean = String(rawText).trim();
    clean = clean.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
    clean = clean.replace(
      /^(Here is the translation|Translation|Here's the translated text|ترجمه)\s*:\s*/i,
      ""
    );
    clean = clean.replace(/\n\s*\*?\([^)]*\)\*?\s*$/g, "");
    return clean.trim();
  }

  /** Escapes text before inserting it into innerHTML (quotes included). */
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Truncates long strings for compact list rendering. */
  function truncate(text, max) {
    const limit = max || 120;
    const value = String(text == null ? "" : text);
    return value.length > limit ? value.slice(0, limit) + "…" : value;
  }

  /** Maps a language code to a speech-synthesis language tag. */
  function getTtsLangTag(langCode) {
    return TTS_LANG_TAGS[langCode] || langCode || "en-US";
  }

  /** Normalizes an optional reverse-proxy URL into an API base URL. */
  function resolveBaseUrl(proxyUrl) {
    if (!proxyUrl || !String(proxyUrl).trim()) return DEFAULT_BASE_URL;
    return String(proxyUrl).trim().replace(/\/+$/, "");
  }

  /** Builds <option> markup for a language <select>. */
  function buildLangOptions(codes, selected) {
    return (codes || TARGET_LANG_CODES)
      .map(function (code) {
        const isSelected = code === selected ? " selected" : "";
        return "<option value=\"" + code + "\"" + isSelected + ">" +
          escapeHtml(LANG_LABELS[code] || code) + "</option>";
      })
      .join("");
  }

  // --------------------------------------------------------------------------
  // Prompt building
  // --------------------------------------------------------------------------

  function buildSystemPrompt(options) {
    const opts = options || {};
    const targetLangName = LANG_NAMES[opts.targetLang] || opts.targetLang || "Persian";
    const toneDesc = TONE_PROMPTS[opts.tone] || TONE_PROMPTS.general;

    const sourceClause =
      opts.sourceLang && opts.sourceLang !== "auto"
        ? "from " + (LANG_NAMES[opts.sourceLang] || opts.sourceLang) + " "
        : "";

    return [
      "SYSTEM INSTRUCTION: You are a strict, ultra-precise direct translator " +
        sourceClause + "into " + targetLangName + ".",
      "CRITICAL CONSTRAINTS:",
      "1. Output ONLY the pure, final translated text.",
      "2. NEVER wrap the output in markdown code fences.",
      "3. NEVER include conversational preambles or introductions (NO \"Here is the translation:\").",
      "4. NEVER include explanatory notes, footnotes, or pronunciation guides.",
      "5. PROPER NOUNS & BRAND NAMES RULE: For company names, software, tools, technologies, famous person names, or technical brand names, provide the translation/transliteration followed by the original English name in parentheses, e.g., 'گوگل (Google)', 'پایتون (Python)', 'مایکروسافت (Microsoft)', 'مایکل (Michael)'.",
      "6. Preserve the original line breaks, list structure and inline punctuation.",
      "7. Tone requirement: " + toneDesc
    ].join("\n");
  }

  // --------------------------------------------------------------------------
  // Storage helpers (promise based)
  // --------------------------------------------------------------------------

  function getStorage(keys) {
    return new Promise(function (resolve) {
      chrome.storage.local.get(keys, function (items) {
        resolve(items || {});
      });
    });
  }

  function setStorage(items) {
    return new Promise(function (resolve) {
      chrome.storage.local.set(items, function () {
        resolve();
      });
    });
  }

  /** Loads all extension settings at once. */
  function getSettings() {
    return getStorage(null);
  }

  // --------------------------------------------------------------------------
  // History (single, shared schema)
  //   { id, source, result, sourceLang, targetLang, timestamp }
  // --------------------------------------------------------------------------

  async function getHistory() {
    const data = await getStorage(["history"]);
    const history = Array.isArray(data.history) ? data.history : [];

    // Migrate legacy popup records that used `targetL` / `time`.
    return history.map(function (item, index) {
      return {
        id: item.id != null ? item.id : Date.now() + index,
        source: item.source || "",
        result: item.result || "",
        sourceLang: item.sourceLang || "auto",
        targetLang: item.targetLang || item.targetL || "fa",
        timestamp: item.timestamp || null,
        legacyTime: item.time || null
      };
    });
  }

  async function saveToHistory(entry) {
    const source = (entry && entry.source) || "";
    const result = (entry && entry.result) || "";
    if (!source.trim() || !result.trim()) return null;

    const history = await getHistory();

    const item = {
      id: Date.now(),
      source: source,
      result: result,
      sourceLang: (entry && entry.sourceLang) || "auto",
      targetLang: (entry && entry.targetLang) || "fa",
      timestamp: new Date().toISOString()
    };

    // Drop an identical consecutive entry to avoid duplicates on re-translate.
    const deduped = history.filter(function (existing) {
      return !(existing.source === item.source && existing.targetLang === item.targetLang);
    });

    deduped.unshift(item);
    await setStorage({ history: deduped.slice(0, HISTORY_LIMIT) });
    return item;
  }

  async function deleteHistoryItem(id) {
    const history = await getHistory();
    const remaining = history.filter(function (item) {
      return String(item.id) !== String(id);
    });
    await setStorage({ history: remaining });
    return remaining;
  }

  async function clearHistory() {
    await setStorage({ history: [] });
    return [];
  }

  /** Formats a history record timestamp for display. */
  function formatHistoryTime(item) {
    if (!item) return "";
    if (item.timestamp) {
      const date = new Date(item.timestamp);
      if (!isNaN(date.getTime())) {
        try {
          return date.toLocaleString("fa-IR", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        } catch (e) {
          return date.toLocaleString();
        }
      }
    }
    return item.legacyTime || "";
  }

  // --------------------------------------------------------------------------
  // Gemini streaming translation
  // --------------------------------------------------------------------------

  function missingApiKeyError() {
    const err = new Error(
      "کلید API گوگل تنظیم نشده است. لطفاً از صفحه تنظیمات (⚙️) کلید خود را وارد کنید."
    );
    err.code = "MISSING_API_KEY";
    return err;
  }

  /**
   * Streams a translation from the Gemini API.
   *
   * @param {Object}   options
   * @param {string}   options.text        Text to translate (required).
   * @param {string}   options.targetLang  Target language code.
   * @param {string}  [options.sourceLang] Source language code, "auto" by default.
   * @param {string}  [options.tone]       Tone key.
   * @param {Object}  [options.settings]   Pre-loaded settings; fetched when omitted.
   * @param {AbortSignal} [options.signal]
   * @param {Function}[options.onChunk]    Called with the sanitized text so far.
   * @returns {Promise<string>} The final sanitized translation.
   */
  async function streamTranslation(options) {
    const opts = options || {};
    const text = (opts.text || "").trim();
    if (!text) return "";

    const settings = opts.settings || (await getSettings());
    const apiKey = settings.apiKey && String(settings.apiKey).trim();
    if (!apiKey) throw missingApiKeyError();

    const model = settings.selectedModel || DEFAULT_MODEL;
    const baseUrl = resolveBaseUrl(settings.customProxyUrl);
    const url =
      baseUrl +
      "/v1beta/models/" +
      encodeURIComponent(model) +
      ":streamGenerateContent?alt=sse&key=" +
      encodeURIComponent(apiKey);

    const systemPrompt = buildSystemPrompt({
      targetLang: opts.targetLang || settings.defaultTargetLang || "fa",
      sourceLang: opts.sourceLang || "auto",
      tone: opts.tone || settings.defaultTone || "general"
    });

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt + "\n\n[INPUT TEXT TO TRANSLATE]:\n" + text }
              ]
            }
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 3072 }
        }),
        signal: opts.signal
      });
    } catch (networkError) {
      if (networkError && networkError.name === "AbortError") throw networkError;
      throw new Error(
        "اتصال به سرور برقرار نشد. اینترنت، فیلترشکن یا آدرس پرکسی خود را بررسی کنید."
      );
    }

    if (!response.ok) {
      const errJson = await response.json().catch(function () {
        return {};
      });
      const errMsg =
        (errJson && errJson.error && errJson.error.message) || response.statusText;

      if (response.status === 400 || response.status === 403) {
        throw new Error("کلید API نامعتبر یا فاقد دسترسی است (" + response.status + "): " + errMsg);
      }
      if (response.status === 429) {
        throw new Error("محدودیت تعداد درخواست‌ها. کمی صبر کنید و دوباره تلاش کنید.");
      }
      throw new Error("خطای API (" + response.status + "): " + errMsg);
    }

    if (!response.body) throw new Error("پاسخ استریم از سرور دریافت نشد.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let full = "";

    function consumeLine(line) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === ":") return;
      if (trimmed.indexOf("data:") !== 0) return;

      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") return;

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        return; // Incomplete or non-JSON payload; safely ignored.
      }

      const candidate = parsed && parsed.candidates && parsed.candidates[0];
      const parts = candidate && candidate.content && candidate.content.parts;
      const piece = parts && parts[0] && parts[0].text;

      if (piece) {
        full += piece;
        if (typeof opts.onChunk === "function") {
          opts.onChunk(sanitizeTranslationText(full));
        }
      }
    }

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });

      // Keep the trailing (possibly incomplete) line in the buffer.
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(consumeLine);
    }

    // Flush whatever remains once the stream is closed.
    buffer += decoder.decode();
    buffer.split("\n").forEach(consumeLine);

    return sanitizeTranslationText(full);
  }

  // --------------------------------------------------------------------------
  // Public surface
  // --------------------------------------------------------------------------

  global.GTShared = {
    // Constants
    LANG_NAMES: LANG_NAMES,
    LANG_LABELS: LANG_LABELS,
    TARGET_LANG_CODES: TARGET_LANG_CODES,
    SOURCE_LANG_CODES: SOURCE_LANG_CODES,
    TTS_LANG_TAGS: TTS_LANG_TAGS,
    TONE_PROMPTS: TONE_PROMPTS,
    DEFAULT_BASE_URL: DEFAULT_BASE_URL,
    DEFAULT_MODEL: DEFAULT_MODEL,
    HISTORY_LIMIT: HISTORY_LIMIT,

    // Text helpers
    detectTextDirection: detectTextDirection,
    applyTextDirection: applyTextDirection,
    sanitizeTranslationText: sanitizeTranslationText,
    escapeHtml: escapeHtml,
    truncate: truncate,
    getTtsLangTag: getTtsLangTag,
    resolveBaseUrl: resolveBaseUrl,
    buildLangOptions: buildLangOptions,
    buildSystemPrompt: buildSystemPrompt,

    // Storage
    getStorage: getStorage,
    setStorage: setStorage,
    getSettings: getSettings,

    // History
    getHistory: getHistory,
    saveToHistory: saveToHistory,
    deleteHistoryItem: deleteHistoryItem,
    clearHistory: clearHistory,
    formatHistoryTime: formatHistoryTime,

    // API
    streamTranslation: streamTranslation
  };
})(typeof self !== "undefined" ? self : window);
