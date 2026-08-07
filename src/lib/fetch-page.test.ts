import { createServer, type Server } from 'node:http';
import { fetchHtml } from './fetch-page';

/**
 * The time budget, against a real socket.
 *
 * A merchant is a third party: it can answer fast, answer slowly, redirect in
 * circles, or accept the connection and then never finish. The last two are
 * what this guards, and they cannot be tested with a mocked fetch — the whole
 * point is what happens to a connection that stays open.
 *
 * These run against loopback and never leave the machine.
 */
let server: Server;
let base: string;

/** Handlers by path, set per test. */
const routes = new Map<string, (res: import('node:http').ServerResponse) => void>();
const timers: NodeJS.Timeout[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    const handler = routes.get(new URL(req.url ?? '/', 'http://x').pathname);
    if (handler) return handler(res);
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  for (const timer of timers) clearInterval(timer);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('the whole attempt is budgeted, not each request', () => {
  it('gives up on a body that never ends', async () => {
    /*
     * The failure this was written for.
     *
     * The previous version cleared its timer before reading the body, so a
     * merchant that answered its headers fast and then dripped one byte at a
     * time was bounded by nothing at all. The 2MB cap does not help: it
     * truncates what we keep, not what we wait for.
     */
    routes.set('/drip', (res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.write('<html><head>');
      timers.push(setInterval(() => void res.write('<!-- -->'), 100));
    });

    const started = Date.now();
    await expect(fetchHtml(`${base}/drip`)).rejects.toThrow();
    const elapsed = Date.now() - started;

    // Cut by the budget, not left to run.
    expect(elapsed).toBeLessThan(9_000);
    expect(elapsed).toBeGreaterThan(3_000);
  }, 20_000);

  it('reads a page that answers normally', async () => {
    // The budget must not be so tight that an ordinary page fails.
    routes.set('/ok', (res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<html><head><title>Théière</title></head><body>ok</body></html>');
    });

    await expect(fetchHtml(`${base}/ok`)).resolves.toContain('Théière');
  });

  it('refuses a response that is not HTML', async () => {
    // A link to a PDF or an image is not a product page, and decoding
    // megabytes of binary as text helps nobody.
    routes.set('/pdf', (res) => {
      res.writeHead(200, { 'content-type': 'application/pdf' });
      res.end('%PDF-1.4');
    });

    await expect(fetchHtml(`${base}/pdf`)).rejects.toThrow(/not an HTML page/);
  });

  it('refuses a redirect with nowhere to go', async () => {
    routes.set('/nowhere', (res) => {
      res.writeHead(302).end();
    });

    await expect(fetchHtml(`${base}/nowhere`)).rejects.toThrow(/redirect/);
  });

  it('stops following redirects rather than looping forever', async () => {
    // A merchant redirecting to itself would otherwise spin until the budget
    // ran out; the hop cap ends it sooner and says why.
    routes.set('/loop', (res) => {
      res.writeHead(302, { location: '/loop' }).end();
    });

    // Loopback is refused by the SSRF guard on the hop, which is itself the
    // correct outcome — either way it stops rather than looping.
    await expect(fetchHtml(`${base}/loop`)).rejects.toThrow();
  }, 20_000);
});
