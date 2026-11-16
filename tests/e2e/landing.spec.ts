import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("states what Voyager is and offers one way in", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Plan a trip that fits you" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Start planning, free" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  test("walks through the plane: every part is introduced, with the drawn plane as the fallback", async ({
    page,
  }) => {
    await page.goto("/");
    const tour = page.getByRole("region", { name: "A walk through the plane" });
    for (const heading of [
      "Compose a trip",
      "Plan it together",
      "Tell it your taste",
      "Find places worth saving",
      "Keep your map",
      "Bring stories back",
    ]) {
      await expect(tour.getByRole("heading", { level: 3, name: heading })).toBeAttached();
    }
    // Before sign-in the markers point at chapters; they are not links into the app.
    const parts = page.getByRole("list", { name: "Parts of the plane" });
    await expect(parts.getByRole("button")).toHaveCount(6);
    await expect(parts.getByRole("link")).toHaveCount(0);
    await parts.getByRole("button", { name: "Huddle: Main cabin" }).click();
    await expect(tour.getByRole("heading", { name: "Plan it together" })).toBeInViewport();
  });

  test("reads a typed trip wish into a brief", async ({ page }) => {
    await page.goto("/");
    const wish = page.getByLabel("Describe a trip the way you'd tell a friend");
    await wish.fill("A week in Tokyo with 3 friends, museums and nightlife");
    const brief = page.locator("dl");
    await expect(brief.getByText("Tokyo")).toBeVisible();
    await expect(brief.getByText("7 days")).toBeVisible();
    await expect(brief.getByText("4 people")).toBeVisible();
    await expect(brief.getByText("Museums")).toBeVisible();
  });

  test("shows a dash for what the wish does not say", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Describe a trip the way you'd tell a friend").fill("somewhere quiet");
    await expect(page.locator("dl").getByLabel("not set").first()).toBeVisible();
  });

  test("carries the named trip into sign-up", async ({ page }) => {
    await page.goto("/");
    const field = page.getByLabel("Trip name");
    await field.fill("Kyoto in autumn");
    await page
      .locator("form[action='/sign-up']")
      .getByRole("button", { name: "Create account" })
      .click();
    await expect(page).toHaveURL(/\/sign-up\?trip=Kyoto/);
    await expect(page.getByLabel("First trip idea (optional)")).toHaveValue("Kyoto in autumn");
  });
});
