// ============================================================================
// Gemini AI Translator - Shared core module
// ----------------------------------------------------------------------------
// Single source of truth for language metadata, AI action modes, prompt
// building, API streaming, the response cache, the custom glossary, history
// management and text helpers.
//
// Loaded by:
//   - src/popup/popup.html   (<script src="../shared/shared.js"></script>)
//   - src/options/options.html (<script src="../shared/shared.js"></script>)
//   - manifest content_scripts ("src/shared/shared.js" before content.js)
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

  /**
   * AI action modes. Every mode reuses the same streaming pipeline and only
   * swaps the system prompt.
   *
   *   usesTarget   - the output language is selectable
   *   usesTone     - the tone selector is meaningful
   *   usesGlossary - glossary terms are injected into the prompt
   *   cacheable    - deterministic enough to be served from cache
   */
  const MODES = {
    translate: {
      id: "translate",
      label: "ترجمه",
      icon: "✦",
      inputLabel: "[INPUT TEXT TO TRANSLATE]",
      usesTarget: true,
      usesTone: true,
      usesGlossary: true,
      cacheable: true
    },
    dictionary: {
      id: "dictionary",
      label: "دیکشنری",
      icon: "📖",
      inputLabel: "[WORD OR SHORT PHRASE TO DEFINE]",
      usesTarget: true,
      usesTone: false,
      usesGlossary: true,
      cacheable: true
    },
    summarize: {
      id: "summarize",
      label: "خلاصه",
      icon: "📝",
      inputLabel: "[TEXT TO SUMMARIZE]",
      usesTarget: true,
      usesTone: true,
      usesGlossary: true,
      cacheable: true
    },
    grammar: {
      id: "grammar",
      label: "اصلاح گرامر",
      icon: "✅",
      inputLabel: "[TEXT TO PROOFREAD]",
      usesTarget: false,
      usesTone: false,
      usesGlossary: false,
      cacheable: true
    },
    rewrite: {
      id: "rewrite",
      label: "بازنویسی",
      icon: "🪄",
      inputLabel: "[TEXT TO REWRITE]",
      usesTarget: false,
      usesTone: true,
      usesGlossary: false,
      cacheable: false
    },
    explain: {
      id: "explain",
      label: "توضیح ساده",
      icon: "💡",
      inputLabel: "[TEXT TO EXPLAIN]",
      usesTarget: true,
      usesTone: false,
      usesGlossary: true,
      cacheable: true
    }
  };

  /** Display order of the modes in every UI surface. */
  const MODE_ORDER = [
    "translate", "dictionary", "summarize", "grammar", "rewrite", "explain"
  ];

  const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
  const DEFAULT_MODEL = "gemini-flash-latest";
  const HISTORY_LIMIT = 50;

  const CACHE_STORAGE_KEY = "aiCache";
  const CACHE_LIMIT = 200;
  const GLOSSARY_STORAGE_KEY = "glossary";
  const GLOSSARY_LIMIT = 300;
  const GLOSSARY_PROMPT_LIMIT = 60;
  const SINGLE_WORD_MAX_LENGTH = 40;

  // Generation defaults, overridable from settings.
  const DEFAULT_MAX_OUTPUT_TOKENS = 3072;
  const DEFAULT_TEMPERATURE = 0.2;

  // Transient-failure retry policy for the Gemini request.
  const MAX_RETRIES = 2;
  const RETRY_BASE_DELAY = 400;

  // Only rewrite a cache entry's recency stamp when it is older than this,
  // so a burst of cache hits does not repeatedly rewrite the whole cache.
  const CACHE_TOUCH_INTERVAL = 60000;

  // "auto" resolves to the OS preference, otherwise "dark" / "light".
  const THEME_STORAGE_KEY = "theme";

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

  /**
   * Mode-aware output cleanup.
   *
   * Translation output is a single block of prose, so the aggressive trailing
   * note stripping is safe. Structured modes (dictionary, summarize, explain)
   * legitimately end with parenthesised text and bullet lists, so only code
   * fences and conversational preambles are removed there.
   */
  function sanitizeModelOutput(rawText, mode) {
    if (!rawText) return "";
    if (!mode || mode === "translate") return sanitizeTranslationText(rawText);

    let clean = String(rawText).trim();
    clean = clean.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
    clean = clean.replace(/^(Here is|Here's|Sure|Of course|Certainly)[^\n:]{0,60}:\s*/i, "");
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

  /**
   * True when the input looks like a single lexical item, which is the signal
   * used to offer the dictionary mode automatically.
   */
  function isSingleWord(text) {
    const stripped = String(text == null ? "" : text)
      .trim()
      .replace(/^["'“”‘’(\[«.,!?:;\-–—]+/, "")
      .replace(/["'“”‘’)\]».,!?:;\-–—]+$/, "")
      .trim();

    if (!stripped) return false;
    if (/\s/.test(stripped)) return false;
    return stripped.length <= SINGLE_WORD_MAX_LENGTH;
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

  /** Builds <option> markup for the AI action mode <select>. */
  function buildModeOptions(selected) {
    return MODE_ORDER.map(function (id) {
      const mode = MODES[id];
      const isSelected = id === selected ? " selected" : "";
      return "<option value=\"" + id + "\"" + isSelected + ">" +
        escapeHtml(mode.icon + " " + mode.label) + "</option>";
    }).join("");
  }

  /** Returns a known mode descriptor, falling back to "translate". */
  function getMode(modeId) {
    return MODES[modeId] || MODES.translate;
  }

  // --------------------------------------------------------------------------
  // Theme
  // --------------------------------------------------------------------------

  /** Resolves a stored preference ("auto"|"dark"|"light") to "dark"|"light". */
  function resolveTheme(theme) {
    if (theme === "light" || theme === "dark") return theme;
    try {
      if (typeof matchMedia === "function" &&
          matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
      }
    } catch (e) { /* matchMedia unavailable (e.g. service worker) */ }
    return "dark";
  }

  /** Writes the resolved theme onto an element as data-gt-theme. */
  function applyTheme(root, theme) {
    const resolved = resolveTheme(theme);
    if (root && root.setAttribute) root.setAttribute("data-gt-theme", resolved);
    return resolved;
  }

  // --------------------------------------------------------------------------
  // Rich text rendering (safe markdown-lite -> HTML)
  //
  // The model returns plain text with light structure (bullets, numbered
  // lists, **bold**, `code`). We escape first, then re-introduce only our own
  // tags, so the output can never inject host markup.
  // --------------------------------------------------------------------------

  /** Applies inline **bold**, *italic*, `code`, and safe http(s) links. */
  function renderInline(escaped) {
    return escaped
      .replace(/`([^`]+)`/g, '<code class="gt-rt-code">$1</code>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a class="gt-rt-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
  }

  /** Renders a single block <div> carrying its own bidi direction. */
  function renderBlock(rawLine, inner) {
    const dir = detectTextDirection(rawLine);
    return '<div class="gt-rt-line" dir="' + dir + '">' + inner + "</div>";
  }

  /**
   * Turns model output into structured, bidi-aware HTML. Falls back to a plain
   * escaped block when the text has no recognisable structure.
   */
  function renderRichText(text) {
    const value = String(text == null ? "" : text);
    if (!value.trim()) return "";

    const lines = value.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let listType = null; // "ul" | "ol" | null

    function closeList() {
      if (listType) { html.push("</" + listType + ">"); listType = null; }
    }

    lines.forEach(function (line) {
      const raw = line.replace(/\s+$/, "");
      if (!raw.trim()) { closeList(); return; }

      const escaped = escapeHtml(raw.trim());
      const bullet = /^[-•*]\s+(.*)$/.exec(raw.trim());
      const numbered = /^(\d+)[.)]\s+(.*)$/.exec(raw.trim());
      const indented = /^\s{2,}\S/.test(line);

      if (bullet) {
        if (listType !== "ul") { closeList(); html.push('<ul class="gt-rt-ul">'); listType = "ul"; }
        html.push('<li dir="' + detectTextDirection(bullet[1]) + '">' +
          renderInline(escapeHtml(bullet[1])) + "</li>");
      } else if (numbered) {
        if (listType !== "ol") { closeList(); html.push('<ol class="gt-rt-ol">'); listType = "ol"; }
        html.push('<li dir="' + detectTextDirection(numbered[2]) + '">' +
          renderInline(escapeHtml(numbered[2])) + "</li>");
      } else {
        closeList();
        const inner = renderInline(escaped);
        html.push(indented
          ? '<div class="gt-rt-sub" dir="' + detectTextDirection(raw) + '">' + inner + "</div>"
          : renderBlock(raw.trim(), inner));
      }
    });

    closeList();
    return html.join("");
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

  /** Reads the stored theme preference ("auto" by default). */
  async function getStoredTheme() {
    const data = await getStorage([THEME_STORAGE_KEY]);
    return data[THEME_STORAGE_KEY] || "auto";
  }

  // --------------------------------------------------------------------------
  // Custom glossary
  //   [{ source: "Kubernetes", target: "کوبرنتیز" }, ...]
  // --------------------------------------------------------------------------

  /** Loads the glossary, dropping malformed or empty rows. */
  async function getGlossary() {
    const data = await getStorage([GLOSSARY_STORAGE_KEY]);
    const raw = Array.isArray(data[GLOSSARY_STORAGE_KEY])
      ? data[GLOSSARY_STORAGE_KEY]
      : [];

    return raw
      .map(function (entry) {
        return {
          source: String((entry && entry.source) || "").trim(),
          target: String((entry && entry.target) || "").trim()
        };
      })
      .filter(function (entry) {
        return entry.source && entry.target;
      });
  }

  /** Persists the glossary, de-duplicating on a case-insensitive source term. */
  async function saveGlossary(entries) {
    const seen = Object.create(null);
    const cleaned = [];

    (Array.isArray(entries) ? entries : []).forEach(function (entry) {
      const source = String((entry && entry.source) || "").trim();
      const target = String((entry && entry.target) || "").trim();
      if (!source || !target) return;

      const key = source.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;

      cleaned.push({ source: source, target: target });
    });

    const limited = cleaned.slice(0, GLOSSARY_LIMIT);
    const patch = {};
    patch[GLOSSARY_STORAGE_KEY] = limited;
    await setStorage(patch);
    return limited;
  }

  /** Stable representation of the glossary, used inside the cache key. */
  function glossaryFingerprint(glossary) {
    if (!Array.isArray(glossary) || glossary.length === 0) return "";
    return glossary
      .map(function (entry) {
        return entry.source + "\u0001" + entry.target;
      })
      .join("\u0002");
  }

  /**
   * Builds the glossary section of the prompt.
   *
   * Only terms actually present in the input are sent, which keeps the prompt
   * small even for a large glossary.
   */
  function buildGlossaryClause(glossary, text) {
    if (!Array.isArray(glossary) || glossary.length === 0) return "";

    const haystack = String(text || "").toLowerCase();
    const relevant = glossary.filter(function (entry) {
      if (!entry || !entry.source || !entry.target) return false;
      if (!haystack) return true;
      return haystack.indexOf(String(entry.source).toLowerCase()) !== -1;
    });

    if (relevant.length === 0) return "";

    const lines = relevant.slice(0, GLOSSARY_PROMPT_LIMIT).map(function (entry) {
      return "- \"" + entry.source + "\" MUST be rendered exactly as \"" + entry.target + "\"";
    });

    return [
      "MANDATORY GLOSSARY (highest priority, overrides every other rule):",
      lines.join("\n"),
      "Use these exact renderings everywhere the term appears, and do NOT append the original term in parentheses for glossary entries."
    ].join("\n");
  }

  // --------------------------------------------------------------------------
  // Prompt building
  // --------------------------------------------------------------------------

  function buildTranslatePrompt(targetLangName, sourceClause, toneDesc) {
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
    ];
  }

  function buildDictionaryPrompt(targetLangName, sourceClause) {
    return [
      "SYSTEM INSTRUCTION: You are a precise bilingual dictionary. Explain the given word or short phrase " +
        sourceClause + "for a speaker of " + targetLangName + ".",
      "Write every label and every explanation in " + targetLangName + ".",
      "OUTPUT FORMAT (plain text only, no markdown fences, no preamble):",
      "Line 1: the original word, then its simple phonetic pronunciation in parentheses.",
      "Line 2: a label meaning 'Part of speech' followed by the grammatical category.",
      "Then a label meaning 'Meanings' followed by up to 3 numbered senses, one per line, each a short definition.",
      "Then a label meaning 'Synonyms' followed by up to 5 synonyms in the ORIGINAL language, comma separated.",
      "Then a label meaning 'Examples' followed by up to 2 example sentences in the ORIGINAL language, each immediately followed on the next line by its translation into " +
        targetLangName + ", indented with two spaces.",
      "CONSTRAINTS:",
      "1. Be compact. Omit any section that does not apply instead of writing 'none'.",
      "2. Never invent a word that does not exist; if the input is not a real word, say so in one short line.",
      "3. Do not add commentary before or after the entry."
    ];
  }

  function buildSummarizePrompt(targetLangName, toneDesc) {
    return [
      "SYSTEM INSTRUCTION: You are an expert summarizer. Summarize the input text in " +
        targetLangName + ".",
      "CRITICAL CONSTRAINTS:",
      "1. Output ONLY the summary. No preamble, no markdown code fences.",
      "2. Begin with exactly one sentence that captures the central idea.",
      "3. Then list between 3 and 6 key points, one per line, each line starting with '- '.",
      "4. Reproduce numbers, dates, names and technical terms exactly as they appear.",
      "5. NEVER add information, opinions or conclusions that are not in the source text.",
      "6. Aim for at most 25 percent of the original length.",
      "7. Tone requirement: " + toneDesc
    ];
  }

  function buildGrammarPrompt() {
    return [
      "SYSTEM INSTRUCTION: You are a meticulous proofreader. Correct grammar, spelling, punctuation and word-choice errors in the input text.",
      "CRITICAL CONSTRAINTS:",
      "1. Keep the SAME language as the input. NEVER translate.",
      "2. Output ONLY the corrected text. No preamble, no explanations, no list of changes, no markdown code fences.",
      "3. Preserve the author's meaning, voice, register and every line break.",
      "4. Leave sentences that are already correct completely untouched.",
      "5. Do not restructure or shorten content; fix only what is wrong.",
      "6. If the text contains no errors, return it verbatim."
    ];
  }

  function buildRewritePrompt(toneDesc) {
    return [
      "SYSTEM INSTRUCTION: You are a skilled editor. Rewrite the input text so that it reads more clearly, naturally and fluently.",
      "CRITICAL CONSTRAINTS:",
      "1. Keep the SAME language as the input. NEVER translate.",
      "2. Output ONLY the rewritten text. No preamble, no notes, no markdown code fences.",
      "3. Preserve every fact, number, date and named entity exactly.",
      "4. Keep roughly the same length: improve flow, remove redundancy and fix awkward phrasing.",
      "5. Preserve the paragraph and list structure of the original.",
      "6. Tone requirement: " + toneDesc
    ];
  }

  function buildExplainPrompt(targetLangName) {
    return [
      "SYSTEM INSTRUCTION: You are a patient teacher. Explain the input text in simple, plain " +
        targetLangName + " that a curious beginner can follow.",
      "CRITICAL CONSTRAINTS:",
      "1. Output ONLY the explanation. No preamble, no markdown code fences.",
      "2. Begin with one short sentence that states plainly what the text is about.",
      "3. Then add between 2 and 5 short clarifying lines, each starting with '- ', unpacking jargon, context and implications.",
      "4. Prefer everyday words. When a technical term is unavoidable, define it in the same line.",
      "5. NEVER invent facts that are not supported by the input text."
    ];
  }

  /**
   * Builds the full system prompt for a given mode.
   *
   * @param {Object}  options
   * @param {string} [options.mode]       One of MODES, "translate" by default.
   * @param {string} [options.targetLang] Output language code.
   * @param {string} [options.sourceLang] Input language code, "auto" by default.
   * @param {string} [options.tone]       Tone key.
   * @param {Array}  [options.glossary]   Custom glossary entries.
   * @param {string} [options.text]       Input text, used to filter the glossary.
   */
  function buildSystemPrompt(options) {
    const opts = options || {};
    const mode = getMode(opts.mode);
    const targetLangName = LANG_NAMES[opts.targetLang] || opts.targetLang || "Persian";
    const toneDesc = TONE_PROMPTS[opts.tone] || TONE_PROMPTS.general;

    const sourceClause =
      opts.sourceLang && opts.sourceLang !== "auto"
        ? "from " + (LANG_NAMES[opts.sourceLang] || opts.sourceLang) + " "
        : "";

    let lines;
    switch (mode.id) {
      case "dictionary":
        lines = buildDictionaryPrompt(targetLangName, sourceClause);
        break;
      case "summarize":
        lines = buildSummarizePrompt(targetLangName, toneDesc);
        break;
      case "grammar":
        lines = buildGrammarPrompt();
        break;
      case "rewrite":
        lines = buildRewritePrompt(toneDesc);
        break;
      case "explain":
        lines = buildExplainPrompt(targetLangName);
        break;
      default:
        lines = buildTranslatePrompt(targetLangName, sourceClause, toneDesc);
        break;
    }

    if (mode.usesGlossary) {
      const glossaryClause = buildGlossaryClause(opts.glossary, opts.text);
      if (glossaryClause) lines = lines.concat(["", glossaryClause]);
    }

    return lines.join("\n");
  }

  // --------------------------------------------------------------------------
  // Response cache (LRU on chrome.storage.local)
  // --------------------------------------------------------------------------

  /** djb2 string hash, base36 encoded, used to keep cache keys short. */
  function hashString(str) {
    const value = String(str == null ? "" : str);
    let hash = 5381;

    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
    }

    return (hash >>> 0).toString(36);
  }

  function buildCacheKey(parts) {
    const p = parts || {};
    return [
      p.mode || "translate",
      p.targetLang || "-",
      p.sourceLang || "auto",
      p.tone || "-",
      p.model || "-",
      hashString(p.glossaryFingerprint || ""),
      String(p.text || "").length,
      hashString(p.text || "")
    ].join("|");
  }

  async function readCache() {
    const data = await getStorage([CACHE_STORAGE_KEY]);
    const cache = data[CACHE_STORAGE_KEY];
    return cache && typeof cache === "object" ? cache : {};
  }

  function writeCache(cache) {
    const patch = {};
    patch[CACHE_STORAGE_KEY] = cache;
    return setStorage(patch);
  }

  /** Returns a cached result and refreshes its recency stamp. */
  async function getCachedResult(key) {
    if (!key) return null;

    const cache = await readCache();
    const hit = cache[key];
    if (!hit || !hit.result) return null;

    // Throttle the recency touch: rewriting the whole cache on every hit is
    // expensive, and second-level precision is enough for LRU eviction.
    const now = Date.now();
    if (now - (hit.at || 0) > CACHE_TOUCH_INTERVAL) {
      hit.at = now;
      cache[key] = hit;
      writeCache(cache); // Intentionally not awaited.
    }

    return hit.result;
  }

  /** Stores a result and evicts the least recently used entries. */
  async function setCachedResult(key, result) {
    if (!key || !result) return;

    const cache = await readCache();
    cache[key] = { result: result, at: Date.now() };

    const keys = Object.keys(cache);
    if (keys.length > CACHE_LIMIT) {
      keys.sort(function (a, b) {
        return (cache[a].at || 0) - (cache[b].at || 0);
      });
      keys.slice(0, keys.length - CACHE_LIMIT).forEach(function (staleKey) {
        delete cache[staleKey];
      });
    }

    await writeCache(cache);
  }

  async function clearCache() {
    await writeCache({});
    return true;
  }

  async function getCacheStats() {
    const cache = await readCache();
    return { count: Object.keys(cache).length, limit: CACHE_LIMIT };
  }

  // --------------------------------------------------------------------------
  // History (single, shared schema)
  //   { id, source, result, sourceLang, targetLang, mode, timestamp }
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
        mode: MODES[item.mode] ? item.mode : "translate",
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
    const mode = MODES[entry && entry.mode] ? entry.mode : "translate";

    const item = {
      id: Date.now(),
      source: source,
      result: result,
      sourceLang: (entry && entry.sourceLang) || "auto",
      targetLang: (entry && entry.targetLang) || "fa",
      mode: mode,
      timestamp: new Date().toISOString()
    };

    // Drop an identical previous entry to avoid duplicates on re-run.
    const deduped = history.filter(function (existing) {
      return !(
        existing.source === item.source &&
        existing.targetLang === item.targetLang &&
        existing.mode === item.mode
      );
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

  /**
   * Filters history records by free-text query, target language and mode.
   * Pure function so the caller can filter an already loaded list.
   */
  function searchHistory(history, filters) {
    const list = Array.isArray(history) ? history : [];
    const f = filters || {};
    const query = String(f.query || "").trim().toLowerCase();

    return list.filter(function (item) {
      if (f.targetLang && item.targetLang !== f.targetLang) return false;
      if (f.mode && item.mode !== f.mode) return false;
      if (!query) return true;

      return (
        String(item.source || "").toLowerCase().indexOf(query) !== -1 ||
        String(item.result || "").toLowerCase().indexOf(query) !== -1
      );
    });
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
  // Backup: export / import glossary and history
  // --------------------------------------------------------------------------

  /** Collects the user's portable data into a single JSON-serialisable object. */
  async function exportAllData() {
    const results = await Promise.all([getGlossary(), getHistory()]);
    return {
      app: "gemini-ai-translator",
      schema: 1,
      exportedAt: new Date().toISOString(),
      glossary: results[0],
      history: results[1]
    };
  }

  /**
   * Imports glossary rows. With replace=false (default) they are merged ahead
   * of the existing rows; saveGlossary de-duplicates on the source term.
   */
  async function importGlossary(entries, replace) {
    const incoming = Array.isArray(entries) ? entries : [];
    const base = replace ? [] : await getGlossary();
    return saveGlossary(incoming.concat(base));
  }

  /** Imports history records, normalising them through saveToHistory's schema. */
  async function importHistory(items, replace) {
    const incoming = (Array.isArray(items) ? items : [])
      .filter(function (it) { return it && it.source && it.result; })
      .map(function (it, index) {
        return {
          id: it.id != null ? it.id : Date.now() + index,
          source: String(it.source),
          result: String(it.result),
          sourceLang: it.sourceLang || "auto",
          targetLang: it.targetLang || it.targetL || "fa",
          mode: MODES[it.mode] ? it.mode : "translate",
          timestamp: it.timestamp || new Date().toISOString()
        };
      });

    const base = replace ? [] : await getHistory();
    const merged = incoming.concat(base).slice(0, HISTORY_LIMIT);
    await setStorage({ history: merged });
    return merged;
  }

  // --------------------------------------------------------------------------
  // Gemini streaming request
  // --------------------------------------------------------------------------

  function missingApiKeyError() {
    const err = new Error(
      "کلید API گوگل تنظیم نشده است. لطفاً از صفحه تنظیمات (⚙️) کلید خود را وارد کنید."
    );
    err.code = "MISSING_API_KEY";
    return err;
  }

  function sleep(ms, signal) {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener("abort", function () {
          clearTimeout(timer);
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        }, { once: true });
      }
    });
  }

  /** Transient statuses worth a retry (rate limit + server-side errors). */
  function isRetriableStatus(status) {
    return status === 429 || (status >= 500 && status <= 599);
  }

  /** Reads a Gemini error response and maps it to a localized Error. */
  async function toApiError(response) {
    const errJson = await response.json().catch(function () { return {}; });
    const errMsg =
      (errJson && errJson.error && errJson.error.message) || response.statusText;

    if (response.status === 400 || response.status === 403) {
      const authErr = new Error("کلید API نامعتبر یا فاقد دسترسی است (" + response.status + "): " + errMsg);
      authErr.code = "AUTH";
      return authErr;
    }
    if (response.status === 429) {
      return new Error("محدودیت تعداد درخواست‌ها. کمی صبر کنید و دوباره تلاش کنید.");
    }
    return new Error("خطای API (" + response.status + "): " + errMsg);
  }

  /**
   * Runs an AI action against the Gemini API with live streaming.
   *
   * @param {Object}   options
   * @param {string}   options.text          Input text (required).
   * @param {string}  [options.mode]         One of MODES, "translate" by default.
   * @param {string}  [options.targetLang]   Output language code.
   * @param {string}  [options.sourceLang]   Input language code, "auto" by default.
   * @param {string}  [options.tone]         Tone key.
   * @param {Object}  [options.settings]     Pre-loaded settings; fetched when omitted.
   * @param {Array}   [options.glossary]     Glossary entries; loaded when omitted.
   * @param {boolean} [options.forceRefresh] Bypass the cache and re-query the model.
   * @param {AbortSignal} [options.signal]
   * @param {Function}[options.onChunk]      Called with the sanitized text so far.
   * @param {Function}[options.onCacheHit]   Called instead of streaming on a cache hit.
   * @returns {Promise<string>} The final sanitized output.
   */
  async function runAction(options) {
    const opts = options || {};
    const text = (opts.text || "").trim();
    if (!text) return "";

    const mode = getMode(opts.mode);
    const settings = opts.settings || (await getSettings());

    const model = settings.selectedModel || DEFAULT_MODEL;
    const targetLang = opts.targetLang || settings.defaultTargetLang || "fa";
    const sourceLang = opts.sourceLang || "auto";
    const tone = opts.tone || settings.defaultTone || "general";

    const glossary = mode.usesGlossary
      ? (opts.glossary !== undefined ? opts.glossary : await getGlossary())
      : [];

    const cacheKey = buildCacheKey({
      mode: mode.id,
      targetLang: mode.usesTarget ? targetLang : "-",
      sourceLang: sourceLang,
      tone: mode.usesTone ? tone : "-",
      model: model,
      glossaryFingerprint: glossaryFingerprint(glossary),
      text: text
    });

    const cacheEnabled =
      settings.enableCache !== false && mode.cacheable && !opts.forceRefresh;

    // Serving from cache costs no quota and needs no network round trip.
    if (cacheEnabled) {
      const cached = await getCachedResult(cacheKey);
      if (cached) {
        if (typeof opts.onCacheHit === "function") opts.onCacheHit(cached);
        if (typeof opts.onChunk === "function") opts.onChunk(cached);
        return cached;
      }
    }

    const apiKey = settings.apiKey && String(settings.apiKey).trim();
    if (!apiKey) throw missingApiKeyError();

    const baseUrl = resolveBaseUrl(settings.customProxyUrl);
    const url =
      baseUrl +
      "/v1beta/models/" +
      encodeURIComponent(model) +
      ":streamGenerateContent?alt=sse&key=" +
      encodeURIComponent(apiKey);

    const systemPrompt = buildSystemPrompt({
      mode: mode.id,
      targetLang: targetLang,
      sourceLang: sourceLang,
      tone: tone,
      glossary: glossary,
      text: text
    });

    const maxOutputTokens = Number(settings.maxOutputTokens) > 0
      ? Number(settings.maxOutputTokens)
      : DEFAULT_MAX_OUTPUT_TOKENS;
    const temperature = settings.temperature != null && settings.temperature !== ""
      ? Number(settings.temperature)
      : DEFAULT_TEMPERATURE;

    const requestBody = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt + "\n\n" + mode.inputLabel + ":\n" + text }
          ]
        }
      ],
      generationConfig: { temperature: temperature, maxOutputTokens: maxOutputTokens }
    });

    // Retry transient failures (network hiccups, 429, 5xx) with backoff.
    let response = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
          signal: opts.signal
        });
      } catch (networkError) {
        if (networkError && networkError.name === "AbortError") throw networkError;
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt), opts.signal);
          continue;
        }
        throw new Error(
          "اتصال به سرور برقرار نشد. اینترنت، فیلترشکن یا آدرس پرکسی خود را بررسی کنید."
        );
      }

      if (response.ok) break;

      if (isRetriableStatus(response.status) && attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt), opts.signal);
        continue;
      }
      throw await toApiError(response);
    }

    if (!response || !response.body) throw new Error("پاسخ استریم از سرور دریافت نشد.");

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
          opts.onChunk(sanitizeModelOutput(full, mode.id));
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

    const result = sanitizeModelOutput(full, mode.id);

    if (result && mode.cacheable && settings.enableCache !== false) {
      await setCachedResult(cacheKey, result);
    }

    return result;
  }

  /** Backwards-compatible alias: runs the "translate" action. */
  function streamTranslation(options) {
    const opts = options || {};
    if (!opts.mode) opts.mode = "translate";
    return runAction(opts);
  }

  // --------------------------------------------------------------------------
  // Non-streaming single call (used by batch page translation)
  // --------------------------------------------------------------------------

  async function generateOnce(config) {
    const cfg = config || {};
    const settings = cfg.settings || (await getSettings());
    const apiKey = settings.apiKey && String(settings.apiKey).trim();
    if (!apiKey) throw missingApiKeyError();

    const model = settings.selectedModel || DEFAULT_MODEL;
    const baseUrl = resolveBaseUrl(settings.customProxyUrl);
    const url = baseUrl + "/v1beta/models/" + encodeURIComponent(model) +
      ":generateContent?key=" + encodeURIComponent(apiKey);

    const maxOutputTokens = Number(settings.maxOutputTokens) > 0
      ? Number(settings.maxOutputTokens) : DEFAULT_MAX_OUTPUT_TOKENS;
    const temperature = cfg.temperature != null ? cfg.temperature
      : (settings.temperature != null && settings.temperature !== ""
        ? Number(settings.temperature) : DEFAULT_TEMPERATURE);

    const body = JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: (cfg.systemPrompt ? cfg.systemPrompt + "\n\n" : "") + (cfg.userText || "") }]
      }],
      generationConfig: { temperature: temperature, maxOutputTokens: maxOutputTokens }
    });

    let response = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          signal: cfg.signal
        });
      } catch (networkError) {
        if (networkError && networkError.name === "AbortError") throw networkError;
        if (attempt < MAX_RETRIES) { await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt), cfg.signal); continue; }
        throw new Error("اتصال به سرور برقرار نشد. اینترنت، فیلترشکن یا آدرس پرکسی خود را بررسی کنید.");
      }
      if (response.ok) break;
      if (isRetriableStatus(response.status) && attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt), cfg.signal); continue;
      }
      throw await toApiError(response);
    }

    const data = await response.json().catch(function () { return {}; });
    const candidate = data && data.candidates && data.candidates[0];
    const parts = candidate && candidate.content && candidate.content.parts;
    return (parts || []).map(function (p) { return (p && p.text) || ""; }).join("");
  }

  // --------------------------------------------------------------------------
  // Batch page translation
  //
  // Segments are sent in numbered batches; the model echoes @@N@@ markers so
  // each translation can be aligned back to its source node. A batch that
  // fails or comes back malformed leaves its originals untouched.
  // --------------------------------------------------------------------------

  const PAGE_BATCH_MAX_SEGMENTS = 40;
  const PAGE_BATCH_MAX_CHARS = 2400;

  function chunkSegments(segments) {
    const chunks = [];
    let current = [];
    let chars = 0;

    (segments || []).forEach(function (seg, i) {
      const len = String(seg == null ? "" : seg).length;
      if (current.length &&
          (current.length >= PAGE_BATCH_MAX_SEGMENTS || chars + len > PAGE_BATCH_MAX_CHARS)) {
        chunks.push(current);
        current = [];
        chars = 0;
      }
      current.push({ index: i, text: seg });
      chars += len;
    });

    if (current.length) chunks.push(current);
    return chunks;
  }

  function parseMarkedOutput(output) {
    const map = {};
    const parts = String(output || "").split(/@@(\d+)@@/);
    for (let i = 1; i < parts.length; i += 2) {
      const idx = parseInt(parts[i], 10);
      const val = String(parts[i + 1] || "").replace(/^\r?\n/, "").trim();
      if (!isNaN(idx)) map[idx] = val;
    }
    return map;
  }

  /**
   * Translates an array of text segments in numbered batches.
   *
   * @param {string[]} segments
   * @param {Object}   opts  { targetLang, settings, glossary, signal, onProgress }
   * @returns {Promise<string[]>} translations aligned to `segments`; a failed
   *          batch yields the original text for its segments.
   */
  async function translatePageSegments(segments, opts) {
    const o = opts || {};
    const list = Array.isArray(segments) ? segments : [];
    const settings = o.settings || (await getSettings());
    const targetLangName = LANG_NAMES[o.targetLang] || o.targetLang || "Persian";
    const glossary = o.glossary || (await getGlossary());

    const results = list.slice(); // Untranslated fallback per segment.
    const chunks = chunkSegments(list);
    let done = 0;

    for (let c = 0; c < chunks.length; c += 1) {
      if (o.signal && o.signal.aborted) break;
      const chunk = chunks[c];

      const glossaryClause = buildGlossaryClause(
        glossary, chunk.map(function (s) { return s.text; }).join("\n")
      );

      const sys = [
        "You are a precise translator. Translate each numbered segment into " + targetLangName + ".",
        "Each segment starts with a marker line of the exact form @@N@@ where N is a number.",
        "Return EVERY marker in the SAME order, each on its own line, immediately followed by ONLY that segment's translation.",
        "Never merge, reorder, drop or renumber segments. Never add commentary, extra markers or code fences.",
        "Preserve inline punctuation. For brand/proper names, keep them readable and add the original in parentheses on first use.",
        glossaryClause
      ].filter(Boolean).join("\n");

      const userText = chunk.map(function (s) {
        return "@@" + s.index + "@@\n" + String(s.text == null ? "" : s.text);
      }).join("\n");

      try {
        const raw = await generateOnce({ settings: settings, systemPrompt: sys, userText: userText, signal: o.signal });
        const map = parseMarkedOutput(raw);
        chunk.forEach(function (s) {
          if (map[s.index] != null && map[s.index] !== "") results[s.index] = map[s.index];
        });
      } catch (err) {
        // Auth/config failures are not transient: stop and surface them.
        if (err && (err.name === "AbortError" || err.code === "MISSING_API_KEY" || err.code === "AUTH")) {
          throw err;
        }
        // Transient/parse failure: keep this chunk's originals and continue.
      }

      done += chunk.length;
      if (typeof o.onProgress === "function") {
        o.onProgress(Math.min(done, list.length), list.length);
      }
    }

    return results;
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
    MODES: MODES,
    MODE_ORDER: MODE_ORDER,
    DEFAULT_BASE_URL: DEFAULT_BASE_URL,
    DEFAULT_MODEL: DEFAULT_MODEL,
    HISTORY_LIMIT: HISTORY_LIMIT,
    CACHE_LIMIT: CACHE_LIMIT,
    GLOSSARY_LIMIT: GLOSSARY_LIMIT,
    DEFAULT_MAX_OUTPUT_TOKENS: DEFAULT_MAX_OUTPUT_TOKENS,
    DEFAULT_TEMPERATURE: DEFAULT_TEMPERATURE,

    // Text helpers
    detectTextDirection: detectTextDirection,
    applyTextDirection: applyTextDirection,
    sanitizeTranslationText: sanitizeTranslationText,
    sanitizeModelOutput: sanitizeModelOutput,
    escapeHtml: escapeHtml,
    renderRichText: renderRichText,
    truncate: truncate,
    isSingleWord: isSingleWord,
    getTtsLangTag: getTtsLangTag,
    resolveBaseUrl: resolveBaseUrl,
    buildLangOptions: buildLangOptions,
    buildModeOptions: buildModeOptions,
    getMode: getMode,
    buildSystemPrompt: buildSystemPrompt,

    // Theme
    resolveTheme: resolveTheme,
    applyTheme: applyTheme,
    getStoredTheme: getStoredTheme,

    // Storage
    getStorage: getStorage,
    setStorage: setStorage,
    getSettings: getSettings,

    // Glossary
    getGlossary: getGlossary,
    saveGlossary: saveGlossary,

    // Cache
    buildCacheKey: buildCacheKey,
    getCachedResult: getCachedResult,
    setCachedResult: setCachedResult,
    clearCache: clearCache,
    getCacheStats: getCacheStats,

    // History
    getHistory: getHistory,
    saveToHistory: saveToHistory,
    deleteHistoryItem: deleteHistoryItem,
    clearHistory: clearHistory,
    searchHistory: searchHistory,
    formatHistoryTime: formatHistoryTime,

    // Backup
    exportAllData: exportAllData,
    importGlossary: importGlossary,
    importHistory: importHistory,

    // API
    runAction: runAction,
    streamTranslation: streamTranslation,
    generateOnce: generateOnce,
    translatePageSegments: translatePageSegments
  };
})(typeof self !== "undefined" ? self : window);
