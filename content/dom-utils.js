(() => {
  const isGoogleDocs = () => {
    return window.location.hostname.includes("docs.google.com");
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

    while (remaining > 0 && currNode) {
      if (currOffset >= remaining) {
        currOffset -= remaining;
        remaining = 0;
        break;
      }
      remaining -= currOffset;
      let prev = currNode.previousSibling;
      while (prev && prev.lastChild) prev = prev.lastChild;
      if (!prev || prev.nodeType !== Node.TEXT_NODE) {
        let parent = currNode.parentElement;
        while (parent && parent !== root && !parent.previousSibling) {
          parent = parent.parentElement;
        }
        if (parent && parent !== root && parent.previousSibling) {
          prev = parent.previousSibling;
          while (prev && prev.lastChild) prev = prev.lastChild;
        }
      }
      if (!prev || prev.nodeType !== Node.TEXT_NODE) {
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
      target.focus();
      if (typeof target.setRangeText === "function") {
        target.setRangeText(newText, start, end, "end");
      } else {
        const val = target.value;
        target.value = val.slice(0, start) + newText + val.slice(end);
        const next = start + newText.length;
        target.setSelectionRange(next, next);
      }
      try {
        target.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: newText, bubbles: true }));
      } catch {
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

    try {
      doc.execCommand("insertText", false, newText);
    } catch {}
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

  const getDeepActiveElement = (root = document) => {
    let el = root.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  };

  const getEventTarget = (e) => {
    if (e && e.composedPath) {
      const path = e.composedPath();
      for (let i = 0; i < path.length; i++) {
        const item = path[i];
        if (item instanceof HTMLElement) {
          if (
            item.tagName === "TEXTAREA" ||
            (item.tagName === "INPUT" && !["hidden", "file", "checkbox", "radio", "button", "submit"].includes(item.type)) ||
            item.isContentEditable
          ) {
            return item.isContentEditable ? (item.closest('[contenteditable="true"]') || item) : item;
          }
        }
      }
      if (path[0] instanceof HTMLElement) return path[0];
    }
    return e?.target || null;
  };

  const getTargetInfo = (el, docsBuffer = "") => {
    if (!el || isPasswordField(el)) return null;
    const doc = el.ownerDocument || document;
    const win = doc.defaultView || window;

    if (isGoogleDocs()) {
      const match = docsBuffer.match(/([/;:a-zA-Z0-9_\u0980-\u09FF]+)$/);
      const queryWord = match ? match[1] : "";
      return {
        type: "googledocs",
        element: el,
        textBefore: docsBuffer,
        queryWord,
        queryStartPos: Math.max(0, docsBuffer.length - queryWord.length),
        pos: docsBuffer.length
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
      const root = el.closest('[contenteditable="true"]') || el;
      const sel = win.getSelection();
      if (!sel || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);

      let textNode = range.startContainer;
      let offset = range.startOffset;

      if (textNode.nodeType === Node.ELEMENT_NODE) {
        if (offset > 0 && textNode.childNodes[offset - 1]) {
          let child = textNode.childNodes[offset - 1];
          while (child && child.lastChild) child = child.lastChild;
          if (child && child.nodeType === Node.TEXT_NODE) {
            textNode = child;
            offset = child.nodeValue.length;
          }
        } else if (textNode.childNodes[offset]) {
          let child = textNode.childNodes[offset];
          while (child && child.firstChild) child = child.firstChild;
          if (child && child.nodeType === Node.TEXT_NODE) {
            textNode = child;
            offset = 0;
          }
        }
      }

      let textBefore = "";
      if (textNode.nodeType === Node.TEXT_NODE) {
        textBefore = textNode.nodeValue.slice(0, offset);
        let curr = textNode;
        while (!/\s/.test(textBefore)) {
          let prev = curr.previousSibling;
          while (prev && prev.lastChild) prev = prev.lastChild;
          if (!prev || prev.nodeType !== Node.TEXT_NODE) break;
          textBefore = prev.nodeValue + textBefore;
          curr = prev;
        }
      }

      textBefore = textBefore.replace(/[\u200B-\u200D\uFEFF]/g, "");
      const lastTokenMatch = textBefore.match(/([/;:a-zA-Z0-9_\u0980-\u09FF]+)$/);
      const queryWord = lastTokenMatch ? lastTokenMatch[1] : "";
      return {
        type: "editable",
        element: root,
        textBefore,
        queryWord,
        queryStartPos: Math.max(0, textBefore.length - queryWord.length),
        range
      };
    }
    return null;
  };

  window.TypeNextDOM = {
    isGoogleDocs,
    getElementCoordinates,
    getGoogleDocsTarget,
    insertIntoGoogleDocs,
    createBackwardRange,
    executeInputReplacement,
    isPasswordField,
    getDeepActiveElement,
    getEventTarget,
    getTargetInfo
  };
})();