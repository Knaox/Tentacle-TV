import { backendUrl } from "../main";
import { isDesktopApp } from "../desktop/bridge";

export const BACKEND = backendUrl;

export const hdrs = (): Record<string, string> => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("tentacle_token");
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

/** credentials option: use cookies on web, nothing on desktop (token is in header) */
export const creds = (): RequestCredentials | undefined =>
  isDesktopApp() ? undefined : "include";

/**
 * Les classes de l'administration — depuis la refonte de nov. 2026, des RACCOURCIS vers les
 * contrôles du socle (`theme/buttons.css`, `theme/overlays.css`, mode d'emploi :
 * docs/REFONTE-UI.md). Les clés ne changent pas : cent vingt appelants les composent.
 *
 * - Boutons : des pilules de 40 px, une seule peau par rôle, la pression à 97 % ;
 * - Panneaux : une encre (`--surface-1`) et son arête, plus de liseré ni de fond translucide ;
 * - Champs : 40 px, rayon de 10, l'anneau de focus à la teinte franche.
 */
export const cls = {
  // Panneau (rayon 20) et sous-bloc (tuile, rayon 16).
  card: "ui-panel mb-8 p-6",
  sub: "ui-tile p-4 space-y-3",

  // Champ et son libellé.
  inp: "field",
  lbl: "mb-1.5 block text-xs font-semibold text-content-tertiary",

  // L'action principale — neutre : le dégradé du logo est réservé à la lecture.
  bp: "btn btn-solid",

  // L'action secondaire.
  bs: "btn btn-soft",

  // L'action intermédiaire, à la teinte franche (ni principale ni secondaire).
  bbrand: "btn btn-accent",

  // L'action destructive.
  bd: "btn btn-danger",

  // Puce d'état : l'appelant y pose sa couleur.
  chip: "chip",
};
