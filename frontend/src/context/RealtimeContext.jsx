import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MusicContext } from "./ShopContext";
import { API_BASE_URL } from "../config/api";

const RealtimeContext = createContext({
  socket: null,
  connected: false,
  lastEventAt: null,
  mode: "idle",
  updatesAvailable: false,
});

const cleanToken = (token) => {
  const value = String(token || "").trim();
  const bad = new Set(["", "false", "null", "undefined", "none", "nan"]);
  return bad.has(value.toLowerCase()) ? "" : value;
};

const createBus = () => {
  const listeners = new Map();
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },
    emitLocal(event, payload) {
      listeners.get(event)?.forEach((handler) => {
        try { handler(payload); }
        catch (error) { console.warn("Realtime handler error:", error); }
      });
    },
  };
};

const sleep = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
});

export const RealtimeProvider = ({ children }) => {
  const { token, getAuthToken } = useContext(MusicContext);
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState(null);
  const [mode, setMode] = useState("idle");
  const busRef = useRef(createBus());

  const authToken = useMemo(
    () => cleanToken(getAuthToken?.() || token || localStorage.getItem("token")),
    [token, getAuthToken]
  );

  useEffect(() => {
    if (!authToken) {
      setConnected(false);
      setMode("idle");
      return undefined;
    }

    const controller = new AbortController();
    let stopped = false;
    let blockedCapabilitySignature = "";

    // Render stays the primary API. We never probe an optional route that may
    // not exist. The API root exists in old and new SoundWave backends.
    // New backends advertise SSE support through response headers; legacy
    // backends simply fall back to polling with no /api/realtime 404 requests.
    const getRealtimeCapability = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) return { supported: false, signature: `root-${response.status}` };
        const realtime = String(response.headers.get("x-soundwave-realtime") || "").trim().toLowerCase();
        const version = String(response.headers.get("x-soundwave-version") || "legacy").trim();
        return {
          supported: realtime === "sse",
          signature: `${version}|${realtime || "none"}`,
        };
      } catch {
        return { supported: false, signature: "root-network" };
      }
    };

    const consumeStream = async () => {
      const response = await fetch(`${API_BASE_URL}/api/realtime/stream`, {
        method: "GET",
        headers: { token: authToken, Accept: "text/event-stream" },
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.status === 401) {
        setMode("idle");
        return "unauthorized";
      }

      if ([404, 405, 410, 501].includes(response.status)) return "unsupported";
      if (!response.ok || !response.body) throw new Error(`Realtime stream unavailable (${response.status})`);

      setConnected(true);
      setMode("live");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped && !controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const dataLine = block.split("\n").find((line) => line.startsWith("data:"));

          if (dataLine) {
            try {
              const packet = JSON.parse(dataLine.slice(5).trim());
              if (packet?.event) {
                setLastEventAt(Date.now());
                busRef.current.emitLocal(packet.event, packet.payload);
              }
            } catch {
              // Keep stream alive through malformed/partial heartbeat frames.
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }

      return "ended";
    };

    const run = async () => {
      let reconnectDelay = 1800;

      while (!stopped && !controller.signal.aborted) {
        setMode((current) => current === "live" ? current : "checking");
        const capability = await getRealtimeCapability();
        if (stopped || controller.signal.aborted) break;

        if (!capability.supported || capability.signature === blockedCapabilitySignature) {
          setConnected(false);
          setMode("polling");
          await sleep(120000, controller.signal);
          continue;
        }

        try {
          const result = await consumeStream();
          setConnected(false);

          if (result === "unauthorized") return;
          if (result === "unsupported") {
            // Never hammer the same deployment with repeated 404 requests.
            // A new backend signature can be tried automatically later.
            blockedCapabilitySignature = capability.signature;
            setMode("polling");
            await sleep(120000, controller.signal);
            continue;
          }

          if (!stopped && !controller.signal.aborted) setMode("reconnecting");
        } catch (error) {
          setConnected(false);
          if (!controller.signal.aborted) {
            setMode("polling");
            if (import.meta.env.DEV) {
              console.debug("SoundWave realtime temporarily unavailable; using polling fallback.", error?.message || error);
            }
          }
        }

        if (!stopped && !controller.signal.aborted) {
          await sleep(reconnectDelay, controller.signal);
          reconnectDelay = Math.min(15000, Math.round(reconnectDelay * 1.7));
        }
      }
    };

    run();

    return () => {
      stopped = true;
      controller.abort();
      setConnected(false);
      setMode("idle");
    };
  }, [authToken]);

  const updatesAvailable = connected || mode === "polling" || mode === "reconnecting" || mode === "checking";
  const value = useMemo(
    () => ({ socket: busRef.current, connected, lastEventAt, mode, updatesAvailable }),
    [connected, lastEventAt, mode, updatesAvailable]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => useContext(RealtimeContext);
export default RealtimeContext;
