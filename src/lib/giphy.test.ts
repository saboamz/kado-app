import { giphyConfigured, searchGifs } from './giphy';

/**
 * The provider integration, and what happens without it.
 *
 * The unconfigured case is not an edge case here: the app ships before the
 * key exists, so it is the FIRST state anybody sees. It has to say so rather
 * than render an empty grid that reads as broken.
 */
describe('when no API key is configured', () => {
  const original = process.env.GIPHY_API_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.GIPHY_API_KEY;
    else process.env.GIPHY_API_KEY = original;
  });

  it('reports itself as unconfigured', () => {
    delete process.env.GIPHY_API_KEY;
    expect(giphyConfigured()).toBe(false);
  });

  it('treats an empty key as absent', () => {
    // A variable declared but left blank is the shape a half-finished setup
    // takes. Treating it as configured would send every search to a client
    // that cannot authenticate, and the failure would arrive as a confusing
    // "search did not respond" instead of "not set up yet".
    process.env.GIPHY_API_KEY = '';
    expect(giphyConfigured()).toBe(false);
  });

  it('refuses to search rather than calling the provider', async () => {
    delete process.env.GIPHY_API_KEY;

    const result = await searchGifs('chat');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // A distinct reason, so the UI can explain the difference between "not
    // set up" and "the provider is down".
    expect(result.reason).toBe('unconfigured');
  });

  it('says so for a trending request too', async () => {
    // The picker opens on trending, before anybody types — so this is the
    // path that runs first.
    delete process.env.GIPHY_API_KEY;

    const result = await searchGifs('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unconfigured');
  });
});

describe('what the picker is given to show', () => {
  const original = process.env.GIPHY_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.GIPHY_API_KEY;
    else process.env.GIPHY_API_KEY = original;
  });

  it('offers an animated preview, not only a still', async () => {
    /*
     * The bug this exists for: the grid rendered stillUrl, so every result
     * was a frozen frame. People were choosing a GIF on the strength of one
     * frame — often a near-empty one — which is choosing blind, and it is the
     * one thing a GIF picker must not do.
     *
     * Skipped when no key is configured, so the suite still runs offline.
     */
    if (!process.env.GIPHY_API_KEY) return;

    const result = await searchGifs('chat', 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gifs.length).toBeGreaterThan(0);

    for (const gif of result.gifs) {
      // Three distinct renditions, each with its own job.
      expect(gif.previewUrl).toMatch(/^https:\/\//);
      expect(gif.gifUrl).toMatch(/^https:\/\//);
      expect(gif.stillUrl).toMatch(/^https:\/\//);
      // The preview must not BE the still, which is exactly what went wrong.
      expect(gif.previewUrl).not.toBe(gif.stillUrl);
    }
  });
});
