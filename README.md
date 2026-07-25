<div align="center">
  <img src="icon128.png" width="96" height="96" alt="Gemini AI Translator icon" />
  <h1>Gemini AI Translator</h1>
  <p>A fast, privacy-conscious Chrome extension for translating and transforming selected text with Google Gemini.</p>
  <p><strong>ترجمه و پردازش سریع متن با Google Gemini، مستقیم داخل مرورگر</strong></p>

  [![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](manifest.json)
  [![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=111)](src/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
  [![Version](https://img.shields.io/badge/version-1.2.1-8B5CF6)](CHANGELOG.md)

  **[English](#english) · [فارسی](#فارسی)**
</div>

---

## English

### Overview

Gemini AI Translator is a dependency-free Chrome extension that brings Gemini-powered language tools to any webpage. Select text to open a compact floating assistant, use the popup for manual input, or trigger translation with a keyboard shortcut.

The extension communicates directly with the Gemini API. Your API key, settings, glossary, history, and response cache remain in Chrome local storage.

### Features

- Live streamed responses from the Gemini API
- Floating, draggable assistant for selected text
- Six AI actions: translation, dictionary, summarization, grammar correction, rewriting, and simple explanation
- Automatic dictionary mode for a single selected word
- 14 target languages and automatic source-language detection
- General, formal, informal, and technical tones
- Custom glossary with exact preferred translations
- Local LRU response cache with manual clearing and cache-hit indicator
- Searchable history with mode filters and per-item deletion
- Stop/cancel button that preserves partial streamed output
- Text-to-speech, copy, context-menu action, and keyboard shortcuts
- Mixed RTL/LTR rendering for Persian, Arabic, English, code, names, and examples
- Optional reverse-proxy endpoint

### AI modes

| Mode | Purpose | Target language | Tone | Cached |
| --- | --- | :---: | :---: | :---: |
| Translate | Accurate, natural translation | Yes | Yes | Yes |
| Dictionary | Pronunciation, part of speech, meanings, synonyms, examples | Yes | No | Yes |
| Summarize | Main idea and concise key points | Yes | Yes | Yes |
| Grammar | Correct spelling, grammar, and punctuation in the same language | No | No | Yes |
| Rewrite | Improve clarity and fluency in the same language | No | Yes | No |
| Explain | Explain complex text in simple language | Yes | No | Yes |

### Installation

1. Download or clone this repository:
   ```bash
   git clone https://github.com/AriaRazavi2005/EX_Translator_Gemini.git
   ```
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the repository root (the folder containing `manifest.json`).
5. Open the extension settings, add a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey), and verify it.

After pulling an update, click **Reload** on `chrome://extensions` and refresh already-open tabs.

### Usage

- Select text on a webpage and click the floating button.
- Right-click selected text and choose the Gemini action.
- Open the extension popup to enter text manually.
- Configure the default mode, language, tone, glossary, cache, and proxy from the settings page.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt + T` | Process the current page selection |
| `Alt + Shift + T` | Open the extension popup |
| `Ctrl/Cmd + Enter` | Run the action from the popup |
| `Esc` | Stop the active request or close the UI |

Shortcuts can be changed at `chrome://extensions/shortcuts`.

### Privacy and permissions

- The API key and extension data are stored in `chrome.storage.local`.
- Requests are sent directly to Google's Gemini API unless you configure a custom proxy.
- `activeTab` and `scripting` are used to read the current selection and inject the assistant when needed.
- `<all_urls>` allows the selection assistant to work across webpages and supports a user-configured proxy. Review the source before installation if this permission is a concern.

Never commit an API key to this repository. See [SECURITY.md](.github/SECURITY.md) for reporting security issues.

### Project structure

```text
.
├── manifest.json
├── icon16.png / icon48.png / icon128.png
├── _locales/
├── src/
│   ├── background/service-worker.js
│   ├── content/content.js + content.css
│   ├── popup/popup.html + popup.js + popup.css
│   ├── options/options.html + options.js + options.css
│   └── shared/shared.js
├── .github/
├── CHANGELOG.md
├── LICENSE
└── README.md
```

`manifest.json` and `_locales/` must remain at the extension root. `src/shared/shared.js` must load before the content, popup, and options scripts because it owns the shared API, prompts, language metadata, cache, glossary, and history logic.

### Development

No build step or package manager is required. Edit the source files, reload the unpacked extension, and refresh the test page. Please read [CONTRIBUTING.md](.github/CONTRIBUTING.md) before submitting changes.

---

## فارسی

### معرفی

Gemini AI Translator یک افزونه سبک و بدون وابستگی برای کروم است که ابزارهای زبانی Gemini را به هر صفحه وب اضافه می‌کند. می‌توانید متن را در صفحه انتخاب کنید و از پنجره شناور استفاده کنید، متن را دستی در پاپ‌آپ وارد کنید یا با میانبر صفحه‌کلید درخواست را اجرا کنید.

افزونه مستقیماً با API جمنای ارتباط برقرار می‌کند. کلید API، تنظیمات، واژه‌نامه، تاریخچه و حافظه پاسخ‌ها در فضای محلی مرورگر نگه‌داری می‌شوند.

### امکانات

- نمایش زنده پاسخ در زمان تولید
- پنجره شناور و قابل جابه‌جایی برای متن انتخاب‌شده
- شش عملکرد: ترجمه، دیکشنری، خلاصه‌سازی، اصلاح گرامر، بازنویسی و توضیح ساده
- فعال شدن خودکار دیکشنری برای تک‌کلمه
- ۱۴ زبان مقصد و تشخیص خودکار زبان مبدأ
- لحن عمومی، رسمی، صمیمانه و تخصصی
- واژه‌نامه اختصاصی برای تعیین معادل‌های دقیق
- حافظه محلی LRU با امکان پاک‌سازی و نشان نتیجه ذخیره‌شده
- تاریخچه قابل جست‌وجو با فیلتر عملکرد و حذف تک‌موردی
- توقف استریم بدون از دست رفتن بخش تولیدشده پاسخ
- خوانش صوتی، کپی، منوی راست‌کلیک و میانبر صفحه‌کلید
- نمایش صحیح متن‌های ترکیبی RTL/LTR شامل فارسی، عربی، انگلیسی، نام‌ها و کد
- پشتیبانی از پروکسی اختیاری

### حالت‌های هوش مصنوعی

| حالت | کاربرد | زبان مقصد | لحن | حافظه |
| --- | --- | :---: | :---: | :---: |
| ترجمه | ترجمه دقیق و روان | دارد | دارد | دارد |
| دیکشنری | تلفظ، نوع کلمه، معنی، مترادف و مثال | دارد | ندارد | دارد |
| خلاصه | ایده اصلی و نکات کلیدی | دارد | دارد | دارد |
| اصلاح گرامر | اصلاح املا، دستور و نشانه‌گذاری در همان زبان | ندارد | ندارد | دارد |
| بازنویسی | روان‌تر و شفاف‌تر کردن متن در همان زبان | ندارد | دارد | ندارد |
| توضیح ساده | توضیح متن پیچیده با زبان ساده | دارد | ندارد | دارد |

### نصب

1. مخزن را دانلود یا clone کنید:
   ```bash
   git clone https://github.com/AriaRazavi2005/EX_Translator_Gemini.git
   ```
2. نشانی `chrome://extensions` را باز کنید.
3. گزینه **Developer mode** را فعال کنید.
4. روی **Load unpacked** بزنید و پوشه اصلی مخزن، یعنی پوشه دارای `manifest.json`، را انتخاب کنید.
5. وارد تنظیمات افزونه شوید، کلید API ساخته‌شده در [Google AI Studio](https://aistudio.google.com/apikey) را وارد و بررسی کنید.

بعد از دریافت نسخه جدید، افزونه را در `chrome://extensions` دوباره بارگذاری کنید و تب‌های باز را refresh کنید.

### استفاده و میانبرها

- متن صفحه را انتخاب و روی دکمه شناور کلیک کنید.
- از منوی راست‌کلیک متن انتخاب‌شده استفاده کنید.
- برای ورود دستی متن، پاپ‌آپ افزونه را باز کنید.
- عملکرد پیش‌فرض، زبان، لحن، واژه‌نامه، حافظه و پروکسی از صفحه تنظیمات قابل تغییرند.

| میانبر | عملکرد |
| --- | --- |
| `Alt + T` | پردازش متن انتخاب‌شده در صفحه |
| `Alt + Shift + T` | باز کردن پاپ‌آپ افزونه |
| `Ctrl/Cmd + Enter` | اجرای درخواست از پاپ‌آپ |
| `Esc` | توقف درخواست فعال یا بستن رابط |

تغییر میانبرها از `chrome://extensions/shortcuts` امکان‌پذیر است.

### حریم خصوصی

- کلید API و داده‌های افزونه در `chrome.storage.local` ذخیره می‌شوند.
- درخواست‌ها مستقیماً به API گوگل ارسال می‌شوند، مگر اینکه پروکسی اختصاصی تنظیم کرده باشید.
- مجوزهای `activeTab` و `scripting` برای خواندن متن انتخاب‌شده و تزریق رابط افزونه استفاده می‌شوند.
- دسترسی `<all_urls>` برای نمایش دستیار در صفحات مختلف و پشتیبانی از پروکسی انتخابی کاربر لازم است.

کلید API را هرگز داخل مخزن commit نکنید. برای گزارش امن آسیب‌پذیری‌ها، [SECURITY.md](.github/SECURITY.md) را بخوانید.

### توسعه و مشارکت

پروژه با JavaScript خالص نوشته شده و مرحله build یا package manager ندارد. پس از تغییر فایل‌ها، افزونه unpacked را دوباره بارگذاری و صفحه آزمایش را refresh کنید. پیش از ارسال تغییرات، [راهنمای مشارکت](.github/CONTRIBUTING.md) را مطالعه کنید.

---

## License / مجوز

Released under the [MIT License](LICENSE).  
این پروژه با مجوز [MIT](LICENSE) منتشر شده است.
