// Options JavaScript for Gemini AI Translator
document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key-input");
  const toggleKeyVisibilityBtn = document.getElementById("toggle-key-visibility");
  const verifyKeyBtn = document.getElementById("verify-key-btn");
  const apiStatusBox = document.getElementById("api-status-box");
  const modelSelect = document.getElementById("model-select");
  const defaultTargetLang = document.getElementById("default-target-lang");
  const defaultTone = document.getElementById("default-tone");
  const autoTooltipCheckbox = document.getElementById("auto-tooltip-checkbox");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const saveMsg = document.getElementById("save-msg");

  // Load Saved Preferences
  chrome.storage.local.get(null, (items) => {
    if (items.apiKey) apiKeyInput.value = items.apiKey;
    if (items.defaultTargetLang) defaultTargetLang.value = items.defaultTargetLang;
    if (items.defaultTone) defaultTone.value = items.defaultTone;
    if (items.autoShowTooltip !== undefined) autoTooltipCheckbox.checked = items.autoShowTooltip;

    const savedModel = items.selectedModel || "gemini-2.5-flash";

    // Auto verify & fetch live models if API key exists
    if (items.apiKey) {
      fetchLiveModels(items.apiKey, savedModel);
    }
  });

  // Toggle API key visibility
  toggleKeyVisibilityBtn.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyVisibilityBtn.innerText = "🙈";
    } else {
      apiKeyInput.type = "password";
      toggleKeyVisibilityBtn.innerText = "👁️";
    }
  });

  // Verify API Key and Fetch Online Models from Google
  verifyKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showStatus("لطفاً ابتدا کلید API را وارد فرمایید.", "error");
      return;
    }
    fetchLiveModels(key, modelSelect.value);
  });

  async function fetchLiveModels(apiKey, currentSelectedModel) {
    showStatus("در حال دریافت لیست مدل‌های فعال از گوگل...", "info");

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `پاسخ ناموفق (${response.status})`);
      }

      const data = await response.json();
      const models = data.models || [];

      // Filter models that support content generation
      const genModels = models.filter(m => 
        m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
      );

      if (genModels.length === 0) {
        showStatus("هیچ مدلی با قابلیت تولید محتوا یافت نشد.", "error");
        return;
      }

      // Populate dropdown
      modelSelect.innerHTML = "";
      let foundSelected = false;

      genModels.forEach((m) => {
        const modelId = m.name.replace(/^models\//, ""); // e.g. gemini-2.5-flash
        const option = document.createElement("option");
        option.value = modelId;
        option.innerText = `${modelId} - ${m.displayName || modelId}`;

        if (modelId === currentSelectedModel) {
          option.selected = true;
          foundSelected = true;
        }
        modelSelect.appendChild(option);
      });

      if (!foundSelected && modelSelect.options.length > 0) {
        modelSelect.selectedIndex = 0; // Default to first available
      }

      showStatus(`✓ کلید API معتبر است! ${genModels.length} مدل آنلاین شناسایی و دریافت شد.`, "success");

    } catch (err) {
      showStatus(`❌ خطا در بررسی کلید API: ${err.message}`, "error");
    }
  }

  function showStatus(text, type) {
    apiStatusBox.innerText = text;
    apiStatusBox.className = `status-box ${type}`;
  }

  // Save Settings
  saveSettingsBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = modelSelect.value;
    const targetLang = defaultTargetLang.value;
    const tone = defaultTone.value;
    const autoTooltip = autoTooltipCheckbox.checked;

    chrome.storage.local.set({
      apiKey,
      selectedModel,
      defaultSourceLang: "auto",
      defaultTargetLang: targetLang,
      defaultTone: tone,
      autoShowTooltip: autoTooltip
    }, () => {
      saveMsg.innerText = "تنظیمات با موفقیت ذخیره شد! ✓";
      setTimeout(() => saveMsg.innerText = "", 2500);
    });
  });
});
