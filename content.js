(() => {
  let isEnabled = true;
  let snippets = [];
  let customDict = [];
  let learnedDict = {};
  let currentTarget = null;
  let activeMatches = [];
  let selectedIndex = 0;
  let suggestionBox = null;
  let toastTimer = null;
  let debounceTimer = null;
  let currentReqId = 0;

  const storage = typeof chrome !== "undefined" && chrome.storage ? (chrome.storage.sync || chrome.storage.local) : null;

  const isPasswordField = (el) => {
    if (!el) return true;
    if (el.tagName === "INPUT" && el.type === "password") return true;
    const auto = (el.getAttribute("autocomplete") || "").toLowerCase();
    if (auto.includes("password")) return true;
    const name = (el.name || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const label = (el.getAttribute("aria-label") || "").toLowerCase();
    if (name.includes("password") || name.includes("passwd") || id.includes("password") || id.includes("passwd") || label.includes("password")) {
      return true;
    }
    return false;
  };

  const loadData = () => {
    if (!storage) return;
    storage.get({
      sat_enabled: true,
      sat_snippets: [],
      sat_custom_dict: [],
      sat_learned_dict: {}
    }, (items) => {
      isEnabled = items.sat_enabled !== false;
      snippets = Array.isArray(items.sat_snippets) ? items.sat_snippets : [];
      customDict = Array.isArray(items.sat_custom_dict) ? items.sat_custom_dict : [];
      learnedDict = items.sat_learned_dict || {};
    });
  };

  const saveLearned = () => {
    if (!storage) return;
    storage.set({ sat_learned_dict: learnedDict });
  };

  const saveCustom = () => {
    if (!storage) return;
    storage.set({ sat_custom_dict: customDict });
  };

  const saveSnippets = () => {
    if (!storage) return;
    storage.set({ sat_snippets: snippets });
  };

  const initUI = () => {
    if (document.getElementById("sat-suggestion-box")) return;

    suggestionBox = document.createElement("div");
    suggestionBox.id = "sat-suggestion-box";
    suggestionBox.className = "sat-suggestion-box";
    document.body.appendChild(suggestionBox);

    const toast = document.createElement("div");
    toast.id = "sat-toast";
    toast.className = "sat-toast";
    document.body.appendChild(toast);
  };

  const showToast = (message) => {
    const toast = document.getElementById("sat-toast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.innerHTML = `<i class="fa-solid fa-sparkles"></i><span>${message}</span>`;
    toast.classList.add("sat-show");
    toastTimer = setTimeout(() => toast.classList.remove("sat-show"), 2000);
  };

  const getTargetInfo = (el) => {
    if (!el || isPasswordField(el)) return null;
    if ("value" in el && typeof el.selectionStart === "number") {
      const text = el.value || "";
      const pos = el.selectionStart;
      const textBefore = text.slice(0, pos);
      const lastTokenMatch = textBefore.match(/([/;:a-zA-Z0-9_\u0980-\u09FF]+)$/);
      const queryWord = lastTokenMatch ? lastTokenMatch[1] : "";
      return {
        type: "input",
        element: el,
        textBefore,
        queryWord,
        queryStartPos: pos - queryWord.length,
        pos
      };
    }
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);
      const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || "";
      const lastTokenMatch = textBefore.match(/([/;:a-zA-Z0-9_\u0980-\u09FF]+)$/);
      const queryWord = lastTokenMatch ? lastTokenMatch[1] : "";
      return {
        type: "editable",
        element: el,
        textBefore,
        queryWord,
        queryStartPos: Math.max(0, (range.startOffset || 0) - queryWord.length),
        range
      };
    }
    return null;
  };

  const calculateCaretCoords = (target) => {
    const rect = target.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 4;

    if (target.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        const clientRects = range.getClientRects();
        if (clientRects.length > 0) {
          const cRect = clientRects[0];
          x = cRect.left;
          y = cRect.bottom + 4;
        }
      }
    }

    const maxLeft = window.innerWidth - 270;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    return {
      left: Math.max(8, Math.min(x + scrollX, maxLeft + scrollX)),
      top: y + scrollY
    };
  };

  const hideSuggestions = () => {
    if (!suggestionBox) return;
    suggestionBox.classList.remove("sat-visible");
    suggestionBox.innerHTML = "";
    activeMatches = [];
    selectedIndex = 0;
  };

  const deleteFromMemory = (item) => {
    let deleted = false;
    if (item.type === "snippet") {
      const idx = snippets.findIndex((s) => s.trigger.toLowerCase() === item.trigger.toLowerCase());
      if (idx !== -1) {
        snippets.splice(idx, 1);
        saveSnippets();
        deleted = true;
      }
    } else {
      const text = item.text;
      if (learnedDict[text]) {
        delete learnedDict[text];
        saveLearned();
        deleted = true;
      }
      const idx = customDict.indexOf(text);
      if (idx !== -1) {
        customDict.splice(idx, 1);
        saveCustom();
        deleted = true;
      }
    }

    activeMatches = activeMatches.filter((m) => m !== item);
    if (activeMatches.length > 0) {
      selectedIndex = Math.min(selectedIndex, activeMatches.length - 1);
      renderSuggestions(currentTarget);
    } else {
      hideSuggestions();
    }

    if (deleted) {
      showToast(`Deleted from memory ✓`);
    }
  };

  const renderSuggestions = (target) => {
    if (!suggestionBox || !activeMatches.length) {
      hideSuggestions();
      return;
    }

    const coords = calculateCaretCoords(target);
    suggestionBox.style.left = `${coords.left}px`;
    suggestionBox.style.top = `${coords.top}px`;
    suggestionBox.innerHTML = "";

    activeMatches.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = `sat-suggestion-item${index === selectedIndex ? " sat-selected" : ""}`;

      let contentHtml = "";
      if (item.type === "snippet") {
        contentHtml = `
          <div style="display:flex;align-items:center;gap:6px;overflow:hidden;flex:1;">
            <i class="fa-solid fa-bolt" style="color:#eab308;font-size:11px;"></i>
            <span style="color:#60a5fa;font-weight:700;">${item.trigger}</span>
            <i class="fa-solid fa-arrow-right" style="font-size:9px;color:#6b7280;"></i>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;">${item.text}</span>
          </div>
        `;
      } else {
        const iconType = item.type === "phonetic"
          ? '<i class="fa-solid fa-language" style="color:#a855f7;font-size:11px;"></i>'
          : item.type === "google"
            ? '<i class="fa-brands fa-google" style="color:#3b82f6;font-size:11px;"></i>'
            : '<i class="fa-solid fa-bookmark" style="color:#10b981;font-size:11px;"></i>';

        contentHtml = `
          <div style="display:flex;align-items:center;gap:7px;overflow:hidden;flex:1;">
            ${iconType}
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;">${item.text}</span>
          </div>
        `;
      }

      row.innerHTML = `
        ${contentHtml}
        <div style="display:flex;align-items:center;gap:5px;">
          <button type="button" class="sat-del-btn" title="Delete from memory" style="border:none;background:transparent;color:#9ca3af;cursor:pointer;padding:2px 4px;font-size:11px;border-radius:4px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <span class="sat-key-hint">Tab</span>
        </div>
      `;

      row.querySelector(".sat-del-btn").addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteFromMemory(item);
      });

      row.addEventListener("mousedown", (e) => {
        if (e.target.closest(".sat-del-btn")) return;
        e.preventDefault();
        applySuggestion(item);
      });

      suggestionBox.appendChild(row);
    });

    suggestionBox.classList.add("sat-visible");
  };

  const getMatchedSnippets = (queryWord) => {
    if (!queryWord) return [];
    const qLower = queryWord.toLowerCase();
    return snippets
      .filter((s) => s.trigger.toLowerCase().startsWith(qLower) || s.trigger.toLowerCase() === qLower)
      .map((s) => ({
        trigger: s.trigger,
        text: s.text,
        type: "snippet"
      }));
  };

  const getLocalMatches = (queryWord) => {
    if (!queryWord) return [];
    const pool = Array.from(new Set([...customDict, ...Object.keys(learnedDict)]));
    const qLower = queryWord.toLowerCase();

    return pool
      .filter((w) => w.toLowerCase().startsWith(qLower) && w.toLowerCase() !== qLower)
      .map((w) => ({ text: w, type: "local" }))
      .slice(0, 3);
  };

  const applySuggestion = (item) => {
    if (!currentTarget || !item || !item.text) return;
    const info = getTargetInfo(currentTarget);
    if (!info) return;

    const chosen = item.text + " ";

    if (info.type === "input") {
      const el = info.element;
      const text = el.value;
      const start = info.queryStartPos;
      const end = info.pos;
      const newText = text.slice(0, start) + chosen + text.slice(end);
      el.value = newText;
      const nextPos = start + chosen.length;
      el.setSelectionRange(nextPos, nextPos);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (info.type === "editable") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node && node.nodeType === Node.TEXT_NODE) {
          const val = node.textContent || "";
          const start = Math.max(0, range.startOffset - info.queryWord.length);
          node.textContent = val.slice(0, start) + chosen + val.slice(range.startOffset);
          range.setStart(node, start + chosen.length);
          range.setEnd(node, start + chosen.length);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          document.execCommand("insertText", false, chosen);
        }
      }
    }

    if (item.type !== "snippet") {
      learnedDict[item.text] = (learnedDict[item.text] || 0) + 1;
      saveLearned();
    }

    hideSuggestions();
  };

  const handleTyping = (e) => {
    if (!isEnabled) return;
    const target = e.target;
    if (!target || isPasswordField(target)) {
      hideSuggestions();
      return;
    }

    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      if (["hidden", "file", "checkbox", "radio", "button", "submit"].includes(target.type)) return;
      currentTarget = target;
      const info = getTargetInfo(target);
      if (!info || !info.queryWord || info.queryWord.length < 2) {
        hideSuggestions();
        return;
      }

      const matchedSnippets = getMatchedSnippets(info.queryWord);
      const localResults = getLocalMatches(info.queryWord);
      activeMatches = [...matchedSnippets, ...localResults];
      selectedIndex = 0;

      if (activeMatches.length > 0) {
        renderSuggestions(target);
      }

      const thisReqId = ++currentReqId;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          chrome.runtime.sendMessage(
            { action: "fetchGoogleSuggestions", query: info.queryWord },
            (response) => {
              if (chrome.runtime.lastError || !response || !response.suggestions) return;
              if (thisReqId !== currentReqId || currentTarget !== target) return;

              const merged = [...matchedSnippets, ...localResults];
              response.suggestions.forEach((ext) => {
                if (!merged.some((m) => m.text.toLowerCase() === ext.text.toLowerCase())) {
                  merged.push(ext);
                }
              });

              if (merged.length > 0) {
                activeMatches = merged.slice(0, 5);
                selectedIndex = 0;
                renderSuggestions(target);
              }
            }
          );
        } catch {}
      }, 70);
    }
  };

  const handleKeydown = (e) => {
    if (!isEnabled || isPasswordField(e.target)) return;

    if (e.key === " " || e.key === "Tab") {
      const info = getTargetInfo(e.target);
      if (info && info.queryWord) {
        const directSnippet = snippets.find(
          (s) => s.trigger.toLowerCase() === info.queryWord.toLowerCase()
        );
        if (directSnippet) {
          e.preventDefault();
          e.stopPropagation();
          applySuggestion({ trigger: directSnippet.trigger, text: directSnippet.text, type: "snippet" });
          return;
        }
      }
    }

    if (!activeMatches.length) return;

    if (e.key === "Delete" && e.shiftKey) {
      e.preventDefault();
      const current = activeMatches[selectedIndex];
      if (current) deleteFromMemory(current);
      return;
    }

    if (e.key === "Tab" || (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      applySuggestion(activeMatches[selectedIndex]);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % activeMatches.length;
      renderSuggestions(currentTarget);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + activeMatches.length) % activeMatches.length;
      renderSuggestions(currentTarget);
      return;
    }

    if (e.key === "Escape") {
      hideSuggestions();
    }
  };

  const handleAutoLearn = (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    const target = e.target;
    if (isPasswordField(target)) return;

    const info = getTargetInfo(target);
    if (!info) return;

    const trimmed = info.textBefore.trim();
    if (!trimmed) return;

    const tokens = trimmed.split(/\s+/);
    const lastWord = tokens[tokens.length - 1];
    if (
      lastWord &&
      lastWord.length >= 3 &&
      !lastWord.startsWith("/") &&
      !lastWord.startsWith(";") &&
      !/^\d+$/.test(lastWord)
    ) {
      learnedDict[lastWord] = (learnedDict[lastWord] || 0) + 1;
      saveLearned();
    }
  };

  document.addEventListener("input", handleTyping, true);
  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("keydown", handleAutoLearn, true);
  document.addEventListener("click", (e) => {
    if (!suggestionBox || suggestionBox.contains(e.target)) return;
    hideSuggestions();
  }, true);

  window.addEventListener("scroll", hideSuggestions, { passive: true });
  window.addEventListener("resize", hideSuggestions, { passive: true });

  if (storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.sat_enabled) isEnabled = changes.sat_enabled.newValue !== false;
      if (changes.sat_snippets) snippets = changes.sat_snippets.newValue || [];
      if (changes.sat_custom_dict) customDict = changes.sat_custom_dict.newValue || [];
      if (changes.sat_learned_dict) learnedDict = changes.sat_learned_dict.newValue || {};
    });
  }

  initUI();
  loadData();
})();