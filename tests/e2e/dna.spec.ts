import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm, uniqueEmail } from "./helpers";

const PASSWORD = "voyager2026";

test.describe("Travel DNA", () => {
  test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");

  test("the deck builds an explained Travel DNA that can be edited", async ({ page }) => {
    await signUpAndConfirm(page, {
      name: "Ana Example",
      email: uniqueEmail("dna"),
      password: PASSWORD,
    });

    // First card by keyboard, second by a real drag, the rest by buttons.
    const deck = page.getByRole("group", { name: /Scene 1 of 12/ });
    await deck.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2 of 12")).toBeVisible();

    const card = page.locator("[aria-roledescription='card deck'] .cursor-grab");
    const box = await card.boundingBox();
    if (!box) throw new Error("card not rendered");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 260, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText("3 of 12")).toBeVisible();

    // Undo goes back one card.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("2 of 12")).toBeVisible();
    await page.getByRole("button", { name: "Not for me", exact: true }).click();

    for (let i = 3; i <= 12; i += 1) {
      await expect(page.getByText(`${i} of 12`)).toBeVisible();
      await page
        .getByRole("button", { name: i % 3 === 0 ? "Not for me" : "Love it", exact: true })
        .click();
    }

    const submit = page.getByRole("button", { name: "See my Travel DNA" });
    await expect(submit).toBeDisabled();
    await page.getByText("Slow", { exact: true }).click();
    await page.getByText("Comfortable", { exact: true }).click();
    await expect(submit).toBeDisabled();
    await page.getByText("With friends", { exact: true }).click();
    await submit.click();

    await expect(page).toHaveURL(/\/dna$/);
    // Expected from the scoring rules: markets, nightlife and music are maxed out; food is +0.62.
    await expect(page.getByText(/You light up for Markets, Nightlife and Music\./)).toBeVisible();
    await expect(page.getByText("+0.62")).toBeVisible();
    await expect(page.getByText(/From: A night market at midnight/).first()).toBeVisible();

    // Nudge Food down twice and save; the change survives a reload.
    await page.getByRole("button", { name: "Less Food" }).click();
    await page.getByRole("button", { name: "Less Food" }).click();
    await page.getByText("Balanced", { exact: true }).click();
    await page.getByRole("button", { name: "Save Travel DNA" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByRole("radio", { name: "Balanced" })).toBeChecked();
    await expect(page.getByText("+0.12")).toBeVisible();
  });

  test("Drift asks for Travel DNA until it exists, and skipping is allowed", async ({ page }) => {
    await signUpAndConfirm(page, {
      name: "Ben Example",
      email: uniqueEmail("skip"),
      password: PASSWORD,
    });
    await page.getByRole("link", { name: "Skip for now" }).click();
    await page.goto("/drift");
    await page.getByRole("link", { name: "Set up Travel DNA" }).click();
    await expect(page).toHaveURL(/\/welcome$/);

    await completeOnboarding(page, (i) => (i % 2 === 0 ? "More like this" : "Not for me"));
    await page.goto("/drift");
    await expect(page.getByText("Picked by Compass for your Travel DNA.")).toBeVisible();
  });

  test("onboarding is closed to guests", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fwelcome$/);
  });
});
