import { chromium } from '@playwright/test';
const out = '/tmp/claude-1000/-home-sabri-kado/c6fe4718-ad56-4ef4-9bdd-c3080b330a9e/scratchpad';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true });
const page = await ctx.newPage();
const login = async (email) => {
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('kado1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
};
// Friend view of a reserved gift
await login('emma@kado.app');
await page.goto('http://localhost:3000/app');
await page.getByRole('link').filter({ hasText: 'Sophie Marchand · Anniversaire' }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/res-friend-list.png` });
await page.getByText('AirPods Pro 3').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/res-friend-gift.png` });
const url = page.url();
// Owner view of the very same gift
await page.goto('http://localhost:3000/profile');
await page.getByRole('button', { name: 'Se déconnecter' }).click();
await page.waitForURL('**/login');
await login('sophie@kado.app');
await page.goto(url);
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/res-owner-gift.png` });
console.log('done');
await b.close();
