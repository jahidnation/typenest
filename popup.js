document.addEventListener("DOMContentLoaded", () => {
  const toggleEnabled = document.getElementById("toggleEnabled");
  const toggleBanglaPhonetic = document.getElementById("toggleBanglaPhonetic");
  const toggleFloatingBtn = document.getElementById("toggleFloatingBtn");
  const toggleSiteEnabled = document.getElementById("toggleSiteEnabled");
  const currentDomain = document.getElementById("currentDomain");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const updateBanner = document.getElementById("updateBanner");
  const updateVersion = document.getElementById("updateVersion");
  const btnUpdate = document.getElementById("btnUpdate");
  const btnDismissUpdate = document.getElementById("btnDismissUpdate");
  const btnExport = document.getElementById("btnExport");
  const btnImport = document.getElementById("btnImport");
  const importFileInput = document.getElementById("importFileInput");
  const popupToast = document.getElementById("popupToast");
  const popupToastText = document.getElementById("popupToastText");

  let toastTimer = null;
  let currentHost = "";

  const showToast = (message) => {
    clearTimeout(toastTimer);
    popupToastText.textContent = message;
    popupToast.classList.add("show");
    toastTimer = setTimeout(() => {
      popupToast.classList.remove("show");
    }, 2000);
  };

  const updateStatusUI = (enabled) => {
    toggleEnabled.checked = enabled;
    if (enabled) {
      statusDot.classList.remove("disabled");
      statusText.textContent = "Active";
    } else {
      statusDot.classList.add("disabled");
      statusText.textContent = "Disabled";
    }
  };

  const tabsManager = window.TypeNextTabs.initTabs({
    tabShortcuts: document.getElementById("tabShortcuts"),
    tabCustom: document.getElementById("tabCustom"),
    tabLearned: document.getElementById("tabLearned"),
    countShortcuts: document.getElementById("countShortcuts"),
    countCustom: document.getElementById("countCustom"),
    countLearned: document.getElementById("countLearned"),
    btnBulkClear: document.getElementById("btnBulkClear"),
    searchFilterInput: document.getElementById("searchFilterInput"),
    btnClearSearch: document.getElementById("btnClearSearch"),
    shortcutInputGroup: document.getElementById("shortcutInputGroup"),
    newShortcutTrigger: document.getElementById("newShortcutTrigger"),
    newShortcutText: document.getElementById("newShortcutText"),
    btnAddShortcut: document.getElementById("btnAddShortcut"),
    customInputGroup: document.getElementById("customInputGroup"),
    newWordInput: document.getElementById("newWordInput"),
    btnAddWord: document.getElementById("btnAddWord"),
    dictList: document.getElementById("dictList"),
    confirmModal: document.getElementById("confirmModal"),
    modalTitle: document.getElementById("modalTitle"),
    modalDesc: document.getElementById("modalDesc"),
    btnModalCancel: document.getElementById("btnModalCancel"),
    btnModalConfirm: document.getElementById("btnModalConfirm"),
    editModal: document.getElementById("editModal"),
    editTriggerGroup: document.getElementById("editTriggerGroup"),
    editTriggerInput: document.getElementById("editTriggerInput"),
    editTextInput: document.getElementById("editTextInput"),
    btnEditCancel: document.getElementById("btnEditCancel"),
    btnEditSave: document.getElementById("btnEditSave")
  }, showToast);

  toggleEnabled.addEventListener("change", () => {
    const isChecked = toggleEnabled.checked;
    updateStatusUI(isChecked);
    window.TypeNextStorage.saveSettings({ sat_enabled: isChecked }, () => {
      showToast(isChecked ? "Auto-complete enabled" : "Auto-complete paused");
    });
  });

  toggleBanglaPhonetic.addEventListener("change", () => {
    const isChecked = toggleBanglaPhonetic.checked;
    window.TypeNextStorage.saveSettings({ sat_bangla_phonetic: isChecked }, () => {
      showToast(isChecked ? "Bangla Phonetic enabled" : "Bangla Phonetic disabled");
    });
  });

  toggleFloatingBtn.addEventListener("change", () => {
    const isChecked = toggleFloatingBtn.checked;
    window.TypeNextStorage.saveSettings({ sat_floating_magic_btn: isChecked }, () => {
      showToast(isChecked ? "Magic button enabled" : "Magic button hidden");
    });
  });

  toggleSiteEnabled.addEventListener("change", () => {
    if (!currentHost) return;
    const isSiteEnabled = toggleSiteEnabled.checked;

    window.TypeNextStorage.getSettings((data) => {
      let disabledDomains = Array.isArray(data.sat_disabled_domains) ? [...data.sat_disabled_domains] : [];
      if (isSiteEnabled) {
        disabledDomains = disabledDomains.filter((d) => d.toLowerCase() !== currentHost.toLowerCase());
      } else {
        if (!disabledDomains.some((d) => d.toLowerCase() === currentHost.toLowerCase())) {
          disabledDomains.push(currentHost.toLowerCase());
        }
      }

      window.TypeNextStorage.saveSettings({ sat_disabled_domains: disabledDomains }, () => {
        showToast(isSiteEnabled ? `Enabled on ${currentHost}` : `Disabled on ${currentHost}`);
      });
    });
  });

  btnExport.addEventListener("click", () => {
    window.TypeNextStorage.exportBackup(() => {
      showToast("All data exported ✓");
    });
  });

  btnImport.addEventListener("click", () => {
    importFileInput.value = "";
    importFileInput.click();
  });

  importFileInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    window.TypeNextStorage.importBackup(file, (payload) => {
      toggleBanglaPhonetic.checked = payload.sat_bangla_phonetic;
      toggleFloatingBtn.checked = payload.sat_floating_magic_btn;
      tabsManager.renderCurrentList();
      showToast("Backup imported successfully ✓");
    }, () => {
      showToast("Invalid JSON backup file");
    });
  });

  btnUpdate.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: "https://github.com/jahidnation/typenest" });
    } else {
      window.open("https://github.com/jahidnation/typenest", "_blank");
    }
  });

  btnDismissUpdate.addEventListener("click", () => {
    updateBanner.classList.add("hidden");
  });

  const checkUpdateStatus = () => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get("sat_update_info", (res) => {
        const info = res?.sat_update_info;
        if (info && info.hasUpdate) {
          updateVersion.textContent = info.latestVersion;
          updateBanner.classList.remove("hidden");
        }
      });
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: "checkUpdateManual" }, () => {
          chrome.storage.local.get("sat_update_info", (res) => {
            const info = res?.sat_update_info;
            if (info && info.hasUpdate) {
              updateVersion.textContent = info.latestVersion;
              updateBanner.classList.remove("hidden");
            }
          });
        });
      }
    }
  };

  const initData = () => {
    window.TypeNextStorage.getSettings((data) => {
      updateStatusUI(data.sat_enabled);
      toggleBanglaPhonetic.checked = !!data.sat_bangla_phonetic;
      toggleFloatingBtn.checked = data.sat_floating_magic_btn !== false;
      if (currentHost) {
        const disabledList = Array.isArray(data.sat_disabled_domains) ? data.sat_disabled_domains : [];
        const isDomainDisabled = disabledList.some((d) => d.toLowerCase() === currentHost.toLowerCase());
        toggleSiteEnabled.checked = !isDomainDisabled;
      }
      tabsManager.renderCurrentList();
      checkUpdateStatus();
    });
  };

  if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs?.[0]?.url) {
        try {
          const url = new URL(tabs[0].url);
          if (url.protocol.startsWith("http")) {
            currentHost = url.hostname;
            currentDomain.textContent = currentHost;
          } else {
            currentDomain.textContent = "Internal page";
            toggleSiteEnabled.disabled = true;
          }
        } catch {
          currentDomain.textContent = "Current tab";
          toggleSiteEnabled.disabled = true;
        }
      }
      initData();
    });
  } else {
    currentDomain.textContent = "localhost";
    initData();
  }
});