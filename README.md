# Jev — Ask This Page

A Chrome extension that asks **TypeSafe Jev** whether the current page contains an answer, then takes you to the supporting passage and highlights it.

## Architecture

```
Web page → extension extracts text → /api/ask → Jev
                                      ↓
                              answer_found (noul)
                                      ↓
                              best_evidence (choice)
                                      ↓
                              extension highlights
```

The TypeSafe API key is **server-side only**. It is never put in the extension.

## Deploy the Jev backend

This repo includes a Vercel serverless endpoint at `api/ask.js`.

### 1. Get a TypeSafe API key

Create/get your key from your TypeSafe account.

### 2. Install Vercel CLI

```bash
npm i -g vercel
```

### 3. Deploy

From this repository:

```bash
vercel
```

Link the project when prompted, then add the secret:

```bash
vercel env add TYPESAFE_API_KEY
```

Paste your TypeSafe API key. Do **not** commit the key.

Deploy production:

```bash
vercel --prod
```

Your API endpoint will be:

```
https://YOUR-PROJECT.vercel.app/api/ask
```

### 4. Configure the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository.
5. Open the extension.
6. Expand **Settings**.
7. Enter your deployed endpoint, e.g. `https://YOUR-PROJECT.vercel.app/api/ask`.
8. Click **Save**.

For local development, use:

```
npm install
vercel dev
```

and keep the default endpoint:

```
http://localhost:3000/api/ask
```

Set `TYPESAFE_API_KEY` in the Vercel/local environment before testing.

## Use it

Ask questions such as:

- “Does this page mention the application deadline?”
- “Does this page say who is eligible?”
- “Is a budget amount specified on this page?”

If Jev determines that the answer exists, the extension returns the selected evidence passage. Click **Go to answer** to scroll to and highlight it.

If the answer is not present, it shows:

**No answer found on this page.**

## Security

Never put `TYPESAFE_API_KEY` in:

- `manifest.json`
- `popup.js`
- `content.js`
- GitHub
- Chrome extension storage

The extension only stores your backend URL. The server sends requests to `https://api.typesafe.ai/v1/systemone` using the server-side key and the `jev-latest` model.

## Design

Jev handles the semantic decisions:

1. **answer_found** — whether the page actually answers the question.
2. **best_evidence** — which candidate passage is the answer.

Code handles page extraction, lightweight candidate retrieval, API orchestration, and deterministic scrolling/highlighting.

This follows TypeSafe's model: **code owns the workflow; Jev supplies the semantic judgment.**
