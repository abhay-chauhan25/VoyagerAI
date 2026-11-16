import { expect, test, type Browser, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";
import {
  completeOnboarding,
  composeLisbon,
  signUpAndConfirm,
  travellerWithSaves,
  uniqueEmail,
} from "./helpers";

// Two travellers in separate browser sessions. The server runs with VOYAGER_FIXTURES=1, so
// Compass's story draft is deterministic; photos go to the local Supabase storage bucket.
const PASSWORD = "voyager2026";

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, check]);
}

/** A real 8×8 PNG in one colour, made here so no image file is kept in the repository. */
function tinyPng(): Buffer {
  const size = 8;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x66)]);
  const pixels = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function reader(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signUpAndConfirm(page, {
    name: "Ben Example",
    email: uniqueEmail("reader"),
    password: PASSWORD,
  });
  await completeOnboarding(page, (i) => (i % 2 ? "Love it" : "Not for me"));
  return page;
}

async function writeNote(
  page: Page,
  note: {
    rating: string;
    body: string;
    audience: string;
    files?: Parameters<Page["setInputFiles"]>[1];
  },
) {
  await page.goto("/notes/new");
  await page.getByLabel("Place").selectOption({ index: 1 });
  await page.getByRole("radio", { name: note.rating }).check({ force: true });
  await page.getByLabel("What would you tell a friend?").fill(note.body);
  if (note.files) await page.getByLabel("Photos (optional)").setInputFiles(note.files);
  await page.getByLabel("Who can see this").selectOption({ label: note.audience });
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page).toHaveURL(/\/notes\?view=mine/);
}

test.describe("Field Notes", () => {
  test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");
  test.describe.configure({ timeout: 180_000 });

  test("notes stay private until shared; a follower reads them and forks a published trip", async ({
    page,
    browser,
  }) => {
    // Public notes from earlier runs stay in the local database, so this run's text is unique.
    const run = Date.now().toString(36);
    const handle = `ana_${run}`;
    const dusk = `Go at dusk, the light is worth it (${run}).`;
    const title = `Two slow days in Lisbon ${run}`;
    await travellerWithSaves(page, "author", 4);
    await composeLisbon(page, 2);
    const tripUrl = page.url();
    const tripId = tripUrl.split("/").at(-1)!;
    await page.goto("/account");
    await page.getByLabel("Handle").fill(handle);
    await page.getByLabel("Public profile").check();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");

    // One private note, one public note with a photo.
    await writeNote(page, {
      rating: "2 out of 5: Fine",
      body: "Only for me: skip the queue.",
      audience: "Only me",
    });
    await writeNote(page, {
      rating: "5 out of 5: Unmissable",
      body: dusk,
      audience: "Everyone on Voyager",
      files: { name: "dusk.png", mimeType: "image/png", buffer: tinyPng() },
    });
    const mine = page.getByRole("region", { name: "Mine" });
    await expect(mine.getByRole("article")).toHaveCount(2);
    const shared = mine.getByRole("article").filter({ hasText: dusk });
    await expect(shared.getByRole("img", { name: "5 out of 5" })).toBeVisible();
    await expect(shared.locator("img")).toHaveCount(1);
    await expect
      .poll(() => shared.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // Publish the trip as a story, from Compass's draft.
    await page.goto(`/notes/publish/${tripId}`);
    await page.getByRole("button", { name: "Draft with Compass" }).click();
    await expect(page.locator("textarea")).toHaveValue(/draft from Compass/);
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Who can see this").selectOption({ label: "Everyone on Voyager" });
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/notes/stories/${tripId}$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    // The author doesn't fork their own story.
    await expect(page.getByRole("button", { name: "Fork this trip" })).toHaveCount(0);

    // Ben sees only what was shared.
    const ben = await reader(browser);
    await ben.goto("/notes?view=everyone");
    const everyone = ben.getByRole("region", { name: "Everyone" });
    await expect(everyone.getByText(dusk)).toBeVisible();
    await expect(everyone.getByText("Only for me: skip the queue.")).toHaveCount(0);
    await expect(everyone.getByRole("link", { name: title })).toBeVisible();
    await ben.goto("/notes");
    await expect(ben.getByText("Nothing from people you follow yet.")).toBeVisible();

    // He follows Ana from her public profile; her notes then appear under Following.
    await ben.goto(`/u/${handle}`);
    await ben.getByRole("button", { name: "Follow Ana Example" }).click();
    await expect(ben.getByRole("button", { name: "Unfollow Ana Example" })).toBeVisible();
    await ben.goto("/notes");
    await expect(ben.getByRole("region", { name: "Following" }).getByText(dusk)).toBeVisible();

    // He can't reach Ana's trip or her publish page, but he can fork the story.
    expect((await ben.goto(tripUrl))?.status()).toBe(404);
    expect((await ben.goto(`/notes/publish/${tripId}`))?.status()).toBe(404);
    await ben.goto(`/notes/stories/${tripId}`);
    await expect(ben.getByRole("list").getByText(/./).first()).toBeVisible();
    await ben.getByRole("button", { name: "Fork this trip" }).click();
    await ben.waitForURL(/\/trips\/[0-9a-f-]{36}$/);
    expect(ben.url()).not.toBe(tripUrl);
    await expect(ben.getByText(`${title} · after Ana Example`).first()).toBeVisible();
    await expect(ben.locator("li[data-stop-id]").first()).toBeVisible();

    // Ana unpublishes: the story is gone for Ben, and his copy stays.
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page).toHaveURL(/\/notes\?view=mine/);
    const forkUrl = ben.url();
    expect((await ben.goto(`/notes/stories/${tripId}`))?.status()).toBe(404);
    expect((await ben.goto(forkUrl))?.status()).toBe(200);
  });

  test("a file that isn't a photo is refused, and a note can be deleted", async ({ page }) => {
    await travellerWithSaves(page, "upload", 3);
    await composeLisbon(page, 1);
    await writeNote(page, {
      rating: "3 out of 5: Good",
      body: "Decent coffee.",
      audience: "Only me",
      files: {
        name: "holiday.png",
        mimeType: "image/png",
        buffer: Buffer.from("<script>alert(1)</script>"),
      },
    });
    await expect(
      page.getByText("Your note was saved, but one photo couldn't be uploaded."),
    ).toBeVisible();
    const note = page.getByRole("article").filter({ hasText: "Decent coffee." });
    await expect(note.locator("img")).toHaveCount(0);

    await note.getByRole("button", { name: "Delete", exact: true }).click();
    await note.getByRole("button", { name: "Delete this note" }).click();
    await expect(page.getByText("You haven't written anything yet.")).toBeVisible();
  });

  test("without a trip there is nothing to write about, and bad links are not found", async ({
    page,
  }) => {
    await signUpAndConfirm(page, {
      name: "Kai Example",
      email: uniqueEmail("empty"),
      password: PASSWORD,
    });
    await completeOnboarding(page, (i) => (i % 2 ? "Love it" : "Not for me"));
    await page.goto("/notes");
    await expect(page.getByRole("link", { name: "Write a note" })).toHaveCount(0);
    await page.goto("/notes/new");
    await expect(page.getByText("There are no places to write about yet.")).toBeVisible();
    expect((await page.goto("/notes/stories/not-a-story"))?.status()).toBe(404);
    expect((await page.goto("/notes/stories/11111111-1111-4111-8111-111111111111"))?.status()).toBe(
      404,
    );
  });
});
