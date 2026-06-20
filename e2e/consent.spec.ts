/**
 * E2E: Talent consent flow via SubjectPortal
 * Tests the token-gated portal error gate and 3-step progress UI.
 */
import { test, expect } from "@playwright/test";

test.describe("SubjectPortal — error gate", () => {
  test("invalid token shows portal error state", async ({ page }) => {
    await page.goto("/subject/thisisnotavalidtoken123456");
    // Wait for the SPA to load and fetch to complete
    await page.waitForLoadState("networkidle");
    // Portal shows either the API error text or the fallback
    const body = await page.textContent("body");
    expect(body).toMatch(/expired|revoked|Invalid|Portal not found/i);
  });

  test("short path does not render SubjectPortal", async ({ page }) => {
    // Token below 16 chars — won't match the _subjectToken regex in App.tsx
    // SPA renders the main app instead
    await page.goto("/subject/short");
    await page.waitForLoadState("networkidle");
    // Should not show the portal chrome (Pluribus / breadcrumb header)
    const hasPortalChrome = await page.locator("text=This link may have expired").isVisible();
    expect(hasPortalChrome).toBe(false);
  });
});

test.describe("SubjectPortal — 3-step progress bar", () => {
  test("step bar is absent on portal error page", async ({ page }) => {
    await page.goto("/subject/invalidtokenabcdefgh123456");
    await page.waitForLoadState("networkidle");
    // Step bar only renders after consent is confirmed — should not be on error page
    const stepBar = page.getByText("Consent signed");
    await expect(stepBar).not.toBeVisible();
  });
});
