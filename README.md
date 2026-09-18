# Jev — Ask This Page

A Chrome extension that asks **TypeSafe Jev** whether the current page contains an answer, then takes you to the supporting passage and highlights it.

## Pure-local setup

There is **no Vercel, no hosted backend, and no cloud server you run**.

Only the Jev inference API is remote. Everything else runs on your computer:

```
Chrome extension
      ↓
127.0.0.1:8787
      ↓
Local Node.js server
      ↓
TypeSafe Jev API
      ↓
answer_found + best_evidence
      ↓
Chrome extension
      ↓
scroll + highlight
```

Your TypeSafe API key stays on your computer and is never included in the extension.

## Requirements

- Node.js 18+ (Node 20+ recommended)
- TypeSafe API key
- Chrome

## 1. Clone

```bash
git clone https://github.com/chiragrohit/jev-extension.git
cd jev-extension
```

## 2. Set the API key

Create a `.env` file in the root directory (or copy `.env.example`):

```bash
cp .env.example .env
```

Add your key to `.env`:

```env
TYPESAFE_API_KEY=YOUR_API_KEY
```

Alternatively, you can export it in your terminal session:

### Windows PowerShell

```powershell
$env:TYPESAFE_API_KEY="YOUR_API_KEY"
```

### macOS / Linux

```bash
export TYPESAFE_API_KEY="YOUR_API_KEY"
```

Do not commit the `.env` file or key.


## 3. Start the local server

```bash
npm start
```

You should see:

```
Jev local server: http://127.0.0.1:8787/api/ask
```

Keep this terminal running.

## 4. Load the Chrome extension

Open:

```
chrome://extensions
```

Then:

1. Enable **Developer mode**.
2. Click **Load unpacked** (or click the reload icon if already loaded).
3. Select the repository folder.
4. Open any webpage.
5. Click the **Jev extension icon** in your toolbar to open Chrome's native side panel.

The extension connects to:

```
http://127.0.0.1:8787/api/ask
```

## 5. Interact like a Chatbot

The native Chrome side panel docks directly into Chrome on the right side. It is completely embedded and does not overlay the webpage, giving you a compact, native chatbot interface.

Example:

> Does this page mention the IPO price?

If Jev finds an answer:

```
✓ Answer found on this page (95%)

"But the IPO price band right now tops out at ₹1,785."

[Jump to passage]
```

Click **Jump to passage** (or it will auto-highlight) to smoothly scroll the active webpage to the passage with an amber highlight right beside your chat!

If the answer is not present:

```
✕ No answer found on this page
```

## 6. Sentiment Scan

Click the **📊 Sentiment** button in the side panel toolbar to analyze page sentiment with Jev:
- **Positive statements**: highlighted in subtle green (`#bbf7d0`).
- **Negative statements**: highlighted in subtle red (`#fecaca`).
- **Neutral statements**: no highlight.

## 7. Custom Semantic Scan & Presets

Click the **🔍 Custom Scan** button to scan the page for *any* custom criteria or topic (e.g. `"content talking positive about Sam Altman"`, `"regulatory risks"`, `"pricing & fees"`):
- Evaluates sentences with TypeSafe Jev and illuminates matching statements on the webpage in soft violet (`#c7d2fe`).
- Automatically saves new custom scans as reusable one-click presets in **IndexedDB**.
- Preloaded with common presets (Risks & Warnings, Pricing & Numbers, Growth & Milestones).

## 8. Toggle Highlights by Result Set

Easily control your view without clutter or wiping your work:
- Each result card (Q&A Answer, Sentiment Scan, and Custom Scan) features an instant **`👁 Visible` / `🚫 Hidden`** toggle button.
- Toggling immediately reveals or hides the **entire result set** on the webpage without touching other highlights or destroying DOM mark coordinates.
- Visibility states are persisted per page in IndexedDB and restored upon return.

## 9. Auto-Adaptive Granularity (Entity, Phrase, Sentence)

Jev automatically determines the ideal highlight granularity based on the query:
- Questions asking for specific names, numbers, acronyms, dates, or titles isolate the exact **entity/word** or **phrase** target on the page with pinpoint precision (`📌 target`).
- Broad conceptual inquiries or explanations highlight the full context sentence/passage.
- No manual chip selection or micro-management required.

## 10. Persistent IndexedDB & Header Tools

- **Persistent Memory**: Chats, sentiment scans, custom scans, active passage indicators, and result-set visibility states are stored in **IndexedDB** per URL. Revisiting any page automatically restores your previous conversation and re-illuminates all highlights on the page!
- **Two-Row Responsive Header**:
  - Row 1: `Jev` status dot, active website favicon, full page title, and **📋 Copy as Markdown** button.
  - Row 2: Action buttons for **📊 Sentiment**, **🔍 Custom Scan**, **👁 All Highlights** toggle, and **🗑 Clear**.
- **Zero Layout Shift**: All highlights use zero margin, zero padding, and display inline with thin 1.5px outlines to guarantee zero page reflow.

## Local does not mean offline

The extension and your server are local. **Jev itself is accessed through its API**, so the machine needs internet access for semantic evaluation.

Page content sent to Jev is processed by the TypeSafe API.

## Security

- API key exists only as `TYPESAFE_API_KEY` in your local process environment.
- The server binds to `127.0.0.1`.
- The extension never receives the API key.
- `.gitignore` excludes common local secrets and dependencies.
- Never commit an API key to GitHub.

## Implementation

Jev performs:

1. `answer_found` — semantic yes/no judgment.
2. `best_evidence` — selection of the passage that answers the question.

Normal JavaScript performs:

- page text extraction
- candidate retrieval
- API orchestration
- DOM lookup
- scrolling
- highlighting
