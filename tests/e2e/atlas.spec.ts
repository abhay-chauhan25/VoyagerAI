import { expect, test } from "@playwright/test";
import { pickCity, signUpAndConfirm, uniqueEmail } from "./helpers";

const PASSWORD = "voyager2026";

test.describe("Atlas", () => {
  test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");

  test("add cities and countries, refuse duplicates, remove places", async ({ page }) => {
    await signUpAndConfirm(page, {
      name: "Kai Example",
      email: uniqueEmail("atlas"),
      password: PASSWORD,
    });
    await page.goto("/atlas");
    await expect(
      page.getByText("Every place you've been, on one map. Add the first one."),
    ).toBeVisible();

    await pickCity(page, "Lisbon", /^Lisbon/);
    await page.getByLabel("Year (optional)").fill("2024");
    await page.getByRole("button", { name: "Add to map" }).click();
    await expect(page.getByText("Added Lisbon, Portugal to your map")).toBeVisible();

    // Keyboard selection in the combobox.
    const box = page.getByRole("combobox", { name: "City" });
    await expect(async () => {
      await box.fill("");
      await box.fill("Kyoto");
      await expect(page.getByRole("option").first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await box.press("ArrowDown");
    await box.press("ArrowUp");
    await box.press("Enter");
    await page.getByRole("button", { name: "Add to map" }).click();
    await expect(page.getByText("Added Kyoto, Japan to your map")).toBeVisible();

    await page.getByRole("radio", { name: "A whole country" }).click();
    await page.getByLabel("Country").selectOption("IS");
    await page.getByRole("button", { name: "Add to map" }).click();
    await expect(page.getByText("Added Iceland to your map")).toBeVisible();

    const strip = page.locator("dl").first();
    await expect(strip).toContainText("Countries3");
    await expect(strip).toContainText("Cities2");
    await expect(page.getByText("3 countries across 2 continents.")).toBeVisible();

    // Duplicates are refused with a clear message.
    await page.getByRole("radio", { name: "A city" }).click();
    await pickCity(page, "Lisbon", /^Lisbon/);
    await page.getByRole("button", { name: "Add to map" }).click();
    await expect(page.getByText("That place is already on your map.")).toBeVisible();

    await page.getByRole("button", { name: "Remove Kyoto, Japan" }).click();
    await expect(page.getByRole("button", { name: "Remove Kyoto, Japan" })).toHaveCount(0);
    await expect(page.getByText("2 countries across 1 continent.")).toBeVisible();
  });

  test("invalid input is explained, not saved", async ({ page }) => {
    await signUpAndConfirm(page, {
      name: "Mia Example",
      email: uniqueEmail("atlasbad"),
      password: PASSWORD,
    });
    await page.goto("/atlas");
    await page.getByRole("button", { name: "Add to map" }).click();
    await expect(page.getByText("Choose a city from the list.")).toBeVisible();

    await pickCity(page, "Porto", /^Porto/);
    await page.getByLabel("Year (optional)").fill("1850");
    await page.getByRole("button", { name: "Add to map" }).click();
    await expect(page.getByText(/Use a year from 1900/)).toBeVisible();
    await expect(page.getByText("Nothing yet.", { exact: false })).toBeVisible();
  });
});

test.describe("city search API", () => {
  test("refuses signed-out and malformed requests", async ({ request }) => {
    expect((await request.get("/api/cities?q=Lisbon")).status()).toBe(401);
    expect((await request.get("/api/cities?q=L")).status()).toBe(400);
    expect((await request.get("/api/cities")).status()).toBe(400);
  });
});
