import { safeLocalStorage } from "./safeStorage";
const BATTERY_KEY = "soundwave_battery_saver";
const LOW_DATA_KEY = "soundwave_low_data";
const THEME_KEY = "soundwave_theme";
const PERSONALIZATION_KEY = "soundwave_personalization";
const SIDEBAR_HIDDEN_KEY = "soundwave_sidebar_hidden";
const UI_EVENT = "soundwave-ui-preferences";

const dispatchPreferences = (detail = {}) => {
  window.dispatchEvent(new CustomEvent(UI_EVENT, { detail }));
};

export const getBatterySaver = () => {
  const stored = safeLocalStorage.getItem(BATTERY_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const lowCoreDevice = Number(navigator.hardwareConcurrency || 8) <= 4;
  return Boolean(reducedMotion || lowCoreDevice);
};

export const setBatterySaver = (value) => {
  const next = Boolean(value);
  safeLocalStorage.setItem(BATTERY_KEY, String(next));
  dispatchPreferences({ batterySaver: next });
};

export const getLowData = () => {
  const stored = safeLocalStorage.getItem(LOW_DATA_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return Boolean(connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType));
};

export const setLowData = (value) => {
  const next = Boolean(value);
  safeLocalStorage.setItem(LOW_DATA_KEY, String(next));
  dispatchPreferences({ lowData: next });
};

export const getPersonalizationEnabled = () => {
  const stored = safeLocalStorage.getItem(PERSONALIZATION_KEY);
  return stored !== "false";
};

export const setPersonalizationEnabled = (value) => {
  const next = Boolean(value);
  safeLocalStorage.setItem(PERSONALIZATION_KEY, String(next));
  dispatchPreferences({ personalization: next });
};

export const getSidebarHidden = () => safeLocalStorage.getItem(SIDEBAR_HIDDEN_KEY) === "true";

export const setSidebarHidden = (value) => {
  const next = Boolean(value);
  safeLocalStorage.setItem(SIDEBAR_HIDDEN_KEY, String(next));
  dispatchPreferences({ sidebarHidden: next });
};

export const getTheme = () => {
  const stored = safeLocalStorage.getItem(THEME_KEY);
  return stored === "dark" ? "dark" : "light";
};

export const setTheme = (theme) => {
  const next = theme === "dark" ? "dark" : "light";
  safeLocalStorage.setItem(THEME_KEY, next);
  dispatchPreferences({ theme: next });
};

export const UI_PREFERENCES_EVENT = UI_EVENT;
