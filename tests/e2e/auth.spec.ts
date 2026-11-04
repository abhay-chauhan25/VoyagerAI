import { expect, test } from "@playwright/test";
import { authLinkFor, inboxCount, signUp, signUpAndConfirm, uniqueEmail } from "./helpers";

const PASSWORD = "voyager2026";

test.describe("access control", () => {
  test("guests are sent to sign-in and returned afterwards", async ({ page }) => {
    await page.goto("/atlas");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fatlas$/);
  });

  test("sign-up rejects invalid input without creating an account", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Tell us what to call you.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("a hostile next parameter cannot redirect off-site", async ({ page }) => {
    await page.goto("/sign-in?next=//evil.example.com");
    await expect(page.locator("input[name=next]").first()).toHaveValue("/trips");
  });
});

test.describe("account lifecycle", () => {
  // These create real (local) accounts and emails, so run them once, not per device.
  test.skip(({ isMobile }) => isMobile, "auth flows run on desktop only");

  test("sign up, confirm, edit profile, sign out and back in", async ({ page }) => {
    const email = uniqueEmail("lifecycle");
    await signUpAndConfirm(page, {
      name: "Ana Example",
      email,
      password: PASSWORD,
      tripIdea: "Lisbon in May",
    });

    await expect(page.getByRole("heading", { name: "Trips", level: 1 })).toBeVisible();
    await expect(page.getByText("Lisbon in May")).toBeVisible();

    await page.getByRole("link", { name: /Ana Example/ }).click();

    // The theme control reflects and changes the saved choice.
    const theme = page.getByRole("radiogroup", { name: "Colour theme" }).last();
    await theme.getByRole("radio", { name: "Night" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(theme.getByRole("radio", { name: "Night" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await theme.getByRole("radio", { name: "Auto" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    await page.getByLabel("Display name").fill("Ana S.");
    await page.getByLabel("Home city").fill("Porto");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByLabel("Home city")).toHaveValue("Porto");

    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL("/");
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/sign-in/);

    const panel = page.getByRole("tabpanel");
    await panel.getByLabel("Email").fill(email);
    await panel.getByLabel("Password").fill("wrong-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That email and password don't match.")).toBeVisible();

    await panel.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/trips$/);
    await expect(page.getByText("Ana S.").first()).toBeVisible();
  });

  test("an unconfirmed account cannot sign in with a password", async ({ page }) => {
    const email = uniqueEmail("unconfirmed");
    await signUp(page, { name: "Ben Example", email, password: PASSWORD });

    await page.goto("/sign-in");
    const panel = page.getByRole("tabpanel");
    await panel.getByLabel("Email").fill(email);
    await panel.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("Confirm your email first. The link is in your inbox."),
    ).toBeVisible();
  });

  test("magic link signs in an existing account; unknown emails get the same answer", async ({
    browser,
    page,
  }) => {
    const email = uniqueEmail("magic");
    await signUpAndConfirm(page, { name: "Kai Example", email, password: PASSWORD });

    // A fresh browser context: the link must work without the earlier session.
    const context = await browser.newContext();
    const guest = await context.newPage();
    await guest.goto("/sign-in");
    await guest.getByRole("tab", { name: "Email me a link" }).click();
    const seen = await inboxCount(guest, email);
    await guest.getByRole("tabpanel").getByLabel("Email").fill(email);
    await guest.getByRole("button", { name: "Send sign-in link" }).click();
    await expect(guest.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await guest.goto(await authLinkFor(guest, email, seen));
    await expect(guest).toHaveURL(/\/trips$/);
    await expect(guest.getByText("Kai Example").first()).toBeVisible();

    // Someone else, in their own browser, asking for a link to an address with no account.
    const strangerContext = await browser.newContext();
    const stranger = await strangerContext.newPage();
    await stranger.goto("/sign-in?next=/atlas");
    await stranger.getByRole("tab", { name: "Email me a link" }).click();
    await stranger.getByRole("tabpanel").getByLabel("Email").fill(uniqueEmail("nobody"));
    await stranger.getByRole("button", { name: "Send sign-in link" }).click();
    await expect(stranger.getByText(/If an account exists for/)).toBeVisible();
    await context.close();
    await strangerContext.close();
  });

  test("an expired or reused link is refused", async ({ page }) => {
    await page.goto("/auth/callback?code=not-a-real-code");
    await expect(page).toHaveURL(/\/sign-in\?error=link$/);
    await expect(page.getByText(/expired or was already used/)).toBeVisible();
  });
});

test.describe("app shell on phones", () => {
  test.skip(({ isMobile }) => !isMobile, "phone navigation only");

  test("bottom tabs move between screens", async ({ page }) => {
    const email = uniqueEmail("phone");
    await signUpAndConfirm(page, { name: "Mia Example", email, password: PASSWORD });
    const tabs = page.getByRole("navigation", { name: "Main" }).last();
    await tabs.getByRole("link", { name: "Atlas" }).click();
    await expect(page.getByRole("heading", { name: "Atlas", level: 1 })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Atlas" })).toHaveAttribute("aria-current", "page");
  });
});
