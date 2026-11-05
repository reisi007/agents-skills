import { test, expect } from '@playwright/test';

// Temporary evidence spec for one issue. Keep it out of the change request
// unless the issue explicitly asks for an E2E test.
//
// Run it twice with the SAME scenario:
//   EVIDENCE_BASE_URL=http://127.0.0.1:3101 npx playwright test evidence.spec.ts
//   EVIDENCE_BASE_URL=http://127.0.0.1:3102 npx playwright test evidence.spec.ts
//
// The before run must show the bug (failing assertion) or the missing feature;
// the after run must show the acceptance. Both runs capture screenshot + video.

const baseUrl = process.env.EVIDENCE_BASE_URL;

test.use({
  video: 'on',
  screenshot: 'on',
});

test('issue evidence: <one-sentence scenario from the issue>', async ({ page }) => {
  // A skipped run exits 0 without artifacts, which would look like evidence.
  // Missing configuration is a hard failure: block the issue instead.
  if (!baseUrl) throw new Error('EVIDENCE_BASE_URL is required for evidence capture');

  await page.goto(baseUrl);

  // 1. Reproduce the exact steps from the issue.
  await page.getByRole('button', { name: '<label>' }).click();
  await page.getByLabel('<field>').fill('<fixture value>');

  // 2. Assert the issue's acceptance. This line is expected to fail "before"
  //    and pass "after" for a bug fix.
  await expect(page.getByText('<expected state>')).toBeVisible();

  // 3. Capture a stable final frame for the comparison table.
  await page.screenshot({ path: `evidence-${process.env.EVIDENCE_LABEL ?? 'run'}.png`, fullPage: true });
});
