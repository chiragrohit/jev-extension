(() => {
  const MARK_CLASS = "__jev_highlight__";

  function visibleText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (["SCRIPT","STYLE","NOSCRIPT","SVG"].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    let text = "";
    let node;
    while ((node = walker.nextNode())) {
      const start = text.length;
      text += node.nodeValue.replace(/\s+/g, " ") + "\n";
      nodes.push({node, start, end:text.length});
    }
    return {text, nodes};
  }

  function normalize(s) {
    return s.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function keywords(question) {
    const stop = new Set([
      "does","do","is","are","was","were","the","a","an","this","that","page",
      "document","mention","mentions","have","has","there","any","about","on",
      "of","to","for","in","and","or","with","what","which","where","when"
    ]);
    return normalize(question).split(/[^a-z0-9₹%]+/).filter(w => w.length > 2 && !stop.has(w));
  }

  function scoreSentence(sentence, terms) {
    const s = normalize(sentence);
    let score = 0;
    for (const t of terms) {
      if (s.includes(t)) score += 1;
    }
    return terms.length ? score / terms.length : 0;
  }

  function findBest(question) {
    const {text} = visibleText();
    const sentences = text
      .split(/(?<=[.!?।])\s+|\n+/)
      .map(x => x.trim())
      .filter(x => x.length >= 20);

    const terms = keywords(question);
    const ranked = sentences
      .map((s, i) => ({text:s, score:scoreSentence(s, terms), index:i}))
      .filter(x => x.score > 0)
      .sort((a,b) => b.score-a.score);

    const best = ranked[0];
    if (!best) return null;

    // Lightweight local semantic proxy for the MVP:
    // require enough question terms to appear in the same passage.
    // The extension can later replace this with a Jev/API call.
    const threshold = terms.length <= 2 ? 0.5 : 0.6;
    if (best.score < threshold) return null;
    return best;
  }

  function highlightText(target) {
    document.querySelectorAll("." + MARK_CLASS).forEach(el => {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });

    const targetNorm = normalize(target.text);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT","STYLE","NOSCRIPT","SVG"].includes(parent.tagName)) continue;
      const source = normalize(node.nodeValue);
      if (source && source.includes(targetNorm)) {
        const original = node.nodeValue;
        const start = source.indexOf(targetNorm);
        if (start < 0) continue;
        const mark = document.createElement("mark");
        mark.className = MARK_CLASS;
        mark.textContent = original;
        mark.style.background = "#fff1a8";
        mark.style.borderRadius = "4px";
        node.parentNode.replaceChild(mark, node);
        mark.scrollIntoView({behavior:"smooth", block:"center"});
        return;
      }
    }

    // Fallback: find matching element by visible text.
    const elements = [...document.body.querySelectorAll("p,li,td,th,article,section,div")];
    const el = elements.find(e => normalize(e.innerText || "") === targetNorm);
    if (el) {
      el.style.outline = "3px solid #f2c94c";
      el.style.backgroundColor = "#fff9d8";
      el.scrollIntoView({behavior:"smooth", block:"center"});
      setTimeout(() => {
        el.style.outline = "";
        el.style.backgroundColor = "";
      }, 5000);
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "FIND_ANSWER") {
      const match = findBest(msg.question || "");
      sendResponse({
        found: Boolean(match),
        match: match ? {text: match.text, score: match.score} : null
      });
      return true;
    }

    if (msg?.type === "HIGHLIGHT_MATCH" && msg.match) {
      highlightText(msg.match);
      sendResponse({ok:true});
      return true;
    }
  });
})();