/**
 * Le rendu de mpv dans notre vue OpenGL, image par image.
 *
 * # Pourquoi pas de thread de rendu
 *
 * Le renderer Rust de l'app Tauri (`src-tauri/src/macos/render.rs`) tourne sur
 * un thread dédié. Ici on ne peut pas : Node n'en a pas, et un rappel appelé
 * depuis un thread mpv ne traverse pas proprement la frontière koffi.
 *
 * Ce n'est pas un pis-aller. Une image coûte trois appels FFI — rendre le
 * contexte courant, dessiner, présenter — soit moins de deux cents par seconde
 * à soixante images. Le GPU fait le travail ; le thread principal ne fait que
 * le déclencher. Et surtout, ces trois fonctions-là ne prennent PAS
 * `mp_dispatch_lock` : elles dessinent, elles n'interrogent pas le cœur de mpv.
 * C'est toute la différence avec la lecture de propriété qui figeait
 * l'application (voir `mpvFfi.ts`).
 *
 * Le pouls (`heartbeat.ts`) surveille ce choix : s'il se met à sauter pendant
 * une lecture, c'est ici qu'il faut revenir.
 *
 * ⚠️ **macOS uniquement.**
 */

import koffi from "koffi";
import { neverThrow, trace } from "./native";
import { msg } from "./objc";
import {
  GetProcAddress,
  MpvRenderParam,
  PARAM,
  FBO_SIZE,
  INIT_PARAMS_SIZE,
  renderApi,
  setCurrentContext,
  openGlSymbol,
} from "./mpvRenderFfi";
import type { GlView } from "./macosGlView";

/**
 * Cadence de rendu.
 *
 * mpv sait quand une image l'attend (`mpv_render_context_update`), mais son
 * rappel de réveil arrive depuis un de ses threads. On sonde donc à cadence
 * fixe : à 120 Hz on ne rate aucune image d'un film à 24, et une passe qui n'a
 * rien à dessiner coûte un seul appel FFI.
 */
const PERIOD_MS = 8;

/** Le rappel enregistré auprès de koffi, tel qu'il faut le rendre. */
type RegisteredCallback = ReturnType<typeof koffi.register>;

interface Session {
  context: unknown;
  view: GlView;
  scale: number;
  loop: ReturnType<typeof setInterval>;
  /** Le rappel enregistré, à libérer avec la session. */
  callback: RegisteredCallback;
  images: number;
}

let session: Session | null = null;

/** Le rendu tourne-t-il ? */
export function renderInProgress(): boolean {
  return session !== null;
}

/** Nombre d'images présentées depuis le début de la session. */
export function framesPresented(): number {
  return session?.images ?? 0;
}

/** Un tampon de `mpv_opengl_init_params` pointant sur notre rappel. */
function initParams(callback: unknown): Buffer {
  const buffer = Buffer.alloc(INIT_PARAMS_SIZE);
  koffi.encode(buffer, 0, "void*", callback);
  koffi.encode(buffer, 8, "void*", null);
  return buffer;
}

/** Un tampon de `mpv_opengl_fbo` visant l'écran (FBO 0). */
function fbo(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(FBO_SIZE);
  buffer.writeInt32LE(0, 0); // fbo 0 : le tampon d'affichage de la vue
  buffer.writeInt32LE(width, 4);
  buffer.writeInt32LE(height, 8);
  buffer.writeInt32LE(0, 12); // internal_format : laissé à mpv
  return buffer;
}

/** Un tampon d'entier, pour les paramètres scalaires (`flip_y`). */
function int(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(value, 0);
  return buffer;
}

/**
 * Démarre le rendu de `mpv` dans `view`. Rend le motif de l'échec, ou `null`.
 *
 * ⚠️ Le contexte OpenGL doit être COURANT quand mpv crée son contexte de rendu :
 * il y interroge les extensions disponibles, et échoue sinon.
 */
