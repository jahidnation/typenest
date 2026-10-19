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
  let suggestionBox = null;
  let magicBtn = null;
  let magicImg = null;
  let toastTimer = null;
  let debounceTimer = null;
  let currentReqId = 0;
  let phoneticBuffer = "";
  let phoneticBanglaLen = 0;
  let docsKeyBuffer = "";
  const attachedDocs = new WeakSet();

  const storage = typeof chrome !== "undefined" && chrome.storage ? (chrome.storage.sync || chrome.storage.local) : null;
  const logoUrl = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
    ? chrome.runtime.getURL("logo.png")
    : "logo.png";

  const isGoogleDocs = () => {
    return window.location.hostname.includes("docs.google.com");
  };

  const parseAvroPhonetic = (str) => {
    if (!str) return "";
    let out = "";
    let i = 0;
    let lastWasConsonant = false;

    const vowels = {
      "ri": "\u098b", "oi": "\u0990", "OI": "\u0990", "ou": "\u0994", "OU": "\u0994", "ee": "\u0988", "oo": "\u098a",
      "o": "\u0985", "a": "\u0986", "A": "\u0986", "i": "\u0987", "I": "\u0988", "u": "\u0989", "U": "\u098a", "e": "\u098f", "E": "\u098f", "O": "\u0993"
    };

    const kars = {
      "ri": "\u09c3", "oi": "\u09c8", "OI": "\u09c8", "ou": "\u09cc", "OU": "\u09cc", "ee": "\u09c0", "oo": "\u09c2",
      "a": "\u09be", "A": "\u09be", "i": "\u09bf", "I": "\u09c0", "u": "\u09c1", "U": "\u09c2", "e": "\u09c7", "E": "\u09c7", "O": "\u09cb"
    };

    const conjunctSpecials = {
      "kkh": "\u0995\u09cd\u09b7", "kSh": "\u0995\u09cd\u09b7", "cch": "\u099a\u09cd\u099b", "cchh": "\u099a\u09cd\u099b",
      "Ngkh": "\u0999\u09cd\u0996", "ngkh": "\u0999\u09cd\u0996", "Nggh": "\u0999\u09cd\u0998", "nggh": "\u0999\u09cd\u0998",
      "Ngk": "\u0999\u09cd\u0995", "ngk": "\u0999\u09cd\u0995", "Ngg": "\u0999\u09cd\u0997", "ngg": "\u0999\u09cd\u0997",
      "jng": "\u099c\u09cd\u099e", "jny": "\u099c\u09cd\u099e", "ggy": "\u099c\u09cd\u099e",
      "ShTh": "\u09b7\u09cd\u09a0", "ShT": "\u09b7\u09cd\u099f", "shch": "\u09b6\u09cd\u099a",
      "shth": "\u09b8\u09cd\u09a5", "sht": "\u09b8\u09cd\u09a4", "sph": "\u09b8\u09cd\u09ab"
    };

    const multiConsonants = {
      "kh": "\u0996", "gh": "\u0998", "Ng": "\u0999", "ch": "\u099b", "jh": "\u099d", "NG": "\u099e",
      "Th": "\u09a0", "Dh": "\u09a2", "th": "\u09a5", "dh": "\u09a7", "ph": "\u09ab", "bh": "\u09ad",
      "sh": "\u09b6", "Sh": "\u09b7", "Rh": "\u09dd", "ng": "\u0982"
    };

    const singleConsonants = {
      "k": "\u0995", "g": "\u0997", "c": "\u099a", "j": "\u099c", "T": "\u099f", "D": "\u09a1",
      "N": "\u09a3", "t": "\u09a4", "d": "\u09a6", "n": "\u09a8", "p": "\u09aa", "f": "\u09ab",
      "b": "\u09ac", "v": "\u09ad", "m": "\u09ae", "z": "\u09af", "y": "\u09df", "Y": "\u09df",
      "r": "\u09b0", "l": "\u09b2", "s": "\u09b8", "S": "\u09b6", "h": "\u09b9", "R": "\u09dc"
    };

    const digits = {
      "0": "\u09e6", "1": "\u09e7", "2": "\u09e8", "3": "\u09e9", "4": "\u09ea",
      "5": "\u09eb", "6": "\u09ec", "7": "\u09ed", "8": "\u09ee", "9": "\u09ef"
    };

    while (i < str.length) {
      if (str.slice(i, i + 2) === "t`") {
        out += "\u09ce";
        i += 2;
        lastWasConsonant = false;
        continue;
      }
      if (str.slice(i, i + 2) === "..") {
        out += "\u0964";
        i += 2;
        lastWasConsonant = false;
        continue;
      }
      if (str.slice(i, i + 2) === ",,") {
        out += "\u09cd";
        i += 2;
        lastWasConsonant = true;
        continue;
      }
      if (str[i] === "^" || str.slice(i, i + 2) === ":$") {
        out += "\u0981";
        i += (str[i] === "^" ? 1 : 2);
        lastWasConsonant = false;
        continue;
      }
      if (str[i] === ":") {
        out += "\u0983";
        i += 1;
        lastWasConsonant = false;
        continue;
      }

      if (digits[str[i]]) {
        out += digits[str[i]];
        i += 1;
        lastWasConsonant = false;
        continue;
      }

      const match4 = str.slice(i, i + 4);
      const match3 = str.slice(i, i + 3);
      const match2 = str.slice(i, i + 2);
      const match1 = str[i];

      if (conjunctSpecials[match4]) {
        out += conjunctSpecials[match4];
        i += 4;
        lastWasConsonant = true;
        continue;
      }
      if (conjunctSpecials[match3]) {
        out += conjunctSpecials[match3];
        i += 3;
        lastWasConsonant = true;
        continue;
      }

      if (lastWasConsonant) {
        if (kars[match2]) {
          out += kars[match2];
          i += 2;
          lastWasConsonant = false;
          continue;
        }
        if (kars[match1]) {
          out += kars[match1];
          i += 1;
          lastWasConsonant = false;
          continue;
        }
        if (match1 === "o") {
          i += 1;
          lastWasConsonant = false;
          continue;
        }
        if (match1 === "r") {
          out += "\u09cd\u09b0";
          i += 1;
          lastWasConsonant = true;
          continue;
        }
        if (match1 === "y" || match1 === "z") {
          out += "\u09cd\u09af";
          i += 1;
          lastWasConsonant = true;
          continue;
        }
        if (match1 === "w") {
          out += "\u09cd\u09ac";
          i += 1;
          lastWasConsonant = true;
          continue;
        }
      }

      if (!lastWasConsonant) {
        if (vowels[match2]) {
          out += vowels[match2];
          i += 2;
          lastWasConsonant = false;
          continue;
        }
        if (vowels[match1]) {
          out += vowels[match1];
          i += 1;
          lastWasConsonant = false;
          continue;
        }
      }

      if (match1 === "r" && i + 1 < str.length) {
        const next2 = str.slice(i + 1, i + 3);
        const next1 = str[i + 1];
        if (multiConsonants[next2] || singleConsonants[next1]) {
          out += "\u09b0\u09cd";
          i += 1;
          lastWasConsonant = false;
          continue;
        }
      }

      const matchedConsonant = multiConsonants[match2] || singleConsonants[match1];
      const step = multiConsonants[match2] ? 2 : (singleConsonants[match1] ? 1 : 0);

      if (matchedConsonant) {
        out += lastWasConsonant ? "\u09cd" + matchedConsonant : matchedConsonant;
        i += step;
        lastWasConsonant = true;
        continue;
      }

      if (match1 === "w") {
        out += lastWasConsonant ? "\u09cd\u09ac" : "\u0993";
        i += 1;
        lastWasConsonant = !lastWasConsonant;
        continue;
      }

      out += match1;
      i += 1;
      lastWasConsonant = false;
    }

    return out;
  };

  const getElementCoordinates = (el) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    let right = rect.right;
    let bottom = rect.bottom;
    const width = rect.width;
    const height = rect.height;

    if (el.ownerDocument && el.ownerDocument !== document) {
      const frameEl = el.ownerDocument.defaultView?.frameElement;
      if (frameEl) {
        const frameRect = frameEl.getBoundingClientRect();
        left += frameRect.left;
        top += frameRect.top;
        right += frameRect.left;
        bottom += frameRect.top;
      }
    }
    return { left, top, right, bottom, width, height };
  };

  const getGoogleDocsTarget = () => {
    const iframe = document.querySelector(".docs-texteventtarget-iframe");
    if (iframe) {
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          return doc.activeElement || doc.querySelector("[contenteditable=true]") || doc.body || iframe;
        }
      } catch {}
      return iframe;
    }
    return document.activeElement;
  };

  const insertIntoGoogleDocs = (text) => {
    if (!text) return;
    const iframe = document.querySelector(".docs-texteventtarget-iframe");
    if (!iframe) return;

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;

    if (win) {
      try { win.focus(); } catch {}
    }

    const target = (doc && (doc.activeElement || doc.querySelector("[contenteditable=true]") || doc.body)) || iframe;
    if (target && target.focus) {
      try { target.focus(); } catch {}
    }

    try {
      const beforeInputEvt = new InputEvent("beforeinput", {
        inputType: "insertText",
        data: text,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      target.dispatchEvent(beforeInputEvt);
      const inputEvt = new InputEvent("input", {
        inputType: "insertText",
        data: text,
        bubbles: true,
        cancelable: false,
        composed: true
      });
      target.dispatchEvent(inputEvt);
    } catch {}

    if (doc) {
      try {
        doc.execCommand("insertText", false, text);
      } catch {}
      try {
        for (let i = 0; i < text.length; i++) {
          doc.execCommand("insertText", false, text[i]);
        }
      } catch {}
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      }
    } catch {}
  };

  const showPhoneticPreview = (text) => {
    if (!suggestionBox) return;
    const target = getGoogleDocsTarget();
    const themeClass = detectTheme(target);
    suggestionBox.className = `sat-suggestion-box ${themeClass} sat-visible`;
    suggestionBox.innerHTML = `
      <div class="sat-suggestion-item sat-selected" style="gap:8px;padding:5px 14px;">
        <i class="fa-solid fa-language" style="color:#ffffff;font-size:12px;"></i>
        <span style="font-size:14px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">${text}</span>
        <span class="sat-key-hint" style="color:#ffffff;background:rgba(255,255,255,0.25);">Space ↵</span>
      </div>
    `;

    const page = document.querySelector(".kix-page-paginated") || document.querySelector(".kix-appview-editor") || document.body;
    const pRect = page.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    suggestionBox.style.left = `${Math.max(16, pRect.left + 120 + scrollX)}px`;
    suggestionBox.style.top = `${Math.max(120, pRect.top + 80 + scrollY)}px`;
  };

  const createBackwardRange = (root, numChars) => {
    const doc = root.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (!sel || !sel.rangeCount || numChars <= 0) return null;

    const currentRange = sel.getRangeAt(0);
    let endNode = currentRange.startContainer;
    let endOffset = currentRange.startOffset;

    if (endNode.nodeType === Node.ELEMENT_NODE) {
      if (endOffset > 0 && endNode.childNodes[endOffset - 1]) {
        let child = endNode.childNodes[endOffset - 1];
        while (child && child.lastChild) child = child.lastChild;
        if (child && child.nodeType === Node.TEXT_NODE) {
          endNode = child;
          endOffset = child.nodeValue.length;
        }
      } else if (endNode.childNodes[endOffset]) {
        let child = endNode.childNodes[endOffset];
        while (child && child.firstChild) child = child.firstChild;
        if (child && child.nodeType === Node.TEXT_NODE) {
          endNode = child;
          endOffset = 0;
        }
      }
    }

    if (endNode.nodeType !== Node.TEXT_NODE) return null;

    let remaining = numChars;
    let currNode = endNode;
    let currOffset = endOffset;

    const walker = doc.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null
    );

    while (remaining > 0 && currNode) {
      if (currOffset >= remaining) {
        currOffset -= remaining;
        remaining = 0;
        break;
      }
      remaining -= currOffset;
      walker.currentNode = currNode;
      const prev = walker.previousNode();
      if (!prev) {
        currOffset = 0;
        remaining = 0;
        break;
      }
      currNode = prev;
      currOffset = prev.nodeValue.length;
    }

    try {
      const range = doc.createRange();
      range.setStart(currNode, currOffset);
      range.setEnd(endNode, endOffset);
      return range;
    } catch {
      return null;
    }
  };

  const executeInputReplacement = (target, newText, oldLen) => {
    if (!target) return;
    const doc = target.ownerDocument || document;
    const win = doc.defaultView || window;

    if ("value" in target && typeof target.selectionStart === "number") {
      const end = target.selectionEnd;
      const start = Math.max(0, end - oldLen);
      const val = target.value;

      target.focus();
      target.setSelectionRange(start, end);

      let handled = false;
      try {
        handled = doc.execCommand("insertText", false, newText);
      } catch {}

      if (!handled) {
        target.value = val.slice(0, start) + newText + val.slice(end);
        const nextCursor = start + newText.length;
        target.setSelectionRange(nextCursor, nextCursor);
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }

    target.focus();
    const sel = win.getSelection();
    if (!sel || !sel.rangeCount) return;

    if (oldLen > 0) {
      const backwardRange = createBackwardRange(target, oldLen);
      if (backwardRange) {
        sel.removeAllRanges();
        sel.addRange(backwardRange);
      }
    }

    let inserted = false;
    if (newText) {
      try {
        inserted = doc.execCommand("insertText", false, newText);
      } catch {}
    } else {
      try {
        inserted = doc.execCommand("delete", false, null);
      } catch {}
    }

    if (!inserted) {
      try {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        if (newText) {
          const textNode = doc.createTextNode(newText);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
        }
        sel.removeAllRanges();
        sel.addRange(range);
      } catch {}
    }

    target.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const resetPhoneticState = () => {
    phoneticBuffer = "";
    phoneticBanglaLen = 0;
  };

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
      const win = checkEl.ownerDocument?.defaultView || window;
      const bg = win.getComputedStyle(checkEl).backgroundColor;
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

      if (!floatingBtnEnabled && magicBtn) {
        magicBtn.style.display = "none";
      }
    });
  };

  const saveLearned = () => {
    if (!storage) return;
    storage.set({ sat_learned_dict: learnedDict });
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

    magicBtn = document.createElement("button");
    magicBtn.type = "button";
    magicBtn.id = "sat-magic-btn";
    magicBtn.className = "sat-magic-btn";
    magicBtn.title = "Magic Translate (Click or Alt + T)";
    magicBtn.style.cssText = "position:fixed;z-index:2147483647;display:none;width:22px;height:22px;min-width:22px;border-radius:50%;background:#1e1f24;border:1px solid rgba(255,255,255,0.25);box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;padding:1px;align-items:center;justify-content:center;transition:transform 0.15s ease,box-shadow 0.2s ease;user-select:none;outline:none;";

    magicImg = document.createElement("img");
    magicImg.src = logoUrl;
    magicImg.alt = "TypeNext";
    magicImg.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:50%;display:block;pointer-events:none;transition:transform 0.2s ease;";
    magicBtn.appendChild(magicImg);
    document.body.appendChild(magicBtn);

    magicBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      executeMagicTranslate();
    });
  };

  const showToast = (message) => {
    const toast = document.getElementById("sat-toast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.innerHTML = `<i class="fa-solid fa-sparkles"></i><span>${message}</span>`;
    toast.classList.add("sat-show");
    toastTimer = setTimeout(() => toast.classList.remove("sat-show"), 2000);
  };

  const positionMagicBtn = (target) => {
    if (!magicBtn) return;
    if (!floatingBtnEnabled || !isEnabled || isCurrentSiteDisabled() || !target || isPasswordField(target)) {
      magicBtn.style.display = "none";
      return;
    }

    if (isGoogleDocs()) {
      const page = document.querySelector(".kix-page-paginated") || document.querySelector(".kix-appview-editor") || document.querySelector("#docs-editor");
      if (page) {
        const pageRect = page.getBoundingClientRect();
        const top = Math.max(pageRect.top + 16, 120);
        let left = Math.min(pageRect.right - 34, window.innerWidth - 38);

        const voiceNestBtn = document.querySelector(".uvt-logo-trigger");
        const isVoiceNestActive = voiceNestBtn &&
          document.contains(voiceNestBtn) &&
          voiceNestBtn.style.display !== "none" &&
          window.getComputedStyle(voiceNestBtn).display !== "none";

        if (isVoiceNestActive) {
          left -= 27;
        }

        magicBtn.style.top = `${Math.round(top)}px`;
        magicBtn.style.left = `${Math.round(left)}px`;
        magicBtn.style.display = "flex";
        return;
      }
    }

    const rect = getElementCoordinates(target);
    if (!rect || rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
      magicBtn.style.display = "none";
      return;
    }

    const btnSize = 22;
    const top = rect.height <= 44 ? rect.top + (rect.height - btnSize) / 2 : rect.top + 6;
    let left = rect.right - btnSize - 6;

    const voiceNestBtn = document.querySelector(".uvt-logo-trigger");
    const isVoiceNestActive = voiceNestBtn &&
      document.contains(voiceNestBtn) &&
      voiceNestBtn.style.display !== "none" &&
      window.getComputedStyle(voiceNestBtn).display !== "none";

    if (isVoiceNestActive) {
      left -= (btnSize + 5);
    }

    if (left < rect.left + 4) left = rect.left + 4;

    magicBtn.style.top = `${Math.round(top)}px`;
    magicBtn.style.left = `${Math.round(left)}px`;
    magicBtn.style.display = "flex";
  };

  const getTargetElement = () => {
    if (currentTarget && (currentTarget.ownerDocument?.contains(currentTarget) || document.contains(currentTarget))) {
      return currentTarget;
    }
    if (isGoogleDocs()) {
      return getGoogleDocsTarget();
    }
    const active = document.activeElement;
    if (active && (active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && !["hidden", "file", "checkbox", "radio", "button", "submit"].includes(active.type)) || active.isContentEditable)) {
      return active;
    }
    return null;
  };

  const executeMagicTranslate = () => {
    const target = getTargetElement();
    if (!target || isPasswordField(target)) {
      showToast("Select an input field first");
      return;
    }
    const doc = target.ownerDocument || document;
    const win = doc.defaultView || window;

    let sourceText = "";
    let isSelection = false;

    if (isGoogleDocs()) {
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
      showToast("No text to translate");
      return;
    }

    if (magicBtn && magicImg) {
      magicBtn.style.borderColor = "#3b82f6";
      magicBtn.style.boxShadow = "0 0 8px rgba(59,130,246,0.7)";
      magicImg.style.animation = "satSpin 0.75s linear infinite";
    }

    chrome.runtime.sendMessage({ action: "translateText", text: sourceText }, async (response) => {
      if (magicBtn && magicImg) {
        magicBtn.style.borderColor = "rgba(255,255,255,0.25)";
        magicBtn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
        magicImg.style.animation = "";
      }

      if (!response || !response.translatedText) {
        showToast("Translation failed");
        return;
      }

      const translated = response.translatedText;

      if (isGoogleDocs()) {
        insertIntoGoogleDocs(translated);
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
          executeInputReplacement(target, translated, 0);
        } else {
          target.innerText = translated;
          target.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }

      const langName = response.toLang === "en" ? "English" : "Bangla";
      showToast(`Translated to ${langName} ✓`);
      positionMagicBtn(target);
    });
  };

  const getTargetInfo = (el) => {
    if (!el || isPasswordField(el)) return null;
    const doc = el.ownerDocument || document;
    const win = doc.defaultView || window;

    if (isGoogleDocs()) {
      const match = docsKeyBuffer.match(/([/;:a-zA-Z0-9_\u0980-\u09FF]+)$/);
      const queryWord = match ? match[1] : "";
      return {
        type: "googledocs",
        element: el,
        textBefore: docsKeyBuffer,
        queryWord,
        queryStartPos: Math.max(0, docsKeyBuffer.length - queryWord.length),
        pos: docsKeyBuffer.length
      };
    }
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
      const sel = win.getSelection();
      if (!sel || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);

      let textBefore = "";
      try {
        const preRange = range.cloneRange();
        preRange.selectNodeContents(el);
        preRange.setEnd(range.startContainer, range.startOffset);
        textBefore = preRange.toString();
      } catch {
        textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || "";
      }

      const lastTokenMatch = textBefore.match(/([/;:a-zA-Z0-9_\u0980-\u09FF]+)$/);
      const queryWord = lastTokenMatch ? lastTokenMatch[1] : "";
      return {
        type: "editable",
        element: el,
        textBefore,
        queryWord,
        queryStartPos: Math.max(0, textBefore.length - queryWord.length),
        range
      };
    }
    return null;
  };

  const updateSuggestionPosition = (target) => {
    if (!suggestionBox || !target) return;
    const doc = target.ownerDocument || document;
    const win = doc.defaultView || window;
    const rect = getElementCoordinates(target);
    if (!rect) return;

    let x = rect.left;
    let targetTop = rect.top;
    let targetBottom = rect.bottom;

    if (target.isContentEditable) {
      const sel = win.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        const clientRects = range.getClientRects();
        if (clientRects.length > 0) {
          const cRect = clientRects[0];
          let frameOffsetLeft = 0;
          let frameOffsetTop = 0;
          if (doc !== document) {
            const frameEl = win.frameElement;
            if (frameEl) {
              const fRect = frameEl.getBoundingClientRect();
              frameOffsetLeft = fRect.left;
              frameOffsetTop = fRect.top;
            }
          }
          x = cRect.left + frameOffsetLeft;
          targetTop = cRect.top + frameOffsetTop;
          targetBottom = cRect.bottom + frameOffsetTop;
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
    if (isGoogleDocs()) {
      insertIntoGoogleDocs(chosen);
    } else {
      executeInputReplacement(currentTarget, chosen, info.queryWord.length);
    }

    if (item.type !== "snippet") {
      learnedDict[item.text] = (learnedDict[item.text] || 0) + 1;
      saveLearned();
    }

    docsKeyBuffer = "";
    resetPhoneticState();
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
      target.isContentEditable ||
      isGoogleDocs()
    ) {
      if (["hidden", "file", "checkbox", "radio", "button", "submit"].includes(target.type)) return;
      currentTarget = target;
      positionMagicBtn(target);

      if (isGoogleDocs()) {
        hideSuggestions();
        return;
      }

      const info = getTargetInfo(target);
      if (!info || !info.queryWord || info.queryWord.length < 1) {
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
              if (!freshInfo || !freshInfo.queryWord || freshInfo.queryWord.length < 1) {
                hideSuggestions();
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
                renderSuggestions(target);
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
      hideSuggestions();
      if (storage) {
        storage.set({ sat_bangla_phonetic: isBanglaPhonetic });
      }
      showToast(isBanglaPhonetic ? "Bangla Phonetic Mode: ON" : "Bangla Phonetic Mode: OFF");
      return;
    }

    if (e.altKey && (e.key === "t" || e.key === "T")) {
      e.preventDefault();
      executeMagicTranslate();
      return;
    }

    if (!isEnabled || isCurrentSiteDisabled() || isPasswordField(e.target)) return;

    if (e.key === "Enter") {
      resetPhoneticState();
      docsKeyBuffer = "";
      hideSuggestions();
    }

    const targetEl = isGoogleDocs() ? (currentTarget || getTargetElement()) : (e.target || currentTarget);

    if (isGoogleDocs()) {
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
        const parsed = parseAvroPhonetic(phoneticBuffer);

        if (isGoogleDocs()) {
          showPhoneticPreview(parsed);
        } else {
          executeInputReplacement(targetEl, parsed, phoneticBanglaLen);
          phoneticBanglaLen = parsed.length;
        }
        return;
      }

      if (e.key === "Backspace" && phoneticBuffer.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        phoneticBuffer = phoneticBuffer.slice(0, -1);
        if (phoneticBuffer.length > 0) {
          const parsed = parseAvroPhonetic(phoneticBuffer);
          if (isGoogleDocs()) {
            showPhoneticPreview(parsed);
          } else {
            executeInputReplacement(targetEl, parsed, phoneticBanglaLen);
            phoneticBanglaLen = parsed.length;
          }
        } else {
          if (isGoogleDocs()) {
            hideSuggestions();
          } else {
            executeInputReplacement(targetEl, "", phoneticBanglaLen);
            phoneticBanglaLen = 0;
          }
        }
        return;
      }

      if ([" ", "Enter", "Tab"].includes(e.key) || /[,.?!;/\\]/.test(e.key)) {
        if (isGoogleDocs() && phoneticBuffer.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          const parsed = parseAvroPhonetic(phoneticBuffer);
          const delimiter = e.key === "Enter" ? "\n" : (e.key === " " ? " " : e.key);
          phoneticBuffer = "";
          phoneticBanglaLen = 0;
          hideSuggestions();
          insertIntoGoogleDocs(parsed + delimiter);
          return;
        }
        resetPhoneticState();
      }
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      setTimeout(() => {
        const info = getTargetInfo(e.target);
        if (!info || !info.queryWord || info.queryWord.length < 1) {
          hideSuggestions();
        }
      }, 10);
    }

    if (e.key === " " || e.key === "Tab") {
      const info = getTargetInfo(targetEl);
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
      docsKeyBuffer = "";
    }

    if (!activeMatches.length) return;

    if (e.key >= "1" && e.key <= String(Math.min(activeMatches.length, 9)) && !e.ctrlKey && !e.altKey && !e.metaKey && (!isBanglaPhonetic || phoneticBuffer.length === 0)) {
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
      resetPhoneticState();
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

  const attachIframe = (iframe) => {
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc || attachedDocs.has(doc)) return;

      const bind = () => {
        try {
          const body = doc.body;
          const isEditable = doc.designMode === "on" || body?.isContentEditable || doc.querySelector('[contenteditable="true"], [contenteditable=""], [role="textbox"]') || isGoogleDocs();
          if (isEditable) {
            attachedDocs.add(doc);
            doc.addEventListener("keydown", handleKeydown, true);
            doc.addEventListener("input", handleTyping, true);
            doc.addEventListener("focusin", handleInteraction, true);
            doc.addEventListener("mousedown", handleInteraction, true);
            doc.addEventListener("submit", hideSuggestions, true);
            doc.addEventListener("click", (e) => {
              if (isGoogleDocs() && phoneticBuffer.length > 0) {
                const parsed = parseAvroPhonetic(phoneticBuffer);
                phoneticBuffer = "";
                phoneticBanglaLen = 0;
                hideSuggestions();
                insertIntoGoogleDocs(parsed);
              }
              resetPhoneticState();
            }, true);
          }
        } catch {}
      };

      bind();
      iframe.addEventListener("load", bind, { once: true });
    } catch {}
  };

  const scanAllIframes = () => {
    document.querySelectorAll("iframe").forEach(attachIframe);
  };

  const handleInteraction = (e) => {
    const path = e.composedPath ? e.composedPath() : [e.target];
    const el = path[0] || e.target;
    if (!el || el === magicBtn || (magicBtn && magicBtn.contains(el))) return;

    if (isGoogleDocs()) {
      scanAllIframes();
      const docsTarget = getGoogleDocsTarget();
      if (docsTarget) {
        currentTarget = docsTarget;
        positionMagicBtn(docsTarget);
        return;
      }
    }

    let editable = null;
    for (let k = 0; k < path.length; k++) {
      const item = path[k];
      if (item instanceof HTMLElement && (item.tagName === "TEXTAREA" || (item.tagName === "INPUT" && !["hidden", "file", "checkbox", "radio", "button", "submit"].includes(item.type)) || item.isContentEditable)) {
        editable = item;
        break;
      }
    }

    if (editable) {
      currentTarget = editable;
      resetPhoneticState();
      positionMagicBtn(editable);
    }
  };

  document.addEventListener("focusin", handleInteraction, true);
  document.addEventListener("mousedown", handleInteraction, true);
  document.addEventListener("input", handleTyping, true);
  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("keydown", handleAutoLearn, true);
  document.addEventListener("submit", hideSuggestions, true);

  document.addEventListener("click", (e) => {
    if (isGoogleDocs() && phoneticBuffer.length > 0) {
      const parsed = parseAvroPhonetic(phoneticBuffer);
      phoneticBuffer = "";
      phoneticBanglaLen = 0;
      hideSuggestions();
      insertIntoGoogleDocs(parsed);
    }
    resetPhoneticState();
    docsKeyBuffer = "";
    if (magicBtn && (e.target === magicBtn || magicBtn.contains(e.target))) return;
    if (suggestionBox && suggestionBox.contains(e.target)) return;
    hideSuggestions();
  }, true);

  window.addEventListener("scroll", () => {
    hideSuggestions();
    if (currentTarget) positionMagicBtn(currentTarget);
  }, { passive: true });

  window.addEventListener("resize", () => {
    hideSuggestions();
    if (currentTarget) positionMagicBtn(currentTarget);
  }, { passive: true });

  const observer = new MutationObserver(() => scanAllIframes());
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

  if (storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.sat_enabled) {
        isEnabled = changes.sat_enabled.newValue !== false;
        if (!isEnabled && magicBtn) magicBtn.style.display = "none";
      }
      if (changes.sat_floating_magic_btn !== undefined) {
        floatingBtnEnabled = changes.sat_floating_magic_btn.newValue !== false;
        if (!floatingBtnEnabled && magicBtn) {
          magicBtn.style.display = "none";
        } else if (currentTarget) {
          positionMagicBtn(currentTarget);
        }
      }
      if (changes.sat_bangla_phonetic) {
        isBanglaPhonetic = changes.sat_bangla_phonetic.newValue === true;
        resetPhoneticState();
        docsKeyBuffer = "";
        hideSuggestions();
      }
      if (changes.sat_disabled_domains) {
        disabledDomains = Array.isArray(changes.sat_disabled_domains.newValue) ? changes.sat_disabled_domains.newValue : [];
        if (isCurrentSiteDisabled()) {
          hideSuggestions();
          if (magicBtn) magicBtn.style.display = "none";
        }
      }
      if (changes.sat_snippets) snippets = changes.sat_snippets.newValue || [];
      if (changes.sat_custom_dict) customDict = changes.sat_custom_dict.newValue || [];
      if (changes.sat_learned_dict) learnedDict = changes.sat_learned_dict.newValue || {};
    });
  }

  initUI();
  loadData();
  scanAllIframes();
})();