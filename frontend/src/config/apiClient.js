import axios from "axios";
import { API_BASE_URL, API_HOSTED_URL, API_MODE } from "./api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Render free instances can need ~50 seconds to wake. A 20 second timeout
  // made a healthy production API look offline during cold starts.
  timeout: 70000,
});


const BAD_TOKEN_VALUES = new Set(["", "false", "null", "undefined", "none", "nan"]);

export const getStoredAuthToken = () => {
  const raw = String(localStorage.getItem("token") || "").trim();
  if (BAD_TOKEN_VALUES.has(raw.toLowerCase())) {
    localStorage.removeItem("token");
    return "";
  }
  return raw;
};

export const clearStoredAuthToken = () => {
  localStorage.removeItem("token");
  window.dispatchEvent(new CustomEvent("soundwave-auth-invalid"));
};

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config || {};

    if (status === 401 && getStoredAuthToken()) {
      clearStoredAuthToken();
    }

    // If local development was explicitly enabled but the local API is down,
    // retry once against the hosted API so the whole site does not collapse.
    const networkFailure = !error?.response;
    if (
      networkFailure &&
      API_MODE === "local" &&
      !config.__soundwaveHostedFallback &&
      API_HOSTED_URL
    ) {
      config.__soundwaveHostedFallback = true;
      config.baseURL = API_HOSTED_URL;
      return apiClient.request(config);
    }

    // Render can briefly answer 502/503/504 while a free instance is waking.
    // Retry GETs once rather than turning every catalog section into an error.
    const retryableStatus = [502, 503, 504].includes(Number(status));
    const isGet = String(config.method || "get").toLowerCase() === "get";
    if ((networkFailure || retryableStatus) && isGet && !config.__soundwaveWakeRetry) {
      config.__soundwaveWakeRetry = true;
      await sleep(1200);
      return apiClient.request(config);
    }

    return Promise.reject(error);
  }
);

export const authHeaders = (token = "") => {
  const clean = String(token || "").trim();
  return clean ? { token: clean } : {};
};

const requestCache = new Map();
const pendingRequests = new Map();
const MAX_CACHE_ENTRIES = 40;

const stableParams = (params = {}) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join("|");

const cacheKeyFor = (url, params, tokenScope = "public") =>
  `${tokenScope}:${url}?${stableParams(params)}`;

const trimCache = () => {
  if (requestCache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = [...requestCache.entries()]
    .sort((a, b) => a[1].createdAt - b[1].createdAt)
    .slice(0, requestCache.size - MAX_CACHE_ENTRIES);
  oldest.forEach(([key]) => requestCache.delete(key));
};

export const cachedGet = async (
  url,
  { params = {}, headers = {}, ttl = 45000, signal, cacheScope = "public" } = {}
) => {
  const key = cacheKeyFor(url, params, cacheScope);
  const cached = requestCache.get(key);
  const now = Date.now();

  if (cached && now - cached.createdAt < ttl) {
    return cached.data;
  }

  // Abortable requests should stay independent, but ordinary GETs can share an
  // in-flight request. This avoids duplicate catalog downloads when several
  // home sections ask for the same endpoint at the same time.
  if (!signal && pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const request = apiClient
    .get(url, { params, headers, signal })
    .then((response) => {
      requestCache.set(key, { createdAt: Date.now(), data: response.data });
      trimCache();
      return response.data;
    })
    .finally(() => {
      if (!signal) pendingRequests.delete(key);
    });

  if (!signal) pendingRequests.set(key, request);
  return request;
};

export const invalidateApiCache = (prefix = "") => {
  if (!prefix) {
    requestCache.clear();
    pendingRequests.clear();
    return;
  }

  [...requestCache.keys()].forEach((key) => {
    if (key.includes(prefix)) requestCache.delete(key);
  });
};
