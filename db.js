const DB_NAME = "JevDB";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store for per-page sessions
      if (!db.objectStoreNames.contains("pages")) {
        db.createObjectStore("pages", { keyPath: "url" });
      }

      // Store for reusable custom scan presets
      if (!db.objectStoreNames.contains("presets")) {
        const presetStore = db.createObjectStore("presets", { keyPath: "id" });
        // Seed default presets
        const defaults = [
          {
            id: "p_risks",
            name: "⚠️ Risks & Warnings",
            prompt: "risks, warnings, challenges, penalties, or negative factors",
            createdAt: Date.now()
          },
          {
            id: "p_pricing",
            name: "💰 Pricing & Numbers",
            prompt: "prices, valuations, costs, fees, or financial metrics",
            createdAt: Date.now()
          },
          {
            id: "p_growth",
            name: "📈 Growth & Milestones",
            prompt: "growth, achievements, expansions, profits, or positive milestones",
            createdAt: Date.now()
          },
          {
            id: "p_leadership",
            name: "👤 People & Leadership",
            prompt: "founders, executives, leadership, key people, or public figures",
            createdAt: Date.now()
          }
        ];
        defaults.forEach((p) => presetStore.add(p));
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPage(url) {
  if (!url) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pages", "readonly");
    const store = tx.objectStore("pages");
    const req = store.get(url);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function savePage(pageData) {
  if (!pageData?.url) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pages", "readwrite");
    const store = tx.objectStore("pages");
    pageData.updatedAt = Date.now();
    const req = store.put(pageData);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deletePage(url) {
  if (!url) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pages", "readwrite");
    const store = tx.objectStore("pages");
    const req = store.delete(url);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPresets() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readonly");
    const store = tx.objectStore("presets");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function savePreset(preset) {
  if (!preset?.id || !preset?.prompt) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readwrite");
    const store = tx.objectStore("presets");
    preset.createdAt = preset.createdAt || Date.now();
    const req = store.put(preset);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deletePreset(id) {
  if (!id) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readwrite");
    const store = tx.objectStore("presets");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
