import { getPage, savePage, deletePage } from "./db.js";

// DOM Elements - Header Row 1
const serverStatusDot = document.getElementById("serverStatusDot");
const pageFavicon = document.getElementById("pageFavicon");
const pageTitleText = document.getElementById("pageTitleText");
const copyMdBtn = document.getElementById("copyMdBtn");

// DOM Elements - Header Row 2
const sentimentScanBtn = document.getElementById("sentimentScanBtn");
const customScanToggleBtn = document.getElementById("customScanToggleBtn");
const toggleHighlightsBtn = document.getElementById("toggleHighlightsBtn");
const highlightEyeIcon = document.getElementById("highlightEyeIcon");
const highlightToggleText = document.getElementById("highlightToggleText");
const clearBtn = document.getElementById("clearBtn");

// DOM Elements - Custom Scan Tray
const customScanTray = document.getElementById("customScanTray");
const customScanInput = document.getElementById("customScanInput");
const runCustomScanBtn = document.getElementById("runCustomScanBtn");

// DOM Elements - Main & Footer
const messageStream = document.getElementById("messageStream");
const welcomeBox = document.getElementById("welcomeBox");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const toast = document.getElementById("toast");

// Application State
let currentTabId = null;
let currentUrl = "";
let currentTabTitle = "";
let currentFavicon = "";
let pageData = {
  url: "",
  title: "",
  favicon: "",
  messages: [],
  sentimentData: null,
  customScanData: null,
  highlightsVisible: true,
  resultSetVisibility: {
    answer: true,
    sentiment: true,
    custom: true
  }
};

function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.origin + u.pathname;
  } catch (_) {
    return rawUrl || "default_page";
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function ensureContentScript(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_CONTENT" });
    if (res) return res;
  } catch (_) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    return await chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_CONTENT" });
  }
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2000);
}

// --- Page Identity & Lifecycle ---
async function syncActiveTab() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    pageTitleText.textContent = "No active page";
    pageFavicon.classList.add("hidden");
    return;
  }

  currentTabId = tab.id;
  const newNormUrl = normalizeUrl(tab.url || "");
  currentFavicon = tab.favIconUrl || "";

  // Resolve true page title
  let title = tab.title || "";
  if (!title || title.toLowerCase() === "new tab" || title === tab.url) {
    try {
      const pageContent = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTENT" });
      if (pageContent?.title) title = pageContent.title;
    } catch (_) {}
  }
  if (!title && tab.url) {
    try {
      title = new URL(tab.url).hostname.replace(/^www\./, "");
    } catch (_) {}
  }

  currentTabTitle = title || "Untitled Page";
  pageTitleText.textContent = currentTabTitle;
  pageTitleText.title = `${currentTabTitle}\n${tab.url || ""}`;

  if (currentFavicon) {
    pageFavicon.src = currentFavicon;
    pageFavicon.classList.remove("hidden");
  } else {
    pageFavicon.classList.add("hidden");
  }

  // Load persisted IndexedDB data if URL changed
  if (newNormUrl !== currentUrl) {
    currentUrl = newNormUrl;
    await loadPageFromDB();
  }
}

async function loadPageFromDB() {
  try {
    const saved = await getPage(currentUrl);
    if (saved) {
      pageData = saved;
      if (!pageData.resultSetVisibility) {
        pageData.resultSetVisibility = { answer: true, sentiment: true, custom: true };
      }
    } else {
      pageData = {
        url: currentUrl,
        title: currentTabTitle,
        favicon: currentFavicon,
        messages: [],
        sentimentData: null,
        customScanData: null,
        highlightsVisible: true,
        resultSetVisibility: { answer: true, sentiment: true, custom: true }
      };
    }
  } catch (err) {
    console.warn("Could not read from IndexedDB:", err);
  }

  updateHighlightToggleUI();
  renderMessages();
  restoreWebpageHighlights();
}

