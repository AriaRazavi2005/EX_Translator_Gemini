// Options page controller for Gemini AI Translator
// Requires shared.js to be loaded first (see options.html).
document.addEventListener("DOMContentLoaded", () => {
  const S = window.GTShared;
  if (!S) {
    console.error("[Gemini Translator] shared.js was not loaded; options page aborted.");
    return;
  }

  const apiKeyInput = document.getElementById("api-key-input");
  const customProxyInput = document.getElementById("custom-proxy-input");
  const toggleKeyVisibilityBtn = document.getElementById("toggle-key-visibility");
  const verifyKeyBtn = document.getElementById("verify-key-btn");
  const apiStatusBox = document.getElementById("api-status-box");
  const modelSelect = document.getElementById("model-select");
  const defaultTargetLang = document.getElementById("default-target-lang");
  const defaultTone = document.getElementById("default-tone");
  const autoTooltipCheckbox = document.getElementById("auto-tooltip-checkbox");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const saveMsg = document.getElementById("save-msg");

  // ---------------------------------------------------------------------------
  // Load saved preferences
  // ---------------------------------------------------------------------------

  S.getSettings().then((items) => {
    if (items.apiKey) apiKeyInput.value = items.apiKey;
    if (items.customProxyUrl) customProxyInput.value = items.customProxyUrl;
    if (items.defaultTargetLang) defaultTargetLang.value = items.defaultTargetLang;
    if (items.defaultTone) defaultTone.value = items.defaultTone;
    if (items.autoShowTooltip !== undefined) autoTooltipCheckbox.checked = items.autoShowTooltip;

    const savedModel = items.selectedModel || S.DEFAULT_MODEL;

    // Auto-verify and refresh the model list when a key is already stored.
    if (items.apiKey) {
      fetchLiveModels(items.apiKey, savedModel, items.customProxyUrl);
    }
  });

  // ---------------------------------------------------------------------------
  // API key visibility
  // ---------------------------------------------------------------------------

  toggleKeyVisibilityBtn.addEventListener("click", () => {
    const hidden = apiKeyInput.type === "password";
    apiKeyInput.type = hidden ? "text" : "password";
    toggleKeyVisibilityBtn.innerText = hidden ? "🙈" : "👁️";
  });

  // ---------------------------------------------------------------------------
  // Verify key and fetch the live model list
  // ---------------------------------------------------------------------------

  verifyKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showStatus("لطفاً ابتدا کلید API را وارد فرمایید.", "error");
      return;
    }
    fetchLiveModels(key, modelSelect.value, customProxyInput.value.trim());
  });

  async function fetchLiveModels(apiKey, currentSelectedModel, proxyUrl) {
    showStatus("در حال دریافت لیست مدل‌های فعال از گوگل...", "info");

    const baseUrl = S.resolveBaseUrl(proxyUrl);
    const url = baseUrl + "/v1beta/models?key=" + encodeURIComponent(apiKey);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const message =
          (errData && errData.error && errData.error.message) ||
          "پاسخ ناموفق (" + response.status + ")";
        throw new Error(message);
      }

      const data = await response.json();
      const models = data.models || [];

      const genModels = models.filter(
        (m) =>
          m.supportedGenerationMethods &&
          m.supportedGenerationMethods.includes("generateContent")
      );

      if (genModels.length === 0) {
        showStatus("هیچ مدلی با قابلیت تولید محتوا یافت نشد.", "error");
        return;
      }

      modelSelect.innerHTML = "";
      let foundSelected = false;

      genModels.forEach((m) => {
        const modelId = m.name.replace(/^models\//, "");
        const option = document.createElement("option");
        option.value = modelId;
        option.innerText = modelId + " - " + (m.displayName || modelId);

        if (modelId === currentSelectedModel) {
          option.selected = true;
          foundSelected = true;
        }
        modelSelect.appendChild(option);
      });

      if (!foundSelected && modelSelect.options.length > 0) {
        modelSelect.selectedIndex = 0;
      }

      showStatus(
        "✓ کلید API معتبر است! " + genModels.length + " مدل آنلاین شناسایی و دریافت شد.",
        "success"
      );
    } catch (err) {
      showStatus("❌ خطا در بررسی کلید API: " + err.message, "error");
    }
  }

  function showStatus(text, type) {
    apiStatusBox.innerText = text;
    apiStatusBox.className = "status-box " + type;
  }

  // ---------------------------------------------------------------------------
  // Save settings
  // ---------------------------------------------------------------------------

  saveSettingsBtn.addEventListener("click", async () => {
    await S.setStorage({
      apiKey: apiKeyInput.value.trim(),
      customProxyUrl: customProxyInput.value.trim(),
      selectedModel: modelSelect.value,
      defaultSourceLang: "auto",
      defaultTargetLang: defaultTargetLang.value,
      defaultTone: defaultTone.value,
      autoShowTooltip: autoTooltipCheckbox.checked
    });

    saveMsg.innerText = "تنظیمات با موفقیت ذخیره شد! ✓";
    setTimeout(() => (saveMsg.innerText = ""), 2500);
  });
});
