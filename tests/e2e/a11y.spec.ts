import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { composeLisbon, travellerWithSaves } from "./helpers";

// Automated accessibility checks (axe) on every main screen, by day and by night. They catch what
// a machine can: contrast, names, roles, labels. They don't replace using the app with a keyboard
// and a screen reader.
const PUBLIC_PAGES = ["/", "/sign-in", "/sign-up"];
const APP_PAGES = [
  "/board",
  "/trips",
  "/trips/new",
  "/huddle",
  "/drift",
  "/dna",
  "/atlas",
  "/notes",
  "/notes?view=mine",
  "/notes/new",
  "/account",
];

async function scan(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // Mapbox draws and labels its own canvas and controls.
    .exclude(".mapboxgl-map")
    .analyze();
  return results.violations.map(
    (violation) =>
      `${path}: ${violation.id} (${violation.impact}) ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(" | ")}`,
  );
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`accessibility, ${theme} theme`, () => {
    test.skip(({ isMobile }) => isMobile, "account flows run on desktop only");
    test.describe.configure({ timeout: 240_000 });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("voyager-theme", value), theme);
    });

    test("public pages have no detectable violations", async ({ page }) => {
      const found: string[] = [];
      for (const path of PUBLIC_PAGES) found.push(...(await scan(page, path)));
      expect(found).toEqual([]);
    });

    test("app screens, a trip and a story have no detectable violations", async ({ page }) => {
      await travellerWithSaves(page, `a11y-${theme}`, 4);
      await composeLisbon(page, 2);
      const tripPath = new URL(page.url()).pathname;
      const tripId = tripPath.split("/").at(-1)!;
      await page.goto(`/notes/publish/${tripId}`);
      await page.getByRole("button", { name: "Draft with Compass" }).click();
      await expect(page.locator("textarea")).toHaveValue(/draft from Compass/);
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await page.waitForURL(/\/notes\/stories\//);

      const found: string[] = [];
      for (const path of [...APP_PAGES, tripPath, `${tripPath}/drift`, `/notes/stories/${tripId}`])
        found.push(...(await scan(page, path)));
      expect(found).toEqual([]);
    });
  });
}
