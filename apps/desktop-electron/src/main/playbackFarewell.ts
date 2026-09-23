/**
 * Fermer l'application en pleine lecture doit ARRÊTER la lecture chez Jellyfin.
 *
 * # Ce qui se passait
 *
 * La page annonçait l'arrêt dans son `beforeunload`, par `sendBeacon`. Depuis
 * l'origine `tentacle://app`, ce beacon ne part jamais : c'est une requête
 * JSON, donc préflightée, et aucun Jellyfin n'autorise cette origine (c'est la
 * raison d'être du relais de `ipc/jellyfin.ts`). Jellyfin ne recevait donc
 * rien, et gardait la session « en lecture » jusqu'à sa minuterie d'inactivité
 * — un passage toutes les cinq minutes, qui clôt ce qui n'a pas donné signe de
 * vie depuis cinq minutes (`SessionManager.CheckForIdlePlayback`, 10.11). Sous
 * Linux, c'était pire : la séquence de fermeture détruit la fenêtre sans
 * `beforeunload` (`closeSequence.ts`), la page n'avait même pas l'occasion
 * d'essayer.
 *
 * # Ce que fait ce module
 *
 * TOUS les reports de lecture de la coquille passent par le processus
 * principal (`jellyfin_session_post`), qu'ils visent Jellyfin en direct ou le
 * proxy du backend. Il les regarde passer, et retient la lecture ouverte : son
 * identité, la route et le jeton qui l'ont portée, sa dernière position.
 * À la sortie (`will-quit`, `index.ts`), il poste lui-même l'arrêt de ce qui
 * est encore ouvert, et attend les envois en vol — celui que la page vient
 * justement de confier au relais, en particulier — avant de laisser le
 * processus mourir. Le tout borné : une application qui ne se ferme plus coûte
 * plus cher qu'un arrêt perdu.
 *
 * Ce module ne peut rien pour un plantage ou une fin forcée : là, plus rien ne
 * tourne. Ce filet-là est côté serveur (canal de session du backend).
 */

const TICKS_PER_MS = 10_000;

/**
 * Au-delà, la sortie n'attend plus Jellyfin.
 *
 * Même échéance que la séquence de fermeture (`closeSequence.ts`) : un report
 * d'arrêt tient en quelques dizaines de millisecondes sur un réseau local, en
 * quelques centaines à distance. Un serveur qui ne répond pas en une seconde et
 * demie ne doit pas retenir une application que l'utilisateur a fermée.
 */
export const FAREWELL_DEADLINE_MS = 1_500;

/**
 * Au-delà, on cesse d'extrapoler la position depuis le dernier report.
 *
 * La page reporte toutes les 10 s en lecture normale : trente secondes couvrent
 * largement l'écart. Un report qui date davantage dit que la page s'est tue
 * (mode « bords », rendu figé) — la position vraie est alors inconnue, et
 * extrapoler une heure pourrait marquer « vu » un film abandonné au milieu.
 */
export const MAX_EXTRAPOLATION_MS = 30_000;

/** Un report de lecture tel que la page le confie au relais. */
export interface SessionPost {
  baseUrl: string;
  path: string;
  token: string;
  authHeader: string;
  /** Corps JSON sérialisé, tel que Jellyfin le recevra. */
  body: string;
}

/** L'arrêt à poster pour une lecture restée ouverte. */
export interface FarewellStop {
  baseUrl: string;
  token: string;
  authHeader: string;
  /** Corps JSON sérialisé de `/Sessions/Playing/Stopped`. */
  body: string;
}

interface OpenPlayback {
  baseUrl: string;
  token: string;
  authHeader: string;
  itemId: string;
  mediaSourceId: string | undefined;
  playSessionId: string | undefined;
  positionTicks: number;
  isPaused: boolean;
  /** Instant du dernier report — c'est de là qu'on extrapole. */
  reportedAt: number;
}

interface ParsedReport {
  itemId: string;
  mediaSourceId: string | undefined;
  playSessionId: string | undefined;
  positionTicks: number | undefined;
  isPaused: boolean | undefined;
}

