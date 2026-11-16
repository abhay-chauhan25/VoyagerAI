import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  completeOnboarding,
  composeLisbon,
  signUpAndConfirm,
  travellerWithSaves,
  uniqueEmail,
} from "./helpers";

// Two travellers in separate browser sessions; places and Compass come from fixtures.
const PASSWORD = "voyager2026";

async function second(browser: Browser, name: string, tag: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signUpAndConfirm(page, { name, email: uniqueEmail(tag), password: PASSWORD });
  await completeOnboarding(page, (i) => (i % 2 ? "Love it" : "Not for me"));
  return page;
}

test.describe("friends and profiles", () => {
  test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");
  test.describe.configure({ timeout: 180_000 });

  test("following back makes friends; friends see shared details and can be invited in one press", async ({
    page,
    browser,
  }) => {
    const run = Date.now().toString(36);
    const handle = `ana_${run}`;
    await travellerWithSaves(page, "friend-a", 3);
    await composeLisbon(page, 1);
    const tripUrl = page.url();

    // Ana goes public and adds details: bio and link for all, email for friends, phone hidden.
    await page.goto("/account");
    await page.getByLabel("Handle").fill(handle);
    await page.getByLabel("Public profile").check();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");
    await page.getByLabel("Bio").fill(`Slow traveller ${run}.`);
    await page.getByLabel("Website or social link").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Use a full address starting with https://")).toBeVisible();
    await page.getByLabel("Website or social link").fill("https://example.com/ana");
    await page.getByLabel("Contact email").fill("ana.contact@example.com");
    await page.getByLabel("Who sees your email").selectOption("friends");
    await page.getByLabel("Phone", { exact: true }).fill("+351 21 000 0000");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

    // A visitor sees the bio and link, never the contact details.
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/u/${handle}`);
    await expect(visitor.getByText(`Slow traveller ${run}.`)).toBeVisible();
    await expect(visitor.getByRole("link", { name: "example.com/ana" })).toBeVisible();
    await expect(visitor.getByText("ana.contact@example.com")).toHaveCount(0);
    await expect(visitor.getByText("+351 21 000 0000")).toHaveCount(0);
    await expect(visitor.getByText("Sign in to read what Ana Example has shared.")).toBeVisible();

    // Ben finds Ana on the Friends page and follows her. Not friends yet: no email.
    const ben = await second(browser, "Ben Example", "friend-b");
    await ben.goto(`/friends?q=${handle}`);
    await ben.getByRole("button", { name: "Follow Ana Example", exact: true }).click();
    await expect(
      ben.getByRole("region", { name: "Following" }).getByText("Ana Example"),
    ).toBeVisible();
    await ben.goto(`/u/${handle}`);
    await expect(ben.getByText("ana.contact@example.com")).toHaveCount(0);

    // Ana sees a follower and follows back: now they're friends, and the counts say so.
    await page.goto("/friends");
    const stats = page.locator("dl");
    await expect(stats.getByText("Followers").locator("xpath=..")).toContainText("1");
    await page.getByRole("button", { name: "Follow Ben Example back" }).click();
    await expect(
      page.getByRole("region", { name: "Friends" }).getByText("Ben Example"),
    ).toBeVisible();
    await expect(stats.getByText("Friends").locator("xpath=..")).toContainText("1");

    // As a friend, Ben now sees the email, and still not the hidden phone.
    await ben.reload();
    await expect(ben.getByRole("link", { name: "ana.contact@example.com" })).toBeVisible();
    await expect(ben.getByText("+351 21 000 0000")).toHaveCount(0);

    // Ana invites her friend to the trip with one press; Ben finds the invitation.
    await page.goto(tripUrl);
    await page.getByText("Invite people").click();
    await page.getByRole("button", { name: "Invite Ben Example as an editor" }).click();
    await expect(
      page.getByText("Invited. They'll find the invitation on their Trips page."),
    ).toBeVisible();
    await ben.goto("/trips");
    await ben
      .getByRole("region", { name: "Invitations" })
      .getByRole("button", { name: "Join" })
      .click();
    await expect(ben).toHaveURL(tripUrl);
  });

  test("Compass suggests places for the city when every saved place is already in the trip", async ({
    page,
  }) => {
    await travellerWithSaves(page, "suggest", 3);
    await composeLisbon(page, 1);
    // All three saves are in the trip, so there is nothing saved left to add.
    await page.getByLabel("What should change?").fill("simulate outage: add more to day 1");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const proposal = page.getByRole("article", { name: /add more to day 1/ });
    await expect(proposal.getByText(/^Add .+ to Day 1$/).first()).toBeVisible();
    const before = await page.locator("li[data-stop-id]").count();
    await proposal.getByRole("button", { name: /^Accept/ }).click();
    await expect(page.locator("li[data-stop-id]")).not.toHaveCount(before);
    expect(await page.locator("li[data-stop-id]").count()).toBeGreaterThan(before);
  });

  test("the Friends page is for signed-in travellers and starts empty", async ({ page }) => {
    await page.goto("/friends");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Ffriends/);
    await signUpAndConfirm(page, {
      name: "Kai Example",
      email: uniqueEmail("friend-k"),
      password: PASSWORD,
    });
    await completeOnboarding(page, (i) => (i % 2 ? "Love it" : "Not for me"));
    await page.goto("/friends");
    await expect(page.getByText("No friends yet.")).toBeVisible();
    await page.goto("/friends?q=%25%27%29%3B--");
    await expect(page.getByRole("heading", { level: 1, name: "Friends" })).toBeVisible();
  });
});
