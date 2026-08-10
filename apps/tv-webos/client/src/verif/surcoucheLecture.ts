/**
 * Ce que le serveur fait vraiment de l'image, affiché sur la dalle.
 *
 * **Jamais en production.** L'installation est gardée par
 * `import.meta.env.DEV || __TV_DEBUG__` et l'import y est dynamique : ce module
 * et tout ce qu'il tire disparaissent du fragment servi à un téléviseur. Le même
 * motif que `surcoucheDebug.ts`, pour la même raison.
 *
 * # Pourquoi elle existe
 *
 * Un transcodage réussi ressemble à une lecture directe : même image, même son,
 * en plus lent et en moins beau. Rien à l'écran ne distingue un REMUX — le
 * serveur démultiplexe, l'image est copiée telle quelle — d'un RÉ-ENCODAGE, où
 * elle est recompressée en permanence. Jusqu'ici il fallait ouvrir un inspecteur
 * distant et lire un `console.warn` pour le savoir, ce qui revient à ne jamais
 * le savoir.
 *
 * Le verdict lui-même vient de `playbackVerdict.ts`, côté web : il est déjà
 * calculé et déjà testé. Ce fichier ne fait que le peindre.
 *
 * # Pourquoi pas de raccourci
 *
 * `surcoucheDebug` s'ouvre par Ctrl+Maj+D, ce qui suppose un clavier. Celle-ci
 * doit se voir pendant qu'on regarde un film à la télécommande : elle s'affiche
 * donc d'office, dès qu'une lecture est négociée, et disparaît avec elle.
 *
 * Écrite sans React, comme sa voisine : elle survit à un arbre cassé, et surtout
 * elle ne pose **aucun élément focusable** — le moteur de focus compte les
 * cibles atteignables, une surcouche qui s'y ajouterait fausserait la
 * navigation qu'elle est censée aider à observer.
 */

const ID = "tv-lecture";
const PERIODE_MS = 500;

/** Ce que `playbackInfoTv` dépose à chaque négociation. Voir `publierLecture`. */
export interface ReleveLecture {
  mode: string;
  reencodageVideo: boolean;
  raisons: string[];
  /** Codec de la piste vidéo source, tel que Jellyfin le nomme. */
  codecVideo?: string;
  /** Plage dynamique de la source — la valeur brute du serveur. */
  plage?: string | number;
  /** L'URL réellement servie au lecteur : c'est elle qui trahit le sort de l'audio. */
  url?: string | null;
}

declare global {
  interface Window {
    __TENTACLE_LECTURE__?: ReleveLecture | null;
  }
}

/**
 * Dépose un relevé pour la surcouche.
 *
 * Passe par une globale plutôt que par un import : l'appelant
 * (`lecture/playbackInfoTv.ts`) est du code de production, et ne doit pas tirer
 * ce module dans le bundle. Sa propre garde `import.meta.env.DEV` élimine
 * l'appel, et cette fonction avec.
 */
export function publierLecture(releve: ReleveLecture | null): void {
  if (typeof window === "undefined") return;
  window.__TENTACLE_LECTURE__ = releve;
}

/**
 * Le sort de l'audio, lu dans l'URL servie.
 *
 * `AudioCodec=copy` est ce que Jellyfin écrit quand il se contente de recopier
 * la piste. Toute autre valeur est une conversion — la chose même qu'on cherche
 * à faire disparaître, et qui ne se voit ni ne s'entend franchement.
 */
function sortDeLAudio(url?: string | null): [string, boolean | null] {
  if (!url) return ["—", null];
  if (!url.includes(".m3u8")) return ["source", true];
  const codec = /[?&]AudioCodec=([^&]*)/i.exec(url)?.[1];
  if (!codec) return ["?", null];
  return codec.toLowerCase() === "copy" ? ["copié", true] : [`converti → ${codec}`, false];
}

/** La variante Dolby Vision est-elle celle qui joue ? */
function sortDeLImage(releve: ReleveLecture): [string, boolean] {
  if (releve.reencodageVideo) return ["RECOMPRESSÉE", false];
  return [releve.mode === "DirectPlay" ? "fichier d'origine" : "copiée", true];
}

function ligne(cle: string, valeur: string, bon: boolean | null): string {
  const couleur = bon === null ? "#d4d4d8" : bon ? "#34d399" : "#fb7185";
  return (
    `<div style="display:flex;gap:12px;justify-content:space-between">` +
    `<span style="color:#a1a1aa">${cle}</span>` +
    `<span style="color:${couleur};font-weight:600">${valeur}</span></div>`
  );
}

function dessiner(releve: ReleveLecture | null): void {
  const existant = document.getElementById(ID);
  if (!releve) {
    existant?.remove();
    return;
  }

  const racine = existant ?? document.createElement("div");
  if (!existant) {
    racine.id = ID;
    racine.setAttribute("aria-hidden", "true");
    // Fond OPAQUE : posé sur une image claire, un panneau translucide devient
    // illisible au moment précis où l'on cherche à y lire une valeur.
    racine.style.cssText = [
      "position:fixed",
      "left:24px",
      "top:24px",
      "z-index:2147483646",
      "pointer-events:none",
      "background:#0a0a10",
      "border:1px solid #27272a",
      "border-radius:8px",
      "padding:10px 14px",
      "font:600 15px/1.55 ui-monospace,Menlo,monospace",
      "min-width:340px",
      "opacity:0.94",
    ].join(";");
    document.body.appendChild(racine);
  }

  const [image, imageOk] = sortDeLImage(releve);
  const [audio, audioOk] = sortDeLAudio(releve.url);
  const raisons = releve.raisons.length ? releve.raisons.join(", ") : "aucune";

  racine.innerHTML =
    `<div style="color:#71717a;font-size:12px;letter-spacing:.08em;margin-bottom:6px">LECTURE — DEV</div>` +
    ligne("mode", releve.mode, !releve.reencodageVideo) +
    ligne("image", image, imageOk) +
    ligne("audio", audio, audioOk) +
    ligne("codec", String(releve.codecVideo ?? "?"), null) +
    ligne("plage", String(releve.plage ?? "?"), null) +
    ligne("raisons", raisons, releve.raisons.length === 0);
}

/**
 * Installe la surveillance. Rend de quoi la retirer.
 *
 * Un intervalle plutôt qu'un abonnement : le relevé est déposé depuis un hook
 * React, et un pont d'événements entre les deux coûterait plus cher à lire
 * qu'un sondage à deux images par seconde qui ne tourne qu'en développement.
 */
export function installerSurcoucheLecture(): () => void {
  let dernier: string | null = null;
  const minuteur = window.setInterval(() => {
    const releve = window.__TENTACLE_LECTURE__ ?? null;
    // On ne repeint que si quelque chose a changé : sur une dalle, un
    // `innerHTML` deux fois par seconde se voit au compteur d'images.
    const empreinte = releve ? JSON.stringify(releve) : null;
    if (empreinte === dernier) return;
    dernier = empreinte;
    dessiner(releve);
  }, PERIODE_MS);

  return () => {
    window.clearInterval(minuteur);
    document.getElementById(ID)?.remove();
  };
}
