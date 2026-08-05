import { checkUrl, isPrivateAddress, type Resolver } from './ssrf';

/** A resolver that answers from a table, so no test touches the network. */
const resolving = (map: Record<string, string[]>): Resolver => async (host) => {
  const addresses = map[host];
  if (!addresses) throw new Error('ENOTFOUND');
  return addresses.map((address) => ({ address }));
};

const PUBLIC = resolving({ 'merchant.fr': ['93.184.216.34'] });

describe('isPrivateAddress', () => {
  it.each([
    ['169.254.169.254', 'the cloud metadata endpoint'],
    ['127.0.0.1', 'loopback'],
    ['10.0.0.1', 'private class A'],
    ['172.16.0.1', 'private class B, low end'],
    ['172.31.255.255', 'private class B, high end'],
    ['192.168.1.1', 'private class C'],
    ['0.0.0.0', 'this network'],
    ['100.64.0.1', 'CGNAT'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['::1', 'IPv6 loopback'],
    ['fe80::1', 'IPv6 link-local'],
    ['fc00::1', 'IPv6 unique local'],
    ['fd12:3456::1', 'IPv6 unique local'],
    ['::ffff:169.254.169.254', 'metadata endpoint via IPv4-mapped IPv6'],
    ['::ffff:10.0.0.1', 'private via IPv4-mapped IPv6'],
  ])('blocks %s (%s)', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    '93.184.216.34',
    '8.8.8.8',
    '1.1.1.1',
    '172.15.0.1', // just below the private block
    '172.32.0.1', // just above it
    '192.167.0.1', // just below 192.168
    '100.63.0.1', // just below CGNAT
    '2606:4700::1111', // public IPv6
  ])('allows the public address %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it('is not fooled by octal or hex spellings of a private address', () => {
    // The network stack resolves these to 10.0.0.1 and 127.0.0.1; a regex on
    // the decimal text would wave them straight through.
    expect(isPrivateAddress('012.0.0.1')).toBe(true);
    expect(isPrivateAddress('0x7f.0.0.1')).toBe(true);
  });

  it('treats anything it cannot parse as private', () => {
    // Failing closed: an address we do not understand is not one we can call
    // public. The cost is a refused fetch; the cost the other way is an SSRF.
    expect(isPrivateAddress('not-an-address')).toBe(true);
    expect(isPrivateAddress('999.1.1.1')).toBe(true);
    expect(isPrivateAddress('1.2.3')).toBe(true);
  });
});

describe('checkUrl', () => {
  it('accepts an ordinary product link', async () => {
    const verdict = await checkUrl('https://merchant.fr/p/theiere', PUBLIC);
    expect(verdict.ok).toBe(true);
  });

  it.each([
    ['file:///etc/passwd', 'a file URL'],
    ['ftp://merchant.fr/x', 'a non-http scheme'],
    ['javascript:alert(1)', 'a javascript URL'],
    ['gopher://merchant.fr/', 'gopher, which can forge other protocols'],
  ])('refuses %s (%s)', async (input) => {
    const verdict = await checkUrl(input, PUBLIC);
    expect(verdict.ok).toBe(false);
  });

  it('refuses a non-standard port', async () => {
    // Ports are where internal services live: 6379 Redis, 5432 Postgres, 8080
    // admin panels. A product page is on 80 or 443.
    for (const port of [22, 3306, 5432, 6379, 8080, 9200]) {
      const verdict = await checkUrl(`https://merchant.fr:${port}/p/x`, PUBLIC);
      expect(verdict.ok).toBe(false);
    }
  });

  it('refuses a hostname that resolves into private space', async () => {
    // The string looks like an ordinary public host. Only the resolved address
    // gives it away, which is why the check cannot live on the text.
    const verdict = await checkUrl(
      'https://harmless-looking.fr/x',
      resolving({ 'harmless-looking.fr': ['10.0.0.1'] }),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ reason: expect.stringContaining('interne') });
  });

  it('refuses the metadata endpoint by literal address', async () => {
    const verdict = await checkUrl(
      'http://169.254.169.254/latest/meta-data/',
      resolving({ '169.254.169.254': ['169.254.169.254'] }),
    );
    expect(verdict.ok).toBe(false);
  });

  it('refuses when ANY resolved address is private, not just the first', async () => {
    // The decisive case. A host with one public A record and one private one
    // passes a first-address-only check, and then the fetch picks whichever
    // address it likes — a race we do not get to win.
    const verdict = await checkUrl(
      'https://split-horizon.fr/x',
      resolving({ 'split-horizon.fr': ['93.184.216.34', '169.254.169.254'] }),
    );
    expect(verdict.ok).toBe(false);
  });

  it('refuses credentials embedded in the URL', async () => {
    const verdict = await checkUrl('https://user:pass@merchant.fr/x', PUBLIC);
    expect(verdict.ok).toBe(false);
  });

  it('refuses a host that does not resolve at all', async () => {
    const verdict = await checkUrl('https://nowhere.invalid/x', PUBLIC);
    expect(verdict.ok).toBe(false);
  });

  it('refuses a host that resolves to nothing', async () => {
    const verdict = await checkUrl(
      'https://empty.fr/x',
      resolving({ 'empty.fr': [] }),
    );
    expect(verdict.ok).toBe(false);
  });
});

describe('the SSRF guard can actually fail', () => {
  /**
   * Guards the guard. These replay the two shortcuts that look correct and are
   * not, and assert the suite's own cases catch them — otherwise the tests
   * above would pass over an open hole.
   */

  it('a first-address-only check would let split-horizon DNS through', () => {
    const addresses = ['93.184.216.34', '169.254.169.254'] as const;
    const firstOnly = isPrivateAddress(addresses[0]); // the tempting shortcut
    const allOf = addresses.some(isPrivateAddress); // what the code does

    expect(firstOnly).toBe(false); // the shortcut sees nothing wrong
    expect(allOf).toBe(true); // the real check refuses
  });

  it('a text-pattern check would let the octal metadata address through', () => {
    const textLooksPrivate = /^(10\.|127\.|169\.254\.|192\.168\.)/.test('012.0.0.1');
    expect(textLooksPrivate).toBe(false); // regex waves it through
    expect(isPrivateAddress('012.0.0.1')).toBe(true); // parsing catches it
  });
});
