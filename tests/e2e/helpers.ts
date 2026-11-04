import { expect, type Page } from "@playwright/test";

/** Local Supabase's mail catcher (Mailpit). Emails never leave the machine. */
const MAILPIT = "http://127.0.0.1:54324";

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

type MailpitSearch = { messages: { ID: string }[] };
type MailpitMessage = { HTML: string };

async function inbox(page: Page, address: string): Promise<MailpitSearch["messages"]> {
  const response = await page.request.get(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
  );
  expect(response.ok(), "Mailpit search failed; is local Supabase running?").toBe(true);
  return ((await response.json()) as MailpitSearch).messages; // newest first
}

/** Number of emails already sent to `address`; pass it to authLinkFor to wait for the next one. */
export async function inboxCount(page: Page, address: string): Promise<number> {
  return (await inbox(page, address)).length;
}

/**
 * Waits until `address` has more than `alreadySeen` emails and returns the Supabase verify link in
 * the newest one. Counting (rather than timestamps) keeps a slow email from being confused with an
 * earlier one, such as the sign-up confirmation sent just before a magic link.
 */
export async function authLinkFor(page: Page, address: string, alreadySeen = 0): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const messages = await inbox(page, address);
        const newest = messages[0];
        if (messages.length <= alreadySeen || !newest) return false;
        const message = (await (
          await page.request.get(`${MAILPIT}/api/v1/message/${newest.ID}`)
        ).json()) as MailpitMessage;
        const match = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(message.HTML);
        link = match?.[1]?.replaceAll("&amp;", "&");
        return Boolean(link);
      },
      { timeout: 15_000, message: `no new auth email arrived for ${address}` },
    )
    .toBe(true);
  return link as string;
}

export async function signUp(
  page: Page,
  opts: { name: string; email: string; password: string; tripIdea?: string },
) {
  await page.goto(
    opts.tripIdea ? `/sign-up?trip=${encodeURIComponent(opts.tripIdea)}` : "/sign-up",
  );
  await page.getByLabel("What should we call you?").fill(opts.name);
  await page.getByLabel("Email").fill(opts.email);
  await page.getByLabel("Password").fill(opts.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
}

/** Signs up and confirms through the emailed link, ending signed in on Trips. */
export async function signUpAndConfirm(
  page: Page,
  opts: { name: string; email: string; password: string; tripIdea?: string },
) {
  await signUp(page, opts);
  await page.goto(await authLinkFor(page, opts.email));
  await expect(page).toHaveURL(/\/trips$/);
}
