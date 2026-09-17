import { getAudiusTrendingMeta, isAudiusConfigured } from "./audiusService.js";
import { syncAudiusTracks } from "./externalCatalogSync.js";

let warming = null;
let lastWarmAt = 0;
const MIN_INTERVAL_MS = Math.max(120000, Number(process.env.AUDIUS_WARM_MIN_INTERVAL_MS || 600000));

export const warmAudiusCatalog = async ({ force = false } = {}) => {
  if (!isAudiusConfigured()) return { success: false, reason: "not_configured" };
  if (warming) return warming;
  if (!force && Date.now() - lastWarmAt < MIN_INTERVAL_MS) return { success: true, skipped: true };

  warming = (async () => {
    try {
      const windows = [
        { time: "week", limit: 70, offset: Math.floor(Math.random() * 12) },
        { time: "month", limit: 50, offset: Math.floor(Math.random() * 18) },
      ];
      const settled = await Promise.allSettled(windows.map((options) => getAudiusTrendingMeta(options)));
      const tracks = [];
      const seen = new Set();
      settled.forEach((entry) => {
        if (entry.status !== "fulfilled") return;
        for (const track of entry.value?.value || []) {
          const id = String(track?.externalId || "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          tracks.push(track);
        }
      });
      const songs = await syncAudiusTracks(tracks);
      lastWarmAt = Date.now();
      console.log(`Audius catalog warmup mirrored ${songs.length} tracks`);
      return { success: true, count: songs.length };
    } catch (error) {
      console.warn("Audius catalog warmup skipped:", error?.message || error);
      return { success: false, reason: error?.message || "warmup_failed" };
    } finally {
      warming = null;
    }
  })();

  return warming;
};

export const startAudiusCatalogWarmup = () => {
  if (!isAudiusConfigured()) return;
  setTimeout(() => warmAudiusCatalog({ force: true }).catch(() => {}), 1200);
  const timer = setInterval(() => warmAudiusCatalog().catch(() => {}), MIN_INTERVAL_MS);
  timer.unref?.();
};
