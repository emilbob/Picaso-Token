import { expect, test } from "@playwright/test";

/**
 * Smoke coverage for the one surface with no other tests.
 *
 * The contracts have a full hermetic suite; the UI had nothing, so a dependency
 * bump could break the header and every check would still pass. These assert
 * what a visitor actually sees, against the exported bundle that ships.
 *
 * Deliberately no wallet: the injected connector needs a real extension, and
 * faking one would test the fake. Everything up to the wallet boundary is here.
 */

const PAPER = "rgb(244, 243, 239)";
const INK_PAPER = "rgb(20, 19, 15)";

const bodyBackground = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("renders the position flow and the unaudited notice", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Deposit. Mint. Redeem." })).toBeVisible();

  // The disclosure is the reason hosting an unaudited contract publicly is
  // defensible. If it ever silently disappears, that should fail a build.
  const notice = page.getByText("This contract has never been audited");
  await expect(notice).toBeVisible();
  await expect(page.getByText("Notice — Unaudited")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Ledger." })).toBeVisible();
});

test("prompts for a wallet instead of failing, before one is connected", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Connect Wallet" })).toBeVisible();
  await expect(page.getByText("Connect a wallet to open a position.")).toBeVisible();
  await expect(page.getByText("Connect a wallet to read your positions.")).toBeVisible();
});

test.describe("theme", () => {
  test.use({ colorScheme: "dark" });

  test("follows the operating system when nothing has been chosen", async ({ page }) => {
    await page.goto("/");

    expect(await bodyBackground(page)).toBe(INK_PAPER);
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
  });

  test("toggles, persists across a reload, and points at its destination", async ({ page }) => {
    await page.goto("/");

    // The control names where it goes, not where it is — the page already says
    // where it is. Dark therefore offers light.
    const toggle = page.getByRole("button", { name: "Switch to light theme" });
    await expect(toggle).toBeVisible();

    await toggle.click();
    expect(await bodyBackground(page)).toBe(PAPER);
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();

    // The pre-paint script in layout.tsx is what makes this hold without a
    // flash of the wrong sheet; a reload under an opposing OS preference is the
    // only way to catch it regressing.
    await page.reload();
    expect(await bodyBackground(page)).toBe(PAPER);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test("uses the light sheet when the operating system asks for it", async ({ page }) => {
  await page.goto("/");

  expect(await bodyBackground(page)).toBe(PAPER);
});
