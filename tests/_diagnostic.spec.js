// ============================================================
// CI ENVIRONMENT DIAGNOSTIC (temporary)
// Purpose: capture what the GitHub runner actually sees when it
// loads the site, to explain why tests pass locally but fail in CI.
// Run only via the "CI Diagnostic" workflow (workflow_dispatch).
// Safe to delete once the CI failures are understood/fixed.
// ============================================================
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const PAGES = [
  { name: 'collection', url: 'https://kenazperfumes.com/collections/all-products' },
  { name: 'pdp', url: 'https://kenazperfumes.com/products/fortuna-100ml' },
];

test.describe('CI Diagnostic', () => {
  for (const p of PAGES) {
    test(`diagnose ${p.name}`, async ({ page }) => {
      test.setTimeout(90000);
      const info = { page: p.name, url: p.url };

      const resp = await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => {
        info.gotoError = e.message.split('\n')[0];
        return null;
      });

      info.httpStatus = resp ? resp.status() : 'no-response';
      info.title = await page.title().catch(() => 'n/a');

      const html = await page.content().catch(() => '');
      info.htmlLength = html.length;
      const titleAndHead = (info.title + ' ' + html.slice(0, 3000));

      // Bot-wall / challenge markers (check title + head, not the whole body,
      // to avoid false positives from stray words deep in the page)
      info.markers = {
        cloudflareJustAMoment: /just a moment|checking your browser|attention required/i.test(titleAndHead),
        cfTurnstile: /cf-turnstile|challenges\.cloudflare\.com/i.test(html),
        hcaptcha: /hcaptcha\.com/i.test(html),
        accessDenied: /access denied|403 forbidden|you have been blocked|rate limited/i.test(titleAndHead),
      };

      // Does real content render?
      info.productLinks = await page.locator('a[href*="/products/"]').count().catch(() => -1);
      info.addToCartButtons = await page.locator('button:has-text("Add"), add-to-cart, [name="add"]').count().catch(() => -1);
      info.bodyTextSample = (await page.locator('body').innerText().catch(() => '')).slice(0, 400).replace(/\s+/g, ' ');

      // Persist artifacts for download
      fs.mkdirSync('diagnostic-output', { recursive: true });
      fs.writeFileSync(`diagnostic-output/${p.name}.html`, html);
      fs.writeFileSync(`diagnostic-output/${p.name}.json`, JSON.stringify(info, null, 2));
      await page.screenshot({ path: `diagnostic-output/${p.name}.png`, fullPage: false }).catch(() => {});

      // Print to the CI log so we can read it without downloading anything
      console.log(`\n===== DIAGNOSTIC: ${p.name} =====`);
      console.log(JSON.stringify(info, null, 2));
      console.log('=================================\n');

      // Never fail — this is a report, not an assertion
      expect(true).toBe(true);
    });
  }
});
