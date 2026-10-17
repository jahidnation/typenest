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
  const tabShortcuts = document.getElementById("tabShortcuts");
  const tabCustom = document.getElementById("tabCustom");
  const tabLearned = document.getElementById("tabLearned");
  const countShortcuts = document.getElementById("countShortcuts");
  const countCustom = document.getElementById("countCustom");
  const countLearned = document.getElementById("countLearned");
  const btnBulkClear = document.getElementById("btnBulkClear");
  const searchFilterInput = document.getElementById("searchFilterInput");
  const btnClearSearch = document.getElementById("btnClearSearch");
  const shortcutInputGroup = document.getElementById("shortcutInputGroup");
  const newShortcutTrigger = document.getElementById("newShortcutTrigger");
  const newShortcutText = document.getElementById("newShortcutText");
  const btnAddShortcut = document.getElementById("btnAddShortcut");
  const customInputGroup = document.getElementById("customInputGroup");
  const newWordInput = document.getElementById("newWordInput");
  const btnAddWord = document.getElementById("btnAddWord");
  const dictList = document.getElementById("dictList");
  const confirmModal = document.getElementById("confirmModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalDesc = document.getElementById("modalDesc");
  const btnModalCancel = document.getElementById("btnModalCancel");
  const btnModalConfirm = document.getElementById("btnModalConfirm");
  const editModal = document.getElementById("editModal");
  const editTriggerGroup = document.getElementById("editTriggerGroup");
  const editTriggerInput = document.getElementById("editTriggerInput");
  const editTextInput = document.getElementById("editTextInput");
  const btnEditCancel = document.getElementById("btnEditCancel");
  const btnEditSave = document.getElementById("btnEditSave");
  const popupToast = document.getElementById("popupToast");
  const popupToastText = document.getElementById("popupToastText");

  let currentTab = "shortcuts";
  let toastTimer = null;
  let currentHost = "";
  let editingContext = null;

  const storage = typeof chrome !== "undefined" && chrome.storage ? (chrome.storage.sync || chrome.storage.local) : null;

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

  const getSettings = (callback) => {
    const defaults = {
      sat_enabled: true,
      sat_bangla_phonetic: false,
      sat_floating_magic_btn: true,
      sat_disabled_domains: [],
      sat_snippets: [],
      sat_custom_dict: [],
      sat_learned_dict: {}
    };

    if (storage) {
      storage.get(defaults, callback);
    } else {
      callback({
        sat_enabled: localStorage.getItem("sat_enabled") !== "false",
        sat_bangla_phonetic: localStorage.getItem("sat_bangla_phonetic") === "true",
        sat_floating_magic_btn: localStorage.getItem("sat_floating_magic_btn") !== "false",
        sat_disabled_domains: JSON.parse(localStorage.getItem("sat_disabled_domains") || "[]"),
        sat_snippets: JSON.parse(localStorage.getItem("sat_snippets") || "[]"),
        sat_custom_dict: JSON.parse(localStorage.getItem("sat_custom_dict") || "[]"),
        sat_learned_dict: JSON.parse(localStorage.getItem("sat_learned_dict") || "{}")
      });
    }
  };

  const saveSettings = (data, callback) => {
    if (storage) {
      storage.set(data, callback);
    } else {
      Object.entries(data).forEach(([k, v]) => {
        localStorage.setItem(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      });
      if (callback) callback();
    }
  };

  const renderCurrentList = () => {
    getSettings((data) => {
      const snippets = Array.isArray(data.sat_snippets) ? data.sat_snippets : [];
      const customList = Array.isArray(data.sat_custom_dict) ? data.sat_custom_dict : [];
      const learnedObj = data.sat_learned_dict || {};
      const learnedList = Object.keys(learnedObj);

      countShortcuts.textContent = String(snippets.length);
      countCustom.textContent = String(customList.length);
      countLearned.textContent = String(learnedList.length);

      const query = (searchFilterInput.value || "").trim().toLowerCase();
      btnClearSearch.style.display = query ? "block" : "none";

      dictList.innerHTML = "";

      if (currentTab === "shortcuts") {
        shortcutInputGroup.classList.remove("hidden");
        customInputGroup.classList.add("hidden");

        const filtered = query
          ? snippets.filter((s) => s.trigger.toLowerCase().includes(query) || s.text.toLowerCase().includes(query))
          : snippets;

        if (!filtered.length) {
          dictList.innerHTML = query
            ? '<div class="empty-state">No matching hotkeys found.</div>'
            : '<div class="empty-state">No hotkeys yet.<br>Add one above (e.g. <b>/tnx</b> ➔ <b>Thank You</b>)!</div>';
          return;
        }

        filtered.forEach((item) => {
          const row = document.createElement("div");
          row.className = "dict-item";
          row.innerHTML = `
            <span class="snippet-tag"><i class="fa-solid fa-bolt"></i>${item.trigger}</span>
            <i class="fa-solid fa-arrow-right snippet-arrow"></i>
            <span class="dict-text" title="${item.text}">${item.text}</span>
            <div class="dict-actions">
              <button type="button" class="dict-btn dict-edit" title="Edit hotkey">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button type="button" class="dict-btn dict-del" title="Delete hotkey">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          `;

          row.querySelector(".dict-edit").addEventListener("click", (e) => {
            e.stopPropagation();
            editingContext = { type: "shortcut", original: item };
            editTriggerGroup.style.display = "block";
            editTriggerInput.value = item.trigger;
            editTextInput.value = item.text;
            editModal.classList.add("show");
            editTextInput.focus();
          });

          row.querySelector(".dict-del").addEventListener("click", (e) => {
            e.stopPropagation();
            const updated = snippets.filter((s) => s.trigger.toLowerCase() !== item.trigger.toLowerCase());
            saveSettings({ sat_snippets: updated }, () => {
              renderCurrentList();
              showToast(`Deleted ${item.trigger} ✓`);
            });
          });

          dictList.appendChild(row);
        });
      } else if (currentTab === "custom") {
        shortcutInputGroup.classList.add("hidden");
        customInputGroup.classList.remove("hidden");

        const filtered = query ? customList.filter((item) => item.toLowerCase().includes(query)) : customList;

        if (!filtered.length) {
          dictList.innerHTML = query
            ? '<div class="empty-state">No matching custom phrases found.</div>'
            : '<div class="empty-state">No custom phrases yet.<br>Add one above!</div>';
          return;
        }

        filtered.forEach((item) => {
          const row = document.createElement("div");
          row.className = "dict-item";
          row.innerHTML = `
            <span class="dict-text" title="${item}">${item}</span>
            <div class="dict-actions">
              <button type="button" class="dict-btn dict-edit" title="Edit phrase">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button type="button" class="dict-btn dict-del" title="Delete phrase">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          `;

          row.querySelector(".dict-edit").addEventListener("click", (e) => {
            e.stopPropagation();
            editingContext = { type: "custom", original: item };
            editTriggerGroup.style.display = "none";
            editTextInput.value = item;
            editModal.classList.add("show");
            editTextInput.focus();
          });

          row.querySelector(".dict-del").addEventListener("click", (e) => {
            e.stopPropagation();
            const updated = customList.filter((w) => w !== item);
            saveSettings({ sat_custom_dict: updated }, () => {
              renderCurrentList();
              showToast("Phrase deleted ✓");
            });
          });

          dictList.appendChild(row);
        });
      } else {
        shortcutInputGroup.classList.add("hidden");
        customInputGroup.classList.add("hidden");

        const filtered = query ? learnedList.filter((item) => item.toLowerCase().includes(query)) : learnedList;

        if (!filtered.length) {
          dictList.innerHTML = query
            ? '<div class="empty-state">No matching learned words found.</div>'
            : '<div class="empty-state">No auto-learned words yet.<br>Words will appear here as you type.</div>';
          return;
        }

        filtered.forEach((word) => {
          const row = document.createElement("div");
          row.className = "dict-item";
          row.innerHTML = `
            <span class="dict-text" title="${word}">${word}</span>
            <div class="dict-actions">
              <button type="button" class="dict-btn dict-del" title="Delete word">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          `;

          row.querySelector(".dict-del").addEventListener("click", (e) => {
            e.stopPropagation();
            const currentLearned = { ...learnedObj };
            delete currentLearned[word];
            saveSettings({ sat_learned_dict: currentLearned }, () => {
              renderCurrentList();
              showToast(`Deleted "${word}" ✓`);
            });
          });

          dictList.appendChild(row);
        });
      }
    });
  };

  const addShortcut = () => {
    let trigger = newShortcutTrigger.value.trim();
    const text = newShortcutText.value.trim();

    if (!trigger) {
      newShortcutTrigger.focus();
      return;
    }
    if (!text) {
      newShortcutText.focus();
      return;
    }

    if (!trigger.startsWith("/") && !trigger.startsWith(";") && !trigger.startsWith(":")) {
      trigger = "/" + trigger;
    }

    getSettings((data) => {
      const list = Array.isArray(data.sat_snippets) ? [...data.sat_snippets] : [];
      const existingIdx = list.findIndex((s) => s.trigger.toLowerCase() === trigger.toLowerCase());

      if (existingIdx !== -1) {
        list[existingIdx] = { trigger, text };
        showToast(`Updated ${trigger} ✓`);
      } else {
        list.unshift({ trigger, text });
        showToast(`Hotkey ${trigger} added ✓`);
      }

      saveSettings({ sat_snippets: list }, () => {
        newShortcutTrigger.value = "";
        newShortcutText.value = "";
        renderCurrentList();
      });
    });
  };

  const addWord = () => {
    const value = newWordInput.value.trim();
    if (!value) {
      newWordInput.focus();
      return;
    }

    getSettings((data) => {
      const list = Array.isArray(data.sat_custom_dict) ? [...data.sat_custom_dict] : [];
      if (list.some((item) => item.toLowerCase() === value.toLowerCase())) {
        showToast("Already exists in dictionary");
        newWordInput.select();
        return;
      }

      list.unshift(value);
      saveSettings({ sat_custom_dict: list }, () => {
        newWordInput.value = "";
        renderCurrentList();
        showToast("Added to dictionary ✓");
      });
    });
  };

  btnAddShortcut.addEventListener("click", addShortcut);

  newShortcutTrigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter") newShortcutText.focus();
  });

  newShortcutText.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addShortcut();
    }
  });

  btnAddWord.addEventListener("click", addWord);

  newWordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addWord();
    }
  });

  btnBulkClear.addEventListener("click", () => {
    if (currentTab === "shortcuts") {
      modalTitle.textContent = "Clear All Hotkeys?";
      modalDesc.textContent = "Are you sure you want to delete all text snippets/hotkeys? This cannot be undone.";
    } else if (currentTab === "custom") {
      modalTitle.textContent = "Clear All Custom Phrases?";
      modalDesc.textContent = "Are you sure you want to delete all your custom phrases? This cannot be undone.";
    } else {
      modalTitle.textContent = "Clear All Learned Words?";
      modalDesc.textContent = "Are you sure you want to clear all auto-learned memory? All learned typos will be removed.";
    }
    confirmModal.classList.add("show");
  });

  btnModalCancel.addEventListener("click", () => {
    confirmModal.classList.remove("show");
  });

  confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) {
      confirmModal.classList.remove("show");
    }
  });

  btnModalConfirm.addEventListener("click", () => {
    confirmModal.classList.remove("show");
    if (currentTab === "shortcuts") {
      saveSettings({ sat_snippets: [] }, () => {
        renderCurrentList();
        showToast("All hotkeys cleared ✓");
      });
    } else if (currentTab === "custom") {
      saveSettings({ sat_custom_dict: [] }, () => {
        renderCurrentList();
        showToast("All custom phrases cleared ✓");
      });
    } else {
      saveSettings({ sat_learned_dict: {} }, () => {
        renderCurrentList();
        showToast("All learned words cleared ✓");
      });
    }
  });

  btnEditCancel.addEventListener("click", () => {
    editModal.classList.remove("show");
    editingContext = null;
  });

  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) {
      editModal.classList.remove("show");
      editingContext = null;
    }
  });

  btnEditSave.addEventListener("click", () => {
    if (!editingContext) return;
    const newText = editTextInput.value.trim();
    if (!newText) {
      editTextInput.focus();
      return;
    }

    if (editingContext.type === "shortcut") {
      let newTrigger = editTriggerInput.value.trim();
      if (!newTrigger) {
        editTriggerInput.focus();
        return;
      }
      if (!newTrigger.startsWith("/") && !newTrigger.startsWith(";") && !newTrigger.startsWith(":")) {
        newTrigger = "/" + newTrigger;
      }

      getSettings((data) => {
        const list = Array.isArray(data.sat_snippets) ? [...data.sat_snippets] : [];
        const idx = list.findIndex((s) => s.trigger.toLowerCase() === editingContext.original.trigger.toLowerCase());
        if (idx !== -1) {
          list[idx] = { trigger: newTrigger, text: newText };
        } else {
          list.unshift({ trigger: newTrigger, text: newText });
        }

        saveSettings({ sat_snippets: list }, () => {
          editModal.classList.remove("show");
          editingContext = null;
          renderCurrentList();
          showToast("Hotkey updated ✓");
        });
      });
    } else if (editingContext.type === "custom") {
      getSettings((data) => {
        const list = Array.isArray(data.sat_custom_dict) ? [...data.sat_custom_dict] : [];
        const idx = list.indexOf(editingContext.original);
        if (idx !== -1) {
          list[idx] = newText;
        } else {
          list.unshift(newText);
        }

        saveSettings({ sat_custom_dict: list }, () => {
          editModal.classList.remove("show");
          editingContext = null;
          renderCurrentList();
          showToast("Phrase updated ✓");
        });
      });
    }
  });

  searchFilterInput.addEventListener("input", renderCurrentList);

  btnClearSearch.addEventListener("click", () => {
    searchFilterInput.value = "";
    searchFilterInput.focus();
    renderCurrentList();
  });

  tabShortcuts.addEventListener("click", () => {
    if (currentTab === "shortcuts") return;
    currentTab = "shortcuts";
    tabShortcuts.classList.add("active");
    tabCustom.classList.remove("active");
    tabLearned.classList.remove("active");
    renderCurrentList();
  });

  tabCustom.addEventListener("click", () => {
    if (currentTab === "custom") return;
    currentTab = "custom";
    tabCustom.classList.add("active");
    tabShortcuts.classList.remove("active");
    tabLearned.classList.remove("active");
    renderCurrentList();
  });

  tabLearned.addEventListener("click", () => {
    if (currentTab === "learned") return;
    currentTab = "learned";
    tabLearned.classList.add("active");
    tabShortcuts.classList.remove("active");
    tabCustom.classList.remove("active");
    renderCurrentList();
  });

  toggleEnabled.addEventListener("change", () => {
    const isChecked = toggleEnabled.checked;
    updateStatusUI(isChecked);
    saveSettings({ sat_enabled: isChecked }, () => {
      showToast(isChecked ? "Auto-complete enabled" : "Auto-complete paused");
    });
  });

  toggleBanglaPhonetic.addEventListener("change", () => {
    const isChecked = toggleBanglaPhonetic.checked;
    saveSettings({ sat_bangla_phonetic: isChecked }, () => {
      showToast(isChecked ? "Bangla Phonetic enabled" : "Bangla Phonetic disabled");
    });
  });

  toggleFloatingBtn.addEventListener("change", () => {
    const isChecked = toggleFloatingBtn.checked;
    saveSettings({ sat_floating_magic_btn: isChecked }, () => {
      showToast(isChecked ? "Magic button enabled" : "Magic button hidden");
    });
  });

  toggleSiteEnabled.addEventListener("change", () => {
    if (!currentHost) return;
    const isSiteEnabled = toggleSiteEnabled.checked;

    getSettings((data) => {
      let disabledDomains = Array.isArray(data.sat_disabled_domains) ? [...data.sat_disabled_domains] : [];
      if (isSiteEnabled) {
        disabledDomains = disabledDomains.filter((d) => d.toLowerCase() !== currentHost.toLowerCase());
      } else {
        if (!disabledDomains.some((d) => d.toLowerCase() === currentHost.toLowerCase())) {
          disabledDomains.push(currentHost.toLowerCase());
        }
      }

      saveSettings({ sat_disabled_domains: disabledDomains }, () => {
        showToast(isSiteEnabled ? `Enabled on ${currentHost}` : `Disabled on ${currentHost}`);
      });
    });
  });

  btnExport.addEventListener("click", () => {
    getSettings((data) => {
      const exportObject = {
        version: "2.1",
        date: new Date().toISOString(),
        bangla_phonetic: data.sat_bangla_phonetic || false,
        floating_magic_btn: data.sat_floating_magic_btn !== false,
        disabled_domains: data.sat_disabled_domains || [],
        snippets: data.sat_snippets || [],
        custom: data.sat_custom_dict || [],
        learned: data.sat_learned_dict || {}
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "typenext_backup.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 150);

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

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        getSettings((current) => {
          const importedSnippets = Array.isArray(imported.snippets) ? imported.snippets : [];
          const importedCustom = Array.isArray(imported.custom) ? imported.custom : (Array.isArray(imported) ? imported : []);
          const importedLearned = imported.learned && typeof imported.learned === "object" ? imported.learned : {};
          const importedDomains = Array.isArray(imported.disabled_domains) ? imported.disabled_domains : [];
          const importedPhonetic = typeof imported.bangla_phonetic === "boolean" ? imported.bangla_phonetic : current.sat_bangla_phonetic;
          const importedFloating = typeof imported.floating_magic_btn === "boolean" ? imported.floating_magic_btn : current.sat_floating_magic_btn;

          const snippetMap = new Map();
          (current.sat_snippets || []).forEach((s) => snippetMap.set(s.trigger.toLowerCase(), s));
          importedSnippets.forEach((s) => snippetMap.set(s.trigger.toLowerCase(), s));

          const combinedCustom = Array.from(new Set([...(current.sat_custom_dict || []), ...importedCustom]));
          const combinedLearned = { ...(current.sat_learned_dict || {}), ...importedLearned };
          const combinedDomains = Array.from(new Set([...(current.sat_disabled_domains || []), ...importedDomains]));

          saveSettings({
            sat_bangla_phonetic: importedPhonetic,
            sat_floating_magic_btn: importedFloating,
            sat_disabled_domains: combinedDomains,
            sat_snippets: Array.from(snippetMap.values()),
            sat_custom_dict: combinedCustom,
            sat_learned_dict: combinedLearned
          }, () => {
            toggleBanglaPhonetic.checked = importedPhonetic;
            toggleFloatingBtn.checked = importedFloating;
            renderCurrentList();
            showToast("Backup imported successfully ✓");
          });
        });
      } catch {
        showToast("Invalid JSON backup file");
      }
    };
    reader.readAsText(file);
  });

  btnUpdate.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: "https://github.com/jahidnation/suggest" });
    } else {
      window.open("https://github.com/jahidnation/suggest", "_blank");
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
    getSettings((data) => {
      updateStatusUI(data.sat_enabled);
      toggleBanglaPhonetic.checked = !!data.sat_bangla_phonetic;
      toggleFloatingBtn.checked = data.sat_floating_magic_btn !== false;
      if (currentHost) {
        const disabledList = Array.isArray(data.sat_disabled_domains) ? data.sat_disabled_domains : [];
        const isDomainDisabled = disabledList.some((d) => d.toLowerCase() === currentHost.toLowerCase());
        toggleSiteEnabled.checked = !isDomainDisabled;
      }
      renderCurrentList();
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