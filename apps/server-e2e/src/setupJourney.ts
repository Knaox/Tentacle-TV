import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "playwright-core";
import { launchChrome } from "./browser";

/**
 * Le parcours de l'assistant tel que le navigateur le traverse :
 *
 *  - CHAQUE écran affiché est relevé dans la page même (un observateur posé
 *    avant le chargement note tout changement de titre et de progression) —
 *    même celui qui ne dure qu'un instant (« Installation ») ;
 *  - les écrans attendus sont capturés dans le dossier des preuves,
 *    numérotés dans l'ordre de passage.
 *
 * De quoi comparer la liste EXACTE des écrans au parcours attendu.
 */
export interface Screen {
  title: string;
  /** « Étape 3 sur 8 » ; vide tant qu'elle n'est pas connue. */
  progress: string;
  /** Le Jellyfin choisi, tel que l'écran le rappelle (« Jellyfin “Salon” · déjà configuré »). */
  server: string;
}

/** Posé avant tout script de la page : chaque écran (titre + progression + serveur rappelé), une fois. */
const OBSERVER = `
(() => {
  const seen = (window.__setupScreens = []);
  const read = () => {
    const h1 = document.querySelector("h1");
    if (!h1) return;
    const progress = [...document.querySelectorAll("span")].map((s) => s.textContent.trim()).find((t) => /^Étape \\d+ sur \\d+$/.test(t)) || "";
    const chip = document.querySelector('[data-testid="setup-chosen-server"]');
    // Les espaces insécables du français (« Et maintenant ? ») deviennent des espaces : le relevé se compare à du texte simple.
    const flat = (text) => text.replace(/\\s+/g, " ").trim();
    const screen = { title: flat(h1.textContent), progress, server: chip ? flat(chip.textContent) : "" };
    const last = seen[seen.length - 1];
    if (last && last.title === screen.title) {
      // Le même écran qui se complète (progression connue, serveur rappelé) : la dernière lecture fait foi.
      if (screen.progress) last.progress = screen.progress;
      if (screen.server) last.server = screen.server;
      return;
    }
    seen.push(screen);
  };
  new MutationObserver(read).observe(document, { subtree: true, childList: true, characterData: true });
})();
`;

export class Journey {
  private shots = 0;

  private constructor(
    readonly browser: Browser,
    readonly page: Page,
    readonly proofs: string,
    readonly prefix: string,
  ) {}

  static async open(proofs: string, prefix: string): Promise<Journey> {
    mkdirSync(proofs, { recursive: true });
    const browser = await launchChrome();
    const context = await browser.newContext({ locale: "fr-FR", viewport: { width: 1100, height: 1300 } });
    await context.addInitScript(OBSERVER);
    return new Journey(browser, await context.newPage(), proofs, prefix);
  }

  button(name: string | RegExp) {
    return this.page.getByRole("button", { name, exact: typeof name === "string" });
  }

  /** Attendre l'écran titré `title`, puis le capturer. */
  async at(title: string): Promise<void> {
    await this.page.getByRole("heading", { level: 1, name: title, exact: true }).waitFor({ timeout: 180_000 });
    // Le titre suffit à dire l'écran ; sa liste se remplit juste après : un court répit pour la capture.
    await this.page.waitForTimeout(500);
    this.shots += 1;
    const slug = title.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    await this.page.screenshot({ path: join(this.proofs, `${this.prefix}-${String(this.shots).padStart(2, "0")}-${slug}.png`), fullPage: true });
  }

  /** Tous les écrans affichés depuis l'ouverture de la page, dans l'ordre. */
  async screens(): Promise<Screen[]> {
    return this.page.evaluate(() => (window as unknown as { __setupScreens: Screen[] }).__setupScreens);
  }

  /** Le relevé, à côté des captures : titre, progression, serveur rappelé. */
  async save(): Promise<Screen[]> {
    const screens = await this.screens().catch(() => [] as Screen[]);
    const lines = screens.map((s, i) => `${String(i + 1).padStart(2, "0")}. ${s.title} — ${s.progress || "(progression pas encore connue)"}${s.server ? ` — ${s.server}` : ""}`);
    writeFileSync(join(this.proofs, `${this.prefix}-parcours.txt`), `${lines.join("\n")}\n`);
    return screens;
  }

  /** Le bouton « Retour » existe-t-il sur cet écran ? */
  async canGoBack(): Promise<boolean> {
    return (await this.button("Retour").count()) > 0;
  }

  async checkedRadios(): Promise<number> {
    return this.page.locator('input[type="radio"]:checked').count();
  }

  /**
   * Un appel DIRECT à l'assistant, depuis la page (même adresse, même session
   * que l'interface) : ce que ferait un client trafiqué qui sauterait l'écran.
   */
  async direct(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
    return this.page.evaluate(
      async ({ method, path, body }) => {
        const headers: Record<string, string> = { "x-tentacle-setup": sessionStorage.getItem("tentacle_setup_session") ?? "" };
        if (body !== undefined) headers["content-type"] = "application/json";
        const res = await fetch(`/api/setup${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        return { status: res.status, body: await res.json().catch(() => null) };
      },
      { method, path, body },
    );
  }

  /** En cas d'échec : la page telle qu'elle est, pour comprendre. */
  async failed(): Promise<void> {
    await this.page.screenshot({ path: join(this.proofs, `${this.prefix}-echec.png`), fullPage: true }).catch(() => undefined);
    writeFileSync(join(this.proofs, `${this.prefix}-echec.txt`), `${this.page.url()}\n\n${await this.page.innerText("body").catch(() => "")}`);
  }

  async close(): Promise<void> {
    await this.save().catch(() => undefined);
    await this.browser.close();
  }
}

/** Les écrans attendus : titre et progression, dans l'ordre. */
export const expected = (total: number, steps: Array<[string, number]>): Array<Pick<Screen, "title" | "progress">> =>
  steps.map(([title, n]) => ({ title, progress: `Étape ${n} sur ${total}` }));
