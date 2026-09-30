import type { ArtworkPalette } from "../../color/artworkPalette";

/**
 * Le contrat du jumelage : une étape à la fois, chacune avec son état. Les
 * libellés fixes sont traduits par la vue ; l'intégration fournit l'étape,
 * le code, le temps qui reste, l'erreur du serveur (sa CLÉ `auth:*`).
 */

export type PairingLanguage = "fr" | "en";

/** L'état d'un code affiché (relais ou serveur). */
export type CodeState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "active"; code: string; remainingSeconds: number; totalSeconds: number }
  | { status: "expired"; code?: string };

/** Les erreurs de `verifyServer` (`errorKey`), plus le repli d'une exception. */
export type ServerErrorKey =
  | "invalidUrl"
  | "connectionTimeout"
  | "apiNotFound"
  | "serverHttpError"
  | "cannotReachServer"
  | "serverNotFoundRetry";

export interface ServerError {
  key: ServerErrorKey;
  params?: Record<string, string>;
}

export type PairingStep =
  | { kind: "welcome" }
  | { kind: "relayCode"; code: CodeState }
  | { kind: "manualServer"; url: string; checking: boolean; error: ServerError | null }
  | { kind: "serverCode"; code: CodeState; serverUrl: string }
  | { kind: "success"; userName: string; avatarUri?: string };

export interface PairingViewProps {
  step: PairingStep;
  /** La langue de l'interface (`uiLanguage(i18n.language)`). */
  language: PairingLanguage;
  /** La lumière du fond ; une lumière chaude par défaut (aucune œuvre ici). */
  palette?: ArtworkPalette;
  onChangeLanguage?: (language: PairingLanguage) => void;
  /** Accueil → code du relais. */
  onShowCode?: () => void;
  /** Accueil, ou relais injoignable → serveur manuel. */
  onManualSetup?: () => void;
  /** Code en erreur ou expiré → en demander un nouveau. */
  onRetryCode?: () => void;
  /** Code du relais → accueil. */
  onCancel?: () => void;
  /** Code du serveur → serveur manuel. */
  onChangeServer?: () => void;
  onChangeUrl?: (url: string) => void;
  onSubmitUrl?: () => void;
  /** Serveur manuel → accueil. */
  onBack?: () => void;
}
