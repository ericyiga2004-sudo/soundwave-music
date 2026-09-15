import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchArtistCatalogue } from '../src/utils/artistCatalogue.js';
const artist = 'a'.repeat(24);
test('loads artist-specific songs absent from the home feed and all pages', async () => {
  const requests = [];
  const client = { get: async (url, options) => {
    requests.push(options.params);
    assert.equal(url, '/api/songs');
    assert.equal(options.params.artist, artist);
    assert.equal(options.params.limit, 100);
    return { data: { success: true, pages: 2, songs: options.params.page === 1
      ? [{ _id: 'bts-new', artist }, { _id: 'duet', featuredArtists: [artist] }]
      : [{ _id: 'duet', featuredArtists: [artist] }, { _id: 'bts-older', artist }] } };
  } };
  assert.deepEqual((await fetchArtistCatalogue(client, '', artist)).map(s => s._id), ['bts-new', 'duet', 'bts-older']);
  assert.deepEqual(requests.map(r => r.page), [1, 2]);
});
test('empty catalogue is valid and ends after one request', async () => {
  let calls = 0;
  assert.deepEqual(await fetchArtistCatalogue({ get: async () => { calls++; return { data: { success: true, pages: 0, songs: [] } }; } }, '', artist), []);
  assert.equal(calls, 1);
});
test('a page failure does not silently return an incomplete catalogue', async () => {
  await assert.rejects(fetchArtistCatalogue({ get: async (_, { params }) => {
    if (params.page === 2) throw new Error('network');
    return { data: { success: true, pages: 2, songs: [{ _id: 'one' }] } };
  } }, '', artist), /network/);
});
test('invalid IDs never trigger an unfiltered song request', async () => {
  await assert.rejects(fetchArtistCatalogue({ get: () => assert.fail('Unexpected request') }, '', 'BTS'), /Invalid artist/);
});
test('cancelled route stops requesting further pages', async () => {
  const c = new AbortController(); let calls = 0;
  await assert.rejects(fetchArtistCatalogue({ get: async (_, options) => {
    calls++; assert.equal(options.signal, c.signal); c.abort();
    return { data: { success: true, pages: 3, songs: [] } };
  } }, '', artist, c.signal), /cancelled/);
  assert.equal(calls, 1);
});
test('API failure and malformed pagination are surfaced', async () => {
  for (const data of [{ success: false }, { success: true, songs: [], pages: 'oops' }]) {
    await assert.rejects(fetchArtistCatalogue({ get: async () => ({ data }) }, '', artist));
  }
});
