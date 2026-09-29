import type { DirectStreamingState } from "./types";
import { withDirectApiKey } from "./directAuth";

/** Échecs médias consécutifs avant de couper le direct. */
const DS_ERROR_THRESHOLD = 3;

/**
 * L'état du streaming direct d'un `JellyfinClient` : la config reçue du
 * serveur, le compteur d'échecs et le verrou de session. Sorti de
 * `jellyfin.ts`, qui dépassait la taille d'un fichier ; le client garde ses
 * méthodes publiques et délègue ici.
 */
export class DirectStreamingControl {
  private state: DirectStreamingState | null = null;
  private errors = 0;
  /**
   * Ce navigateur ne peut PAS joindre le serveur média en direct : verrou de
   * session, posé sur constat (cf. `block`). Il survit aux resynchronisations
   * de la config admin, sans quoi celle-ci rallumerait aussitôt un chemin dont
   * on vient de mesurer qu'il ne passe pas.
   */
  private locked = false;
  private failCallback?: () => void;

  set(config: DirectStreamingState | null): void {
    if (config && this.locked) return;
    this.state = config;
    if (config) this.errors = 0;
  }

  get(): DirectStreamingState | null {
    return this.state;
  }

  /**
   * Le direct est inatteignable depuis cette origine — typiquement un serveur
   * Jellyfin sans en-tête CORS. On coupe pour toute la session.
   *
   * Sans ce verrou, chaque lecture repayait la découverte : le `PlaybackInfo`
   * direct échouait puis repartait en proxy MAIS laissait `directStreaming`
   * actif, l'URL de stream se construisait donc encore sur le serveur média,
   * hls.js se cassait sur le manifeste, et le lecteur redemandait un
   * `PlaybackInfo` complet. Deux allers-retours et un rechargement visible, à
   * chaque démarrage.
   *
   * On ne déclenche PAS le rappel d'échec ici : il invalide la config admin,
   * dont la resynchronisation rallumerait le direct.
   *
   * Le prix d'une erreur réseau passagère prise pour un refus est faible : le
   * proxy sert tout, et un rechargement de page repart de zéro.
   */
  block(reason: string): void {
    if (this.locked) return;
    this.locked = true;
    this.state = null;
    this.errors = 0;
    console.warn("[Tentacle:DirectStreaming] coupe pour la session —", reason);
  }

  onFail(cb: () => void): void {
    this.failCallback = cb;
  }

  /** Un échec média en direct ; au-delà du seuil, le direct est coupé et le rappel levé. */
  reportError(): void {
    if (!this.state) return;
    if (++this.errors >= DS_ERROR_THRESHOLD) {
      this.state = null;
      this.errors = 0;
      this.failCallback?.();
    }
  }

  reportSuccess(): void {
    this.errors = 0;
  }

  /**
   * L'URL d'un média : directe si le direct est actif, sinon celle du proxy.
   * Les images restent au proxy (CORS) ; en direct, le jeton est celui de
   * l'utilisateur, sous `ApiKey` — `api_key` vaut un 401 chez Jellyfin 12.
   */
  resolve(proxyUrl: string, proxyBase: string): string {
    if (!this.state) return proxyUrl;
    const { mediaBaseUrl, jellyfinToken } = this.state;
    const path = proxyUrl.replace(proxyBase, "");
    if (/\/Images\//i.test(path)) return proxyUrl;
    return withDirectApiKey(`${mediaBaseUrl}${path}`, jellyfinToken);
  }
}