function parseReport(body: string): ParsedReport | null {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== "object") return null;
  const fields = raw as Record<string, unknown>;
  if (typeof fields.ItemId !== "string" || fields.ItemId === "") return null;
  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value !== "" ? value : undefined;
  const ticks = fields.PositionTicks;
  return {
    itemId: fields.ItemId,
    mediaSourceId: text(fields.MediaSourceId),
    playSessionId: text(fields.PlaySessionId),
    positionTicks: typeof ticks === "number" && Number.isFinite(ticks) && ticks >= 0 ? ticks : undefined,
    isPaused: typeof fields.IsPaused === "boolean" ? fields.IsPaused : undefined,
  };
}

/** Une lecture est identifiée par sa session de lecture, à défaut par son média. */
function keyOf(report: { itemId: string; playSessionId: string | undefined }): string {
  return report.playSessionId ?? report.itemId;
}

export class PlaybackFarewell {
  private readonly open = new Map<string, OpenPlayback>();
  private readonly inFlight = new Set<Promise<unknown>>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Chaque report relayé passe ici, AVANT son envoi : une fermeture qui suit de près le voit déjà. */
  note(post: SessionPost): void {
    const report = parseReport(post.body);
    if (report === null) return;
    const key = keyOf(report);

    if (post.path === "/Sessions/Playing/Stopped") {
      this.open.delete(key);
      // Un arrêt sans session de lecture ferme tout ce qui porte ce média.
      for (const [other, playback] of this.open) {
        if (playback.itemId === report.itemId) this.open.delete(other);
      }
      return;
    }

    // Début ou progression. Une progression d'une lecture inconnue l'ouvre :
    // pour Jellyfin, elle est en cours (il la ranime sur un simple report).
    const previous = this.open.get(key);
    this.open.set(key, {
      baseUrl: post.baseUrl,
      token: post.token,
      authHeader: post.authHeader,
      itemId: report.itemId,
      mediaSourceId: report.mediaSourceId ?? previous?.mediaSourceId,
      playSessionId: report.playSessionId,
      positionTicks: report.positionTicks ?? previous?.positionTicks ?? 0,
      isPaused: report.isPaused ?? previous?.isPaused ?? false,
      reportedAt: this.now(),
    });
  }

  /** Suit un envoi en cours : la sortie l'attendra avant de laisser mourir le processus. */
  track<T>(promise: Promise<T>): Promise<T> {
    this.inFlight.add(promise);
    const forget = (): void => {
      this.inFlight.delete(promise);
    };
    promise.then(forget, forget);
    return promise;
  }

  /** Reste-t-il quelque chose à dire à Jellyfin avant de partir ? */
  pending(): boolean {
    return this.open.size > 0 || this.inFlight.size > 0;
  }

  /** Les arrêts à poster pour les lectures encore ouvertes, position extrapolée. */
  stops(): FarewellStop[] {
    const at = this.now();
    return [...this.open.values()].map((playback) => {
      const elapsed = playback.isPaused ? 0 : Math.min(Math.max(at - playback.reportedAt, 0), MAX_EXTRAPOLATION_MS);
      const body: Record<string, unknown> = {
        ItemId: playback.itemId,
        MediaSourceId: playback.mediaSourceId ?? playback.itemId,
        PositionTicks: Math.floor(playback.positionTicks + elapsed * TICKS_PER_MS),
      };
      if (playback.playSessionId !== undefined) body.PlaySessionId = playback.playSessionId;
      return {
        baseUrl: playback.baseUrl,
        token: playback.token,
        authHeader: playback.authHeader,
        body: JSON.stringify(body),
      };
    });
  }

  /**
   * Poste l'arrêt de ce qui reste ouvert et attend les envois en vol — au plus
   * `deadlineMs`. Ne rejette jamais : la sortie suit, quoi qu'il arrive.
   */
  async farewell(send: (stop: FarewellStop) => Promise<unknown>, deadlineMs: number): Promise<void> {
    const stops = this.stops();
    this.open.clear();
    const all = [
      ...[...this.inFlight],
      ...stops.map((stop) => {
        try {
          return send(stop);
        } catch (error: unknown) {
          return Promise.reject(error);
        }
      }),
    ].map((p) => p.then(() => undefined, () => undefined));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, deadlineMs);
    });
    await Promise.race([Promise.all(all).then(() => undefined), deadline]);
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** L'instance du processus : alimentée par le relais, vidée à la sortie. */
export const playbackFarewell = new PlaybackFarewell();
