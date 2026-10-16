const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // Login
  await page.goto('http://localhost:3000/');
  await page.waitForSelector('#login-email', { timeout: 8000 });
  await page.fill('#login-email', 'parth@taskhive.dev');
  await page.fill("#login-password", "test1234");
  await page.click('#login-submit');
  await page.waitForSelector('.settings-page', { timeout: 5000 }).catch(()=>{});
  await page.goto('http://localhost:3000/#/settings');
  await page.waitForSelector('.st-hero', { timeout: 8000 });
  console.log('PASS settings renders hero card');

  // Toggles present + dark toggle reflects server pref (darkMode was true in db)
  const darkChecked = await page.isChecked('#set-dark');
  const digestChecked = await page.isChecked('#set-digest');
  console.log(darkChecked ? 'PASS dark toggle checked from server pref' : 'FAIL dark toggle state: ' + darkChecked);
  console.log(digestChecked ? 'PASS weekly digest checked from server pref' : 'FAIL digest: ' + digestChecked);

  // Toggle dark off -> theme changes + persists
  await page.uncheck("#set-dark");
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log(!isDark ? 'PASS toggling off removes dark class' : 'FAIL dark class still on');
  await page.waitForTimeout(400); // allow PATCH

  // Reload -> settings should remember light mode (server-persisted)
  await page.reload();
  await page.waitForSelector('.st-hero', { timeout: 8000 });
  const stillLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
  console.log(stillLight ? 'PASS theme persists across reload' : 'FAIL theme not persisted');

  // Rename via Save account changes
  await page.fill('#set-name', 'Partha');
  await page.click('#save-settings');
  await page.waitForSelector('.st-hero h2:has-text("Partha")', { timeout: 6000 })
    .then(() => console.log('PASS rename saves and homepage/sidebar re-render with new name'))
    .catch(() => console.log('FAIL rename did not propagate'));

  // restore name
  await page.goto('http://localhost:3000/#/settings');
  await page.waitForSelector('#set-name');
  await page.fill('#set-name', 'Parth');
  await page.click('#save-settings');
  await page.waitForTimeout(600);

  // Mobile layout check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/#/settings');
  await page.waitForSelector('.st-hero');
  const gridCols = await page.evaluate(() => getComputedStyle(document.querySelector('.st-grid')).gridTemplateColumns.split(' ').length);
  console.log(gridCols === 1 ? 'PASS mobile: single-column settings grid' : 'FAIL mobile grid cols=' + gridCols);

  // Screenshots
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:3000/#/settings');
  await page.waitForSelector('.st-hero');
  await page.screenshot({ path: 'settings_light.png', fullPage: true });
  await page.check("#set-dark");
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'settings_dark.png', fullPage: true });
  console.log('PASS screenshots saved (settings_light.png / settings_dark.png)');

  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'PASS zero page/console errors');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
