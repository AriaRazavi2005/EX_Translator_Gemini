# Contributing | مشارکت

Thanks for helping improve Gemini AI Translator.

## Workflow

1. Fork the repository and create a focused branch from `main`.
2. Keep changes small and avoid unrelated formatting edits.
3. Do not commit API keys, tokens, private proxy URLs, or generated browser data.
4. Reload the unpacked extension and test the popup, settings page, context menu, keyboard shortcut, and floating widget.
5. Test at least one RTL input, one LTR input, and one mixed Persian/English dictionary result.
6. Update `CHANGELOG.md` when behavior changes.
7. Open a pull request using the repository template.

## Style

- Use plain JavaScript, HTML, and CSS; the project has no build step.
- Keep shared API, prompt, cache, glossary, and history logic in `src/shared/shared.js`.
- Load `shared.js` before UI scripts.
- Prefer logical CSS properties (`margin-inline-start`, `padding-inline`) and `unicode-bidi: plaintext` for mixed-direction content.
- Escape untrusted model/history content before using `innerHTML`; prefer `textContent` when possible.

---

برای مشارکت، یک branch جدا از `main` بسازید، تغییرات را محدود و قابل بررسی نگه دارید، هیچ کلید یا اطلاعات محرمانه‌ای commit نکنید و رابط را با متن فارسی، انگلیسی و ترکیبی آزمایش کنید.
