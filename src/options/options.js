// ============================================================================
// Gemini AI Translator - Options page logic
// ----------------------------------------------------------------------------
// Depends on GTShared (../shared/shared.js), which is loaded first by
// options.html.
// ============================================================================
(function () {
  "use strict";

  const S = window.GTShared;
  if (!S) {
    document.body.innerHTML =
      '<p style="padding:16px;font-family:sans-serif">shared.js لود نشد.</p>';
    return;
  }

  const el = (id) => document.getElementById(id);

  const dom = {};
  let glossaryEntries = [];

  function cacheDom() {
    [
      "api-key-input", "custom-proxy-input", "toggle-key-visibility",
      "verify-key-btn", "api-status-box", "model-select", "default-mode",
      "default-target-lang", "default-tone", "auto-tooltip-checkbox",
      "auto-dictionary-checkbox", "enable-cache-checkbox", "clear-cache-btn",
      "cache-stats", "glossary-source", "glossary-target", "glossary-add-btn",
      "glossary-list", "glossary-count", "save-settings-btn", "save-msg"
    ].forEach((id) => {
      const key = id.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      dom[key] = el(id);
    });
  }

  function setStatusBox(message, kind) {
    dom.apiStatusBox.innerText = message || "";
    dom.apiStatusBox.className = "status-box" + (kind ? " " + kind : "");
  }

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  async function init() {
    cacheDom();

    dom.defaultTargetLang.innerHTML = S.buildLangOptions(S.TARGET_LANG_CODES);
    dom.defaultMode.innerHTML = S.buildModeOptions("translate");

    const settings = await S.getSettings();

    dom.apiKeyInput.value = settings.apiKey || "";
    dom.customProxyInput.value = settings.customProxyUrl || "";
    dom.defaultTargetLang.value = settings.defaultTargetLang || "fa";
    dom.defaultTone.value = settings.defaultTone || "general";
    dom.defaultMode.value = settings.defaultMode || "translate";
    dom.autoTooltipCheckbox.checked = settings.autoShowTooltip !== false;
    dom.autoDictionaryCheckbox.checked = settings.autoDictionary !== false;
    dom.enableCacheCheckbox.checked = settings.enableCache !== false;

    // Keep the stored model selectable even before the model list is fetched.
    const storedModel = settings.selectedModel || S.DEFAULT_MODEL;
    if (!Array.from(dom.modelSelect.options).some((o) => o.value === storedModel)) {
      const option = document.createElement("option");
      option.value = storedModel;
      option.textContent = storedModel;
      dom.modelSelect.appendChild(option);
    }
    dom.modelSelect.value = storedModel;

    glossaryEntries = await S.getGlossary();
    renderGlossary();
    refreshCacheStats();

    bindEvents();

    if (settings.apiKey) fetchModels(settings.apiKey, storedModel);
  }

  function bindEvents() {
    dom.toggleKeyVisibility.addEventListener("click", () => {
      dom.apiKeyInput.type = dom.apiKeyInput.type === "password" ? "text" : "password";
    });

    dom.verifyKeyBtn.addEventListener("click", verifyKey);
    dom.saveSettingsBtn.addEventListener("click", saveSettings);

    dom.glossaryAddBtn.addEventListener("click", addGlossaryEntry);
    dom.glossaryTarget.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addGlossaryEntry();
    });
    dom.glossarySource.addEventListener("keydown", (e) => {
      if (e.key === "Enter") dom.glossaryTarget.focus();
    });

    dom.clearCacheBtn.addEventListener("click", async () => {
      await S.clearCache();
      refreshCacheStats();
      showSaveMessage("حافطه پاک شد.");
    });
  }

  // ---------------------------------------------------------------------------
  // Glossary
  // ---------------------------------------------------------------------------

  function renderGlossary() {
    dom.glossaryCount.innerText =
      glossaryEntries.length + " از " + S.GLOSSARY_LIMIT + " واژه ثبت شده است.";

    if (glossaryEntries.length === 0) {
      dom.glossaryList.innerHTML =
        '<div class="glossary-empty">هنوز واژه‌ای ثبت نشده است.</div>';
      return;
    }

    dom.glossaryList.innerHTML = "";

    glossaryEntries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "glossary-row";
      row.innerHTML = `
        <input class="g-source" type="text" value="${S.escapeHtml(entry.source)}" spellcheck="false" />
        <span class="arrow">→</span>
        <input class="g-target" type="text" value="${S.escapeHtml(entry.target)}" />
        <button class="g-del" title="حذف">🗑</button>
      `;

      // Inline editing writes straight back into the working list.
      row.querySelector(".g-source").addEventListener("input", (e) => {
        glossaryEntries[index].source = e.target.value;
      });
      row.querySelector(".g-target").addEventListener("input", (e) => {
        glossaryEntries[index].target = e.target.value;
      });

      row.querySelector(".g-del").addEventListener("click", async () => {
        glossaryEntries.splice(index, 1);
        glossaryEntries = await S.saveGlossary(glossaryEntries);
        renderGlossary();
      });

      dom.glossaryList.appendChild(row);
    });
  }

  async function addGlossaryEntry() {
    const source = dom.glossarySource.value.trim();
    const target = dom.glossaryTarget.value.trim();

    if (!source || !target) {
      showSaveMessage("هر دو طرف واژه را پر کنید.", true);
      return;
    }

    if (glossaryEntries.length >= S.GLOSSARY_LIMIT) {
      showSaveMessage("سقف واژه‌نامه پر شده است.", true);
      return;
    }

    // New terms go on top so they are easy to review.
    glossaryEntries.unshift({ source, target });
    glossaryEntries = await S.saveGlossary(glossaryEntries);

    dom.glossarySource.value = "";
    dom.glossaryTarget.value = "";
    dom.glossarySource.focus();

    renderGlossary();
    showSaveMessage("واژه افزوده شد.");
  }

  // ---------------------------------------------------------------------------
  // Cache
  // ---------------------------------------------------------------------------

  async function refreshCacheStats() {
    const stats = await S.getCacheStats();
    dom.cacheStats.innerText =
      stats.count + " پاسخ از سقف " + stats.limit + " در حافطه است.";
  }

  // ---------------------------------------------------------------------------
  // API key verification + model list
  // ---------------------------------------------------------------------------

  async function verifyKey() {
    const apiKey = dom.apiKeyInput.value.trim();
    if (!apiKey) {
      setStatusBox("ابتدا کلید API را وارد کنید.", "error");
      return;
    }

    setStatusBox("در حال بررسی کلید…", "info");
    const ok = await fetchModels(apiKey, dom.modelSelect.value);

    if (ok) setStatusBox("✓ کلید معتبر است و لیست مدل‌ها بروز شد.", "success");
  }

  /** Loads the models available to this key. Returns true on success. */
  async function fetchModels(apiKey, preferredModel) {
    const baseUrl = S.resolveBaseUrl(dom.customProxyInput.value);

    try {
      const response = await fetch(
        baseUrl + "/v1beta/models?key=" + encodeURIComponent(apiKey)
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const message = (errJson.error && errJson.error.message) || response.statusText;
        setStatusBox("❌ کلید پذیرفته نشد (" + response.status + "): " + message, "error");
        return false;
      }

      const data = await response.json();
      const models = (data.models || [])
        .filter((m) =>
          (m.supportedGenerationMethods || []).indexOf("generateContent") !== -1
        )
        .map((m) => String(m.name || "").replace(/^models\//, ""))
        .filter(Boolean)
        .sort();

      if (models.length === 0) {
        setStatusBox("مدلی برای این کلید پیدا نشد.", "error");
        return false;
      }

      dom.modelSelect.innerHTML = models
        .map((name) => '<option value="' + name + '">' + name + "</option>")
        .join("");

      // Keep the user's choice when it is still available.
      if (preferredModel && models.indexOf(preferredModel) !== -1) {
        dom.modelSelect.value = preferredModel;
      } else if (models.indexOf(S.DEFAULT_MODEL) !== -1) {
        dom.modelSelect.value = S.DEFAULT_MODEL;
      }

      return true;
    } catch (err) {
      setStatusBox("❌ اتصال برقرار نشد: " + err.message, "error");
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  function showSaveMessage(message, isError) {
    dom.saveMsg.innerText = message;
    dom.saveMsg.classList.toggle("error", isError === true);
    setTimeout(() => {
      if (dom.saveMsg.innerText === message) dom.saveMsg.innerText = "";
    }, 2500);
  }

  async function saveSettings() {
    // Persist inline glossary edits together with the rest of the settings.
    glossaryEntries = await S.saveGlossary(glossaryEntries);
    renderGlossary();

    await S.setStorage({
      apiKey: dom.apiKeyInput.value.trim(),
      customProxyUrl: dom.customProxyInput.value.trim(),
      selectedModel: dom.modelSelect.value,
      defaultMode: dom.defaultMode.value,
      defaultTargetLang: dom.defaultTargetLang.value,
      defaultTone: dom.defaultTone.value,
      autoShowTooltip: dom.autoTooltipCheckbox.checked,
      autoDictionary: dom.autoDictionaryCheckbox.checked,
      enableCache: dom.enableCacheCheckbox.checked
    });

    showSaveMessage("✓ تنطیمات ذخیره شد.");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
