import axios from "axios";
import { API_BASE_URL } from "./api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

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
