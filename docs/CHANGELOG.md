# 📋 Changelog | تاریخچه تغییرات

All notable changes are documented here. This project follows [Semantic Versioning](https://semver.org/).

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
