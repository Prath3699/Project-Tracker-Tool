const { chromium } = require('playwright');
const EXE = '/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await (await browser.newContext()).newPage();
  page.on('console', m => console.log('PAGE:', m.text()));
  await page.goto('http://localhost:8090/index.html#/mytasks', {waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,400));
  await page.evaluate(() => {
    document.addEventListener('click', e => {
      const card = e.target.closest('.mtask-card');
      if (card) console.log('CARD CLICKED, dataset=' + JSON.stringify({...card.dataset}) + ' closest-with-id=' + !!e.target.closest('[id],[data-goto],[data-calday],[data-project],[data-inbox],[data-attachment],[data-person],[data-plan]'));
    }, true); // capture phase to see before delegation
  });
  await page.click('.mtask-card[data-status="In review"]');
  await new Promise(r=>setTimeout(r,500));
  await browser.close();
})();
