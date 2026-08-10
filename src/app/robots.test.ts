import robots from './robots';
import sitemap from './sitemap';

/**
 * What a crawler is allowed to read.
 *
 * This is the one file in the app where a mistake is public and slow to
 * undo: a profile indexed today is in a search result for weeks, and the
 * person who ticked "profil public" meant "anybody with the link", not
 * "anybody searching my name".
 *
 * So the rules are held by a test rather than trusted to review.
 */
const rules = () => {
  const config = robots();
  const rule = Array.isArray(config.rules) ? config.rules[0]! : config.rules;
  return (rule.disallow ?? []) as string[];
};

/** Whether a path survives the published Disallow list, as a crawler reads it. */
const indexable = (path: string) => !rules().some((d) => path.startsWith(d));

describe('what a crawler may reach', () => {
  it.each(['/', '/mentions-legales', '/confidentialite', '/conditions'])(
    'opens %s',
    (path) => {
      // Everything this app has to say to a stranger.
      expect(indexable(path)).toBe(true);
    },
  );

  it.each([
    ['/u/abc123', 'a profile: somebody’s name, photo and interests'],
    ['/lists/abc', 'a list, which may be visible to anybody with the link'],
    ['/gifts/abc', 'a wish, same'],
    ['/i/xFpBlFa1xpMj', 'an invitation code, which is a credential'],
    ['/profile', 'the signed-in profile'],
    ['/profile/edit', 'and anything under it'],
    ['/settings', 'settings'],
    ['/app', 'the app itself'],
    ['/uploads/avatars/x.jpg', 'the files people upload'],
    ['/api/cron', 'the cron endpoint'],
  ])('closes %s — %s', (path) => {
    expect(indexable(path)).toBe(false);
  });

  it('closes sign-in and sign-up', () => {
    // Reachable without a session, and worth nothing in a result: an empty
    // form helps nobody and competes with the landing page for one query.
    expect(indexable('/login')).toBe(false);
    expect(indexable('/signup')).toBe(false);
  });

  it('closes by prefix, so a route added later is closed the day it is written', () => {
    // /lists/abc/gifts/new did not exist when these rules were written.
    expect(indexable('/lists/abc/gifts/new')).toBe(false);
    expect(indexable('/u/abc/anything')).toBe(false);
  });
});

describe('the sitemap', () => {
  it('lists only what robots.txt opens', () => {
    /*
     * The two files have to agree. A sitemap naming a page that robots.txt
     * forbids is a contradiction a crawler reports as an error, and it is
     * exactly the kind of drift that happens when one is edited alone.
     */
    for (const entry of sitemap()) {
      const path = new URL(entry.url).pathname || '/';
      expect(indexable(path)).toBe(true);
    }
  });

  it('stays small, because everything else is somebody’s private list', () => {
    expect(sitemap()).toHaveLength(4);
  });
});
