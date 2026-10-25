import { createHmac, randomBytes, randomUUID } from "crypto";
import {
  allowedUrl,
  checkClientFetchRequest,
  CLIENT_FETCH_LIMITS,
  CLIENT_FETCH_MESSAGE,
  type ClientFetchJob,
  type ClientFetchManifest,
  type ClientFetchOutcome,
  type ClientFetchRequest,
} from "../pluginClientFetch";

/**
 * Le COURTIER des requêtes déléguées (`client.fetch`) : une extension décrit
 * une requête, l'hôte la valide, la pousse sur la socket de L'appareil qui a
 * sollicité l'extension — et lui seul —, attend sa réponse et la rend. Jamais
 * une exception pour l'extension : un motif de la liste fermée.
 *
 * L'appareil est désigné par une POIGNÉE opaque, posée par le relais
 * (`RELAY_HEADERS.client`) : HMAC d'un secret du processus sur (extension,
 * appareil). Une extension ne peut viser que les appareils qui l'ont appelée,
 * jamais ceux d'une autre extension ; la poignée meurt avec la socket.
 */

export interface ClientFetchBrokerDeps {
  /** Pousse le travail sur les sockets de l'appareil ; faux s'il n'en a aucune. */
  send(deviceKey: string, job: ClientFetchJob): boolean;
  online(deviceKey: string): boolean;
}

interface Pending {
  deviceKey: string;
  pluginId: string;
  manifest: ClientFetchManifest;
  maxBytes: number;
  done(outcome: ClientFetchOutcome): void;
}

/** Marge accordée à l'appareil au-delà du délai de la requête (socket, pont, retour). */
const REPLY_MARGIN_MS = 1_500;

export class ClientFetchBroker {
  private readonly secret = randomBytes(32);
  private readonly handles = new Map<string, { pluginId: string; deviceKey: string }>();
  private readonly pending = new Map<string, Pending>();
  private readonly inFlight = new Map<string, number>();

  constructor(private readonly deps: ClientFetchBrokerDeps) {}

  /** La poignée de (extension, appareil), retenue tant que l'appareil a une socket. */
  handleFor(pluginId: string, deviceKey: string): string | null {
    if (!this.deps.online(deviceKey)) return null;
    const handle = createHmac("sha256", this.secret).update(`${pluginId}\n${deviceKey}`).digest("base64url").slice(0, 32);
    this.handles.set(handle, { pluginId, deviceKey });
    return handle;
  }

  /** L'appareil est parti : ses poignées tombent, ses requêtes en cours échouent `offline`. */
  forgetDevice(deviceKey: string): void {
    for (const [handle, h] of this.handles) if (h.deviceKey === deviceKey) this.handles.delete(handle);
    for (const [id, p] of this.pending) {
      if (p.deviceKey !== deviceKey) continue;
      this.pending.delete(id);
      p.done({ ok: false, reason: "offline" });
    }
  }

  /** `client.fetch` : la requête de `pluginId`, exécutée par l'appareil de `handle`. */
  run(pluginId: string, manifest: ClientFetchManifest | undefined, handle: string, request: ClientFetchRequest): Promise<ClientFetchOutcome> {
    if (!manifest || checkClientFetchRequest(request, manifest) !== null) return Promise.resolve({ ok: false, reason: "refused" });
    const target = this.handles.get(handle);
    if (!target || target.pluginId !== pluginId || !this.deps.online(target.deviceKey)) return Promise.resolve({ ok: false, reason: "offline" });
    const busy = this.inFlight.get(target.deviceKey) ?? 0;
    if (busy >= CLIENT_FETCH_LIMITS.maxParallel) return Promise.resolve({ ok: false, reason: "budget" });

    const id = randomUUID();
    const timeoutMs = request.timeoutMs ?? CLIENT_FETCH_LIMITS.defaultTimeoutMs;
    return new Promise<ClientFetchOutcome>((resolve) => {
      this.inFlight.set(target.deviceKey, busy + 1);
      const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), timeoutMs + REPLY_MARGIN_MS);
      timer.unref?.();
      const finish = (outcome: ClientFetchOutcome) => {
        clearTimeout(timer);
        this.pending.delete(id);
        const left = (this.inFlight.get(target.deviceKey) ?? 1) - 1;
        if (left > 0) this.inFlight.set(target.deviceKey, left);
        else this.inFlight.delete(target.deviceKey);
        resolve(outcome);
      };
      this.pending.set(id, { deviceKey: target.deviceKey, pluginId, manifest, maxBytes: request.maxBytes ?? CLIENT_FETCH_LIMITS.defaultMaxBytes, done: finish });
      if (!this.deps.send(target.deviceKey, { type: CLIENT_FETCH_MESSAGE, id, pluginId, request })) finish({ ok: false, reason: "offline" });
    });
  }

  /**
   * La réponse d'un appareil (`POST /api/client-fetch/:id`) : acceptée seulement
   * de l'appareil visé, et si elle tient dans ce qui a été demandé (taille, hôte
   * final déclaré). Faux : inconnue, d'un autre appareil, ou déjà rendue.
   */
  accept(id: string, deviceKey: string, outcome: ClientFetchOutcome): boolean {
    const p = this.pending.get(id);
    if (!p || p.deviceKey !== deviceKey) return false;
    if (outcome.ok) {
      const { response } = outcome;
      if (Buffer.byteLength(response.body, "utf8") > p.maxBytes) return p.done({ ok: false, reason: "tooLarge" }), true;
      if (!allowedUrl(response.url, p.manifest.hosts)) return p.done({ ok: false, reason: "refused" }), true;
      const contentType = response.headers["content-type"];
      p.done({ ok: true, response: { status: response.status, url: response.url, headers: typeof contentType === "string" ? { "content-type": contentType.slice(0, 200) } : {}, body: response.body } });
      return true;
    }
    p.done(outcome);
    return true;
  }

  /** Pour l'administration et les tests. */
  get pendingCount(): number {
    return this.pending.size;
  }
}
