(() => {
  const oldHost = document.getElementById("jev-sidebar-host");
  if (oldHost) oldHost.remove();

  const MARK_CLASS = "__jev_highlight__";
  const ACTIVE_CLASS = "__jev_active_highlight__";
  const SENTIMENT_POS = "__jev_sentiment_pos__";
  const SENTIMENT_NEG = "__jev_sentiment_neg__";
  const CUSTOM_SCAN = "__jev_custom_scan__";
  const HIDE_ALL_CLASS = "__jev_hide_all_highlights__";
  const HIDE_ANSWER_CLASS = "__jev_hide_answer_highlights__";
  const HIDE_SENTIMENT_CLASS = "__jev_hide_sentiment_highlights__";
  const HIDE_CUSTOM_CLASS = "__jev_hide_custom_highlights__";

  // Inject highlight styles with strict zero layout shift
  let styleEl = document.getElementById("__jev_styles__");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "__jev_styles__";
    styleEl.textContent = `
      .${MARK_CLASS} {
        background-color: rgba(254, 240, 138, 0.7) !important;
        color: inherit !important;
        padding: 0 !important;
        margin: 0 !important;
        border-radius: 2px !important;
        display: inline !important;
        box-shadow: none !important;
        border: none !important;
      }
      .${MARK_CLASS}.${ACTIVE_CLASS} {
        background-color: #fde047 !important;
        outline: 1.5px solid #d97706 !important;
        outline-offset: 1px !important;
        border-radius: 2px !important;
        box-shadow: none !important;
        font-weight: inherit !important;
      }
      .__jev_box_highlight__ {
        background-color: rgba(254, 243, 199, 0.45) !important;
        border: none !important;
        outline: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .__jev_box_highlight__.${ACTIVE_CLASS} {
        background-color: rgba(253, 224, 71, 0.4) !important;
        outline: 1.5px solid #d97706 !important;
        outline-offset: 1px !important;
      }

      /* Sentiment Highlights */
      .${SENTIMENT_POS} {
        background-color: rgba(187, 247, 208, 0.75) !important;
        color: inherit !important;
        padding: 0 !important;
        margin: 0 !important;
        display: inline !important;
        border-radius: 2px !important;
        border: none !important;
      }
      .${SENTIMENT_NEG} {
        background-color: rgba(254, 202, 202, 0.75) !important;
        color: inherit !important;
        padding: 0 !important;
        margin: 0 !important;
        display: inline !important;
        border-radius: 2px !important;
        border: none !important;
      }
      .${SENTIMENT_POS}.${ACTIVE_CLASS} {
        outline: 1.5px solid #16a34a !important;
        outline-offset: 1px !important;
      }
      .${SENTIMENT_NEG}.${ACTIVE_CLASS} {
        outline: 1.5px solid #dc2626 !important;
        outline-offset: 1px !important;
      }

      /* Custom Scan Highlights (Indigo / Violet) */
      .${CUSTOM_SCAN} {
        background-color: rgba(224, 231, 255, 0.8) !important;
        color: inherit !important;
        padding: 0 !important;
        margin: 0 !important;
        display: inline !important;
        border-radius: 2px !important;
        border: none !important;
      }
      .${CUSTOM_SCAN}.${ACTIVE_CLASS} {
        background-color: #c7d2fe !important;
        outline: 1.5px solid #4f46e5 !important;
        outline-offset: 1px !important;
      }

      /* Global Toggle - hide all highlights cleanly without DOM removal */
      .${HIDE_ALL_CLASS} .${MARK_CLASS},
      .${HIDE_ALL_CLASS} .${SENTIMENT_POS},
      .${HIDE_ALL_CLASS} .${SENTIMENT_NEG},
      .${HIDE_ALL_CLASS} .${CUSTOM_SCAN},
      .${HIDE_ALL_CLASS} .__jev_box_highlight__,
      /* Per-Result-Set Toggles */
      .${HIDE_ANSWER_CLASS} .${MARK_CLASS},
      .${HIDE_ANSWER_CLASS} .__jev_box_highlight__,
      .${HIDE_SENTIMENT_CLASS} .${SENTIMENT_POS},
      .${HIDE_SENTIMENT_CLASS} .${SENTIMENT_NEG},
      .${HIDE_CUSTOM_CLASS} .${CUSTOM_SCAN} {
        background-color: transparent !important;
        outline: none !important;
        box-shadow: none !important;
        border: none !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  function clearAnswerHighlights() {
    document.querySelectorAll("." + MARK_CLASS).forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    });
    document.querySelectorAll(".__jev_box_highlight__").forEach((el) => {
      el.classList.remove("__jev_box_highlight__", ACTIVE_CLASS);
    });
  }

  function clearSentimentHighlights() {
    document.querySelectorAll("." + SENTIMENT_POS + ", ." + SENTIMENT_NEG).forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    });
  }

  function clearCustomScanHighlights() {
    document.querySelectorAll("." + CUSTOM_SCAN).forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    });
  }

  function clearAllHighlights() {
    clearAnswerHighlights();
    clearSentimentHighlights();
    clearCustomScanHighlights();
  }

  function setHighlightsVisibility(visible) {
    if (visible) {
      document.documentElement.classList.remove(HIDE_ALL_CLASS);
    } else {
      document.documentElement.classList.add(HIDE_ALL_CLASS);
    }
  }

  function setResultSetVisibility(resultSetType, visible) {
    let targetClass;
    if (resultSetType === "answer" || resultSetType === "qa") targetClass = HIDE_ANSWER_CLASS;
    else if (resultSetType === "sentiment") targetClass = HIDE_SENTIMENT_CLASS;
    else if (resultSetType === "custom-scan" || resultSetType === "custom") targetClass = HIDE_CUSTOM_CLASS;

    if (targetClass) {
      if (visible) {
        document.documentElement.classList.remove(targetClass);
      } else {
        document.documentElement.classList.add(targetClass);
      }
    }
  }

  function highlightSingle(target, isActive = true) {
    const wanted = String(target?.targetText || target?.text || "").trim();
    if (!wanted) return null;

    const wantedNorm = wanted.replace(/\s+/g, " ").toLowerCase();
    const snippet = wantedNorm.slice(0, Math.min(wantedNorm.length, 45));

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || ["SCRIPT", "STYLE", "NOSCRIPT", "SVG"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    while ((node = walker.nextNode())) {
      const original = node.nodeValue;
      const originalNorm = original.toLowerCase();
      let idx = originalNorm.indexOf(wantedNorm);
      let matchLen = wanted.length;

      if (idx === -1 && snippet.length >= 20) {
        idx = originalNorm.indexOf(snippet);
        matchLen = snippet.length;
      }

      if (idx !== -1) {
        const mark = document.createElement("mark");
        mark.className = MARK_CLASS + (isActive ? " " + ACTIVE_CLASS : "");
        mark.textContent = original.slice(idx, idx + matchLen);

        const after = document.createTextNode(original.slice(idx + matchLen));
        const before = document.createTextNode(original.slice(0, idx));
        const parent = node.parentNode;
        parent.insertBefore(before, node);
        parent.insertBefore(mark, node);
        parent.insertBefore(after, node);
        parent.removeChild(node);

        if (isActive) {
          mark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return mark;
      }
    }

    const leafSelectors = "p, li, blockquote, figcaption, dt, dd, h1, h2, h3, h4, h5, h6, td, th";
    const elements = [...document.body.querySelectorAll(leafSelectors)];

    const matching = elements.filter((e) => {
      const text = (e.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      return text.includes(wantedNorm) || (snippet.length >= 20 && text.includes(snippet));
    });

    if (matching.length > 0) {
      matching.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
      const bestEl = matching[0];

      const innerWalker = document.createTreeWalker(bestEl, NodeFilter.SHOW_TEXT);
      let innerNode;
      while ((innerNode = innerWalker.nextNode())) {
        const t = innerNode.nodeValue.toLowerCase();
        let i = t.indexOf(snippet);
        if (i !== -1 && snippet.length >= 15) {
          const mark = document.createElement("mark");
          mark.className = MARK_CLASS + (isActive ? " " + ACTIVE_CLASS : "");
          mark.textContent = innerNode.nodeValue.slice(i, i + snippet.length);

          const after = document.createTextNode(innerNode.nodeValue.slice(i + snippet.length));
          const before = document.createTextNode(innerNode.nodeValue.slice(0, i));
          const p = innerNode.parentNode;
          p.insertBefore(before, innerNode);
          p.insertBefore(mark, innerNode);
          p.insertBefore(after, innerNode);
          p.removeChild(innerNode);

          if (isActive) {
            mark.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return mark;
        }
      }

      bestEl.classList.add("__jev_box_highlight__");
      if (isActive) {
        bestEl.classList.add(ACTIVE_CLASS);
        bestEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return bestEl;
    }

    return null;
  }

  function highlightAll(matches, activeIndex = 0) {
    clearAnswerHighlights();
    if (!Array.isArray(matches) || !matches.length) return false;

    matches.forEach((m, idx) => {
      if (idx !== activeIndex) {
        highlightSingle(m, false);
      }
    });

    if (matches[activeIndex]) {
      highlightSingle(matches[activeIndex], true);
    }
    return true;
  }

  function setActiveMatch(matches, activeIndex) {
    if (!Array.isArray(matches) || !matches[activeIndex]) return;
    highlightAll(matches, activeIndex);
  }

  // --- Sentiment Highlighting ---
  function applySentimentHighlights(items) {
    clearSentimentHighlights();
    if (!Array.isArray(items)) return;

    items.forEach((item) => {
      if (item.sentiment !== "positive" && item.sentiment !== "negative") return;

      const cls = item.sentiment === "positive" ? SENTIMENT_POS : SENTIMENT_NEG;
      const text = String(item.text || "").trim();
      if (!text) return;

      const textNorm = text.replace(/\s+/g, " ").toLowerCase();
      const snippet = textNorm.slice(0, Math.min(textNorm.length, 45));

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p || ["SCRIPT", "STYLE", "NOSCRIPT", "SVG"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.classList.contains(SENTIMENT_POS) || p.classList.contains(SENTIMENT_NEG)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let node;
      let applied = false;
      while ((node = walker.nextNode())) {
        const orig = node.nodeValue;
        const origNorm = orig.toLowerCase();
        let idx = origNorm.indexOf(textNorm);
        let len = text.length;

        if (idx === -1 && snippet.length >= 20) {
          idx = origNorm.indexOf(snippet);
          len = snippet.length;
        }

        if (idx !== -1) {
          const mark = document.createElement("mark");
          mark.className = cls;
          mark.textContent = orig.slice(idx, idx + len);
          mark.setAttribute("data-sentiment-id", item.id || "");

          const after = document.createTextNode(orig.slice(idx + len));
          const before = document.createTextNode(orig.slice(0, idx));
          const parent = node.parentNode;
          parent.insertBefore(before, node);
          parent.insertBefore(mark, node);
          parent.insertBefore(after, node);
          parent.removeChild(node);
          applied = true;
          break;
        }
      }

      if (!applied) {
        const leafElements = [...document.body.querySelectorAll("p, li, blockquote, dt, dd, h1, h2, h3, h4, h5, h6")];
        const match = leafElements.find((el) => {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
          return t.includes(snippet);
        });

        if (match) {
          const innerWalker = document.createTreeWalker(match, NodeFilter.SHOW_TEXT);
          let inNode;
          while ((inNode = innerWalker.nextNode())) {
            const inT = inNode.nodeValue.toLowerCase();
            const i = inT.indexOf(snippet);
            if (i !== -1 && snippet.length >= 15) {
              const mark = document.createElement("mark");
              mark.className = cls;
              mark.textContent = inNode.nodeValue.slice(i, i + snippet.length);
              mark.setAttribute("data-sentiment-id", item.id || "");

              const after = document.createTextNode(inNode.nodeValue.slice(i + snippet.length));
              const before = document.createTextNode(inNode.nodeValue.slice(0, i));
              const parent = inNode.parentNode;
              parent.insertBefore(before, inNode);
              parent.insertBefore(mark, inNode);
              parent.insertBefore(after, inNode);
              parent.removeChild(inNode);
              break;
            }
          }
        }
      }
    });
  }

  function jumpToSentiment(id) {
    document.querySelectorAll("." + ACTIVE_CLASS).forEach(el => el.classList.remove(ACTIVE_CLASS));
    const target = document.querySelector(`[data-sentiment-id="${id}"]`);
    if (target) {
      target.classList.add(ACTIVE_CLASS);
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // --- Custom Scan Highlighting ---
  function applyCustomScanHighlights(items) {
    clearCustomScanHighlights();
    if (!Array.isArray(items)) return;

    items.forEach((item) => {
      if (!item.matched) return;

      const text = String(item.targetText || item.text || "").trim();
      if (!text) return;

      const textNorm = text.replace(/\s+/g, " ").toLowerCase();
      const snippet = textNorm.slice(0, Math.min(textNorm.length, 45));

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p || ["SCRIPT", "STYLE", "NOSCRIPT", "SVG"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.classList.contains(CUSTOM_SCAN)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let node;
      let applied = false;
      while ((node = walker.nextNode())) {
        const orig = node.nodeValue;
        const origNorm = orig.toLowerCase();
        let idx = origNorm.indexOf(textNorm);
        let len = text.length;

        if (idx === -1 && snippet.length >= 20) {
          idx = origNorm.indexOf(snippet);
          len = snippet.length;
        }

        if (idx !== -1) {
          const mark = document.createElement("mark");
          mark.className = CUSTOM_SCAN;
          mark.textContent = orig.slice(idx, idx + len);
          mark.setAttribute("data-custom-id", item.id || "");

          const after = document.createTextNode(orig.slice(idx + len));
          const before = document.createTextNode(orig.slice(0, idx));
          const parent = node.parentNode;
          parent.insertBefore(before, node);
          parent.insertBefore(mark, node);
          parent.insertBefore(after, node);
          parent.removeChild(node);
          applied = true;
          break;
        }
      }

      if (!applied) {
        const leafElements = [...document.body.querySelectorAll("p, li, blockquote, dt, dd, h1, h2, h3, h4, h5, h6")];
        const match = leafElements.find((el) => {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
          return t.includes(snippet);
        });

        if (match) {
          const innerWalker = document.createTreeWalker(match, NodeFilter.SHOW_TEXT);
          let inNode;
          while ((inNode = innerWalker.nextNode())) {
            const inT = inNode.nodeValue.toLowerCase();
            const i = inT.indexOf(snippet);
            if (i !== -1 && snippet.length >= 15) {
              const mark = document.createElement("mark");
              mark.className = CUSTOM_SCAN;
              mark.textContent = inNode.nodeValue.slice(i, i + snippet.length);
              mark.setAttribute("data-custom-id", item.id || "");

              const after = document.createTextNode(inNode.nodeValue.slice(i + snippet.length));
              const before = document.createTextNode(inNode.nodeValue.slice(0, i));
              const parent = inNode.parentNode;
              parent.insertBefore(before, inNode);
              parent.insertBefore(mark, inNode);
              parent.insertBefore(after, inNode);
              parent.removeChild(inNode);
              break;
            }
          }
        }
      }
    });
  }

  function jumpToCustomScan(id) {
    document.querySelectorAll("." + ACTIVE_CLASS).forEach(el => el.classList.remove(ACTIVE_CLASS));
    const target = document.querySelector(`[data-custom-id="${id}"]`);
    if (target) {
      target.classList.add(ACTIVE_CLASS);
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function restoreAllHighlights({ answerMatches, activeIndex, sentimentItems, customScanItems, visible = true, resultSetVisibility }) {
    clearAllHighlights();

    if (Array.isArray(answerMatches) && answerMatches.length) {
      highlightAll(answerMatches, activeIndex || 0);
    }
    if (Array.isArray(sentimentItems) && sentimentItems.length) {
      applySentimentHighlights(sentimentItems);
    }
    if (Array.isArray(customScanItems) && customScanItems.length) {
      applyCustomScanHighlights(customScanItems);
    }

    setHighlightsVisibility(visible);
    if (resultSetVisibility) {
      if (resultSetVisibility.answer !== undefined) setResultSetVisibility("answer", resultSetVisibility.answer);
      if (resultSetVisibility.sentiment !== undefined) setResultSetVisibility("sentiment", resultSetVisibility.sentiment);
      if (resultSetVisibility.custom !== undefined) setResultSetVisibility("custom", resultSetVisibility.custom);
    }
  }

  function visibleText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || ["SCRIPT", "STYLE", "NOSCRIPT", "SVG"].includes(p.tagName) || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let text = "", node;
    while ((node = walker.nextNode())) {
      text += node.nodeValue.replace(/\s+/g, " ") + "\n";
    }
    return text;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "GET_PAGE_CONTENT") {
      sendResponse({
        content: visibleText(),
        title: document.title || "",
        url: window.location.href
      });
      return true;
    }
    if (msg?.type === "HIGHLIGHT_MATCH" && msg.match) {
      clearAnswerHighlights();
      highlightSingle(msg.match, true);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "HIGHLIGHT_ALL_MATCHES") {
      const ok = highlightAll(msg.matches, msg.activeIndex || 0);
      sendResponse({ ok });
      return true;
    }
    if (msg?.type === "SET_ACTIVE_MATCH") {
      setActiveMatch(msg.matches, msg.activeIndex || 0);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "HIGHLIGHT_SENTIMENT") {
      applySentimentHighlights(msg.items);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "JUMP_TO_SENTIMENT") {
      jumpToSentiment(msg.id);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "CLEAR_SENTIMENT") {
      clearSentimentHighlights();
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "HIGHLIGHT_CUSTOM_SCAN") {
      applyCustomScanHighlights(msg.items);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "JUMP_TO_CUSTOM_SCAN") {
      jumpToCustomScan(msg.id);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "CLEAR_CUSTOM_SCAN") {
      clearCustomScanHighlights();
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "TOGGLE_HIGHLIGHTS_VISIBILITY") {
      setHighlightsVisibility(Boolean(msg.visible));
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "TOGGLE_RESULT_SET_VISIBILITY") {
      setResultSetVisibility(msg.resultSetType, Boolean(msg.visible));
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "RESTORE_ALL_PAGE_HIGHLIGHTS") {
      restoreAllHighlights(msg);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "CLEAR_HIGHLIGHTS") {
      clearAllHighlights();
      sendResponse({ ok: true });
      return true;
    }
  });
})();