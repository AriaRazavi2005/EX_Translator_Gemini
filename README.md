# ✦ Gemini AI Translator - Chrome Extension 🚀

[![Chrome Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue.svg?style=for-the-badge&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Google Gemini API](https://img.shields.io/badge/AI_Engine-Google_Gemini_API-8E75B2.svg?style=for-the-badge&logo=googlegemini)](https://ai.google.dev/)
[![Version](https://img.shields.io/badge/Version-1.1.0-6366f1.svg?style=for-the-badge)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![JavaScript](https://img.shields.io/badge/Built_With-JavaScript-F7DF1E.svg?style=for-the-badge&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

A state-of-the-art, lightning-fast, and ultra-sleek **Google Chrome Extension (Manifest V3)** for instant, precise, and intelligent text translation powered by **Google Gemini AI**. Featuring real-time Server-Sent Events (SSE) response streaming, Glassmorphic UI design, resizable text boxes, proper noun preservation rules, and custom reverse-proxy / Cloudflare Worker anti-sanction bypass.

> 📄 See the [CHANGELOG](CHANGELOG.md) for what changed in **v1.1.0**.

---

## 📑 Table of Contents
- [✨ Features](#-features)
- [⌨️ Keyboard Shortcuts](#️-keyboard-shortcuts)
- [🌍 Supported Languages](#-supported-languages)
- [🛠️ Architecture & File Structure](#️-architecture--file-structure)
- [🧩 The Shared Module](#-the-shared-module)
- [📥 Installation Guide](#-installation-guide)
- [🔑 How to Get a Free Gemini API Key](#-how-to-get-a-free-gemini-api-key)
- [🛡️ Anti-Sanction & Bypass Proxy Setup (Cloudflare Worker)](#️-anti-sanction--bypass-proxy-setup-cloudflare-worker)
- [🇮🇷 راهنمای فارسی (Persian Summary)](#-راهنمای-فارسی-persian-summary)
- [📜 License](#-license)

---

## ✨ Features

- **✦ Smart On-Page Selection Tooltip**: Highlight any text on any website to reveal a sleek floating trigger button (`✦ Translate`). Clicking it opens a draggable Glassmorphic translation widget right over the page.
- **⚡ Real-Time Streaming Output (SSE)**: Streams translations word-by-word via Server-Sent Events for zero-latency feedback. Chunk parsing is buffered, so a payload split across two network packets never drops text.
- **⌨️ Keyboard Shortcut**: Press `Ctrl + Enter` (or `Cmd + Enter` on macOS) inside the popup textarea to translate without reaching for the mouse.
- **🌍 14 Target Languages**: Persian, English, Arabic, French, German, Spanish, Italian, Russian, Turkish, Chinese, Japanese, Korean, Hindi and Portuguese.
- **🔁 Auto Re-Translate**: Changing the target language or tone in the floating widget instantly re-runs the translation.
- **🏷️ Proper Nouns Preservation Rule**: Intelligently translates text while retaining original English terms for company names, brands, technologies, or people in parentheses (e.g. `گوگل (Google)`, `پایتون (Python)`, `مایکروسافت (Microsoft)`).
- **📐 Resizable Text Area**: Both input and output translation boxes are vertically resizable (`resize: vertical`), preventing clipping or awkward scrollbars on long articles and code snippets.
- **📜 Instant Webpage & Popup History**: Access your last 50 translations anytime from either the browser popup or the floating widget drawer directly on any webpage.
- **🗑️ Per-Item History Delete**: Remove a single history record from either the popup list or the in-page drawer — no need to wipe everything.
- **🔊 Text-to-Speech (TTS)**: Built-in high-quality voice playback with a correct BCP-47 tag for every supported language.
- **🎭 Multi-Tone Adaptation**: Choose between General, Formal/Executive, Informal/Conversational, or Technical/Scientific translation tones.
- **🤖 Live Dynamic Model Fetching**: Query Google's `/v1beta/models` REST endpoint live from the Options page to dynamically load and select available Gemini models.
- **🛡️ Custom Reverse Proxy / Anti-Sanction Support**: Easily configure a custom reverse proxy URL (such as a free Cloudflare Worker) to bypass region blocks or network sanctions seamlessly without needing a VPN.
- **🖱️ Context Menu Integration**: Right-click any selected text to immediately trigger `Translate with Gemini AI ✦`.
- **🧩 Zero Duplication**: All translation, history and formatting logic lives in a single shared module consumed by the popup, the options page and the content script.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Context | Action |
| --- | --- | --- |
| `Ctrl + Enter` / `Cmd + Enter` | Popup textarea | Start the translation |
| `Esc` | Floating widget on a web page | Close the widget and abort the request |

---

## 🌍 Supported Languages

| Code | Language | TTS tag |
| --- | --- | --- |
| `fa` | Persian — فارسی | `fa-IR` |
| `en` | English | `en-US` |
| `ar` | Arabic — العربية | `ar-SA` |
| `fr` | French — Français | `fr-FR` |
| `de` | German — Deutsch | `de-DE` |
| `es` | Spanish — Español | `es-ES` |
| `it` | Italian — Italiano | `it-IT` |
| `ru` | Russian — Русский | `ru-RU` |
| `tr` | Turkish — Türkçe | `tr-TR` |
| `zh` | Chinese — 中文 | `zh-CN` |
| `ja` | Japanese — 日本語 | `ja-JP` |
| `ko` | Korean — 한국어 | `ko-KR` |
| `hi` | Hindi — हिन्दी | `hi-IN` |
| `pt` | Portuguese — Português | `pt-BR` |

The source-language selector additionally offers `auto` (automatic detection).

---

## 🛠️ Architecture & File Structure

```text
EX_Translator_Gemini/
├── manifest.json         # Manifest V3 extension configuration & permissions
├── shared.js             # 🆕 Shared module: languages, prompts, SSE streaming, history helpers
├── background.js         # Service Worker handling context menu & storage defaults
├── content.js            # Injected web content script (floating tooltip, widget, drawer)
├── content.css           # Glassmorphism UI stylesheet with Vazirmatn Persian typography
├── popup.html            # Main extension popup interface layout
├── popup.js              # Popup controller (manual input, history, TTS, language switcher)
├── popup.css             # Popup window styling & resizable containers
├── options.html          # Options page (API key, model list, proxy settings, Cloudflare guide)
├── options.js            # Dynamic API key verification & live model fetch controller
├── options.css           # Options page Glassmorphism layout
├── _locales/en/          # Extension localization strings
├── icon16/48/128.png     # Extension PNG brand assets
├── CHANGELOG.md          # 🆕 Release history
├── README.md             # Comprehensive project documentation
└── .gitignore            # Git version control ignore rules
```

> ⚠️ **Load order matters.** `shared.js` must always be loaded *before* `popup.js`, `options.js` and `content.js`. This is enforced by the `content_scripts.js` array in `manifest.json`, by the `<script>` order in the HTML pages, and by `CONTENT_SCRIPT_FILES` in `background.js`.

---

## 🧩 The Shared Module

`shared.js` exposes a single global namespace, `window.GTShared`, and is safe to inject more than once.

| Export | Purpose |
| --- | --- |
| `LANG_NAMES`, `LANG_LABELS`, `TARGET_LANG_CODES`, `SOURCE_LANG_CODES` | Language metadata for prompts and UI dropdowns |
| `TTS_LANG_TAGS`, `getTtsLangTag()` | Speech-synthesis language mapping |
| `TONE_PROMPTS`, `buildSystemPrompt()` | Tone descriptions and full system-prompt construction |
| `streamTranslation()` | Buffered SSE streaming request against the Gemini API |
| `getHistory()`, `saveToHistory()`, `deleteHistoryItem()`, `clearHistory()` | History CRUD on a single unified schema |
| `detectTextDirection()`, `applyTextDirection()` | RTL/LTR detection and application |
| `sanitizeTranslationText()`, `escapeHtml()`, `truncate()` | Output cleanup and safe rendering |
| `resolveBaseUrl()` | Normalizes the optional reverse-proxy endpoint |
| `getSettings()`, `getStorage()`, `setStorage()` | Promise-based `chrome.storage.local` wrappers |

### History record schema

```json
{
  "id": 1735138800000,
  "source": "Hello world",
  "result": "سلام دنیا",
  "sourceLang": "auto",
  "targetLang": "fa",
  "timestamp": "2026-07-25T09:00:00.000Z"
}
```

Legacy records written by older versions (which used `targetL` and `time`) are migrated transparently on read.

---

## 📥 Installation Guide

1. Clone or download this repository:
   ```bash
   git clone https://github.com/AriaRazavi2005/EX_Translator_Gemini.git
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** and select the `EX_Translator_Gemini` folder.
5. Click the extension icon or open **Options (⚙️ Settings)** to enter your Google Gemini API Key.

---

## 🔑 How to Get a Free Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account and click **Get API Key**.
3. Create a new API key and copy it into the extension **Options** page.
4. Click **🔄 Test Connection & Fetch Online Models** to verify your key and auto-detect available models.

---

## 🛡️ Anti-Sanction & Bypass Proxy Setup (Cloudflare Worker)

If you live in a region where Google AI Studio API is restricted or blocked, you can route requests through a free **Cloudflare Worker** reverse proxy in 1 minute without needing any local VPN:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages**.
2. Click **Create Worker** and paste the following snippet:

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'generativelanguage.googleapis.com';
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    return fetch(modifiedRequest);
  }
};
```

3. Deploy the worker and copy your new Worker URL (e.g. `https://my-gemini-proxy.subdomain.workers.dev`).
4. Paste this URL into the **Reverse Proxy Endpoint** field in the extension **Options** page!

---

## 🇮🇷 راهنمای فارسی (Persian Summary)

اکستنشن کروم **Gemini AI Translator** یک ابزار حرفه‌ای و مدرن برای ترجمه فوری متون با مدل‌های هوش مصنوعی گوگل Gemini است.

### امکانات برجسته:
- **پاپ‌آپ شناور شیشه‌ای روی صفحات وب (Glassmorphic Tooltip)**
- **استریم زنده پاسخ (Server-Sent Events)**
- **میانبر کیبورد `Ctrl + Enter` برای شروع سریع ترجمه**
- **پشتیبانی از ۱۴ زبان مقصد**
- **حفظ نام‌های خاص و برندها در پرانتز انگلیسی (مانند: گوگل (Google))**
- **باکس‌های قابل تغییر اندازه در هر دو حالت پاپ‌آپ و درون صفحه**
- **کشوی تاریخچه ترجمه‌ها به همراه امکان حذف تک‌تک موارد**
- **پشتیبانی از ریورس پرکسی و Cloudflare Worker برای دور زدن تحریم‌ها بدون نیاز به فیلترشکن**

---

## 📜 License

This project is licensed under the [MIT License](LICENSE) - feel free to use, modify, and distribute as desired.
