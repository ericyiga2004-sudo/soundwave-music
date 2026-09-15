// Artist pages must query their own catalogue, not the limited home feed.
export async function fetchArtistCatalogue(client, backendUrl, artistId, signal) {
  if (!/^[a-f\d]{24}$/i.test(String(artistId || ''))) {
    throw new Error('Invalid artist ID');
  }
  const found = new Map();
  let page = 1;
  let pages = 1;
  do {
    if (signal?.aborted) throw new Error('Artist request cancelled');
    const response = await client.get(`${backendUrl}/api/songs`, {
      params: { artist: artistId, page, limit: 100, sort: 'popular' },
      signal,
      timeout: 20000,
    });
    const data = response.data;
    if (!data?.success || !Array.isArray(data.songs)) {
      throw new Error('Could not load artist songs');
    }
    const count = Number(data.pages);
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('Invalid artist song pagination');
    }
    pages = count;
    for (const song of data.songs) {
      if (song?._id) found.set(String(song._id), song);
    }
    page += 1;
  } while (page <= pages);
  return [...found.values()];
}
