import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

// The server runs with VOYAGER_FIXTURES=1: places, travel times and Compass are deterministic
// fixtures. A request containing "simulate outage" makes Compass fail so the rule-based path runs.
const PASSWORD = "voyager2026";
const LISBON = 2267057;

async function travellerWithSaves(page: Page, tag: string, saves: number) {
  await signUpAndConfirm(page, {
    name: "Ana Example",
    email: uniqueEmail(tag),
    password: PASSWORD,
  });
  await completeOnboarding(page);
  await page.goto(`/drift/${LISBON}`);
  for (let i = 1; i <= saves; i += 1) {
    await expect(page.getByText(new RegExp(`^${i} of \\d+$`))).toBeVisible();
    await page.getByRole("button", { name: "Love it", exact: true }).click();
    await expect(page.getByText(new RegExp(`^${i + 1} of \\d+$`))).toBeVisible();
  }
  // Every save has landed before Compose reads them.
  await expect(async () => {
    await page.goto("/drift?view=saved");
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(saves, {
      timeout: 1000,
    });
  }).toPass({ timeout: 15_000 });
}

async function composeLisbon(page: Page, days: number) {
  await page.goto("/trips/new");
  await expect(page.getByRole("radio", { name: /Lisbon/ })).toBeChecked();
  const field = page.getByLabel("Days", { exact: true });
  await field.fill(String(days));
  await page.getByRole("button", { name: "Compose trip" }).click();
  await page.waitForURL(/\/trips\/[0-9a-f-]{36}$/);
}

test.describe("Trips", () => {
  test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");

  test("with no saves, Compose explains how to start", async ({ page }) => {
    await signUpAndConfirm(page, {
      name: "Ben Example",
      email: uniqueEmail("nosaves"),
      password: PASSWORD,
    });
    await completeOnboarding(page);
    await page.goto("/trips");
    await expect(page.getByText("No trips yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Compose a trip" })).toHaveCount(0);
    await page.goto("/trips/new");
    await expect(page.getByText("You haven't saved any places in a city yet.")).toBeVisible();
  });

  test("composes saves into days, then edits, asks for changes and applies them", async ({
    page,
  }) => {
    await travellerWithSaves(page, "compose", 6);
    await composeLisbon(page, 2);

    await expect(page.getByRole("heading", { name: "Lisbon, 2 days", level: 1 })).toBeVisible();
    const day1 = page.getByRole("list", { name: "Stops on day 1" });
    const day2 = page.getByRole("list", { name: "Stops on day 2" });
    // Six saves over two balanced days: three each, named by Compass, timed from 09:30.
    await expect(day1.getByRole("button", { name: /^Move / })).toHaveCount(3);
    await expect(day2.getByRole("button", { name: /^Move / })).toHaveCount(3);
    await expect(page.getByRole("heading", { name: /^Around Example /, level: 3 })).toHaveCount(2);
    await expect(day1.getByText(/^09:30–/)).toBeVisible();
    await expect(page.getByRole("meter", { name: "Pace" }).first()).toBeVisible();

    // Move a stop with the keyboard-friendly menu instead of dragging.
    const first = day1.locator("li[data-stop-id]").first();
    const name = (await first.locator("h4").innerText()).trim();
    await first.getByText("Edit stop").click();
    await first.getByLabel("Move to").selectOption("1");
    await expect(day2.getByRole("button", { name: `Move ${name}.`, exact: false })).toBeVisible();
    await expect(day1.getByRole("button", { name: /^Move / })).toHaveCount(2);
    await page.reload();
    await expect(day2.getByRole("button", { name: /^Move / })).toHaveCount(4);

    // Compass proposes (the fixture moves day 1's first stop to day 2); nothing changes until accepted.
    await page.getByLabel("What should change?").fill("Spread things out a bit");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const proposal = page.getByRole("article", { name: /Proposal for/ });
    await expect(proposal.getByText("Compass suggests")).toBeVisible();
    await expect(day2.getByRole("button", { name: /^Move / })).toHaveCount(4);
    await proposal.getByRole("button", { name: "Accept all" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Applied 1 change." })).toBeVisible();
    await expect(day1.getByRole("button", { name: /^Move / })).toHaveCount(1);
    await expect(day2.getByRole("button", { name: /^Move / })).toHaveCount(5);

    // With Compass down, a simple request is still understood, and rejecting leaves the trip alone.
    await page.getByLabel("What should change?").fill("simulate outage: make day 2 slower");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const fallback = page.getByRole("article", { name: /simulate outage/ });
    await expect(fallback.getByText("Suggested without AI")).toBeVisible();
    await expect(fallback.getByRole("checkbox")).toHaveCount(1);
    await fallback.getByRole("button", { name: "Reject all" }).click();
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(day1.getByRole("button", { name: /^Move / })).toHaveCount(1);

    await page.goto("/trips");
    await expect(page.getByRole("link", { name: /Lisbon, 2 days/ })).toBeVisible();
  });

  test("refuses invalid input and other people's trips", async ({ page }) => {
    await travellerWithSaves(page, "invalid", 1);
    await page.goto("/trips/new");
    await page.getByLabel("Days", { exact: true }).fill("40");
    await page.getByRole("button", { name: "Compose trip" }).click();
    await expect(page.getByText("At most 14 days.")).toBeVisible();

    await composeLisbon(page, 1);
    await page.getByLabel("What should change?").fill("hi");
    await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Trip name").fill("   ");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Give the trip a name." }),
    ).toBeVisible();

    // A trip id that isn't theirs (or doesn't exist) is simply not found.
    const response = await page.goto("/trips/00000000-0000-4000-8000-000000000000");
    expect(response?.status()).toBe(404);
    const malformed = await page.goto("/trips/not-a-trip");
    expect(malformed?.status()).toBe(404);
  });

  test("stops can be dragged with the keyboard, and the new order is saved", async ({ page }) => {
    await travellerWithSaves(page, "drag", 3);
    await composeLisbon(page, 1);
    const day = page.getByRole("list", { name: "Stops on day 1" });
    const names = async () => day.locator("li[data-stop-id] h4").allInnerTexts();
    const before = await names();
    expect(before).toHaveLength(3);

    const handle = day.getByRole("button", { name: `Move ${before[0]}.` });
    await handle.focus();
    // dnd-kit measures the list after pick-up, so each key waits for the previous one to land.
    const announcer = page.locator('[id^="DndLiveRegion"]');
    await page.keyboard.press("Space");
    await expect(announcer).toContainText(`Picked up ${before[0]}`);
    await page.keyboard.press("ArrowDown");
    await expect(announcer).toContainText(`${before[0]} is now at ${before[1]}'s place on day 1`);
    await page.keyboard.press("Space");
    await expect(announcer).toContainText(`Dropped ${before[0]}`);
    await expect.poll(names).toEqual([before[1], before[0], before[2]]);
    await page.reload();
    await expect.poll(names).toEqual([before[1], before[0], before[2]]);
  });

  test("a trip can be deleted after confirming in the page", async ({ page }) => {
    await travellerWithSaves(page, "delete", 2);
    await composeLisbon(page, 1);
    await page.getByRole("button", { name: "Delete trip" }).click();
    await expect(page.getByText("Delete this trip? This can't be undone.")).toBeVisible();
    await page.getByRole("button", { name: "Keep it" }).click();
    await page.getByRole("button", { name: "Delete trip" }).click();
    await page.getByRole("button", { name: "Delete trip" }).click();
    await page.waitForURL(/\/trips$/);
    await expect(page.getByText("No trips yet.")).toBeVisible();
  });
});
