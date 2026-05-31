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

/**
 * The core advertised claim is *directed* cheers — "send hearts and claps to a
 * chosen peer". A 2-peer test cannot prove directedness (with two peers every
 * cheer necessarily targets the other one). This 3-peer test drives the cheer
 * on peer A aimed at B and asserts the burst lands ONLY on B — carol (C), the
 * non-target, must see nothing in her incoming-burst region even though she is
 * in the same room and the cheer event is in the shared log. That is the bit
 * the directedness contract actually guarantees, and it is read on the
 * opposite (untargeted) peer.
 */
test("alice cheers bob → burst lands on bob only, carol (untargeted) sees none", async ({
  browser,
  baseURL,
}) => {
  const { a, b, context, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  // Third peer in the same context shares the BroadcastChannel mesh + room.
  const c = await context.newPage();
  await c.goto(baseURL ?? "");
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await c.getByPlaceholder("your name").fill("carol");
    // Let all three names propagate into the shared __mesh_names map so each
    // peer can resolve the others as targets.
    await expect(a.getByRole("button", { name: "target bob", exact: true })).toBeVisible();
    await expect(a.getByRole("button", { name: "target carol", exact: true })).toBeVisible();

    await a.getByRole("button", { name: "target bob", exact: true }).click();
    await a.getByRole("button", { name: "send 👏", exact: true }).click();

    // Targeted peer sees the burst + a received tally.
    await expect(b.locator(".cheer-burst")).toContainText("alice");
    await expect(b.locator(".cheer-burst")).toContainText("👏");
    await expect(b.locator(".cheer-tally-received")).toContainText("1");

    // Untargeted peer: the event reached carol's shared log (the ledger shows
    // the directed edge for everyone) but her incoming-burst region — which is
    // filtered to `to === self` — stays empty and her received tally stays 0.
    await expect(c.locator(".cheer-ledger")).toContainText("alice → bob");
    await expect(c.locator(".cheer-burst .cheer-burst-item")).toHaveCount(0);
    await expect(c.locator(".cheer-tally-received")).toContainText("0");
  } finally {
    await c.close();
    await cleanup();
  }
});
