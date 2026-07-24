# ✦ Gemini AI Translator - Chrome Extension 🚀

[![Chrome Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Google Gemini API](https://img.shields.io/badge/AI_Engine-Google_Gemini_API-purple.svg)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

یک اکستنشن مدرن، پرسرعت و فوق‌العاده شیک برای مرورگر گوگل کروم جهت ترجمه مستقیم، دقیق و هوشمند متون با قدرت مدل‌های هوش مصنوعی **Google Gemini AI**.

---

## 🌟 ویژگی‌های کلیدی (Key Features)

- **✦ پاپ‌آپ شناور هوشمند (Selection Tooltip)**: هنگام انتخاب متن در هر صفحه وب، ویجت شیشه‌ای (Glassmorphic) ترجمه ظاهر می‌شود.
- **📜 استریم زنده پاسخ (Live Streaming SSE)**: دریافت کلمه به کلمه پاسخ ترجمه بدون معطلی با فناوری Server-Sent Events.
- **🎯 ترجمه خالص و بدون کلمات اضافی (Clean Direct Translation)**: پالایش خودکار پاسخ مدل جهت حذف هرگونه توضیح، مقدمه اضافی، علامت‌های کد یا تلفظ‌های متفرقه.
- **📐 باکس‌های قابل تغییر اندازه (Resizable Containers)**: امکان بزرگ و کوچک کردن باکس‌های متن اصلی و ترجمه (`resize: vertical`) برای مطالعه آسان متون طولانی.
- **📜 تاریخچه ترجمه‌ها (Translation History)**: ذخیره خودکار ترجمه‌های اخیر هم در پنجره اکستنشن و هم درون ویجت شناور وب‌سایت.
- **🔊 خوانش صوتی (Text-To-Speech / TTS)**: تلفظ صوتی با کیفیت ترجمه به زبان‌های فارسی و انگلیسی.
- **🎭 تنظیم لحن ترجمه (Tone Control)**: قابلیت انتخاب لحن (عمومی، رسمی و اداری، صمیمانه، تخصصی و علمی).
- **🔑 دریافت آنلاین و داینامیک مدل‌ها (Live Model Fetching)**: اتصال به API گوگل جهت لیست‌گیری آخرین مدل‌های فعال (`gemini-flash-latest`, `gemini-3.6-flash`, `gemini-3.5-flash`, ...).
- **🖱️ منوی راست‌کلیک (Context Menu)**: ترجمه سریع هر متن انتخابی با کلیک راست.

---

## 📸 نمای کلی پروژه (Project Overview)

```text
├── manifest.json         # پیکربندی Manifest V3
├── background.js          # Service Worker پس‌زمینه و منوی راست کلیک
├── content.js             # ویجت شناور در صفحات وب + دریافت استریم
├── content.css            # استایل Glassmorphism و فونت Vazirmatn برای صفحات وب
├── popup.html             # رابط کاربری پنجره اصلی اکستنشن
├── popup.js               # منطق استریم، تاریخچه و مدیریت زبان‌ها
├── popup.css              # استایل شیشه‌ای پنجره اصلی
├── options.html           # صفحه تنظیمات کلید API و انتخاب مدل
├── options.js             # استخراج داینامیک لیست مدل‌های گوگل و بررسی کلید
├── options.css            # استایل صفحه تنظیمات
└── icon16/48/128.png      # آیکون‌های اختصاصی پروژه
```

---

## ⚡ راهنمای نصب و راه‌اندازی (Installation & Setup)

1. مخزن را کلون کنید یا فایل‌های آن را دانلود کنید:
   ```bash
   git clone https://github.com/your-username/gemini-ai-chrome-translator.git
   ```
2. مرورگر **Google Chrome** را باز کرده و به آدرس زیر بروید:
   ```text
   chrome://extensions
   ```
3. گزینه‌ی **Developer mode** را در بالای سمت راست فعال کنید.
4. روی دکمه **Load unpacked** کلیک کرده و پوشه پروژه را انتخاب کنید.
5. روی آیکون اکستنشن کلیک کرده یا به صفحه **Options (تنظیمات)** بروید و **کلید API گوگل** خود را وارد نمایید.

---

## 🛠️ نحوه گرفتن کلید API رایگان (Get Free Gemini API Key)

1. به وب‌سایت [Google AI Studio](https://aistudio.google.com/) بروید.
2. روی دکمه **Get API Key** کلیک کرده و یک کلید جدید بسازید.
3. کلید را در صفحه تنظیمات اکستنشن وارد کرده و روی **«تست اتصال و لیست‌گیری آنلاین مدل‌ها»** کلیک کنید.

---

## 📜 لایسنس (License)

این پروژه تحت لایسنس **MIT** منتشر شده است. استفاده، تغییر و توسعه آن آزاد می‌باشد.
