const q = document.getElementById("question");
const ask = document.getElementById("ask");
const status = document.getElementById("status");
const result = document.getElementById("result");
const badge = document.getElementById("answerBadge");
const evidence = document.getElementById("evidence");
const go = document.getElementById("go");

let lastMatch = null;

function setStatus(text) {
  status.textContent = text;
  status.classList.toggle("hidden", !text);
}

function showResult(found, match) {
  result.classList.remove("hidden");
  badge.textContent = found ? "✓ Answer found on this page" : "✕ No answer found on this page";
  badge.className = "badge " + (found ? "yes" : "no");
  evidence.textContent = match?.text || "";
  go.classList.toggle("hidden", !found || !match);
}

ask.addEventListener("click", async () => {
  const question = q.value.trim();
  if (!question) return;
  ask.disabled = true;
  go.classList.add("hidden");
  result.classList.add("hidden");
  setStatus("Reading page…");

  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw new Error("No active tab");

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "FIND_ANSWER",
      question
    });

    lastMatch = response?.match || null;
    showResult(Boolean(response?.found), lastMatch);
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("This page cannot be analyzed.");
  } finally {
    ask.disabled = false;
  }
});

go.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id || !lastMatch) return;
  await chrome.tabs.sendMessage(tab.id, {
    type: "HIGHLIGHT_MATCH",
    match: lastMatch
  });
  window.close();
});