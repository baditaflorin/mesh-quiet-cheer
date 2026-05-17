import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("alice cheers bob with ❤️ → bob sees burst + tallies sync", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "target bob", exact: true }).click();
    await a.getByRole("button", { name: "send ❤️", exact: true }).click();

    await expect(b.locator(".cheer-burst")).toContainText("alice");
    await expect(b.locator(".cheer-burst")).toContainText("❤️");
    await expect(b.locator(".cheer-tally-received")).toContainText("1");
    await expect(a.locator(".cheer-tally-sent")).toContainText("1");
    await expect(b.locator(".cheer-ledger")).toContainText("alice → bob");
  } finally {
    await cleanup();
  }
});
