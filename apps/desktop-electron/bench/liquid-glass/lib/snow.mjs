// Le VRAI lecteur sur une vidéo presque blanche (« Banc Neige ») : les glyphes
// des capsules doivent passer en SOMBRE (ton adaptatif, liquidGlass.sample).
// On lit la couleur calculée des textes et des icônes visibles du lecteur, et
// sa luminance relative (0 = noir, 1 = blanc).
import { dismissOverlays, go, sleep } from "./app.mjs";
import { itemId } from "./config.mjs";
import { leavePlayer, playing, shot, showControls, step } from "./steps.mjs";

export const snow = (ctx) => playerTone(ctx, "Banc Neige", "lecteur-neige");
export const night = (ctx) => playerTone(ctx, "Banc Nuit", "lecteur-nuit");

async function playerTone(ctx, title, name) {
  const { page } = ctx.app;
  await go(page, "/", 2500);
  await dismissOverlays(page);
  await step(ctx, name, async () => {
    await go(page, `/watch/${await itemId(title, "Movie")}`, 2000);
    const mpv = await playing(page);
    await showControls(page);
    await sleep(800);
    const glyphs = await page.evaluate(`
      const lum = (c) => {
        const m = c.match(/[\\d.]+/g); if (!m) return null;
        const [r, g, b] = m.slice(0, 3).map((v) => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 100) / 100;
      };
      const out = [];
      for (const el of document.querySelectorAll("button[aria-label], span, p, h1, h2")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        const isTime = /\\d+:\\d{2}/.test(el.textContent ?? "") && own;
        const isButton = el.tagName === "BUTTON";
        if (!isTime && !isButton && !own) continue;
        const color = getComputedStyle(isButton ? (el.querySelector("svg") ?? el) : el).color;
        out.push({ what: isButton ? el.getAttribute("aria-label") : (el.textContent ?? "").trim().slice(0, 20), color, lum: lum(color), tone: el.closest("[data-lg-tone]")?.getAttribute("data-lg-tone") ?? null });
      }
      return out.slice(0, 30);
    `);
    const capture = await shot(ctx, name);
    const lums = glyphs.map((g) => g.lum).filter((v) => v !== null).sort((a, b) => a - b);
    return { mpv, glyphs, capture, medianLum: lums.length ? lums[Math.floor(lums.length / 2)] : null };
  });
  await leavePlayer(page);
}