async function persistPageData() {
  pageData.title = currentTabTitle || pageData.title;
  pageData.favicon = currentFavicon || pageData.favicon;
  try {
    await savePage(pageData);
  } catch (err) {
    console.warn("Failed to persist to IndexedDB:", err);
  }
}

function updateHighlightToggleUI() {
  const isVis = pageData.highlightsVisible !== false;
  highlightEyeIcon.textContent = isVis ? "👁" : "🚫";
  highlightToggleText.textContent = isVis ? "On" : "Off";
  toggleHighlightsBtn.classList.toggle("active", isVis);
}

async function restoreWebpageHighlights() {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  let answerMatches = [];
  let activeIndex = 0;
  for (let i = pageData.messages.length - 1; i >= 0; i--) {
    const m = pageData.messages[i];
    if (m.role === "bot" && Array.isArray(m.evidences) && m.evidences.length) {
      answerMatches = m.evidences;
      activeIndex = m.activeIndex || 0;
      break;
    }
  }

  const sentimentItems = pageData.sentimentData?.items || [];
  const customScanItems = pageData.customScanData?.items || [];

  chrome.tabs.sendMessage(tab.id, {
    type: "RESTORE_ALL_PAGE_HIGHLIGHTS",
    answerMatches,
    activeIndex,
    sentimentItems,
    customScanItems,
    visible: pageData.highlightsVisible !== false,
    resultSetVisibility: pageData.resultSetVisibility
  }).catch(() => {});
}

// --- Message Rendering ---
function renderMessages() {
  messageStream.innerHTML = "";
  messageStream.appendChild(welcomeBox);

  if (pageData.messages.length > 0) {
    welcomeBox.style.display = "none";
    pageData.messages.forEach((msg) => appendMessageToDOM(msg, false));
  } else {
    welcomeBox.style.display = "block";
  }

  messageStream.scrollTop = messageStream.scrollHeight;
}

