const { chromium } = require('playwright');
const EXE = '/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await (await browser.newContext({ viewport:{width:1440,height:900} })).newPage();
  page.on('pageerror', e => console.log('PAGEERR', String(e)));
  await page.goto('http://localhost:8090/index.html#/mytasks', {waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,400));
  console.log(await page.evaluate(() => ({
    filterVar: typeof myTaskFilter !== 'undefined' ? myTaskFilter : 'UNDEFINED',
    cards: document.querySelectorAll('.mtask-card').length,
  })));
  await page.click('.mtask-card[data-status="In review"]');
  await new Promise(r=>setTimeout(r,400));
  console.log(await page.evaluate(() => ({
    filterVarAfterClick: typeof myTaskFilter !== 'undefined' ? myTaskFilter : 'UNDEFINED',
    activeCards: [...document.querySelectorAll('.mtask-card.active')].map(c=>c.dataset.status),
    groups: [...document.querySelectorAll('.mtask-group-title')].map(g=>g.textContent.trim()),
    rows: document.querySelectorAll('.task-table tbody tr[data-idx]').length,
  })));
  await browser.close();
})();
