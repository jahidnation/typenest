(() => {
  let isEnabled = true;
  let isBanglaPhonetic = false;
  let floatingBtnEnabled = true;
  let disabledDomains = [];
  let snippets = [];
  let customDict = [];
  let learnedDict = {};
  let currentTarget = null;
  let activeMatches = [];
  let selectedIndex = 0;
  let debounceTimer = null;
  let currentReqId = 0;
  let phoneticBuffer = "";
  let phoneticBanglaLen = 0;
  let docsKeyBuffer = "";
  const attachedRoots = new WeakSet();

  const storage = typeof chrome !== "undefined" && chrome.storage ? (chrome.storage.sync || chrome.storage.local) : null;

  const isCurrentSiteDisabled = () => {
    const host = window.location.hostname.toLowerCase();
    return disabledDomains.some((d) => d && (host === d.toLowerCase() || host.endsWith("." + d.toLowerCase())));
  };

  const resetPhoneticState = () => {
    phoneticBuffer = "";
    phoneticBanglaLen = 0;
  };

  const loadData = () => {
    if (!storage) return;
    storage.get({
      sat_enabled: true,
      sat_bangla_phonetic: false,
      sat_floating_magic_btn: true,
      sat_disabled_domains: [],
      sat_snippets: [],
      sat_custom_dict: [],
      sat_learned_dict: {}
    }, (items) => {
      isEnabled = items.sat_enabled !== false;
      isBanglaPhonetic = items.sat_bangla_phonetic === true;
      floatingBtnEnabled = items.sat_floating_magic_btn !== false;
      disabledDomains = Array.isArray(items.sat_disabled_domains) ? items.sat_disabled_domains : [];
      snippets = Array.isArray(items.sat_snippets) ? items.sat_snippets : [];
      customDict = Array.isArray(items.sat_custom_dict) ? items.sat_custom_dict : [];
      learnedDict = items.sat_learned_dict || {};

      const magicBtn = window.TypeNextUI.getMagicBtn();
      if (!floatingBtnEnabled && magicBtn) {
        magicBtn.style.display = "none";
      }
    });
  };

  const saveLearned = () => {
    if (storage) storage.set({ sat_learned_dict: learnedDict });
  };

  const saveSnippets = () => {
    if (storage) storage.set({ sat_snippets: snippets });
  };

  const executeMagicTranslate = () => {
    const target = currentTarget || window.TypeNextDOM.getDeepActiveElement();
    if (!target || window.TypeNextDOM.isPasswordField(target)) {
      window.TypeNextUI.showToast("Select an input field first");
      return;
    }
    const doc = target.ownerDocument || document;
    const win = doc.defaultView || window;

    let sourceText = "";
    let isSelection = false;

    if (window.TypeNextDOM.isGoogleDocs()) {
      const iframe = document.querySelector(".docs-texteventtarget-iframe");
      const iWin = iframe?.contentWindow;
      const sel = iWin ? iWin.getSelection() : window.getSelection();
      sourceText = (sel ? sel.toString().trim() : "") || (window.getSelection() ? window.getSelection().toString().trim() : "");
    } else if ("value" in target) {
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      if (start !== end) {
        sourceText = target.value.substring(start, end).trim();
        isSelection = true;
      } else {
        sourceText = (target.value || "").trim();
      }
    } else if (target.isContentEditable) {
      const sel = win.getSelection();
      const selText = sel ? sel.toString().trim() : "";
      if (selText) {
        sourceText = selText;
        isSelection = true;
      } else {
        sourceText = (target.innerText || "").trim();
      }
    }

    if (!sourceText) {
      window.TypeNextUI.showToast("No text to translate");
      return;
    }

    window.TypeNextUI.setMagicBtnLoading(true);

    chrome.runtime.sendMessage({ action: "translateText", text: sourceText }, async (response) => {
      window.TypeNextUI.setMagicBtnLoading(false);

      if (!response || !response.translatedText) {
        window.TypeNextUI.showToast("Translation failed");
        return;
      }

      const translated = response.translatedText;

      if (window.TypeNextDOM.isGoogleDocs()) {
        window.TypeNextDOM.insertIntoGoogleDocs(translated);
      } else if ("value" in target) {
        const val = target.value;
        if (isSelection) {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          target.value = val.slice(0, start) + translated + val.slice(end);
          const next = start + translated.length;
          target.setSelectionRange(next, next);
        } else {
          target.value = translated;
          target.setSelectionRange(translated.length, translated.length);
        }
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (target.isContentEditable) {
        if (isSelection) {
          window.TypeNextDOM.executeInputReplacement(target, translated, 0);
        } else {
          target.innerText = translated;
          target.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }

      const langName = response.toLang === "en" ? "English" : "Bangla";
      window.TypeNextUI.showToast(`Translated to ${langName} ✓`);
      window.TypeNextUI.positionMagicBtn(target, { floatingBtnEnabled, isEnabled, isSiteDisabled: isCurrentSiteDisabled() });
    });
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
        deleted = true;
      }
    }

    activeMatches = activeMatches.filter((m) => m !== item);
    if (activeMatches.length > 0) {
      selectedIndex = Math.min(selectedIndex, activeMatches.length - 1);
      window.TypeNextUI.renderSuggestions(currentTarget, activeMatches, selectedIndex, applySuggestion, deleteFromMemory);
    } else {
      window.TypeNextUI.hideSuggestions();
    }

    if (deleted) {
      window.TypeNextUI.showToast("Deleted from memory ✓");
    }
  };

  const getMatchedSnippets = (queryWord) => {
    if (!queryWord) return [];
    const qLower = queryWord.toLowerCase();
    return snippets
      .filter((s) => s.trigger.toLowerCase().startsWith(qLower) || s.trigger.toLowerCase() === qLower)
      .map((s) => ({ trigger: s.trigger, text: s.text, type: "snippet" }));
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
    const info = window.TypeNextDOM.getTargetInfo(currentTarget, docsKeyBuffer);
    if (!info) return;

    activeMatches = [];
    selectedIndex = 0;

    const chosen = item.text + " ";
    if (window.TypeNextDOM.isGoogleDocs()) {
      window.TypeNextDOM.insertIntoGoogleDocs(chosen);
    } else {
      window.TypeNextDOM.executeInputReplacement(currentTarget, chosen, info.queryWord.length);
    }

    if (item.type !== "snippet") {
      learnedDict[item.text] = (learnedDict[item.text] || 0) + 1;
      saveLearned();
    }

    docsKeyBuffer = "";
    resetPhoneticState();
    window.TypeNextUI.hideSuggestions();
  };

  const handleTyping = (e) => {
    if (!isEnabled || isCurrentSiteDisabled()) {
      window.TypeNextUI.hideSuggestions();
      return;
    }

    const target = window.TypeNextDOM.getEventTarget(e);
    if (!target || window.TypeNextDOM.isPasswordField(target)) {
      window.TypeNextUI.hideSuggestions();
      return;
    }

    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      window.TypeNextDOM.isGoogleDocs()
    ) {
      if (["hidden", "file", "checkbox", "radio", "button", "submit"].includes(target.type)) return;
      currentTarget = target.isContentEditable ? (target.closest('[contenteditable="true"]') || target) : target;
      window.TypeNextUI.positionMagicBtn(currentTarget, { floatingBtnEnabled, isEnabled, isSiteDisabled: isCurrentSiteDisabled() });

      if (window.TypeNextDOM.isGoogleDocs()) {
        window.TypeNextUI.hideSuggestions();
        return;
      }

      const info = window.TypeNextDOM.getTargetInfo(currentTarget, docsKeyBuffer);
      if (!info || !info.queryWord || info.queryWord.length < 1) {
        window.TypeNextUI.hideSuggestions();
        return;
      }

      const matchedSnippets = getMatchedSnippets(info.queryWord);
      const localResults = getLocalMatches(info.queryWord);
      activeMatches = [...matchedSnippets, ...localResults];
      selectedIndex = 0;

      if (activeMatches.length > 0) {
        window.TypeNextUI.renderSuggestions(currentTarget, activeMatches, selectedIndex, applySuggestion, deleteFromMemory);
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

              const freshInfo = window.TypeNextDOM.getTargetInfo(currentTarget, docsKeyBuffer);
              if (!freshInfo || !freshInfo.queryWord || freshInfo.queryWord.length < 1) {
                window.TypeNextUI.hideSuggestions();
                return;
              }

              const merged = [...matchedSnippets, ...localResults];
              const extPhonetic = [];
              const extGoogle = [];

              response.suggestions.forEach((ext) => {
                if (ext.type === "phonetic") {
                  extPhonetic.push(ext);
                } else {
                  if (!merged.some((m) => m.text.toLowerCase() === ext.text.toLowerCase()) && !extGoogle.some((m) => m.text.toLowerCase() === ext.text.toLowerCase())) {
                    extGoogle.push(ext);
                  }
                }
              });

              if (isBanglaPhonetic && extPhonetic.length > 0) {
                activeMatches = [...extPhonetic, ...matchedSnippets, ...localResults, ...extGoogle].slice(0, 6);
              } else {
                const primaryList = [...merged, ...extGoogle];
                if (extPhonetic.length > 0) {
                  activeMatches = [...primaryList.slice(0, 5), extPhonetic[0]];
                } else {
                  activeMatches = primaryList.slice(0, 6);
                }
              }

              if (activeMatches.length > 0) {
                selectedIndex = 0;
                window.TypeNextUI.renderSuggestions(currentTarget, activeMatches, selectedIndex, applySuggestion, deleteFromMemory);
              }
            }
          );
        } catch {}
      }, 50);
    }
  };

  const handleKeydown = (e) => {
    if ((e.ctrlKey && e.key.toLowerCase() === "m") || e.key === "F12") {
      e.preventDefault();
      isBanglaPhonetic = !isBanglaPhonetic;
      resetPhoneticState();
      docsKeyBuffer = "";
      window.TypeNextUI.hideSuggestions();
      if (storage) storage.set({ sat_bangla_phonetic: isBanglaPhonetic });
      window.TypeNextUI.showToast(isBanglaPhonetic ? "Bangla Phonetic Mode: ON" : "Bangla Phonetic Mode: OFF");
      return;
    }

    if (e.altKey && (e.key === "t" || e.key === "T")) {
      e.preventDefault();
      executeMagicTranslate();
      return;
    }

    const rawTarget = window.TypeNextDOM.getEventTarget(e);
    if (!isEnabled || isCurrentSiteDisabled() || window.TypeNextDOM.isPasswordField(rawTarget)) return;

    if (activeMatches.length > 0 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key >= "1" && e.key <= String(Math.min(activeMatches.length, 9))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const selected = activeMatches[parseInt(e.key, 10) - 1];
        applySuggestion(selected);
        return;
      }

      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const selected = activeMatches[selectedIndex];
        applySuggestion(selected);
        return;
      }

      if (e.key === "Delete" && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const current = activeMatches[selectedIndex];
        if (current) deleteFromMemory(current);
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        selectedIndex = (selectedIndex + 1) % activeMatches.length;
        window.TypeNextUI.renderSuggestions(currentTarget, activeMatches, selectedIndex, applySuggestion, deleteFromMemory);
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        selectedIndex = (selectedIndex - 1 + activeMatches.length) % activeMatches.length;
        window.TypeNextUI.renderSuggestions(currentTarget, activeMatches, selectedIndex, applySuggestion, deleteFromMemory);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        activeMatches = [];
        resetPhoneticState();
        window.TypeNextUI.hideSuggestions();
        return;
      }
    }

    if (e.key === "Enter") {
      resetPhoneticState();
      docsKeyBuffer = "";
      window.TypeNextUI.hideSuggestions();
    }

    const targetEl = window.TypeNextDOM.isGoogleDocs() ? (currentTarget || window.TypeNextDOM.getGoogleDocsTarget()) : (rawTarget || currentTarget);

    if (window.TypeNextDOM.isGoogleDocs()) {
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        docsKeyBuffer += e.key;
        if (docsKeyBuffer.length > 40) docsKeyBuffer = docsKeyBuffer.slice(-40);
      } else if (e.key === "Backspace") {
        docsKeyBuffer = docsKeyBuffer.slice(0, -1);
      } else if (["Enter", "Escape"].includes(e.key)) {
        docsKeyBuffer = "";
      }
    }

    if (isBanglaPhonetic && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key.length === 1 && /[a-zA-Z0-9`^:$~]/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        phoneticBuffer += e.key;
        const parsed = window.TypeNextAvro.parse(phoneticBuffer);

        if (window.TypeNextDOM.isGoogleDocs()) {
          window.TypeNextUI.showPhoneticPreview(parsed);
        } else {
          window.TypeNextDOM.executeInputReplacement(targetEl, parsed, phoneticBanglaLen);
          phoneticBanglaLen = parsed.length;
        }
        return;
      }

      if (e.key === "Backspace" && phoneticBuffer.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        phoneticBuffer = phoneticBuffer.slice(0, -1);
        if (phoneticBuffer.length > 0) {
          const parsed = window.TypeNextAvro.parse(phoneticBuffer);
          if (window.TypeNextDOM.isGoogleDocs()) {
            window.TypeNextUI.showPhoneticPreview(parsed);
          } else {
            window.TypeNextDOM.executeInputReplacement(targetEl, parsed, phoneticBanglaLen);
            phoneticBanglaLen = parsed.length;
          }
        } else {
          if (window.TypeNextDOM.isGoogleDocs()) {
            window.TypeNextUI.hideSuggestions();
          } else {
            window.TypeNextDOM.executeInputReplacement(targetEl, "", phoneticBanglaLen);
            phoneticBanglaLen = 0;
          }
        }
        return;
      }

      if ([" ", "Enter", "Tab"].includes(e.key) || /[,.?!;/\\]/.test(e.key)) {
        if (window.TypeNextDOM.isGoogleDocs() && phoneticBuffer.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          const parsed = window.TypeNextAvro.parse(phoneticBuffer);
          const delimiter = e.key === "Enter" ? "\n" : (e.key === " " ? " " : e.key);
          phoneticBuffer = "";
          phoneticBanglaLen = 0;
          window.TypeNextUI.hideSuggestions();
          window.TypeNextDOM.insertIntoGoogleDocs(parsed + delimiter);
          return;
        }
        resetPhoneticState();
      }
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      setTimeout(() => {
        const info = window.TypeNextDOM.getTargetInfo(targetEl || currentTarget, docsKeyBuffer);
        if (!info || !info.queryWord || info.queryWord.length < 1) {
          window.TypeNextUI.hideSuggestions();
        }
      }, 10);
    }

    if (e.key === " " || e.key === "Tab") {
      const info = window.TypeNextDOM.getTargetInfo(targetEl || currentTarget, docsKeyBuffer);
      if (info && info.queryWord) {
        const directSnippet = snippets.find(
          (s) => s.trigger.toLowerCase() === info.queryWord.toLowerCase()
        );
        if (directSnippet) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          applySuggestion({ trigger: directSnippet.trigger, text: directSnippet.text, type: "snippet" });
          return;
        }
      }
      docsKeyBuffer = "";
    }
  };

  const handleAutoLearn = (e) => {
    if (!isEnabled || isCurrentSiteDisabled()) return;
    if (e.key !== " " && e.key !== "Enter") return;
    const target = window.TypeNextDOM.getEventTarget(e);
    if (window.TypeNextDOM.isPasswordField(target)) return;

    const info = window.TypeNextDOM.getTargetInfo(target, docsKeyBuffer);
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

  const attachRoot = (root) => {
    if (!root || attachedRoots.has(root)) return;
    attachedRoots.add(root);
    try {
      root.addEventListener("keydown", handleKeydown, true);
      root.addEventListener("input", handleTyping, true);
      root.addEventListener("focusin", handleInteraction, true);
      root.addEventListener("mousedown", handleInteraction, true);
      root.addEventListener("submit", () => window.TypeNextUI.hideSuggestions(), true);
    } catch {}
  };

  const scanAllRoots = (node = document) => {
    try {
      document.querySelectorAll("iframe").forEach((iframe) => {
        try {
          const doc = iframe.contentDocument;
          if (doc) attachRoot(doc);
        } catch {}
      });

      const rootElement = node === document ? (document.body || document.documentElement) : node;
      if (!rootElement) return;

      const treeWalker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_ELEMENT,
        null
      );

      let curr = treeWalker.currentNode;
      while (curr) {
        if (curr.shadowRoot) {
          attachRoot(curr.shadowRoot);
          scanAllRoots(curr.shadowRoot);
        }
        curr = treeWalker.nextNode();
      }
    } catch {}
  };

  const handleInteraction = (e) => {
    const el = window.TypeNextDOM.getEventTarget(e);
    const magicBtn = window.TypeNextUI.getMagicBtn();
    if (!el || el === magicBtn || (magicBtn && magicBtn.contains(el))) return;

    if (window.TypeNextDOM.isGoogleDocs()) {
      scanAllRoots();
      const docsTarget = window.TypeNextDOM.getGoogleDocsTarget();
      if (docsTarget) {
        currentTarget = docsTarget;
        window.TypeNextUI.positionMagicBtn(docsTarget, { floatingBtnEnabled, isEnabled, isSiteDisabled: isCurrentSiteDisabled() });
        return;
      }
    }

    if (
      el.tagName === "TEXTAREA" ||
      (el.tagName === "INPUT" && !["hidden", "file", "checkbox", "radio", "button", "submit"].includes(el.type)) ||
      el.isContentEditable
    ) {
      currentTarget = el.isContentEditable ? (el.closest('[contenteditable="true"]') || el) : el;
      resetPhoneticState();
      window.TypeNextUI.positionMagicBtn(currentTarget, { floatingBtnEnabled, isEnabled, isSiteDisabled: isCurrentSiteDisabled() });
    }
  };

  window.addEventListener("focusin", handleInteraction, true);
  window.addEventListener("mousedown", handleInteraction, true);
  window.addEventListener("input", handleTyping, true);
  window.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("keydown", handleAutoLearn, true);
  window.addEventListener("submit", () => window.TypeNextUI.hideSuggestions(), true);

  window.addEventListener("click", (e) => {
    if (window.TypeNextDOM.isGoogleDocs() && phoneticBuffer.length > 0) {
      const parsed = window.TypeNextAvro.parse(phoneticBuffer);
      phoneticBuffer = "";
      phoneticBanglaLen = 0;
      window.TypeNextUI.hideSuggestions();
      window.TypeNextDOM.insertIntoGoogleDocs(parsed);
    }
    resetPhoneticState();
    docsKeyBuffer = "";
    const magicBtn = window.TypeNextUI.getMagicBtn();
    const suggestionBox = window.TypeNextUI.getSuggestionBox();
    if (magicBtn && (e.target === magicBtn || magicBtn.contains(e.target))) return;
    if (suggestionBox && suggestionBox.contains(e.target)) return;
    window.TypeNextUI.hideSuggestions();
  }, true);

  window.addEventListener("scroll", () => {
    window.TypeNextUI.hideSuggestions();
    if (currentTarget) window.TypeNextUI.positionMagicBtn(currentTarget, { floatingBtnEnabled, isEnabled, isSiteDisabled: isCurrentSiteDisabled() });
  }, { passive: true });

  window.addEventListener("resize", () => {
    window.TypeNextUI.hideSuggestions();
    if (currentTarget) window.TypeNextUI.positionMagicBtn(currentTarget, { floatingBtnEnabled, isEnabled, isSiteDisabled: isCurrentSiteDisabled() });
  }, { passive: true });

  const observer = new MutationObserver(() => scanAllRoots());
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

  if (storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.sat_enabled) {
        isEnabled = changes.sat_enabled.newValue !== false;
        const magicBtn = window.TypeNextUI.getMagicBtn();
        if (!isEnabled && magicBtn) magicBtn.style.display = "none";
      }
      if (changes.sat_floating_magic_btn !== undefined) {
        floatingBtnEnabled = changes.sat_floating_magic_btn.newValue !== false;
        const magicBtn = window.TypeNextUI.getMagicBtn();
        if (!floatingBtnEnabled && magicBtn) {
          magicBtn.style.display = "none";
        } else if (currentTarget) {
          window.TypeNextUI.positionMagicBtn(currentTarget, { floatingBtnEnabled, isEnabled, isSiteDisabled: isCurrentSiteDisabled() });
        }
      }
      if (changes.sat_bangla_phonetic) {
        isBanglaPhonetic = changes.sat_bangla_phonetic.newValue === true;
        resetPhoneticState();
        docsKeyBuffer = "";
        window.TypeNextUI.hideSuggestions();
      }
      if (changes.sat_disabled_domains) {
        disabledDomains = Array.isArray(changes.sat_disabled_domains.newValue) ? changes.sat_disabled_domains.newValue : [];
        if (isCurrentSiteDisabled()) {
          window.TypeNextUI.hideSuggestions();
          const magicBtn = window.TypeNextUI.getMagicBtn();
          if (magicBtn) magicBtn.style.display = "none";
        }
      }
      if (changes.sat_snippets) snippets = changes.sat_snippets.newValue || [];
      if (changes.sat_custom_dict) customDict = changes.sat_custom_dict.newValue || [];
      if (changes.sat_learned_dict) learnedDict = changes.sat_learned_dict.newValue || {};
    });
  }

  window.TypeNextUI.initUI(executeMagicTranslate);
  loadData();
  scanAllRoots();
})();