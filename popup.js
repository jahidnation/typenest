document.addEventListener("DOMContentLoaded", () => {
  const toggleEnabled = document.getElementById("toggleEnabled");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
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
  const popupToast = document.getElementById("popupToast");
  const popupToastText = document.getElementById("popupToastText");

  let currentTab = "shortcuts";
  let toastTimer = null;
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
      sat_snippets: [],
      sat_custom_dict: [],
      sat_learned_dict: {}
    };

    if (storage) {
      storage.get(defaults, callback);
    } else {
      callback({
        sat_enabled: localStorage.getItem("sat_enabled") !== "false",
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
            <button type="button" class="dict-del" title="Delete hotkey">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          `;

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
            <button type="button" class="dict-del" title="Delete phrase">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          `;

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
            <button type="button" class="dict-del" title="Delete word">
              <i class="fa-solid fa-trash-can"></i>
            </button>
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

  btnExport.addEventListener("click", () => {
    getSettings((data) => {
      const exportObject = {
        version: "2.0",
        date: new Date().toISOString(),
        snippets: data.sat_snippets || [],
        custom: data.sat_custom_dict || [],
        learned: data.sat_learned_dict || {}
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "smart_autotype_backup.json";
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

          const snippetMap = new Map();
          (current.sat_snippets || []).forEach((s) => snippetMap.set(s.trigger.toLowerCase(), s));
          importedSnippets.forEach((s) => snippetMap.set(s.trigger.toLowerCase(), s));

          const combinedCustom = Array.from(new Set([...(current.sat_custom_dict || []), ...importedCustom]));
          const combinedLearned = { ...(current.sat_learned_dict || {}), ...importedLearned };

          saveSettings({
            sat_snippets: Array.from(snippetMap.values()),
            sat_custom_dict: combinedCustom,
            sat_learned_dict: combinedLearned
          }, () => {
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

  getSettings((data) => {
    updateStatusUI(data.sat_enabled);
    renderCurrentList();
  });
});