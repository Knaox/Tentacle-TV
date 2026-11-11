/**
 * Attendre que la page soit LISIBLE avant de mesurer : pas de voile « serveur hors ligne » (la
 * sonde de connectivité expire parfois sur un relais lent), et les images à l'écran peintes.
 * Sur une instance réelle, le réseau décide ; le banc mesure le mécanisme, pas le réseau.
 */

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** @returns {Promise<{ veil: boolean, cards: number, unpainted: number, waitedMs: number }>} */
export async function waitUntilReadable(page, { timeoutMs = 60000, needCards = true } = {}) {
  const started = Date.now();
  let state = { veil: true, cards: 0, unpainted: 0 };
  while (Date.now() - started < timeoutMs) {
    state = await page.evaluate(() => {
      const veil = [...document.querySelectorAll("div.fixed.inset-0")].some((el) => getComputedStyle(el).zIndex === "999");
      const onScreen = (el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
      };
      const cards = [...document.querySelectorAll("[data-card-visual]")].filter(onScreen);
      const unpainted = cards.filter((card) => {
        const img = card.querySelector("img");
        return !img || !img.complete || img.naturalWidth === 0;
      }).length;
      const spinner = [...document.querySelectorAll(".animate-spin")].some(onScreen);
      return { veil, cards: cards.length, unpainted, spinner };
    });
    if (state.veil) {
      // Le voile propose de réessayer : on le fait, comme l'utilisateur.
      await page.evaluate(() => [...document.querySelectorAll("div.fixed.inset-0 button")].find((b) => /essayer|retry/i.test(b.textContent ?? ""))?.click()).catch(() => undefined);
    } else if (!state.spinner && (!needCards || (state.cards > 0 && state.unpainted === 0))) {
      break;
    }
    await sleep(500);
  }
  return { ...state, waitedMs: Date.now() - started };
}
