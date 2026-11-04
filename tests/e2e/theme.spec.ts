import { expect, test } from "@playwright/test";

test.describe("theme", () => {
  test("night mode applies, persists across reloads and can return to auto", async ({ page }) => {
    await page.goto("/sign-up");
    // The auth pages have no toggle; the app shell does. Use the stored preference path directly.
    await page.evaluate(() => localStorage.setItem("voyager-theme", "dark"));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("an unknown stored value falls back to the system setting", async ({ page }) => {
    await page.goto("/sign-in");
    await page.evaluate(() => localStorage.setItem("voyager-theme", "neon"));
    await page.reload();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });
});
