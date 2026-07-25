<div align="center">
  <img src="icon128.png" width="96" height="96" alt="Gemini AI Translator icon" />
  <h1>✨ Gemini AI Translator</h1>
  <p><strong>A fast, privacy-conscious AI language assistant for Chrome.</strong></p>
  <p><strong>دستیار سریع و هوشمند ترجمه و پردازش متن برای کروم</strong></p>

  [![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](manifest.json)
  [![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=111)](src/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)](LICENSE)
  [![Version](https://img.shields.io/badge/version-1.2.1-8B5CF6)](docs/CHANGELOG.md)

  **[🇬🇧 English](#-english) · [🇮🇷 فارسی](#-فارسی)**
</div>

---

# 🇬🇧 English

## 🚀 Overview

**Gemini AI Translator** brings Google Gemini language tools directly to every webpage. Select text to open a compact floating assistant, enter text manually in the popup, use the context menu, or run an action with a keyboard shortcut.

The extension is built with plain JavaScript and has no build step or runtime dependencies.

## ✨ Features

- ⚡ Live streamed Gemini responses
- 🪟 Draggable floating assistant for selected text
- 🧠 Six AI modes in one extension
- 📖 Automatic dictionary mode for a single word
- 🌍 14 target languages with automatic source detection
- 🎭 General, formal, informal, and technical tones
- 📒 Custom glossary with preferred exact translations
- 🚄 Local LRU response cache with a cache-hit badge
- 🔎 Searchable history with mode filters and per-item deletion
- ⏹️ Stream cancellation while preserving partial output
- 🔊 Text-to-speech and one-click copy
- 🖱️ Context-menu action and global shortcuts
- ↔️ Correct mixed RTL/LTR rendering for Persian, Arabic, English, code, names, and examples
- 🌐 Optional reverse-proxy endpoint

## 🧩 AI modes

| Mode | Purpose | Target language | Tone | Cache |
| --- | --- | :---: | :---: | :---: |
| ✨ Translate | Accurate, natural translation | ✅ | ✅ | ✅ |
| 📖 Dictionary | Pronunciation, word class, meanings, synonyms, and examples | ✅ | — | ✅ |
| 📝 Summarize | Main idea and concise key points | ✅ | ✅ | ✅ |
| ✅ Grammar | Correct spelling, grammar, and punctuation in the same language | — | — | ✅ |
| 🪄 Rewrite | Improve clarity and fluency in the same language | — | ✅ | — |
| 💡 Explain | Explain complex text in simple language | ✅ | — | ✅ |

## 📦 Installation

1. Download the repository or clone it:
   ```bash
   git clone https://github.com/AriaRazavi2005/EX_Translator_Gemini.git
   ```
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository root—the directory containing `manifest.json`.
6. Open extension settings and add a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

> After updating the source, click **Reload** in `chrome://extensions` and refresh already-open tabs.

## 🎯 Usage

- Select text on a webpage and click the floating button.
- Right-click selected text and choose the Gemini action.
- Open the popup to process manually entered text.
- Configure the default mode, language, tone, glossary, cache, and proxy from the settings page.

## ⌨️ Shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt + T` | Process the current page selection |
| `Alt + Shift + T` | Open the extension popup |
| `Ctrl/Cmd + Enter` | Run the selected popup action |
| `Esc` | Stop the active request or close the interface |

Customize shortcuts at `chrome://extensions/shortcuts`.

## 🔐 Privacy & permissions

- 🔑 API keys and extension data are stored in `chrome.storage.local`.
- ☁️ Requests go directly to Google's Gemini API unless a custom proxy is configured.
- 🧩 `activeTab` and `scripting` read the active selection and inject the assistant when required.
- 🌍 `<all_urls>` allows the selection assistant to work across webpages and supports a user-defined proxy.

Never commit an API key, token, or private proxy address. See [Security Policy](.github/SECURITY.md) for responsible disclosure.

## 🗂️ Project structure

```text
.
├── .github/                   # Community, security, issue and PR files
├── docs/
│   └── CHANGELOG.md           # Release history
├── _locales/                  # Chrome localization (root requirement)
├── src/
│   ├── background/            # Manifest V3 service worker
│   ├── content/               # In-page floating assistant
│   ├── options/               # Settings and glossary UI
│   ├── popup/                 # Extension popup
│   └── shared/                # API, prompts, cache, history, languages
├── icon16.png                 # Chrome extension icons
├── icon48.png
├── icon128.png
├── manifest.json              # Chrome manifest (root requirement)
├── LICENSE
└── README.md
```

`src/shared/shared.js` must load before the content, popup, and options scripts. It is the single source of truth for language metadata, AI prompts, API streaming, cache, glossary, history, and shared helpers.

## 🧑‍💻 Development

No package manager or build command is required:

1. Edit files under `src/`.
2. Reload the unpacked extension.
3. Refresh the test page.
4. Test Persian, English, and mixed-direction dictionary output.

Please read the [contribution guide](.github/CONTRIBUTING.md) before opening a pull request.

---

# 🇮🇷 فارسی

## 🚀 معرفی

**Gemini AI Translator** ابزارهای زبانی Google Gemini را مستقیماً به صفحات وب اضافه می‌کند. می‌توانید متن را انتخاب کنید و پنجره شناور را باز کنید، متن را دستی داخل پاپ‌آپ وارد کنید، از منوی راست‌کلیک استفاده کنید یا درخواست را با میانبر صفحه‌کلید اجرا کنید.

این افزونه با JavaScript خالص ساخته شده و به مرحله build یا وابستگی زمان اجرا نیاز ندارد.

## ✨ امکانات

- ⚡ نمایش زنده پاسخ Gemini
- 🪟 پنجره شناور و قابل جابه‌جایی برای متن انتخاب‌شده
- 🧠 شش عملکرد هوش مصنوعی در یک افزونه
- 📖 فعال شدن خودکار دیکشنری برای تک‌کلمه
- 🌍 پشتیبانی از ۱۴ زبان مقصد و تشخیص زبان مبدأ
- 🎭 لحن عمومی، رسمی، صمیمانه و تخصصی
- 📒 واژه‌نامه اختصاصی برای تعیین معادل‌های دقیق
- 🚄 حافظه محلی LRU با نشان پاسخ ذخیره‌شده
- 🔎 تاریخچه قابل جست‌وجو با فیلتر عملکرد و حذف تک‌موردی
- ⏹️ توقف پاسخ بدون حذف متن تولیدشده
- 🔊 خوانش صوتی و کپی سریع
- 🖱️ منوی راست‌کلیک و میانبرهای صفحه‌کلید
- ↔️ نمایش صحیح متن ترکیبی فارسی، عربی، انگلیسی، نام‌ها و کد
- 🌐 پشتیبانی از پروکسی اختیاری

## 🧩 حالت‌های هوش مصنوعی

| حالت | کاربرد | زبان مقصد | لحن | حافظه |
| --- | --- | :---: | :---: | :---: |
| ✨ ترجمه | ترجمه دقیق و روان | ✅ | ✅ | ✅ |
| 📖 دیکشنری | تلفظ، نوع کلمه، معنی، مترادف و مثال | ✅ | — | ✅ |
| 📝 خلاصه | ایده اصلی و نکات کلیدی | ✅ | ✅ | ✅ |
| ✅ اصلاح گرامر | اصلاح املا، دستور و نشانه‌گذاری در همان زبان | — | — | ✅ |
| 🪄 بازنویسی | روان‌تر و شفاف‌تر کردن متن در همان زبان | — | ✅ | — |
| 💡 توضیح ساده | توضیح متن پیچیده با زبان ساده | ✅ | — | ✅ |

## 📦 نصب

1. مخزن را دانلود یا clone کنید:
   ```bash
   git clone https://github.com/AriaRazavi2005/EX_Translator_Gemini.git
   ```
2. نشانی `chrome://extensions` را باز کنید.
3. گزینه **Developer mode** را فعال کنید.
4. روی **Load unpacked** بزنید.
5. پوشه اصلی مخزن، یعنی پوشه دارای `manifest.json`، را انتخاب کنید.
6. وارد تنظیمات شوید و کلید ساخته‌شده در [Google AI Studio](https://aistudio.google.com/apikey) را وارد کنید.

> بعد از دریافت نسخه جدید، افزونه را Reload و تب‌های باز را Refresh کنید.

## 🎯 روش استفاده

- متن صفحه را انتخاب و روی دکمه شناور کلیک کنید.
- روی متن انتخاب‌شده راست‌کلیک کنید.
- برای ورود دستی متن، پاپ‌آپ افزونه را باز کنید.
- عملکرد پیش‌فرض، زبان، لحن، واژه‌نامه، حافظه و پروکسی را از تنظیمات تغییر دهید.

## ⌨️ میانبرها

| میانبر | عملکرد |
| --- | --- |
| `Alt + T` | پردازش متن انتخاب‌شده در صفحه |
| `Alt + Shift + T` | باز کردن پاپ‌آپ افزونه |
| `Ctrl/Cmd + Enter` | اجرای درخواست انتخاب‌شده |
| `Esc` | توقف درخواست فعال یا بستن رابط |

میانبرها از `chrome://extensions/shortcuts` قابل تغییرند.

## 🔐 حریم خصوصی و مجوزها

- 🔑 کلید API و داده‌های افزونه در `chrome.storage.local` ذخیره می‌شوند.
- ☁️ درخواست‌ها مستقیماً به API گوگل ارسال می‌شوند، مگر اینکه پروکسی اختصاصی تنظیم شده باشد.
- 🧩 مجوزهای `activeTab` و `scripting` برای خواندن متن انتخاب‌شده و نمایش دستیار استفاده می‌شوند.
- 🌍 دسترسی `<all_urls>` برای فعالیت دستیار در صفحات وب و پشتیبانی از پروکسی انتخابی لازم است.

کلید API یا اطلاعات خصوصی را داخل مخزن commit نکنید. برای گزارش آسیب‌پذیری، [سیاست امنیتی](.github/SECURITY.md) را بخوانید.

## 🧑‍💻 توسعه و مشارکت

1. فایل‌های داخل `src/` را ویرایش کنید.
2. افزونه unpacked را دوباره بارگذاری کنید.
3. صفحه آزمایش را refresh کنید.
4. خروجی فارسی، انگلیسی و ترکیبی دیکشنری را بررسی کنید.

پیش از ارسال Pull Request، [راهنمای مشارکت](.github/CONTRIBUTING.md) را مطالعه کنید.

---

## 📄 License / مجوز

Released under the [MIT License](LICENSE).  
این پروژه با مجوز [MIT](LICENSE) منتشر شده است.
