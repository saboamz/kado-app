import { readFileSync } from 'node:fs';
import { db } from './db';
import { WEIGHTS } from './events';
import { clickOutReport } from './clickout';
import { cleanup, makeGift, makeList, makeUser } from '@/test/factories';

/**
 * Counting the clicks that leave for a shop.
 *
 * Two things are pinned here, and only one of them is about arithmetic.
 *
 * The first is that the count is usable: it groups by merchant, separates
 * people from clicks, and does not quietly lose the clicks it cannot
 * attribute to any shop.
 *
 * The second is the one that matters. A list owner must never learn that
 * somebody clicked the link on one of their wishes — that is the same secret
 * as a reservation, arriving by a different door. Two defences are checked:
 * that the component does not record an owner's own click, and that the
 * report exposes nothing per-gift for anybody to read it out of.
 */
let owner: { id: string };
let friend: { id: string };
let merchantId: string;
let productId: string;
let giftId: string;
let unresolvedGiftId: string;

beforeAll(async () => {
  owner = await makeUser('Propriétaire');
  friend = await makeUser('Amie');

  const merchant = await db.merchant.create({
    data: {
      slug: `test-shop-${Date.now()}`,
      name: 'Boutique Test',
      domains: ['boutique-test.example'],
    },
  });
  merchantId = merchant.id;

  const product = await db.product.create({
    data: {
      title: 'Théière en fonte',
      merchantId,
      currency: 'EUR',
      status: 'active',
    },
  });
  productId = product.id;

  const list = await makeList(owner.id);
  giftId = (await makeGift(list.id)).id;
  unresolvedGiftId = (await makeGift(list.id)).id;
});

afterAll(async () => {
  await db.giftEvent.deleteMany({ where: { actorId: { in: [owner.id, friend.id] } } });
  await db.product.deleteMany({ where: { merchantId } });
  await db.merchant.delete({ where: { id: merchantId } });
  await cleanup([owner.id, friend.id]);
  await db.$disconnect();
});

/**
 * A file with its comments removed.
 *
 * The tests below assert on what the code does, and prose that merely
 * discusses `giftId` or `preventDefault` is not the code doing it — the first
 * versions of these assertions matched their own explanatory comments and
 * failed on documentation.
 */
const codeOf = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/.*$/gm, '');

/** A click as the component would cause one to be written. */
const click = (actorId: string, gift: string, product: string | null) =>
  db.giftEvent.create({
    data: {
      actorId,
      kind: 'click_out',
      giftId: gift,
      productId: product,
      weight: WEIGHTS.click_out,
    },
  });

describe('the report', () => {
  it('groups clicks by shop, counting people apart from clicks', async () => {
    // The friend clicks twice, somebody else once: three clicks, two people.
    await click(friend.id, giftId, productId);
    await click(friend.id, giftId, productId);
    await click(owner.id, giftId, productId);

    const report = await clickOutReport();
    const shop = report.byMerchant.find((m) => m.merchant === 'Boutique Test');

    expect(shop?.clicks).toBe(3);
    // The gap between the two is the whole reason both are reported: one
    // person clicking three times is not three people, and an affiliate
    // network told otherwise will find out.
    expect(shop?.people).toBe(2);
  });

  it('keeps the clicks it cannot attribute to a shop', async () => {
    /*
     * A wish whose link never resolved to a catalogue row has no product,
     * and a merchant is only reachable through one. Dropping these would
     * report a number smaller than the truth while looking complete.
     */
    const before = await clickOutReport();
    await click(friend.id, unresolvedGiftId, null);
    const after = await clickOutReport();

    expect(after.unattributedClicks).toBe(before.unattributedClicks + 1);
    expect(after.totalClicks).toBe(before.totalClicks + 1);
  });

  it('adds up: attributed plus unattributed is the total', async () => {
    const report = await clickOutReport();
    const attributed = report.byMerchant.reduce((sum, m) => sum + m.clicks, 0);

    expect(attributed + report.unattributedClicks).toBe(report.totalClicks);
  });

  it('ignores clicks older than the window', async () => {
    const old = await db.giftEvent.create({
      data: {
        actorId: friend.id,
        kind: 'click_out',
        giftId,
        productId,
        weight: WEIGHTS.click_out,
        occurredAt: new Date('2024-01-01'),
      },
    });

    const report = await clickOutReport(30);
    const shop = report.byMerchant.find((m) => m.merchant === 'Boutique Test');
    expect(shop?.clicks).toBe(3); // the three from the first test, not four

    await db.giftEvent.delete({ where: { id: old.id } });
  });

  it('counts only clicks, not every kind of event', async () => {
    // The event log holds reservations and views too. A shop's click figure
    // that included page views would be a number nobody could defend.
    const view = await db.giftEvent.create({
      data: {
        actorId: friend.id,
        kind: 'view_product',
        giftId,
        productId,
        weight: WEIGHTS.view_product,
      },
    });

    const report = await clickOutReport();
    const shop = report.byMerchant.find((m) => m.merchant === 'Boutique Test');
    expect(shop?.clicks).toBe(3);

    await db.giftEvent.delete({ where: { id: view.id } });
  });
});

describe('what an owner can learn from it', () => {
  it('says nothing about any individual wish', () => {
    /*
     * The invariant, checked at the shape rather than the values.
     *
     * A click on a wish is evidence that somebody is interested in it —
     * exactly what a reservation is, arriving by a different door. As long
     * as the report carries no giftId, there is no query an owner's page
     * could make against it that would betray one.
     */
    const source = codeOf('src/lib/clickout.ts');

    expect(source).not.toContain('giftId');
    // No per-gift grouping and no gift join: the two ways this would grow a
    // way to answer "how many clicks on MY wish".
    expect(source).not.toMatch(/JOIN\s+"Gift"/i);
  });

  it('is never asked to record an owner clicking their own link', () => {
    /*
     * Checked in the source because the skip lives in a client component,
     * which the unit suite cannot render.
     *
     * To be exact about what this defends: no screen reads GiftEvent today,
     * so an owner could not see these rows in any case. The skip is a
     * refusal to accumulate the record at all, against the day some future
     * screen does read this table.
     */
    const source = codeOf('src/components/OutboundLink.tsx');

    expect(source).toContain('if (isOwner) return;');
    // Before the call, not after it — the order is the whole point.
    expect(source.indexOf('if (isOwner) return;')).toBeLessThan(
      source.indexOf('recordTelemetry({'),
    );
  });

  it('does not block the link on the recording', () => {
    // A dropped row costs a data point; a blocked link costs somebody the
    // thing they were trying to buy.
    const source = codeOf('src/components/OutboundLink.tsx');

    expect(source).not.toContain('preventDefault');
    expect(source).toContain('void recordTelemetry');
  });
});
