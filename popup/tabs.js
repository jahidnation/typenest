(() => {
  let currentTab = "shortcuts";
  let editingContext = null;

  const initTabs = (elements, showToast) => {
    const {
      tabShortcuts,
      tabCustom,
      tabLearned,
      countShortcuts,
      countCustom,
      countLearned,
      btnBulkClear,
      searchFilterInput,
      btnClearSearch,
      shortcutInputGroup,
      newShortcutTrigger,
      newShortcutText,
      btnAddShortcut,
      customInputGroup,
      newWordInput,
      btnAddWord,
      dictList,
      confirmModal,
      modalTitle,
      modalDesc,
      btnModalCancel,
      btnModalConfirm,
      editModal,
      editTriggerGroup,
      editTriggerInput,
      editTextInput,
      btnEditCancel,
      btnEditSave
    } = elements;

    const renderCurrentList = () => {
      window.TypeNextStorage.getSettings((data) => {
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
              window.TypeNextStorage.saveSettings({ sat_snippets: updated }, () => {
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
              window.TypeNextStorage.saveSettings({ sat_custom_dict: updated }, () => {
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
              window.TypeNextStorage.saveSettings({ sat_learned_dict: currentLearned }, () => {
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

      window.TypeNextStorage.getSettings((data) => {
        const list = Array.isArray(data.sat_snippets) ? [...data.sat_snippets] : [];
        const existingIdx = list.findIndex((s) => s.trigger.toLowerCase() === trigger.toLowerCase());

        if (existingIdx !== -1) {
          list[existingIdx] = { trigger, text };
          showToast(`Updated ${trigger} ✓`);
        } else {
          list.unshift({ trigger, text });
          showToast(`Hotkey ${trigger} added ✓`);
        }

        window.TypeNextStorage.saveSettings({ sat_snippets: list }, () => {
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

      window.TypeNextStorage.getSettings((data) => {
        const list = Array.isArray(data.sat_custom_dict) ? [...data.sat_custom_dict] : [];
        if (list.some((item) => item.toLowerCase() === value.toLowerCase())) {
          showToast("Already exists in dictionary");
          newWordInput.select();
          return;
        }

        list.unshift(value);
        window.TypeNextStorage.saveSettings({ sat_custom_dict: list }, () => {
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
        window.TypeNextStorage.saveSettings({ sat_snippets: [] }, () => {
          renderCurrentList();
          showToast("All hotkeys cleared ✓");
        });
      } else if (currentTab === "custom") {
        window.TypeNextStorage.saveSettings({ sat_custom_dict: [] }, () => {
          renderCurrentList();
          showToast("All custom phrases cleared ✓");
        });
      } else {
        window.TypeNextStorage.saveSettings({ sat_learned_dict: {} }, () => {
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

        window.TypeNextStorage.getSettings((data) => {
          const list = Array.isArray(data.sat_snippets) ? [...data.sat_snippets] : [];
          const idx = list.findIndex((s) => s.trigger.toLowerCase() === editingContext.original.trigger.toLowerCase());
          if (idx !== -1) {
            list[idx] = { trigger: newTrigger, text: newText };
          } else {
            list.unshift({ trigger: newTrigger, text: newText });
          }

          window.TypeNextStorage.saveSettings({ sat_snippets: list }, () => {
            editModal.classList.remove("show");
            editingContext = null;
            renderCurrentList();
            showToast("Hotkey updated ✓");
          });
        });
      } else if (editingContext.type === "custom") {
        window.TypeNextStorage.getSettings((data) => {
          const list = Array.isArray(data.sat_custom_dict) ? [...data.sat_custom_dict] : [];
          const idx = list.indexOf(editingContext.original);
          if (idx !== -1) {
            list[idx] = newText;
          } else {
            list.unshift(newText);
          }

          window.TypeNextStorage.saveSettings({ sat_custom_dict: list }, () => {
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

    return { renderCurrentList };
  };

  window.TypeNextTabs = { initTabs };
})();