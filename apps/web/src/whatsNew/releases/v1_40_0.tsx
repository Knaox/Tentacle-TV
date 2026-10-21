import type { WhatsNewRelease } from "../types";
import { GlassNavigationScene, GlassPlayerScene } from "../scenes/v1_40_0";

/**
 * 1.40.0 — le Liquid Glass de macOS 26 (Tahoe) : la navigation et le lecteur
 * en verre, aux couleurs de Tentacle, activé d'office et réglable dans
 * Réglages › Apparence.
 *
 * Deux scènes : la barre en capsule de verre au-dessus d'une page qui défile
 * dessous, sa pastille qui glisse d'un onglet à l'autre ; le lecteur dont les
 * commandes flottent sur le film, et « Pistes » qui ouvre son panneau en
 * verre. Toutes deux exigent le trait `liquidGlass` (`requires`) : sur
 * Windows, Linux, un Mac d'avant macOS 26 ou le web, elles n'existent pas —
 * et une release ainsi vidée n'ouvre pas d'écran vide (`forClient`).
 *
 * Les autres nouveautés de la 1.40.0 s'ajoutent ICI, après le verre, chacune
 * avec sa scène (`scenes/v1_40_0/`) et ses textes (espace i18n `whatsNew`,
 * v1_40_0_<id>_title / _body) ; sans `requires`, elles valent pour tous.
 */
export const RELEASE_1_40_0: WhatsNewRelease = {
  version: "1.40.0",
  features: [
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
      requires: "liquidGlass",
    },
  ],
};
