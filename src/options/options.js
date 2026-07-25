// Gemini AI Translator — options page
(function () {
  "use strict";
  const S = window.GTShared;
  if (!S) {
    document.body.innerHTML = '<p style="padding:16px;font-family:sans-serif">هسته مشترک افزونه بارگذاری نشد.</p>';
    return;
  }

  const el = (id) => document.getElementById(id);
  const dom = {};
  let glossaryEntries = [];

  function cacheDom() {
    ["api-key-input", "custom-proxy-input", "toggle-key-visibility", "verify-key-btn",
      "api-status-box", "model-select", "default-mode", "default-target-lang",
      "default-tone", "auto-tooltip-checkbox", "auto-dictionary-checkbox",
      "enable-cache-checkbox", "clear-cache-btn", "cache-stats", "glossary-source",
      "glossary-target", "glossary-add-btn", "glossary-list", "glossary-count",
      "save-settings-btn", "save-msg"].forEach((id) => {
      dom[id.replace(/-([a-z])/g, (match, char) => char.toUpperCase())] = el(id);
    });
  }

  function setStatusBox(message, kind) {
    dom.apiStatusBox.textContent = message || "";
    dom.apiStatusBox.className = "status-box" + (kind ? " " + kind : "");
  }

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

    const storedModel = settings.selectedModel || S.DEFAULT_MODEL;
    if (!Array.from(dom.modelSelect.options).some((option) => option.value === storedModel)) {
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
    dom.glossaryTarget.addEventListener("keydown", (event) => {
      if (event.key === "Enter") addGlossaryEntry();
    });
    dom.glossarySource.addEventListener("keydown", (event) => {
      if (event.key === "Enter") dom.glossaryTarget.focus();
    });
    dom.clearCacheBtn.addEventListener("click", async () => {
      await S.clearCache();
      await refreshCacheStats();
      showSaveMessage("حافظه پاک شد.");
    });
  }

  function renderGlossary() {
    dom.glossaryCount.textContent = `${glossaryEntries.length} از ${S.GLOSSARY_LIMIT} واژه ثبت شده است.`;
    dom.glossaryList.replaceChildren();

    if (!glossaryEntries.length) {
      const empty = document.createElement("div");
      empty.className = "glossary-empty";
      empty.textContent = "هنوز واژه‌ای ثبت نشده است.";
      dom.glossaryList.appendChild(empty);
      return;
    }

    glossaryEntries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "glossary-row";

      const source = document.createElement("input");
      source.className = "g-source";
      source.type = "text";
      source.value = entry.source;
      source.dir = "auto";
      source.spellcheck = false;

      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "→";

      const target = document.createElement("input");
      target.className = "g-target";
      target.type = "text";
      target.value = entry.target;
      target.dir = "auto";

      const remove = document.createElement("button");
      remove.className = "g-del";
      remove.title = "حذف";
      remove.textContent = "🗑";

      source.addEventListener("input", (event) => { glossaryEntries[index].source = event.target.value; });
      target.addEventListener("input", (event) => { glossaryEntries[index].target = event.target.value; });
      remove.addEventListener("click", async () => {
        glossaryEntries.splice(index, 1);
        glossaryEntries = await S.saveGlossary(glossaryEntries);
        renderGlossary();
      });

      row.append(source, arrow, target, remove);
      dom.glossaryList.appendChild(row);
    });
  }

  async function addGlossaryEntry() {
    const source = dom.glossarySource.value.trim();
    const target = dom.glossaryTarget.value.trim();
    if (!source || !target) return showSaveMessage("هر دو طرف واژه را کامل کنید.", true);
    if (glossaryEntries.length >= S.GLOSSARY_LIMIT) return showSaveMessage("ظرفیت واژه‌نامه تکمیل شده است.", true);

    glossaryEntries.unshift({ source, target });
    glossaryEntries = await S.saveGlossary(glossaryEntries);
    dom.glossarySource.value = "";
    dom.glossaryTarget.value = "";
    dom.glossarySource.focus();
    renderGlossary();
    showSaveMessage("واژه افزوده شد.");
  }

  async function refreshCacheStats() {
    const stats = await S.getCacheStats();
    dom.cacheStats.textContent = `${stats.count} پاسخ از سقف ${stats.limit} در حافظه است.`;
  }

  async function verifyKey() {
    const apiKey = dom.apiKeyInput.value.trim();
    if (!apiKey) return setStatusBox("ابتدا کلید API را وارد کنید.", "error");
    setStatusBox("در حال بررسی کلید…", "info");
    const ok = await fetchModels(apiKey, dom.modelSelect.value);
    if (ok) setStatusBox("✓ کلید معتبر است و فهرست مدل‌ها به‌روز شد.", "success");
  }

  async function fetchModels(apiKey, preferredModel) {
    const baseUrl = S.resolveBaseUrl(dom.customProxyInput.value);
    try {
      const response = await fetch(`${baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload.error?.message || response.statusText;
        setStatusBox(`❌ کلید پذیرفته نشد (${response.status}): ${message}`, "error");
        return false;
      }

      const data = await response.json();
      const models = (data.models || [])
        .filter((model) => (model.supportedGenerationMethods || []).includes("generateContent"))
        .map((model) => String(model.name || "").replace(/^models\//, ""))
        .filter(Boolean)
        .sort();

      if (!models.length) {
        setStatusBox("مدلی برای این کلید پیدا نشد.", "error");
        return false;
      }

      dom.modelSelect.replaceChildren(...models.map((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        return option;
      }));
      dom.modelSelect.value = models.includes(preferredModel)
        ? preferredModel
        : (models.includes(S.DEFAULT_MODEL) ? S.DEFAULT_MODEL : models[0]);
      return true;
    } catch (error) {
      setStatusBox(`❌ اتصال برقرار نشد: ${error.message}`, "error");
      return false;
    }
  }

  function showSaveMessage(message, isError) {
    dom.saveMsg.textContent = message;
    dom.saveMsg.classList.toggle("error", isError === true);
    setTimeout(() => {
      if (dom.saveMsg.textContent === message) dom.saveMsg.textContent = "";
    }, 2500);
  }

  async function saveSettings() {
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
    showSaveMessage("✓ تنظیمات ذخیره شد.");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
