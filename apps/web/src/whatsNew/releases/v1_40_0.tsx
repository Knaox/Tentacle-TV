import type { WhatsNewRelease } from "../types";
import { GlassNavigationScene, GlassPlayerScene, OctaveScene } from "../scenes/v1_40_0";

/**
 * 1.40.0 — LA nouveauté : Octave, le mode musique, EN TÊTE. Il n'existe que face
 * à un serveur qui déclare `music.library` (1.40) : face à un autre, la
 * nouveauté n'existe pas (`forServer`) — l'app n'en montre rien. Sa scène : la
 * bascule « Mode musique », Octave, une houle, l'« en cours » (pochettes et noms
 * inventés). Textes alignés sur `changelogs/desktop.md` : un lecteur pour la
 * bibliothèque PERSONNELLE, rien d'autre (revue Apple).
 *
 * Puis le Liquid Glass de macOS 26 (Tahoe) : la navigation et le lecteur
 * en verre, aux couleurs de Tentacle, activé d'office et réglable dans
 * Réglages › Apparence.
 *
 * Deux scènes : la barre en capsule de verre au-dessus d'une page qui défile
 * dessous, sa pastille qui glisse d'un onglet à l'autre ; le lecteur dont les
 * commandes flottent sur le film, et « Pistes » qui ouvre son panneau en
 * verre. La navigation exige le trait `liquidGlass` (`requires`), le lecteur
 * `liquidGlassPlayer` — le verre qui voit la vidéo, Apple Silicon seulement :
 * sur Windows, Linux, un Mac d'avant macOS 26 ou le web, aucune n'existe, sur
 * un Mac Intel en macOS 26 la navigation seule — et une release ainsi vidée
 * n'ouvre pas d'écran vide (`forClient`).
 *
 * Les autres nouveautés de la 1.40.0 s'ajoutent ICI, après le verre, chacune
 * avec sa scène (`scenes/v1_40_0/`) et ses textes (espace i18n `whatsNew`,
 * v1_40_0_<id>_title / _body) ; sans `requires`, elles valent pour tous.
 */
export const RELEASE_1_40_0: WhatsNewRelease = {
  version: "1.40.0",
  features: [
    {
      id: "octave",
      kind: "new",
      titleKey: "v1_40_0_octave_title",
      bodyKey: "v1_40_0_octave_body",
      Scene: OctaveScene,
      route: "/octave",
      capability: "music.library",
    },
    {
      id: "glassNavigation",
      kind: "new",
      titleKey: "v1_40_0_glassNavigation_title",
      bodyKey: "v1_40_0_glassNavigation_body",
      Scene: GlassNavigationScene,
      route: "/settings/appearance",
      requires: "liquidGlass",
    },
    {
      id: "glassPlayer",
      kind: "new",
      titleKey: "v1_40_0_glassPlayer_title",
      bodyKey: "v1_40_0_glassPlayer_body",
      Scene: GlassPlayerScene,
      requires: "liquidGlassPlayer",
    },
  ],
};
