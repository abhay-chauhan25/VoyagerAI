import { expect, test } from "@playwright/test";
import { completeOnboarding, pickCity, signUpAndConfirm, uniqueEmail } from "./helpers";

const PASSWORD = "voyager2026";

test.describe("public profiles", () => {
  test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");

  test("visible to visitors only once made public", async ({ browser, page }) => {
    const handle = `ana_${Date.now().toString().slice(-8)}`;
    await signUpAndConfirm(page, {
      name: "Ana Example",
      email: uniqueEmail("public"),
      password: PASSWORD,
    });
    await completeOnboarding(page);
    await page.goto("/atlas");
    await pickCity(page, "Lisbon", /^Lisbon/);
    await page.getByRole("button", { name: "Add to map" }).click();
    await expect(page.getByText("Added Lisbon, Portugal to your map")).toBeVisible();

    // A public profile needs a handle.
    await page.goto("/account");
    await page.getByLabel("Public profile").check();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(
      page.getByText("Choose a handle before making your profile public."),
    ).toBeVisible();

    await page.getByLabel("Handle").fill(handle);
    await page.getByLabel("Public profile").uncheck();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");

    // Private: the owner sees a notice, a visitor sees nothing.
    await page.goto(`/u/${handle}`);
    await expect(page.getByText("Only you can see this page.")).toBeVisible();
    const visitor = await (await browser.newContext()).newPage();
    expect((await visitor.goto(`/u/${handle}`))?.status()).toBe(404);

    await page.goto("/account");
    await page.getByLabel("Public profile").check();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("link", { name: `/u/${handle}` })).toBeVisible();

    await visitor.goto(`/u/${handle}`);
    await expect(visitor.getByRole("heading", { name: "Ana Example", level: 1 })).toBeVisible();
    await expect(visitor.getByText("Lisbon")).toBeVisible();
    await expect(visitor.getByRole("heading", { name: "Travel DNA" })).toBeVisible();
    await expect(visitor.getByText(/@example\.com/)).toHaveCount(0);
    await visitor.context().close();
  });

  test("a taken handle is refused", async ({ page, browser }) => {
    const handle = `kai_${Date.now().toString().slice(-8)}`;
    await signUpAndConfirm(page, {
      name: "Kai One",
      email: uniqueEmail("handle1"),
      password: PASSWORD,
    });
    await page.goto("/account");
    await page.getByLabel("Handle").fill(handle);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");

    const other = await (await browser.newContext()).newPage();
    await signUpAndConfirm(other, {
      name: "Kai Two",
      email: uniqueEmail("handle2"),
      password: PASSWORD,
    });
    await other.goto("/account");
    await other.getByLabel("Handle").fill(handle.toUpperCase());
    await other.getByRole("button", { name: "Save profile" }).click();
    await expect(other.getByText("That handle is taken. Try another.")).toBeVisible();
    await other.context().close();
  });

  test("unknown and malformed handles are not found", async ({ page }) => {
    expect((await page.goto("/u/nobody_here_123"))?.status()).toBe(404);
    expect((await page.goto("/u/%3Cscript%3E"))?.status()).toBe(404);
  });
});
