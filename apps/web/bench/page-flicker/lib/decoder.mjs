/**
 * Le décodeur des images du screencast : un navigateur sans tête À PART, qui ne sert qu'à
 * rendre la LUMINANCE de chaque JPEG (canvas). Le screencast est pris en JPEG parce que
 * l'encodage PNG, plus lent, lui fait sauter des images sous charge (mesuré : pire écart
 * 400 ms en PNG, 120 ms en JPEG) ; Node n'a pas de décodeur JPEG, le navigateur si.
 */

import { chromium } from "playwright-core";

/** @returns {Promise<{ decode: (jpegs: string[]) => Promise<Array<{ width: number, height: number, luma: Uint8Array }>>, close: () => Promise<void> }>} */
export async function openDecoder() {
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--disable-audio-output"] });
  const page = await browser.newPage();
  await page.goto("about:blank");
  const decode = async (jpegs) => {
    const frames = [];
    // Par lots : une transition tient en une centaine d'images de 360 px.
    for (let from = 0; from < jpegs.length; from += 40) {
      const batch = await page.evaluate(async (list) => {
        const out = [];
        for (const base64 of list) {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const context = canvas.getContext("2d");
          context.drawImage(bitmap, 0, 0);
          const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
          const luma = new Uint8Array(bitmap.width * bitmap.height);
          for (let i = 0; i < luma.length; i += 1) luma[i] = Math.round(0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]);
          let text = "";
          for (let i = 0; i < luma.length; i += 0x8000) text += String.fromCharCode(...luma.subarray(i, i + 0x8000));
          out.push({ width: bitmap.width, height: bitmap.height, luma: btoa(text) });
          bitmap.close();
        }
        return out;
      }, jpegs.slice(from, from + 40));
      for (const frame of batch) frames.push({ width: frame.width, height: frame.height, luma: new Uint8Array(Buffer.from(frame.luma, "base64")) });
    }
    return frames;
  };
  return { decode, close: () => browser.close() };
}
