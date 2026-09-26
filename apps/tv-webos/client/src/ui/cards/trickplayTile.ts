import type { ResumeFrame } from "@/hooks/useResumeFrame";

/**
 * La case d'une planche trickplay, extraite en petite image.
 *
 * `createImageBitmap` avec un rectangle source décode la planche HORS du fil
 * principal et n'en garde que la case ; la case repasse par un canevas pour
 * devenir un JPEG qu'une balise `<img>` affiche comme n'importe quelle
 * affiche. La planche décodée n'est retenue nulle part : elle vit le temps de
 * la découpe. Sa requête, elle, reste servie par le cache HTTP — le proxy la
 * déclare immuable.
 *
 * Les découpes sont mémorisées par adresse ET case : une carte remontée
 * retrouve la sienne sans rien redemander, et deux cartes qui la veulent en
 * même temps partagent le même travail.
 */

/** Au-delà, les plus anciennes sont libérées (une adresse `blob:` retient son JPEG). */
const LIMIT = 120;
/** Même qualité que la bannière d'une carte 16:9. */
const JPEG_QUALITY = 0.9;

const done = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/** La découpe déjà prête, sans attendre — `null` s'il faut la faire. */
export function croppedTile(key: string): string | null {
  return done.get(key) ?? null;
}

export function cropTrickplayTile(frame: ResumeFrame): Promise<string> {
  const key = `${frame.url}#${frame.col}:${frame.row}`;
  const ready = done.get(key);
  if (ready) return Promise.resolve(ready);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const job = crop(frame)
    .then((url) => {
      remember(key, url);
      return url;
    })
    .finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}

async function crop(frame: ResumeFrame): Promise<string> {
  const response = await fetch(frame.url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`planche trickplay : HTTP ${response.status}`);
  const sprite = await response.blob();
  const width = frame.info.Width;
  const height = frame.info.Height;
  const tile = await createImageBitmap(sprite, frame.col * width, frame.row * height, width, height);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canevas 2D indisponible");
    context.drawImage(tile, 0, 0);
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!jpeg) throw new Error("encodage de la vignette impossible");
    return URL.createObjectURL(jpeg);
  } finally {
    tile.close();
  }
}

function remember(key: string, url: string): void {
  done.set(key, url);
  if (done.size <= LIMIT) return;
  // Ordre d'insertion : la première est la plus ancienne. Une image déjà
  // affichée garde ses pixels ; seule une carte remontée la redécoupera.
  const [oldestKey, oldestUrl] = done.entries().next().value as [string, string];
  done.delete(oldestKey);
  URL.revokeObjectURL(oldestUrl);
}