export function startRender(
  mpv: unknown,
  view: GlView,
  scale: number,
  size: { w: number; h: number },
): string | null {
  if (session !== null) return "un rendu tourne deja";

  setCurrentContext(view.context);

  // Enregistré AVANT la création : mpv l'appelle pendant, de façon synchrone.
  const callback = koffi.register(
    (_ctx: unknown, name: string): unknown => openGlSymbol(name),
    koffi.pointer(GetProcAddress),
  );

  const output: unknown[] = [null];
  const code = renderApi().contextCreate(output, mpv, [
    { type: PARAM.API_TYPE, data: Buffer.from("opengl\0", "utf8") },
    { type: PARAM.OPENGL_INIT_PARAMS, data: initParams(callback) },
    { type: PARAM.INVALID, data: null },
  ]) as number;

  if (code < 0 || !output[0]) {
    koffi.unregister(callback);
    return `mpv_render_context_create : ${String(code)}`;
  }

  const context = output[0];
  const loop = setInterval(() => {
    neverThrow("rendu d'une image", () => draw());
  }, PERIOD_MS);
  loop.unref();

  session = { context, view, scale, loop, callback, images: 0 };
  trace(
    `rendu demarre — ${String(size.w)}x${String(size.h)} px, ` +
      `${String(Math.round(1000 / PERIOD_MS))} sondages/s`,
  );
  return null;
}

/**
 * Dessine une image, si mpv en a une qui attend.
 *
 * `mpv_render_context_update` est le seul appel de la passe quand il n'y a rien
 * à faire — c'est ce qui rend la cadence de sondage bon marché.
 */
function draw(): void {
  const s = session;
  if (s === null) return;
  const api = renderApi();

  // koffi rend un `number` tant que la valeur tient dans la plage sûre, un
  // `bigint` au-delà — les deux passent par `Number()` sans perte ici, seul le
  // bit de poids faible nous intéresse.
  const flags = Number(api.contextUpdate(s.context) as number | bigint);
  if ((flags & 1) === 0) return;

  const size = currentSize(s);
  setCurrentContext(s.view.context);
  api.contextRender(s.context, [
    { type: PARAM.OPENGL_FBO, data: fbo(size.w, size.h) },
    // ⚠️ mpv dessine l'origine en HAUT, OpenGL l'attend en BAS. Sans ce
    // drapeau, l'image est retournée — et une image retournée reste une image,
    // donc la sonde de pixels ne le verrait pas.
    { type: PARAM.FLIP_Y, data: int(1) },
    { type: PARAM.INVALID, data: null },
  ]);
  msg.get(s.view.nsContext, "flushBuffer");
  api.contextReportSwap(s.context);
  s.images += 1;
}

/** La taille en pixels de la vue, relue à chaque image — elle suit la fenêtre. */
function currentSize(s: Session): { w: number; h: number } {
  const frame = msg.rect(s.view.view, "frame");
  return {
    w: Math.max(1, Math.round(frame.width * s.scale)),
    h: Math.max(1, Math.round(frame.height * s.scale)),
  };
}

/**
 * Arrête le rendu et détruit le contexte.
 *
 * ⚠️ À appeler AVANT l'arrêt de mpv : `mpv_render_context_free` attend la fin
 * du rendu en cours, et mpv détruit sa sortie vidéo à l'arrêt.
 */
export function stopRender(): void {
  const s = session;
  if (s === null) return;
  session = null;
  clearInterval(s.loop);
  neverThrow("arret du rendu", () => {
    renderApi().contextFree(s.context);
    koffi.unregister(s.callback);
  });
  trace(`rendu arrete — ${String(s.images)} images presentees`);
}

/** Décrit l'état du rendu, pour le rapport de diagnostic. */
export function renderState(): string {
  const s = session;
  if (s === null) return "rendu=arrete";
  const size = currentSize(s);
  return `rendu=actif ${String(size.w)}x${String(size.h)} px, ${String(s.images)} images`;
}

/** Le type de structure, exporté pour que koffi le connaisse à l'appel. */
export const PARAM_STRUCT = MpvRenderParam;
