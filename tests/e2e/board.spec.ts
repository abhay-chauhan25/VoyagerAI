import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  composeLisbon,
  signUpAndConfirm,
  travellerWithSaves,
  uniqueEmail,
} from "./helpers";

// The test browser draws with software graphics, so Voyager shows the drawn plane by default;
// the markers and the manifest are the same links either way.
const PASSWORD = "voyager2026";

test.describe("the plane", () => {
  test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");
  test.describe.configure({ timeout: 120_000 });

  test("every part of the plane opens its section, and the sidebar still goes direct", async ({
    page,
  }) => {
    await signUpAndConfirm(page, {
      name: "Ana Example",
      email: uniqueEmail("board"),
      password: PASSWORD,
    });
    await completeOnboarding(page, (i) => (i % 2 ? "Love it" : "Not for me"));
    await page.goto("/board");
    await expect(page.getByRole("heading", { level: 1, name: "Where to, Ana?" })).toBeVisible();

    const parts = page.getByRole("list", { name: "Parts of the plane" });
    const manifest = page.getByRole("navigation", { name: "Manifest" });
    const routes = [
      ["Trips: Cockpit", "/trips"],
      ["Huddle: Main cabin", "/huddle"],
      ["Travel DNA: Rear galley", "/dna"],
      ["Drift: Wing", "/drift"],
      ["Atlas: Tail fin", "/atlas"],
      ["Field Notes: Hold", "/notes"],
    ] as const;
    for (const [name, href] of routes) {
      await expect(parts.getByRole("link", { name })).toHaveAttribute("href", href);
      await expect(manifest.locator(`a[href="${href}"]`)).toBeVisible();
    }

    // Pointing at a part says where it leads.
    await parts.getByRole("link", { name: "Huddle: Main cabin" }).hover();
    await expect(
      page.getByText("Seats for your crew. Plan a trip together, live.").first(),
    ).toBeVisible();

    // The keyboard opens a part at once.
    await parts.getByRole("link", { name: "Travel DNA: Rear galley" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dna$/);
    await expect(page.getByRole("heading", { level: 1, name: "Travel DNA" })).toBeVisible();

    // The sidebar shows which part this is and leads back to the plane.
    await page.getByRole("link", { name: "You are in the rear galley. Back to the plane" }).click();
    await expect(page).toHaveURL(/\/board$/);

    // Direct navigation between sections is unchanged.
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Atlas" })
      .click();
    await expect(page).toHaveURL(/\/atlas$/);
  });

  test("the plane can be shown as a drawing or live, and the choice is remembered", async ({
    page,
  }) => {
    await signUpAndConfirm(page, {
      name: "Ben Example",
      email: uniqueEmail("stage"),
      password: PASSWORD,
    });
    await completeOnboarding(page, (i) => (i % 2 ? "Love it" : "Not for me"));
    await page.goto("/board");
    const choice = page.getByRole("group", { name: "How the plane is shown" });
    await expect(choice.getByRole("button", { name: "Drawing" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("canvas")).toHaveCount(0);

    await choice.getByRole("button", { name: "3D" }).click();
    await expect(page.locator("canvas")).toHaveCount(1);
    await page.reload();
    await expect(choice.getByRole("button", { name: "3D" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The links are the same in both.
    await expect(
      page
        .getByRole("list", { name: "Parts of the plane" })
        .getByRole("link", { name: "Trips: Cockpit" }),
    ).toHaveAttribute("href", "/trips");

    // A stored value that isn't a known choice is ignored.
    await page.evaluate(() => localStorage.setItem("voyager-plane", "hologram"));
    await page.reload();
    await expect(choice.getByRole("button", { name: "Drawing" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("the plane is for signed-in travellers", async ({ page }) => {
    await page.goto("/board");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fboard/);
    await page.goto("/huddle");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fhuddle/);
  });

  test("Huddle lists trips with room for company, and says so when there are none", async ({
    page,
  }) => {
    await travellerWithSaves(page, "hub", 3);
    await page.goto("/huddle");
    await expect(page.getByRole("heading", { level: 1, name: "Huddle" })).toBeVisible();
    await expect(page.getByText("No shared trips yet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trips with room for company" })).toHaveCount(0);

    await composeLisbon(page, 1);
    await page.goto("/huddle");
    const solo = page.getByRole("region", { name: "Trips with room for company" });
    await expect(solo.getByRole("img", { name: "1 traveller" })).toBeVisible();
    await solo.getByRole("link", { name: "Invite people" }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
  });
});
