/**
 * Une transition, image par image : le screencast CDP (ce que le compositeur a présenté) et la
 * sonde de la page (ce que le document contenait en fin d'image), autour d'UN geste.
 */

import { installProbe } from "./probe.mjs";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * @param {import("playwright-core").Page} page
 * @param {() => Promise<void>} gesture  le clic (ou la navigation) qui lance la transition
 * @param {{ decode: (jpegs: string[]) => Promise<Array<{ width: number, height: number, luma: Uint8Array }>> }} decoder
 * @param {{ leadMs?: number, holdMs?: number, width?: number }} [options]
 */
export async function captureTransition(page, gesture, decoder, { leadMs = 250, holdMs = 1600, width = 360 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const shots = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    shots.push({ t: metadata.timestamp * 1000, data });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  await page.evaluate(installProbe);
  await page.evaluate(() => window.__flickerProbe.start());
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, maxWidth: width, maxHeight: width, everyNthFrame: 1 });
  await sleep(leadMs);
  const gestureAt = Date.now();
  await gesture();
  await sleep(holdMs);
  await cdp.send("Page.stopScreencast");
  const probe = await page.evaluate(() => window.__flickerProbe.stop());
  await cdp.detach().catch(() => undefined);
  // Le screencast ne livre pas ses images dans l'ordre de leur présentation : on les y remet.
  shots.sort((a, b) => a.t - b.t);
  const decoded = await decoder.decode(shots.map((shot) => shot.data));
  const frames = shots.map((shot, index) => ({ t: shot.t, ...decoded[index], jpeg: shot.data }));
  return { gestureAt, frames, probe };
}
