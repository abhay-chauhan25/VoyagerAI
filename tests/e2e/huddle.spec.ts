import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  completeOnboarding,
  composeLisbon,
  signUpAndConfirm,
  travellerWithSaves,
  uniqueEmail,
} from "./helpers";

// Two (or three) travellers in separate browser sessions at once. The server runs with
// VOYAGER_FIXTURES=1, so places and Compass are deterministic; Realtime is the local Supabase one.
const PASSWORD = "voyager2026";

async function secondTraveller(browser: Browser, tag: string, name: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUpAndConfirm(page, { name, email: uniqueEmail(tag), password: PASSWORD });
  await completeOnboarding(page, (i) => (i % 2 ? "Love it" : "Not for me"));
  return page;
}

async function inviteLink(owner: Page, role: "Editor" | "Viewer"): Promise<string> {
  await owner.getByText("Invite people").click();
  await owner.getByLabel("Joins as").selectOption(role.toLowerCase());
  await owner.getByRole("button", { name: "Create link" }).click();
  const box = owner.getByLabel("New invite link");
  await expect(box).toHaveValue(/\/trips\/join\/[A-Za-z0-9_-]{32}$/);
  return box.inputValue();
}

test.describe("Huddle", () => {
  test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");
  test.describe.configure({ timeout: 180_000 });

  test("an editor joins by link; presence and edits are live for both", async ({
    page,
    browser,
  }) => {
    await travellerWithSaves(page, "owner", 6);
    await composeLisbon(page, 2);
    const tripUrl = page.url();
    const link = await inviteLink(page, "Editor");

    const ben = await secondTraveller(browser, "editor", "Ben Example");
    await ben.goto(link);
    await expect(ben.getByText("You'd join as an editor: you can change the plan.")).toBeVisible();
    await expect(ben.getByText(/shares your display name, pace and top three/)).toBeVisible();
    await ben.getByRole("button", { name: "Join the trip" }).click();
    await expect(ben).toHaveURL(tripUrl);

    // Both are here, live.
    await expect(page.getByText("2 here now")).toBeVisible({ timeout: 15_000 });
    await expect(ben.getByText("2 here now")).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Ben Example" })
        .getByText(/^Editor ·/),
    ).toBeVisible();

    // Ben moves a stop; Ana sees it without reloading.
    const day1 = ben.getByRole("list", { name: "Stops on day 1" });
    const first = day1.locator("li[data-stop-id]").first();
    const name = (await first.locator("h4").innerText()).trim();
    await first.getByText("Edit stop").click();
    await first.getByLabel("Move to").selectOption("1");
    await expect(
      page.getByRole("list", { name: "Stops on day 2" }).getByRole("heading", { name }),
    ).toBeVisible({ timeout: 15_000 });

    // A link can be revoked; it then no longer works for anyone else.
    await page.reload();
    await page.getByText("Invite people").click();
    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link revoked" })).toBeVisible();
    const kai = await secondTraveller(browser, "late", "Kai Example");
    await kai.goto(link);
    await expect(kai.getByRole("heading", { name: "This link can't be used" })).toBeVisible();
    await kai.goto("/trips/join/not-a-real-token");
    await expect(kai.getByRole("heading", { name: "This link can't be used" })).toBeVisible();
  });

  test("a viewer invited by handle swipes and votes; matches and Consensus reach the trip", async ({
    page,
    browser,
  }) => {
    // Kai sets a handle so the owner can invite them.
    const kai = await secondTraveller(browser, "viewer", "Kai Example");
    const handle = `kai_${Date.now().toString(36)}`;
    await kai.goto("/account");
    await kai.getByLabel("Handle").fill(handle);
    await kai.getByRole("button", { name: "Save profile" }).click();
    await expect(kai.getByText("Saved")).toBeVisible();

    await travellerWithSaves(page, "host", 4);
    await composeLisbon(page, 1);
    const tripUrl = page.url();
    await page.getByText("Invite people").click();
    await page.getByLabel("Invite by handle").fill(`@${handle}`);
    await page.getByLabel("Role for the invited traveller").selectOption("viewer");
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(page.getByText(`If @${handle} is on Voyager`)).toBeVisible();
    // Unknown handles get the same answer, so the form can't reveal who has an account.
    await page.getByLabel("Invite by handle").fill("@nobody_by_this_name");
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(page.getByText("If @nobody_by_this_name is on Voyager")).toBeVisible();

    await kai.goto("/trips");
    const invitation = kai.getByRole("region", { name: "Invitations" });
    await expect(invitation.getByText(/invited you as a viewer/)).toBeVisible();
    await invitation.getByRole("button", { name: "Join" }).click();
    await expect(kai).toHaveURL(tripUrl);

    // A viewer sees the plan but can't change it.
    await expect(kai.getByRole("heading", { name: "Proposed changes" })).toBeVisible();
    await expect(kai.getByRole("button", { name: /^Move / })).toHaveCount(0);
    await expect(kai.getByText("Edit stop")).toHaveCount(0);
    await expect(kai.getByRole("button", { name: "Propose a Consensus plan" })).toHaveCount(0);

    // Both swipe the shared deck: the first two places are loved by both, so they match.
    for (const traveller of [page, kai]) {
      await traveller.goto(`${tripUrl}/drift`);
      for (const verdict of ["Love it", "Love it", "Not for me"]) {
        await traveller.getByRole("button", { name: verdict, exact: true }).click();
        await expect(traveller.getByText("Saving…")).toHaveCount(0);
      }
    }
    await page.reload();
    const matches = page.getByRole("region", { name: "Matches" });
    await expect(matches.getByRole("heading", { level: 3 })).toHaveCount(2);
    await expect(matches.getByText(/Ana Example, Kai Example loved it/).first()).toBeVisible();

    // The owner asks for a Consensus plan; the viewer votes on it; the owner decides.
    await page.goto(tripUrl);
    await page.getByRole("button", { name: "Propose a Consensus plan" }).click();
    const proposal = page.getByRole("article", { name: /Consensus plan/ });
    await expect(proposal.getByText(/^Kai Example \(/)).toBeVisible();

    await kai.goto(tripUrl);
    const kaiView = kai.getByRole("article", { name: /Consensus plan/ });
    // Viewers vote but can't decide.
    await expect(kaiView.getByRole("button", { name: /^(Accept|Reject|OK)/ })).toHaveCount(0);
    await kaiView.getByRole("button", { name: /^For/ }).click();
    await expect(proposal.getByText("For: Kai Example")).toBeVisible({ timeout: 15_000 });
    // Accept the changes, or acknowledge that none were needed.
    await proposal.getByRole("button", { name: /^(Accept|OK)/ }).click();
    await expect(page.getByRole("article", { name: /Consensus plan/ })).toHaveCount(0);
  });

  test("Consensus needs a second member", async ({ page }) => {
    await travellerWithSaves(page, "solo", 2);
    await composeLisbon(page, 1);
    await expect(page.getByRole("button", { name: "Propose a Consensus plan" })).toBeDisabled();
    await expect(page.getByText("1 here now")).toBeVisible({ timeout: 15_000 });
  });
});
