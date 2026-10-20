/**
 * Un membre web du banc : un contexte Chrome sans tête À LUI (cookies,
 * stockage), donc un « appareil » à lui. Deux contextes du même compte = deux
 * appareils de ce compte (le cas du 3ᵉ appareil).
 *
 * Mesure : `sample()` lit DANS la page, au même instant, la position de
 * l'élément vidéo et l'heure murale (`performance.timeOrigin + now()`). Tous
 * les clients tournent sur le même Mac : l'heure murale est commune, l'écart
 * entre deux lecteurs se calcule sans faire confiance à leur propre horloge
 * synchronisée — c'est la vérité terrain, pas le `driftMs` que le lecteur
 * déclare lui-même.
 *
 * Les trames `wt:*` de la socket sont journalisées (heure, sens, type, cause)
 * pour vérifier qui reçoit quoi.
 */

import type { Browser, BrowserContext, Page } from "playwright-core";
import type { BenchAccount, BenchState } from "../env";

export interface PlayerSample {
  label: string;
  /** Heure murale de la lecture (ms, horloge du Mac). */
  wallMs: number;
  /** Position du lecteur (s), null sans élément vidéo. */
  pos: number | null;
  paused: boolean;
  rate: number;
  readyState: number;
  seeking: boolean;
  path: string;
}

export interface WsFrame {
  at: number;
  dir: "in" | "out";
  type: string;
  cause?: string;
  raw: Record<string, unknown>;
}

export interface WebClientOptions {
  /** Plafond de débit (b/s) imposé à PlaybackInfo : force un transcodage. */
  maxBitrate?: number;
  /** Retard ajouté aux premières requêtes média (ms) : un démarrage lent. */
  mediaDelayMs?: number;
  /** Combien de requêtes média sont retardées (défaut : 4). */
  mediaDelayCount?: number;
}

export class WebClient {
  readonly frames: WsFrame[] = [];
  readonly console: string[] = [];
  readonly mediaModes = new Set<"direct" | "transcode">();
  private constructor(
    readonly label: string,
    readonly account: BenchAccount,
    readonly context: BrowserContext,
    readonly page: Page,
    private readonly state: BenchState,
  ) {}

