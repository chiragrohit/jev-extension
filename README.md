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

### Windows PowerShell

```powershell
$env:TYPESAFE_API_KEY="YOUR_API_KEY"
```

### macOS / Linux

```bash
export TYPESAFE_API_KEY="YOUR_API_KEY"
```

Do not commit the key.

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
2. Click **Load unpacked**.
3. Select the repository folder.
4. Open any webpage.
5. Click the Jev extension icon.

The extension is hard-wired to:

```
http://127.0.0.1:8787/api/ask
```

There is no backend URL setting because this is intentionally local-only.

## 5. Ask

Example:

> Does this page mention the application deadline?

If Jev finds an answer:

```
✓ Answer found on this page

"The last date for applications is..."
    
[Go to answer]
```

Click **Go to answer** and the extension scrolls to and highlights the passage.

If the answer is not present:

```
✕ No answer found on this page
```

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
