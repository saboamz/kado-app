import { chromium } from '@playwright/test';
const out = '/tmp/claude-1000/-home-sabri-kado/c6fe4718-ad56-4ef4-9bdd-c3080b330a9e/scratchpad';
const b = await chromium.launch();
for (const [name, w, h, mob] of [['mobile',390,844,true],['desktop',1440,900,false]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:2, isMobile:mob });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Adresse e-mail').fill('thomas@kado.app');
  await page.getByLabel('Mot de passe').fill('kado1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/app');
  // Thomas viewing Sophie's list: reservations visible to a friend.
  await page.goto('http://localhost:3000/lists/cmsdp33fw000i51czefzvkwzl');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/list-friend-${name}.png` });
  await ctx.close();
}
await b.close();
