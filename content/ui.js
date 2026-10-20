(() => {
  let suggestionBox = null;
  let magicBtn = null;
  let magicImg = null;
  let toastTimer = null;

  const logoUrl = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
    ? chrome.runtime.getURL("logo.png")
    : "logo.png";

  const initUI = (onMagicClick) => {
    if (document.getElementById("sat-suggestion-box")) {
      suggestionBox = document.getElementById("sat-suggestion-box");
      magicBtn = document.getElementById("sat-magic-btn");
      magicImg = magicBtn?.querySelector("img");
      return;
    }

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
    magicImg.alt = "TypeNest";
    magicImg.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:50%;display:block;pointer-events:none;transition:transform 0.2s ease;";
    magicBtn.appendChild(magicImg);
    document.body.appendChild(magicBtn);

    magicBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onMagicClick) onMagicClick();
    });
  };

  const showToast = (message) => {
    const toast = document.getElementById("sat-toast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i><span>${message}</span>`;
    toast.classList.add("sat-show");
    toastTimer = setTimeout(() => toast.classList.remove("sat-show"), 2000);
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

  const setMagicBtnLoading = (loading) => {
    if (!magicBtn || !magicImg) return;
    if (loading) {
      magicBtn.style.borderColor = "#3b82f6";
      magicBtn.style.boxShadow = "0 0 8px rgba(59,130,246,0.7)";
      magicImg.style.animation = "satSpin 0.75s linear infinite";
    } else {
      magicBtn.style.borderColor = "rgba(255,255,255,0.25)";
      magicBtn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      magicImg.style.animation = "";
    }
  };

  const positionMagicBtn = (target, options = {}) => {
    if (!magicBtn) return;
    const { floatingBtnEnabled = true, isEnabled = true, isSiteDisabled = false } = options;
    if (!floatingBtnEnabled || !isEnabled || isSiteDisabled || !target || window.TypeNextDOM.isPasswordField(target)) {
      magicBtn.style.display = "none";
      return;
    }

    if (window.TypeNextDOM.isGoogleDocs()) {
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

    const rect = window.TypeNextDOM.getElementCoordinates(target);
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

  const updateSuggestionPosition = (target) => {
    if (!suggestionBox || !target) return;
    const doc = target.ownerDocument || document;
    const win = doc.defaultView || window;
    const rect = window.TypeNextDOM.getElementCoordinates(target);
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
    if (!suggestionBox) return;
    suggestionBox.classList.remove("sat-visible");
    suggestionBox.innerHTML = "";
  };

  const showPhoneticPreview = (text) => {
    if (!suggestionBox) return;
    const target = window.TypeNextDOM.getGoogleDocsTarget();
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

  const renderSuggestions = (target, matches, selectedIndex, onSelect, onDelete) => {
    if (!suggestionBox || !matches || !matches.length) {
      hideSuggestions();
      return;
    }

    const themeClass = detectTheme(target);
    suggestionBox.className = `sat-suggestion-box ${themeClass}`;
    suggestionBox.innerHTML = "";

    matches.forEach((item, index) => {
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
        if (onDelete) onDelete(item);
      });

      row.addEventListener("mousedown", (e) => {
        if (e.target.closest(".sat-del-btn")) return;
        e.preventDefault();
        if (onSelect) onSelect(item);
      });

      suggestionBox.appendChild(row);
    });

    suggestionBox.classList.add("sat-visible");
    updateSuggestionPosition(target);
  };

  window.TypeNextUI = {
    initUI,
    showToast,
    detectTheme,
    setMagicBtnLoading,
    positionMagicBtn,
    updateSuggestionPosition,
    hideSuggestions,
    showPhoneticPreview,
    renderSuggestions,
    getSuggestionBox: () => suggestionBox,
    getMagicBtn: () => magicBtn
  };
})();