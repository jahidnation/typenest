(() => {
  let isEnabled = true;
  let disabledDomains = [];
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

  const isCurrentSiteDisabled = () => {
    const host = window.location.hostname.toLowerCase();
    return disabledDomains.some((d) => d && (host === d.toLowerCase() || host.endsWith("." + d.toLowerCase())));
  };

  const isPasswordField = (el) => {
    if (!el) return true;
    if (el.tagName === "INPUT" && el.type === "password") return true;
    const auto = (el.getAttribute("autocomplete") || "").toLowerCase();
    if (auto.includes("password")) return true;
    const name = (el.name || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const label = (el.getAttribute("aria-label") || "").toLowerCase();
    return name.includes("password") || name.includes("passwd") || id.includes("password") || id.includes("passwd") || label.includes("password");
  };

  const detectTheme = (target) => {
    let isLight = false;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      isLight = true;
    }
    try {
      const checkEl = target || document.body || document.documentElement;
      const bg = window.getComputedStyle(checkEl).backgroundColor;
      const rgb = bg.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const r = parseInt(rgb[0], 10);
        const g = parseInt(rgb[1], 10);
        const b = parseInt(rgb[2], 10);
        const a = rgb[3] !== undefined ? parseFloat(rgb[3]) : 1;
        if (a > 0.15) {
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          isLight = brightness > 145;
        }
      }
    } catch {}
    return isLight ? "sat-theme-light" : "sat-theme-dark";
  };

  const loadData = () => {
    if (!storage) return;
    storage.get({
      sat_enabled: true,
      sat_disabled_domains: [],
      sat_snippets: [],
      sat_custom_dict: [],
      sat_learned_dict: {}
    }, (items) => {
      isEnabled = items.sat_enabled !== false;
      disabledDomains = Array.isArray(items.sat_disabled_domains) ? items.sat_disabled_domains : [];
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

  const updateSuggestionPosition = (target) => {
    if (!suggestionBox || !target) return;
    const rect = target.getBoundingClientRect();
    let x = rect.left;
    let targetTop = rect.top;
    let targetBottom = rect.bottom;

    if (target.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        const clientRects = range.getClientRects();
        if (clientRects.length > 0) {
          const cRect = clientRects[0];
          x = cRect.left;
          targetTop = cRect.top;
          targetBottom = cRect.bottom;
        }
      }
    }

    const boxHeight = suggestionBox.offsetHeight || 38;
    const boxWidth = suggestionBox.offsetWidth || 280;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let topPos = targetBottom + 6 + scrollY;
    if (targetBottom + boxHeight + 10 > viewportHeight && targetTop - boxHeight - 6 >= 0) {
      topPos = targetTop - boxHeight - 6 + scrollY;
    }

    const maxLeft = viewportWidth - boxWidth - 12;
    const leftPos = Math.max(8, Math.min(x + scrollX, maxLeft + scrollX));

    suggestionBox.style.left = `${leftPos}px`;
    suggestionBox.style.top = `${topPos}px`;
  };

  const hideSuggestions = () => {
    clearTimeout(debounceTimer);
    ++currentReqId;
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
      showToast("Deleted from memory ✓");
    }
  };

  const renderSuggestions = (target) => {
    if (!suggestionBox || !activeMatches.length) {
      hideSuggestions();
      return;
    }

    const themeClass = detectTheme(target);
    suggestionBox.className = `sat-suggestion-box ${themeClass}`;
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
            <i class="fa-solid fa-arrow-right" style="font-size:9px;opacity:0.6;"></i>
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
        <div style="display:flex;align-items:center;gap:4px;">
          <button type="button" class="sat-del-btn" title="Delete from memory">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <span class="sat-key-hint">${index + 1}</span>
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
    updateSuggestionPosition(target);
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
    if (!isEnabled || isCurrentSiteDisabled()) {
      hideSuggestions();
      return;
    }

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

              const freshInfo = getTargetInfo(target);
              if (!freshInfo || !freshInfo.queryWord || freshInfo.queryWord.length < 2) {
                hideSuggestions();
                return;
              }

              const merged = [...matchedSnippets, ...localResults];
              const extGoogle = [];
              let extPhonetic = null;

              response.suggestions.forEach((ext) => {
                if (ext.type === "phonetic") {
                  if (!extPhonetic) extPhonetic = ext;
                } else {
                  if (!merged.some((m) => m.text.toLowerCase() === ext.text.toLowerCase()) && !extGoogle.some((m) => m.text.toLowerCase() === ext.text.toLowerCase())) {
                    extGoogle.push(ext);
                  }
                }
              });

              const primaryList = [...merged, ...extGoogle];
              const maxSlots = 6;
              if (extPhonetic) {
                activeMatches = [...primaryList.slice(0, maxSlots - 1), extPhonetic];
              } else {
                activeMatches = primaryList.slice(0, maxSlots);
              }

              if (activeMatches.length > 0) {
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
    if (!isEnabled || isCurrentSiteDisabled() || isPasswordField(e.target)) return;

    if (e.key === "Backspace" || e.key === "Delete") {
      setTimeout(() => {
        const info = getTargetInfo(e.target);
        if (!info || !info.queryWord || info.queryWord.length < 2) {
          hideSuggestions();
        }
      }, 10);
    }

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

    if (e.key >= "1" && e.key <= String(Math.min(activeMatches.length, 9)) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      applySuggestion(activeMatches[parseInt(e.key, 10) - 1]);
      return;
    }

    if (e.key === "Delete" && e.shiftKey) {
      e.preventDefault();
      const current = activeMatches[selectedIndex];
      if (current) deleteFromMemory(current);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      applySuggestion(activeMatches[selectedIndex]);
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % activeMatches.length;
      renderSuggestions(currentTarget);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
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
    if (!isEnabled || isCurrentSiteDisabled()) return;
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
      if (changes.sat_disabled_domains) {
        disabledDomains = Array.isArray(changes.sat_disabled_domains.newValue) ? changes.sat_disabled_domains.newValue : [];
        if (isCurrentSiteDisabled()) hideSuggestions();
      }
      if (changes.sat_snippets) snippets = changes.sat_snippets.newValue || [];
      if (changes.sat_custom_dict) customDict = changes.sat_custom_dict.newValue || [];
      if (changes.sat_learned_dict) learnedDict = changes.sat_learned_dict.newValue || {};
    });
  }

  initUI();
  loadData();
})();