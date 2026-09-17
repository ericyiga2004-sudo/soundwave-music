const OFFLINE_CACHE_NAME = "music-app-offline-songs-v1";
const OFFLINE_META_KEY = "music_app_offline_songs";

const getSongId = (songOrId) => {
  if (!songOrId) return "";
  return typeof songOrId === "string" ? songOrId : songOrId._id || songOrId.id || "";
};

const readOfflineMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_META_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeOfflineMeta = (items) => {
  localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(items));
};

const safeFileName = (name = "song") => {
  return String(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "song";
};

export const getOfflineSongs = () => readOfflineMeta();

export const isSongOfflineAvailable = async (songOrId) => {
  const songId = getSongId(songOrId);
  if (!songId || !("caches" in window)) return false;

  const meta = readOfflineMeta();
  const savedSong = meta.find((item) => item._id === songId);

  if (!savedSong?.audioUrl) return false;

  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const cachedAudio = await cache.match(savedSong.audioUrl);

  return Boolean(cachedAudio);
};

export const saveSongForOffline = async (song) => {
  if (!song?._id) {
    throw new Error("Song ID is missing.");
  }

  if (!song?.audioUrl) {
    throw new Error("Song audio URL is missing.");
  }

  if (!("caches" in window)) {
    throw new Error("This browser does not support offline audio caching.");
  }

  const cache = await caches.open(OFFLINE_CACHE_NAME);

  const audioResponse = await fetch(song.audioUrl, {
    mode: "cors",
  });

  if (!audioResponse.ok) {
    throw new Error("Could not download the audio file.");
  }

  await cache.put(song.audioUrl, audioResponse.clone());

  if (song.imageUrl) {
    try {
      const imageResponse = await fetch(song.imageUrl, {
        mode: "cors",
      });

      if (imageResponse.ok) {
        await cache.put(song.imageUrl, imageResponse.clone());
      }
    } catch {
      // Cover image caching is optional. Audio is the important part.
    }
  }

  const meta = readOfflineMeta();
  const nextMeta = meta.filter((item) => item._id !== song._id);

  nextMeta.unshift({
    _id: song._id,
    title: song.title || "Unknown Song",
    artistName: song.artist?.name || song.artist?.artistName || "Unknown Artist",
    albumTitle: song.album?.title || "Unknown Album",
    audioUrl: song.audioUrl,
    imageUrl: song.imageUrl || "",
    duration: song.duration || 0,
    genre: song.genre || "Unknown",
    releaseYear: song.releaseYear || "",
    downloadedAt: new Date().toISOString(),
  });

  writeOfflineMeta(nextMeta);

  return true;
};

export const getOfflineAudioObjectUrl = async (song) => {
  if (!song?.audioUrl || !("caches" in window)) return null;

  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const cachedAudio = await cache.match(song.audioUrl);

  if (!cachedAudio) return null;

  const blob = await cachedAudio.blob();
  return URL.createObjectURL(blob);
};

export const removeOfflineSong = async (songOrId) => {
  const songId = getSongId(songOrId);
  const meta = readOfflineMeta();
  const savedSong = meta.find((item) => item._id === songId);

  if ("caches" in window && savedSong) {
    const cache = await caches.open(OFFLINE_CACHE_NAME);

    if (savedSong.audioUrl) {
      await cache.delete(savedSong.audioUrl);
    }

    if (savedSong.imageUrl) {
      await cache.delete(savedSong.imageUrl);
    }
  }

  writeOfflineMeta(meta.filter((item) => item._id !== songId));

  return true;
};

export const downloadSongFileToDevice = async (song) => {
  if (!song?.audioUrl) {
    throw new Error("Song audio URL is missing.");
  }

  const response = await fetch(song.audioUrl, {
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error("Could not download song file.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const artist = song.artist?.name || "Unknown Artist";
  const title = song.title || "song";
  const fileName = `${safeFileName(artist)} - ${safeFileName(title)}.mp3`;

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
};