import type { PlatformTraits } from "./platformTraits";

/**
 * Les traits d'Android TV — le jumeau de `traits.ts`.
 *
 * Liquid Glass : non. Le verre natif n'existe que sur tvOS 26, et sa
 * simulation demande un flou en direct qu'Android 11 (la Shield, API 30) n'a
 * pas sans RenderEffect : la refonte y garde le verre enrichi, et le réglage
 * disparaît des Réglages.
 */
export const PLATFORM_TRAITS: PlatformTraits = {
  liquidGlass: false,
  playerAnnouncesFirstFrame: true,
};
