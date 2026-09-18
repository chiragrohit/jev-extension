# Jev — Ask This Page

A small Chrome extension MVP for asking a yes/no-style question about the current page.

## MVP

1. Open a webpage.
2. Click the extension.
3. Ask a question such as:
   **Does this page mention the application deadline?**
4. The extension searches the page's visible text.
5. If a strong matching passage is found, it shows the passage and lets you jump to it.
6. Otherwise it reports **No answer found on this page**.

## Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.

## Architecture

The current MVP uses a local lexical matching heuristic so it works without an API key.

The intended next step is:

```
Page content
   ↓
Jev / semantic question
   ↓
answer_found: yes/no
   ↓
best evidence passage
   ↓
DOM locator
   ↓
highlight + scroll
```

Jev/API integration can replace the local matching function without changing the popup UX.
