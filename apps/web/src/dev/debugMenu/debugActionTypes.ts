/**
 * Le menu de débogage — DÉVELOPPEMENT UNIQUEMENT (`__PLAYER_DEBUG__` est faux dans tout paquet
 * livré : ces modules disparaissent du bundle). Les libellés restent donc en clair, sans i18n.
 *
 * Une ACTION dit trois choses, et le menu les montre toutes :
 *  - ce qu'elle fait (`label`, `hint`) ;
 *  - où elle en est (`status` : allumée ou non, une valeur) ;
 *  - si elle PEUT agir ici (`unavailable` : la raison, en mots) — une coquille qui refuse un
 *    réglage ne doit jamais laisser croire qu'il est passé (vécu : sous CEF, quatre bascules
 *    annonçaient « target-colorspace-hint = no » alors que la coquille les refusait).
 */

export type DebugGroupId = "player" | "display" | "app" | "network";

export const DEBUG_GROUPS: ReadonlyArray<{ id: DebugGroupId; label: string }> = [
  { id: "player", label: "Lecteur" },
  { id: "display", label: "Image et HDR" },
  { id: "app", label: "Application" },
  { id: "network", label: "Réseau" },
];

export interface DebugStatus {
  /** Une bascule : allumée ou non. */
  on?: boolean;
  /** La valeur en cours, en quelques caractères (« auto-safe », « bt.2446a »). */
  value?: string;
  /** L'action ne peut pas agir ici : pourquoi. Absente = disponible. */
  unavailable?: string;
}

export interface DebugChoice {
  id: string;
  label: string;
}

export interface DebugAction {
  id: string;
  /** Touche qui la déclenche panneau ouvert, en minuscule. */
  key: string;
  group: DebugGroupId;
  label: string;
  /** Une phrase : ce que l'action change, et quand. */
  hint: string;
  /** `switch` : un état qu'on bascule ; `button` : un geste qu'on lance. */
  kind: "switch" | "button";
  /** Des variantes du geste (les états d'une pop-up) ; la touche lance la première. */
  choices?: readonly DebugChoice[];
  /** Renvoie ce qu'il faut dire en retour, ou `null` si rien à dire. */
  run: (choice?: string) => Promise<string | null>;
  status?: () => Promise<DebugStatus> | DebugStatus;
}
