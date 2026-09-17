const MONGO_ID_RE = /^[a-f0-9]{24}$/i;

export const isAudiusSong = (song) =>
  Boolean(
    String(song?.externalSource || "").toLowerCase() === "audius" ||
      String(song?.source || "").toLowerCase() === "audius" ||
      String(song?._id || "").startsWith("audius_")
  );

export const isExternalSong = (song) => Boolean(song?.isExternal || isAudiusSong(song));

export const hasPersistentSoundwaveId = (song) => MONGO_ID_RE.test(String(song?._id || ""));

// Mirrored Audius metadata has a normal MongoDB id. That means likes, history,
// playlists, social shares, comments and recommendations can safely use the
// exact same SoundWave APIs as uploaded songs while the audio itself remains
// an Audius stream.
export const canUseSoundwaveSongApi = (song) => hasPersistentSoundwaveId(song);