  static async open(browser: Browser, state: BenchState, account: BenchAccount, label: string, opts: WebClientOptions = {}): Promise<WebClient> {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "fr-FR" });
    const page = await context.newPage();
    const client = new WebClient(label, account, context, page, state);
    page.on("console", (msg) => {
      const text = msg.text();
      if (/\[WT|wt-|error/i.test(text)) client.console.push(`${Date.now()} ${msg.type()} ${text.slice(0, 400)}`);
    });
    // Mode de lecture effectif : un transcodage passe par le HLS de Jellyfin.
    page.on("request", (req) => {
      const url = req.url();
      if (/master\.m3u8|\/hls1\//i.test(url)) client.mediaModes.add("transcode");
      else if (/\/Videos\/[^/]+\/stream/i.test(url)) client.mediaModes.add("direct");
    });
    page.on("websocket", (ws) => {
      const record = (dir: "in" | "out") => (payload: string | Buffer) => {
        const text = typeof payload === "string" ? payload : payload.toString("utf8");
        if (!text.includes("\"wt:")) return;
        try {
          const raw = JSON.parse(text) as Record<string, unknown>;
          client.frames.push({ at: Date.now(), dir, type: String(raw.type), cause: raw.cause as string | undefined, raw });
        } catch { /* trame non JSON */ }
      };
      ws.on("framereceived", (f) => record("in")(f.payload));
      ws.on("framesent", (f) => record("out")(f.payload));
    });
    if (opts.maxBitrate) await client.capBitrate(opts.maxBitrate);
    if (opts.mediaDelayMs) await client.delayMedia(opts.mediaDelayMs, opts.mediaDelayCount ?? 4);
    return client;
  }

  /** Le geste « qualité basse » d'un utilisateur, imposé à chaque PlaybackInfo. */
  async capBitrate(bps: number): Promise<void> {
    await this.context.route(/\/Items\/[^/]+\/PlaybackInfo/i, async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set("MaxStreamingBitrate", String(bps));
      url.searchParams.set("EnableDirectPlay", "false");
      url.searchParams.set("EnableDirectStream", "false");
      let postData = route.request().postData() ?? undefined;
      if (postData) {
        try {
          const body = JSON.parse(postData) as Record<string, unknown>;
          body.MaxStreamingBitrate = bps;
          body.EnableDirectPlay = false;
          body.EnableDirectStream = false;
          const profile = body.DeviceProfile as Record<string, unknown> | undefined;
          if (profile) profile.MaxStreamingBitrate = bps;
          postData = JSON.stringify(body);
        } catch { /* corps non JSON */ }
      }
      await route.continue({ url: url.toString(), postData });
    });
  }

  /** Retarde les `count` premières requêtes média : le lecteur démarre lentement, puis lit normalement. */
  async delayMedia(ms: number, count: number): Promise<void> {
    let left = count;
    await this.context.route(/\/(Videos|videos)\/[^/]+\/(hls1|main|stream|master)/, async (route) => {
      if (left > 0) {
        left -= 1;
        await new Promise((ok) => setTimeout(ok, ms));
      }
      await route.continue();
    });
  }

  async login(): Promise<void> {
    await this.page.goto(`${this.state.webUrl}/login`, { waitUntil: "domcontentloaded" });
    await this.page.fill("#username", this.account.name);
    await this.page.fill("#password", this.account.password);
    await this.page.press("#password", "Enter");
    await this.page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  }

  /** Appel REST au nom de cette session (cookie de la page). */
  async api<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
    return this.page.evaluate(async ({ method, path, body }) => {
      const res = await fetch(path, {
        method, credentials: "include",
        headers: body !== undefined ? { "Content-Type": "application/json" } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: res.status, json: json as never };
    }, { method, path, body });
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(`${this.state.webUrl}${path}`, { waitUntil: "domcontentloaded" });
  }

  async sample(): Promise<PlayerSample> {
    const s = await this.page.evaluate(() => {
      const v = document.querySelector("video");
      return {
        wallMs: performance.timeOrigin + performance.now(),
        pos: v ? v.currentTime : null,
        paused: v ? v.paused : true,
        rate: v ? v.playbackRate : 1,
        readyState: v ? v.readyState : 0,
        seeking: v ? v.seeking : false,
        path: location.pathname,
      };
    }).catch(() => ({ wallMs: Date.now(), pos: null, paused: true, rate: 1, readyState: 0, seeking: false, path: "?" }));
    return { label: this.label, ...s };
  }

  /** Clique un bouton par son texte visible ; false s'il n'existe pas. */
  async clickText(text: string | RegExp, timeoutMs = 5_000): Promise<boolean> {
    const loc = this.page.getByRole("button", { name: text }).first();
    try {
      await loc.waitFor({ state: "visible", timeout: timeoutMs });
      await loc.click();
      return true;
    } catch {
      return false;
    }
  }

  async isVisible(text: string | RegExp): Promise<boolean> {
    return this.page.getByText(text).first().isVisible().catch(() => false);
  }

  /**
   * Geste au lecteur, comme l'utilisateur : les raccourcis du lecteur web
   * (`usePlayerHotkeys`) — Espace lecture/pause, → +30 s, ← −10 s, N épisode
   * suivant. Ils passent par les mêmes chemins que les boutons.
   */
  async press(code: "Space" | "ArrowRight" | "ArrowLeft" | "KeyN"): Promise<void> {
    await this.page.mouse.move(640, 400);
    await this.page.keyboard.press(code);
  }

  /** Lecture/pause : appuie sur Espace jusqu'à l'état voulu (au plus deux fois). */
  async setPlaying(playing: boolean): Promise<void> {
    const cur = await this.sample();
    if (cur.paused === !playing) return;
    await this.press("Space");
  }

  /**
   * Arrière-plan. Chrome sans tête garde toute page « visible » (un autre
   * onglet au premier plan n'y change rien) : `hidden` simule l'onglet caché
   * (visibilityState + visibilitychange, ce que lisent l'app et hls.js) ;
   * `frozen` gèle la page comme Chrome le fait d'un onglet en arrière-plan
   * prolongé — et comme iOS le fait d'une app (CDP Page.setWebLifecycleState).
   */
  async background(mode: "hidden" | "frozen" | "active"): Promise<void> {
    const cdp = await this.context.newCDPSession(this.page);
    if (mode === "frozen") {
      await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
    } else {
      await cdp.send("Page.setWebLifecycleState", { state: "active" }).catch(() => undefined);
      await this.page.evaluate((hidden) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
        document.dispatchEvent(new Event("visibilitychange"));
      }, mode === "hidden");
    }
    await cdp.detach().catch(() => undefined);
  }

  async setOffline(offline: boolean): Promise<void> {
    await this.context.setOffline(offline);
  }

  /** Les trames reçues depuis `since` (ms) du type donné. */
  received(type: string, since = 0): WsFrame[] {
    return this.frames.filter((f) => f.dir === "in" && f.type === type && f.at >= since);
  }

  async screenshot(path: string): Promise<void> {
    await this.page.screenshot({ path }).catch(() => undefined);
  }

  async close(): Promise<void> {
    await this.context.close().catch(() => undefined);
  }
}
