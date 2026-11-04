import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

// The server runs with VOYAGER_FIXTURES=1: Compass, OpenStreetMap and Wikimedia are deterministic
// fixtures. The fixture AI also suggests a fictional "Narnia", which grounding must drop.
const PASSWORD = "voyager2026";

async function newTravellerWithDna(page: Page, tag: string) {
  await signUpAndConfirm(page, {
    name: "Ana Example",
    email: uniqueEmail(tag),
    password: PASSWORD,
  });
  await completeOnboarding(page);
}

test.describe("Drift", () => {
  test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");

  test("deals grounded destinations, saves swipes and opens a city's places", async ({ page }) => {
    await newTravellerWithDna(page, "drift");
    await page.goto("/drift");

    await expect(page.getByText("Picked by Compass for your Travel DNA.")).toBeVisible();
    await expect(page.getByText(/29 Compass requests left today/)).toBeVisible();
    await expect(page.getByText("1 of 4")).toBeVisible(); // five suggestions, Narnia dropped
    await expect(page.getByText("Narnia")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Lisbon", level: 2 })).toBeVisible();
    await expect(page.getByText("A fixture description used in tests.")).toBeVisible();

    await page.getByRole("button", { name: "Love it", exact: true }).click();
    await expect(page.getByText("2 of 4")).toBeVisible();
    await expect(page.getByText("Saving…")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Saved\s*1/ })).toBeVisible();
    await page.getByRole("button", { name: "Not for me", exact: true }).click();
    await expect(page.getByText("3 of 4")).toBeVisible();

    // A reload keeps today's deck (no new AI call) and remembers what was judged.
    await page.reload();
    await expect(page.getByText("3 of 4")).toBeVisible();
    await expect(page.getByText(/29 Compass requests left today/)).toBeVisible();

    await page.getByRole("link", { name: /Explore places in/ }).click();
    await expect(page.getByRole("heading", { name: /Places in/, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Example /, level: 2 })).toBeVisible();
    await expect(page.getByText(/OpenStreetMap contributors/)).toBeVisible();
    await page.getByRole("button", { name: "Love it", exact: true }).click();
    await expect(page.getByText(/^2 of \d+$/)).toBeVisible();
    await expect(page.getByText("Saving…")).toHaveCount(0); // the save has landed

    await page.goto("/drift?view=saved");
    await expect(page.getByRole("heading", { name: "Lisbon", level: 2 })).toBeVisible();
    const saved = page.getByRole("button", { name: /^Remove / });
    await expect(saved).toHaveCount(2);
    await saved.first().click();
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(1);
  });

  test("an exhausted deck offers a fresh one", async ({ page }) => {
    await newTravellerWithDna(page, "deckend");
    await page.goto("/drift");
    for (let i = 1; i <= 4; i += 1) {
      await expect(page.getByText(`${i} of 4`)).toBeVisible();
      await page.getByRole("button", { name: "Not for me", exact: true }).click();
    }
    await expect(page.getByText("That's the whole deck.")).toBeVisible();
    await page.getByRole("button", { name: "Deal a new deck" }).click();
    // Everything Compass suggests has now been judged, so the new deck falls back to big cities.
    await expect(page.getByText(/Chosen without AI|Picked by Compass/)).toBeVisible();
    await expect(page.getByText(/^1 of \d+$/)).toBeVisible();
  });

  test("Ask Compass answers with verified places, and falls back when the AI is down", async ({
    page,
  }) => {
    await newTravellerWithDna(page, "ask");
    await page.goto("/drift?view=ask");
    const box = page.getByLabel("Ask Compass");

    await box.fill("hi");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Tell Compass a little more.")).toBeVisible();

    await box.fill("Somewhere warm in spring with great food");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Compass suggests" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lisbon", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mexico City", level: 3 })).toBeVisible();
    await expect(
      page.getByText("Compass suggested 1 place we couldn't verify, so it was left out."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save Lisbon" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    await box.fill("simulate outage: three days in Lisbon");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Compass couldn't answer just now.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lisbon", level: 3 })).toBeVisible();

    await box.fill("simulate outage: somewhere warm");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText(/Name a city to search for it directly/)).toBeVisible();
  });

  test("unknown cities are not found", async ({ page }) => {
    await newTravellerWithDna(page, "city404");
    expect((await page.goto("/drift/not-a-number"))?.status()).toBe(404);
    expect((await page.goto("/drift/999999999"))?.status()).toBe(404);
  });
});
