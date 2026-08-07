import { isAllowedGifUrl, isSlot, SLOTS, SLOT_LABELS } from './decorations';

/**
 * The two checks that stand between a decorated profile and a tracking pixel.
 *
 * A decoration is a URL supplied by one person and loaded by everyone who
 * visits their profile. Without the host allowlist, anybody could point it at
 * a server they control and turn every visit into a logged hit — on a page
 * whose entire premise is that people cannot see what others are doing.
 *
 * The picker only ever offers what the search returned, but the picker is not
 * the boundary: it posts a choice back, and nothing stops a crafted request
 * posting something else.
 */
describe('which hosts a decoration may come from', () => {
  it('accepts the provider CDN over https', () => {
    for (const url of [
      'https://media.giphy.com/media/abc/giphy.gif',
      'https://media3.giphy.com/media/xyz/giphy.gif',
      'https://i.giphy.com/media/abc/200.gif',
    ]) {
      expect(isAllowedGifUrl(url)).toBe(true);
    }
  });

  it('refuses any other host', () => {
    // The attack this exists for: a profile that reports its visitors to
    // somebody's own server.
    for (const url of [
      'https://tracker.example.com/pixel.gif',
      'https://giphy.com.evil.example/media/abc.gif',
      'https://evil.example/media.giphy.com/abc.gif',
    ]) {
      expect(isAllowedGifUrl(url)).toBe(false);
    }
  });

  it('refuses plain http even on an allowed host', () => {
    // Mixed content is blocked by the browser anyway; refusing here means the
    // row never stores a URL that cannot render.
    expect(isAllowedGifUrl('http://media.giphy.com/media/abc/giphy.gif')).toBe(false);
  });

  it('refuses schemes that are not http at all', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      'file:///etc/passwd',
    ]) {
      expect(isAllowedGifUrl(url)).toBe(false);
    }
  });

  it('refuses something that is not a URL', () => {
    for (const value of ['', 'media.giphy.com/abc.gif', 'not a url']) {
      expect(isAllowedGifUrl(value)).toBe(false);
    }
  });
});

describe('which places a decoration may go', () => {
  it('accepts the defined slots', () => {
    for (const slot of SLOTS) expect(isSlot(slot)).toBe(true);
  });

  it('refuses anything else', () => {
    // The slot is written straight into a unique index and used to look up a
    // CSS class; an unknown value would store a row nothing can ever render.
    for (const value of ['', 'header', 'BANNER', '../banner', 42, null, undefined]) {
      expect(isSlot(value)).toBe(false);
    }
  });

  it('describes every slot it offers', () => {
    // A slot with no label would render as an unexplained empty box in the
    // picker — easy to add one and forget the other.
    for (const slot of SLOTS) {
      expect(SLOT_LABELS[slot].name.length).toBeGreaterThan(0);
      expect(SLOT_LABELS[slot].hint.length).toBeGreaterThan(0);
    }
  });
});
