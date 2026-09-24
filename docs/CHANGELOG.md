# 📋 Changelog | تاریخچه تغییرات

All notable changes are documented here. This project follows [Semantic Versioning](https://semver.org/).

## [1.3.0] - 2026-09-23

### ✨ Added
- **Full-page translation**: translate every visible text node in place from the context menu or `Alt+Shift+P`, with a live progress toast and one-click restore of the original page. A 🌐 button in the popup translates the active tab too.
- **Light / dark / auto theme** across the popup, options page, in-page widget, and page-translation toast (`auto` follows the OS preference and updates live when it changes).
- **Rich output rendering**: model output with bullet lists, numbered lists, `**bold**`, `` `code` ``, and safe `http(s)` links is rendered as structured, bidi-aware HTML instead of plain text.
- **Source language + swap** control inside the in-page floating widget (previously popup-only).
- **Backup**: export the glossary and history to a JSON file and import/merge it back from the options page.
- **Configurable maximum response length** (`maxOutputTokens`) for longer documents.

### 🛠️ Fixed
- Corrected Persian spelling (`حافظه`, `تنظیم`) in the widget and popup UI.
- Automatic retry with exponential backoff on transient network failures and `429`/`5xx` responses.
- Page translation now surfaces missing-key and authentication errors instead of silently finishing with no changes, and reports when a very large page is only partly covered.
- Throttled the response cache's recency writes so a burst of cache hits no longer rewrites the whole cache on every read.

### ♿ Accessibility
- The in-page widget is a focusable `role="dialog"`, and the floating trigger is keyboard-operable (`Enter` / `Space`).

### ♻️ Changed
- Cached the Gemini model list so the options page does not re-fetch it on every open.
- Added a dependency-free unit-test suite for the shared core (`node test/run-tests.mjs`).

## [1.2.1] - 2026-07-25

### 🛠️ Fixed
- Reworked the in-page widget layout shown in dictionary mode.
- Stopped forcing RTL direction on every child element.
- Added bidirectional plaintext rendering for mixed Persian/English output, examples, names, and code.
- Isolated buttons and selects from host-page CSS and prevented stretched or collapsed controls.
- Constrained the floating widget to the viewport and moved scrolling into its body.
- Replaced physical left/right spacing with logical RTL/LTR-safe properties.
- Corrected Persian spelling across popup and options UI.

### ♻️ Changed
- Rewrote README as a professional bilingual English/Persian repository page.
- Added standard license, contribution, security, issue, and pull-request files.
- Moved the changelog to `docs/` and cleaned root-level repository configuration.

## [1.2.0] - 2026-07-25

### ✨ Added
- Six AI modes: translation, dictionary, summarization, grammar correction, rewriting, and simple explanation.
- Custom glossary editor with up to 300 entries.
- Local LRU response cache with up to 200 entries.
- Global selection shortcut, stream cancellation, searchable history, and automatic dictionary mode.

### ♻️ Changed
- Moved extension source into `src/shared`, `src/background`, `src/content`, `src/popup`, and `src/options`.
- Added a shared history schema and mode-aware output cleanup.

## [1.1.0] - 2026-07-25

### ✨ Added
- `Ctrl/Cmd + Enter` execution shortcut and `Esc` closing behavior.
- 14 supported target languages.
- Per-item history deletion, optional proxy support, and a shared core module.

### 🛠️ Fixed
- Buffered SSE parsing, request cancellation, API error messages, safe history rendering, and on-demand script injection.

## [1.0.0]

- Initial Gemini translation extension with streaming, floating widget, popup, settings, speech, copy, history, and context-menu integration.
