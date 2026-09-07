const fallback = { localStorage: new Map(), sessionStorage: new Map() };
const makeStorage = (name) => ({
  getItem(key) {
    try { return window[name].getItem(key) ?? fallback[name].get(key) ?? null; }
    catch { return fallback[name].get(key) ?? null; }
  },
  setItem(key, value) {
    fallback[name].set(key, String(value));
    try { window[name].setItem(key, String(value)); } catch { /* Session remains usable. */ }
  },
  removeItem(key) {
    fallback[name].delete(key);
    try { window[name].removeItem(key); } catch { /* Storage unavailable. */ }
  },
});
export const safeLocalStorage = makeStorage("localStorage");
export const safeSessionStorage = makeStorage("sessionStorage");
