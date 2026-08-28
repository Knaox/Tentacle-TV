/**
 * Le TÉMOIN de la colle : la fenêtre mpv suit-elle VRAIMENT la nôtre ?
 *
 * La question n'est pas rhétorique. Poser la colle réussit toujours en
 * apparence — `loadDeclarativeScript` rend un numéro, `run` réussit — et le
 * compositeur peut n'avoir jamais construit le composant : c'est exactement la
 * panne du 28.08 au soir, muette côté application, visible seulement dans le
 * journal de KWin (voir l'en-tête de `kwinGlue.ts`). Un « colle posée » qui
 * ment coûte une soirée de lecture avec une fenêtre vidéo qui flotte.
 *
 * D'où une contre-lecture, côté mpv : sa fenêtre a la TAILLE de la nôtre, ou
 * elle ne l'a pas. C'est mpv qui parle (`osd-dimensions`), pas le compositeur —
 * la mesure est indépendante de ce qu'on croit avoir demandé.
 *
 * # Pourquoi la taille, et pas la position
 *
 * mpv ne publie pas la position de sa fenêtre : sous Wayland, un client ne la
 * connaît même pas. La taille suffit à trancher — une fenêtre libre naît à la
 * dimension du clip, jamais à celle de l'hôte.
 *
 * # Pourquoi une tolérance, et si large
 *
 * On compare des points logiques (Electron) à des pixels (mpv) : l'échelle de
 * l'écran fait le pont, et elle peut être fractionnaire. La colle copie de plus
 * le `frameGeometry` de l'hôte, décorations comprises, quand `getBounds` peut
 * n'en rendre qu'une partie. On ne cherche pas le pixel : on distingue
 * « collée » de « libre », et 10 % séparent ces deux mondes sans ambiguïté.
 */

export type VerdictColle = "collée" | "libre" | "indécidable";

/** Assez lâche pour absorber décorations et échelle fractionnaire. */
const TOLERANCE = 0.1;

export interface TailleFenetre {
  largeur: number;
  hauteur: number;
}

/** Une propriété mpv rendue en texte, en nombre — `null` si elle ne dit rien. */
export function nombreMpv(valeur: string | null): number | null {
  if (valeur === null) return null;
  const nombre = Number.parseFloat(valeur.trim());
  return Number.isFinite(nombre) && nombre > 0 ? nombre : null;
}

function saine(taille: TailleFenetre | null): taille is TailleFenetre {
  return (
    taille !== null &&
    Number.isFinite(taille.largeur) &&
    Number.isFinite(taille.hauteur) &&
    taille.largeur > 0 &&
    taille.hauteur > 0
  );
}

/** La taille attendue de la fenêtre mpv : celle de l'hôte, en pixels. */
function attendue(hote: TailleFenetre, echelle: number): TailleFenetre {
  return { largeur: hote.largeur * echelle, hauteur: hote.hauteur * echelle };
}

/**
 * Le verdict. `indécidable` quand une mesure manque — fenêtre réduite, sortie
 * vidéo pas encore montée : on ne conclut RIEN, et surtout on ne repose pas
 * une colle qui marche peut-être très bien.
 */
export function verdictColle(
  mpv: TailleFenetre | null,
  hote: TailleFenetre,
  echelle: number,
): VerdictColle {
  if (!saine(mpv) || !saine(hote) || !Number.isFinite(echelle) || echelle <= 0) {
    return "indécidable";
  }
  const cible = attendue(hote, echelle);
  const ecart = (mesure: number, visee: number): number => Math.abs(mesure - visee) / visee;
  return ecart(mpv.largeur, cible.largeur) <= TOLERANCE &&
    ecart(mpv.hauteur, cible.hauteur) <= TOLERANCE
    ? "collée"
    : "libre";
}

/** La mesure en une ligne de journal — les deux tailles, jamais le seul verdict. */
export function descriptionMesure(
  mpv: TailleFenetre | null,
  hote: TailleFenetre,
  echelle: number,
): string {
  const cible = attendue(hote, echelle);
  const rond = (n: number): string => String(Math.round(n));
  const vue = saine(mpv) ? `${rond(mpv.largeur)}x${rond(mpv.hauteur)}` : "?";
  return `mpv ${vue} · attendu ${rond(cible.largeur)}x${rond(cible.hauteur)}` +
    ` (hôte ${rond(hote.largeur)}x${rond(hote.hauteur)} ×${String(echelle)})`;
}
