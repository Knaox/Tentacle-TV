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

export type GlueVerdict = "collée" | "libre" | "indécidable";

/** Assez lâche pour absorber décorations et échelle fractionnaire. */
const TOLERANCE = 0.1;

export interface WindowSize {
  width: number;
  height: number;
}

/** Une propriété mpv rendue en texte, en nombre — `null` si elle ne dit rien. */
export function mpvNumber(value: string | null): number | null {
  if (value === null) return null;
  const count = Number.parseFloat(value.trim());
  return Number.isFinite(count) && count > 0 ? count : null;
}

function sane(size: WindowSize | null): size is WindowSize {
  return (
    size !== null &&
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

/** La taille attendue de la fenêtre mpv : celle de l'hôte, en pixels. */
function expected(host: WindowSize, scale: number): WindowSize {
  return { width: host.width * scale, height: host.height * scale };
}

/**
 * Le verdict. `indécidable` quand une mesure manque — fenêtre réduite, sortie
 * vidéo pas encore montée : on ne conclut RIEN, et surtout on ne repose pas
 * une colle qui marche peut-être très bien.
 */
export function glueVerdict(
  mpv: WindowSize | null,
  host: WindowSize,
  scale: number,
): GlueVerdict {
  if (!sane(mpv) || !sane(host) || !Number.isFinite(scale) || scale <= 0) {
    return "indécidable";
  }
  const target = expected(host, scale);
  const gap = (measure: number, aim: number): number => Math.abs(measure - aim) / aim;
  return gap(mpv.width, target.width) <= TOLERANCE &&
    gap(mpv.height, target.height) <= TOLERANCE
    ? "collée"
    : "libre";
}

/** La mesure en une ligne de journal — les deux tailles, jamais le seul verdict. */
export function measureDescription(
  mpv: WindowSize | null,
  host: WindowSize,
  scale: number,
): string {
  const target = expected(host, scale);
  const round = (n: number): string => String(Math.round(n));
  const view = sane(mpv) ? `${round(mpv.width)}x${round(mpv.height)}` : "?";
  return `mpv ${view} · attendu ${round(target.width)}x${round(target.height)}` +
    ` (hôte ${round(host.width)}x${round(host.height)} ×${String(scale)})`;
}
