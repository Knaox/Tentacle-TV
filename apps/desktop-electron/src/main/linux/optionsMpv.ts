/**
 * Les options mpv que seule la COQUILLE peut poser sous Linux.
 *
 * Sur macOS, les cinq lignes dont dépend le HDR vivent côté page
 * (`mpvRuntime.ts`), parce qu'elles ne dépendent que du système. Ici elles
 * dépendent de la SESSION — Wayland ou X11 — et la page ne la connaît pas : elle
 * ne voit qu'un `platform: "linux"`. C'est donc le processus principal qui les
 * pose, après celles de la page, comme le socle anti-scripts.
 *
 * # `gpu-context`, et pourquoi il ne peut pas rester automatique
 *
 * Laissé à lui-même, mpv choisit son contexte comme n'importe quel programme :
 * il regarde `WAYLAND_DISPLAY`, puis `DISPLAY`. Or sous XWayland les deux sont
 * posées — notre fenêtre est X11, mpv prendrait Wayland, et ouvrirait une fenêtre
 * native que notre fenêtre X11 ne pourrait ni caler ni recouvrir. Le contexte
 * doit donc suivre le montage, pas l'environnement.
 *
 * # `target-colorspace-hint`, et pourquoi seulement sur Wayland
 *
 * C'est LA ligne qui décide du HDR, et la leçon est la même que sur macOS : en
 * `auto`, mpv n'envoie le signal que s'il peut interroger l'écran, et retombe
 * silencieusement en SDR. En `yes`, mesuré le 25.08.2026 sur KWin 6.7.4 :
 *
 *     [vo/gpu-next/wayland] Setting preferred transfer to PQ for HDR output.
 *     [vo/gpu-next/libplacebo] Picked surface configuration 7:
 *         VK_FORMAT_A2B10G10R10_UNORM_PACK32 + VK_COLOR_SPACE_HDR10_ST2084_EXT
 *
 * Sous X11 elle n'a rien à demander : X.Org n'a pas de gestion de couleur et
 * n'en aura pas. La poser n'y ferait qu'un signal dans le vide.
 *
 * # `focus-on=never` et `fullscreen`
 *
 * Les deux tiennent l'empilement sur Wayland : la fenêtre de mpv ne réclame
 * jamais l'activation, donc le compositeur ne la remonte jamais devant la nôtre,
 * et le plein écran est la seule géométrie qu'un client Wayland puisse garantir.
 * Sous X11, c'est nous qui plaçons la fenêtre : elle ne doit surtout PAS se
 * mettre en plein écran toute seule.
 */

import type { Montage } from "./sessionGraphique";

/** Le socle Linux, selon le montage. Posé après les options de la page. */
export function socleLinux(
  montage: Montage,
  colleKwin = false,
): Readonly<Record<string, string>> {
  const commun = {
    // libplacebo n'a de HDR que par Vulkan ; le contexte OpenGL ne sait pas
    // décrire l'espace de sortie au compositeur.
    "gpu-api": "vulkan",
    // La fenêtre ne prend jamais l'activation : c'est ce qui garde la nôtre
    // devant, sur Wayland comme sous X11.
    "focus-on": "never",
  };
  if (montage === "wayland") {
    // La saveur COLLÉE (fenêtré libre, `kwinGlue.ts`) : la fenêtre mpv est
    // calée par le compositeur sur la nôtre — elle ne doit JAMAIS être plein
    // écran d'elle-même (elle serait promue en couche haute, devant
    // l'interface), et elle REMPLIT le rectangle de l'hôte : le letterbox vit
    // DANS la fenêtre (mesuré au banc : avec `keepaspect-window`, mpv rognait
    // la hauteur au ratio du clip et laissait un vide sous l'overlay).
    if (colleKwin) {
      return {
        ...commun,
        "gpu-context": "waylandvk",
        "target-colorspace-hint": "yes",
        fullscreen: "no",
        "keepaspect-window": "no",
      };
    }
    return {
      ...commun,
      "gpu-context": "waylandvk",
      "target-colorspace-hint": "yes",
      fullscreen: "yes",
    };
  }
  return {
    ...commun,
    "gpu-context": "x11vk",
    // ⚠️ mpv demande par défaut au compositeur de se retirer quand sa fenêtre
    // est en plein écran (`fs-only`). Ce retrait supprime la composition — donc
    // la transparence de NOTRE fenêtre, qui laisse voir la vidéo. On ne le
    // déclenche pas aujourd'hui, puisque mpv n'est jamais en plein écran ici,
    // mais le laisser armé, c'est laisser une trappe ouverte sous l'overlay.
    "x11-bypass-compositor": "no",
    // ⚠️ Explicitement NON : sous X11 la fenêtre est calée par nous, au pixel.
    // Un plein écran posé par mpv lui ferait couvrir l'écran entier et masquer
    // l'interface, que la page soit fenêtrée ou non.
    fullscreen: "no",
  };
}