function appendMessageToDOM(msg, scroll = true) {
  welcomeBox.style.display = "none";
  const el = document.createElement("div");
  el.className = "message " + msg.role;

  if (msg.role === "user") {
    el.innerHTML = `<div class="user-bubble">${escapeHtml(msg.text)}</div>`;
  } else {
    const card = document.createElement("div");
    card.className = "bot-card";

    if (msg.loading) {
      card.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <span>${escapeHtml(msg.loadingText || "Reading page and asking Jev…")}</span>
        </div>
      `;
    } else if (msg.error) {
      card.innerHTML = `<div class="error-text">⚠️ ${escapeHtml(msg.error)}</div>`;
    } else if (msg.type === "sentiment") {
      card.className = "sentiment-card";
      const summary = msg.summary || { positive: 0, negative: 0, neutral: 0 };
      const items = Array.isArray(msg.items) ? msg.items : [];
      const nonNeutral = items.filter((i) => i.sentiment === "positive" || i.sentiment === "negative");

      let itemsHtml = "";
      if (nonNeutral.length > 0) {
        itemsHtml = `
          <div class="sentiment-items-list">
            ${nonNeutral.map((item) => `
              <div class="sentiment-row" data-id="${escapeHtml(item.id)}">
                <div class="sentiment-dot ${item.sentiment === "positive" ? "pos" : "neg"}"></div>
                <div class="sentiment-text">"${escapeHtml(item.text)}"</div>
              </div>
            `).join("")}
          </div>
        `;
      } else {
        itemsHtml = `<div style="font-size: 11px; color: var(--text-secondary);">No strong positive or negative statements found.</div>`;
      }

      const isSentVis = pageData.resultSetVisibility?.sentiment !== false;
      card.innerHTML = `
        <div class="sentiment-header">
          <div class="sentiment-title">📊 Sentiment Scan</div>
          <div class="card-actions">
            <button class="toggle-result-btn ${isSentVis ? "active" : ""}" id="toggleSentCardBtn" title="Toggle all sentiment highlights on page">
              ${isSentVis ? "👁 Visible" : "🚫 Hidden"}
            </button>
            <button class="clear-card-btn" id="clearSentCardBtn">Clear</button>
          </div>
        </div>
        <div class="sentiment-stats">
          <span class="sentiment-stat-pill pos">🟢 ${summary.positive} Positive</span>
          <span class="sentiment-stat-pill neg">🔴 ${summary.negative} Negative</span>
          <span class="sentiment-stat-pill neu">⚪ ${summary.neutral} Neutral</span>
        </div>
        ${itemsHtml}
      `;

      card.querySelectorAll(".sentiment-row").forEach((row) => {
        row.addEventListener("click", async () => {
          const id = row.getAttribute("data-id");
          const tab = await getActiveTab();
          if (tab?.id && id) {
            chrome.tabs.sendMessage(tab.id, { type: "JUMP_TO_SENTIMENT", id });
          }
        });
      });

      const toggleSent = card.querySelector("#toggleSentCardBtn");
      if (toggleSent) {
        toggleSent.addEventListener("click", async () => {
          const nextVis = !(pageData.resultSetVisibility?.sentiment !== false);
          pageData.resultSetVisibility.sentiment = nextVis;
          await persistPageData();
          toggleSent.classList.toggle("active", nextVis);
          toggleSent.textContent = nextVis ? "👁 Visible" : "🚫 Hidden";

          const tab = await getActiveTab();
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: "TOGGLE_RESULT_SET_VISIBILITY",
              resultSetType: "sentiment",
              visible: nextVis
            });
          }
          showToast(`Sentiment highlights ${nextVis ? "visible" : "hidden"}`);
        });
      }

      const clearSent = card.querySelector("#clearSentCardBtn");
      if (clearSent) {
        clearSent.addEventListener("click", async () => {
          pageData.sentimentData = null;
          await persistPageData();
          const tab = await getActiveTab();
          if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "CLEAR_SENTIMENT" });
          showToast("Sentiment highlights cleared");
        });
      }
    } else if (msg.type === "custom-scan") {
      card.className = "custom-scan-card";
      const summary = msg.summary || { totalScanned: 0, matchedCount: 0 };
      const items = (Array.isArray(msg.items) ? msg.items : []).filter((i) => i.matched);

      let itemsHtml = "";
      if (items.length > 0) {
        itemsHtml = `
          <div class="scan-items-list">
            ${items.map((item) => {
              const hasTarget = item.targetText && item.targetText !== item.text;
              return `
              <div class="scan-row" data-id="${escapeHtml(item.id)}">
                <div class="scan-dot"></div>
                <div class="scan-text">
                  ${hasTarget ? `<strong class="target-chip">📌 ${escapeHtml(item.targetText)}</strong> ` : ""}
                  "${escapeHtml(item.text)}"
                </div>
              </div>
            `;
            }).join("")}
          </div>
        `;
      } else {
        itemsHtml = `<div style="font-size: 11px; color: var(--text-secondary);">No statements matching this topic were identified.</div>`;
      }

      const isCustomVis = pageData.resultSetVisibility?.custom !== false;
      card.innerHTML = `
        <div class="scan-card-header">
          <div class="scan-card-title">🔍 Scan: "${escapeHtml(msg.prompt)}"</div>
          <div class="card-actions">
            <button class="toggle-result-btn ${isCustomVis ? "active" : ""}" id="toggleCustomCardBtn" title="Toggle custom scan highlights on page">
              ${isCustomVis ? "👁 Visible" : "🚫 Hidden"}
            </button>
            <button class="clear-card-btn" id="clearScanCardBtn">Clear</button>
          </div>
        </div>
        <div class="scan-card-stats">
          <span class="scan-stat-pill">🎯 ${summary.matchedCount} matching statements</span>
        </div>
        ${itemsHtml}
      `;

      card.querySelectorAll(".scan-row").forEach((row) => {
        row.addEventListener("click", async () => {
          const id = row.getAttribute("data-id");
          const tab = await getActiveTab();
          if (tab?.id && id) {
            chrome.tabs.sendMessage(tab.id, { type: "JUMP_TO_CUSTOM_SCAN", id });
          }
        });
      });

      const toggleCustom = card.querySelector("#toggleCustomCardBtn");
      if (toggleCustom) {
        toggleCustom.addEventListener("click", async () => {
          const nextVis = !(pageData.resultSetVisibility?.custom !== false);
          pageData.resultSetVisibility.custom = nextVis;
          await persistPageData();
          toggleCustom.classList.toggle("active", nextVis);
          toggleCustom.textContent = nextVis ? "👁 Visible" : "🚫 Hidden";

          const tab = await getActiveTab();
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: "TOGGLE_RESULT_SET_VISIBILITY",
              resultSetType: "custom",
              visible: nextVis
            });
          }
          showToast(`Custom scan highlights ${nextVis ? "visible" : "hidden"}`);
        });
      }

      const clearScan = card.querySelector("#clearScanCardBtn");
      if (clearScan) {
        clearScan.addEventListener("click", async () => {
          pageData.customScanData = null;
          await persistPageData();
          const tab = await getActiveTab();
          if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "CLEAR_CUSTOM_SCAN" });
          showToast("Custom scan highlights cleared");
        });
      }
    } else {
      // Standard Question Answer Card
      const pct = Math.round((msg.probability || 0) * 100);
      const isYes = Boolean(msg.answer_found);
      const badgeText = isYes ? `✓ Answer found (${pct}%)` : `✕ No answer found on page`;
      const list = Array.isArray(msg.evidences) && msg.evidences.length
        ? msg.evidences
        : (msg.evidence ? [msg.evidence] : []);

      if (typeof msg.activeIndex !== "number" || msg.activeIndex >= list.length) {
        msg.activeIndex = 0;
      }

      const isAnswerVis = pageData.resultSetVisibility?.answer !== false;
      let inner = `
        <div class="card-top">
          <div class="verdict-pill ${isYes ? "yes" : "no"}">${badgeText}</div>
          <div class="card-actions">
            ${list.length > 0 ? `
              <button class="toggle-result-btn ${isAnswerVis ? "active" : ""}" id="toggleAnswerCardBtn" title="Toggle answer highlights on page">
                ${isAnswerVis ? "👁 Visible" : "🚫 Hidden"}
              </button>
            ` : ""}
            ${list.length > 1 ? `<div class="matches-badge">${list.length} matches found</div>` : ""}
          </div>
        </div>
      `;

      if (list.length > 0) {
        const active = list[msg.activeIndex] || list[0];

        if (list.length > 1) {
          inner += `
            <div class="passage-nav">
              <span class="passage-indicator">Passage ${msg.activeIndex + 1} of ${list.length}</span>
              <div class="pager-controls">
                <button class="nav-arrow prev-btn" title="Previous passage" ${msg.activeIndex === 0 ? "disabled" : ""}>‹</button>
                <button class="nav-arrow next-btn" title="Next passage" ${msg.activeIndex === list.length - 1 ? "disabled" : ""}>›</button>
              </div>
            </div>
          `;
        }

        const hasTarget = active.targetText && active.targetText !== active.text;
        inner += `
          <div class="evidence-box">
            ${hasTarget ? `<div style="margin-bottom:4px;"><strong class="target-chip">📌 ${escapeHtml(active.targetText)}</strong></div>` : ""}
            "${escapeHtml(active.text)}"
          </div>
        `;
        inner += `
          <button class="jump-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Jump to passage ${list.length > 1 ? msg.activeIndex + 1 : ""}
          </button>
        `;
      } else if (isYes) {
        inner += `<div style="font-size: 11px; color: var(--text-secondary);">Jev verified that this page answers your question.</div>`;
      } else {
        inner += `<div style="font-size: 11px; color: var(--text-secondary);">This page does not contain sufficient details to answer this.</div>`;
      }

      card.innerHTML = inner;

      const prevBtn = card.querySelector(".prev-btn");
      const nextBtn = card.querySelector(".next-btn");
      const jumpBtn = card.querySelector(".jump-btn");

      async function syncHighlight() {
        const tab = await getActiveTab();
        if (tab?.id && list.length) {
          chrome.tabs.sendMessage(tab.id, {
            type: "SET_ACTIVE_MATCH",
            matches: list,
            activeIndex: msg.activeIndex
          });
        }
      }

      if (prevBtn) {
        prevBtn.addEventListener("click", async () => {
          if (msg.activeIndex > 0) {
            msg.activeIndex--;
            await persistPageData();
            renderMessages();
            syncHighlight();
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", async () => {
          if (msg.activeIndex < list.length - 1) {
            msg.activeIndex++;
            await persistPageData();
            renderMessages();
            syncHighlight();
          }
        });
      }

      if (jumpBtn) {
        jumpBtn.addEventListener("click", syncHighlight);
      }

      const toggleAns = card.querySelector("#toggleAnswerCardBtn");
      if (toggleAns) {
        toggleAns.addEventListener("click", async () => {
          const nextVis = !(pageData.resultSetVisibility?.answer !== false);
          if (!pageData.resultSetVisibility) pageData.resultSetVisibility = {};
          pageData.resultSetVisibility.answer = nextVis;
          await persistPageData();
          toggleAns.classList.toggle("active", nextVis);
          toggleAns.textContent = nextVis ? "👁 Visible" : "🚫 Hidden";
          const tab = await getActiveTab();
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: "TOGGLE_RESULT_SET_VISIBILITY",
              resultSetType: "answer",
              visible: nextVis
            });
          }
          showToast(`Answer highlights ${nextVis ? "visible" : "hidden"}`);
        });
      }
    }

    el.appendChild(card);
  }

  messageStream.appendChild(el);
  if (scroll) messageStream.scrollTop = messageStream.scrollHeight;
  return el;
}

// --- Chat Question Handler ---
async function handleSend() {
  const question = chatInput.value.trim();
  if (!question) return;

  chatInput.value = "";
  chatInput.style.height = "auto";
  sendBtn.disabled = true;

  const userMsg = { role: "user", text: question, id: "u_" + Date.now() };
  pageData.messages.push(userMsg);
  appendMessageToDOM(userMsg);

  const loadingMsg = { role: "bot", loading: true, id: "l_" + Date.now() };
  const loadingEl = appendMessageToDOM(loadingMsg);

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active browser tab found.");

    const pageContent = await ensureContentScript(tab.id);
    if (!pageContent?.content) throw new Error("Could not extract readable text from this page.");

    const res = await fetch("http://127.0.0.1:8787/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        content: pageContent.content,
        title: pageContent.title || tab.title || "",
        url: pageContent.url || tab.url || "",
        granularity: "auto"
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Local Jev server error.");

    loadingEl.remove();
    const list = Array.isArray(data.evidences) && data.evidences.length
      ? data.evidences
      : (data.evidence ? [data.evidence] : []);

    const botMsg = {
      role: "bot",
      answer_found: Boolean(data.answer_found),
      probability: data.probability,
      evidence: data.evidence,
      evidences: list,
      activeIndex: 0,
      id: "b_" + Date.now()
    };
    pageData.messages.push(botMsg);
    appendMessageToDOM(botMsg);
    await persistPageData();

    if (list.length && pageData.highlightsVisible !== false) {
      chrome.tabs.sendMessage(tab.id, {
        type: "HIGHLIGHT_ALL_MATCHES",
        matches: list,
        activeIndex: 0
      });
    }
  } catch (err) {
    loadingEl.remove();
    const errorMsg = {
      role: "bot",
      error: err.message || "Failed to communicate with Jev.",
      id: "err_" + Date.now()
    };
    pageData.messages.push(errorMsg);
    appendMessageToDOM(errorMsg);
    await persistPageData();
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// --- Sentiment Scan Handler ---
async function handleSentimentScan() {
  sentimentScanBtn.disabled = true;
  const actionMsg = { role: "user", text: "📊 Run Sentiment Scan", id: "u_" + Date.now() };
  pageData.messages.push(actionMsg);
  appendMessageToDOM(actionMsg);

  const loadingMsg = {
    role: "bot",
    loading: true,
    loadingText: "Evaluating page sentiment with Jev…",
    id: "l_" + Date.now()
  };
  const loadingEl = appendMessageToDOM(loadingMsg);

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active browser tab found.");

    const pageContent = await ensureContentScript(tab.id);
    if (!pageContent?.content) throw new Error("Could not extract readable text from this page.");

    const res = await fetch("http://127.0.0.1:8787/api/sentiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: pageContent.content })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Sentiment scan failed.");

    loadingEl.remove();
    const sentMsg = {
      role: "bot",
      type: "sentiment",
      summary: data.summary,
      items: data.items,
      id: "sent_" + Date.now()
    };
    pageData.messages.push(sentMsg);
    pageData.sentimentData = { summary: data.summary, items: data.items };
    appendMessageToDOM(sentMsg);
    await persistPageData();

    if (pageData.highlightsVisible !== false) {
      chrome.tabs.sendMessage(tab.id, {
        type: "HIGHLIGHT_SENTIMENT",
        items: data.items
      });
    }
  } catch (err) {
    loadingEl.remove();
    const errorMsg = {
      role: "bot",
      error: err.message || "Sentiment scan error.",
      id: "err_" + Date.now()
    };
    pageData.messages.push(errorMsg);
    appendMessageToDOM(errorMsg);
    await persistPageData();
  } finally {
    sentimentScanBtn.disabled = false;
  }
}

// --- Custom Semantic Scan Handler ---
async function executeCustomScan() {
  const prompt = customScanInput.value.trim();
  if (!prompt) return;

  customScanTray.classList.add("hidden");
  runCustomScanBtn.disabled = true;

  const actionMsg = { role: "user", text: `🔍 Custom Scan: "${prompt}"`, id: "u_" + Date.now() };
  pageData.messages.push(actionMsg);
  appendMessageToDOM(actionMsg);

  const loadingMsg = {
    role: "bot",
    loading: true,
    loadingText: `Scanning for "${prompt}"…`,
    id: "l_" + Date.now()
  };
  const loadingEl = appendMessageToDOM(loadingMsg);

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active browser tab found.");

    const pageContent = await ensureContentScript(tab.id);
    if (!pageContent?.content) throw new Error("Could not extract readable text from this page.");

    const res = await fetch("http://127.0.0.1:8787/api/custom-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: pageContent.content,
        prompt,
        granularity: "auto"
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Custom scan failed.");

    loadingEl.remove();
    const scanMsg = {
      role: "bot",
      type: "custom-scan",
      prompt,
      summary: data.summary,
      items: data.items,
      id: "cscan_" + Date.now()
    };
    pageData.messages.push(scanMsg);
    pageData.customScanData = { prompt, summary: data.summary, items: data.items };
    appendMessageToDOM(scanMsg);
    await persistPageData();

    if (pageData.highlightsVisible !== false) {
      chrome.tabs.sendMessage(tab.id, {
        type: "HIGHLIGHT_CUSTOM_SCAN",
        items: data.items,
        prompt
      });
    }
  } catch (err) {
    loadingEl.remove();
    const errorMsg = {
      role: "bot",
      error: err.message || "Custom scan error.",
      id: "err_" + Date.now()
    };
    pageData.messages.push(errorMsg);
    appendMessageToDOM(errorMsg);
    await persistPageData();
  } finally {
    runCustomScanBtn.disabled = false;
  }
}

// --- Export Markdown ---
function exportMarkdown() {
  if (!pageData.messages.length) {
    showToast("No conversation to copy yet.");
    return;
  }

  let md = `# Jev Insights: ${pageData.title || "Page Analysis"}\n`;
  md += `**URL**: ${pageData.url}\n\n---\n\n`;

  pageData.messages.forEach((msg) => {
    if (msg.role === "user") {
      md += `### 💬 ${msg.text}\n\n`;
    } else if (msg.type === "sentiment") {
      md += `#### 📊 Sentiment Scan\n`;
      md += `- Positive: ${msg.summary?.positive || 0} statements\n`;
      md += `- Negative: ${msg.summary?.negative || 0} statements\n`;
      md += `- Neutral: ${msg.summary?.neutral || 0} statements\n\n`;
      (msg.items || []).filter((i) => i.sentiment !== "neutral").forEach((i) => {
        md += `> **[${i.sentiment.toUpperCase()}]** "${i.text}"\n\n`;
      });
    } else if (msg.type === "custom-scan") {
      md += `#### 🔍 Custom Scan: "${msg.prompt}"\n`;
      md += `- Found ${msg.summary?.matchedCount || 0} matching statements\n\n`;
      (msg.items || []).filter((i) => i.matched).forEach((i) => {
        md += `> "${i.text}"\n\n`;
      });
    } else if (msg.answer_found) {
      const pct = Math.round((msg.probability || 0) * 100);
      md += `**Answer Found (${pct}%)**\n\n`;
      const list = Array.isArray(msg.evidences) && msg.evidences.length ? msg.evidences : (msg.evidence ? [msg.evidence] : []);
      list.forEach((e, idx) => {
        md += `> Passage ${idx + 1}: "${e.text}"\n\n`;
      });
    } else if (msg.answer_found === false) {
      md += `*No answer found on page.*\n\n`;
    }
  });

  navigator.clipboard.writeText(md).then(() => {
    showToast("Copied as Markdown! ✓");
  }).catch(() => {
    showToast("Failed to copy to clipboard.");
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

// --- Event Listeners Setup ---
sendBtn.addEventListener("click", handleSend);

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + "px";
});

sentimentScanBtn.addEventListener("click", handleSentimentScan);

customScanToggleBtn.addEventListener("click", () => {
  customScanTray.classList.toggle("hidden");
  if (!customScanTray.classList.contains("hidden")) {
    customScanInput.focus();
  }
});

runCustomScanBtn.addEventListener("click", executeCustomScan);
customScanInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    executeCustomScan();
  }
});

toggleHighlightsBtn.addEventListener("click", async () => {
  pageData.highlightsVisible = !(pageData.highlightsVisible !== false);
  updateHighlightToggleUI();
  await persistPageData();

  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "TOGGLE_HIGHLIGHTS_VISIBILITY",
      visible: pageData.highlightsVisible
    });
  }
  showToast(`Highlights ${pageData.highlightsVisible ? "Visible" : "Hidden"}`);
});

clearBtn.addEventListener("click", async () => {
  if (confirm("Clear all chat messages and saved highlights for this page?")) {
    await deletePage(currentUrl);
    pageData = {
      url: currentUrl,
      title: currentTabTitle,
      favicon: currentFavicon,
      messages: [],
      sentimentData: null,
      customScanData: null,
      highlightsVisible: true
    };
    renderMessages();
    updateHighlightToggleUI();

    const tab = await getActiveTab();
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "CLEAR_HIGHLIGHTS" });
    }
    showToast("Page history cleared");
  }
});

copyMdBtn.addEventListener("click", exportMarkdown);

// Watch Tab Events
chrome.tabs.onActivated.addListener(() => syncActiveTab());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete" && tabId === currentTabId) {
    syncActiveTab();
  }
});

// Initial Setup
syncActiveTab();
