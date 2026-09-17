export const isAudiusSong = (song) =>
  Boolean(
    song?.isExternal ||
      String(song?.externalSource || "").toLowerCase() === "audius" ||
      String(song?.source || "").toLowerCase() === "audius" ||
      String(song?._id || "").startsWith("audius_")
  );

export const isExternalSong = (song) => Boolean(song?.isExternal || isAudiusSong(song));

export const canUseSoundwaveSongApi = (song) =>
  Boolean(song?._id && !isExternalSong(song));
