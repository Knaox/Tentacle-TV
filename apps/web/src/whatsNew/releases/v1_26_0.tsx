import type { WhatsNewRelease } from "../types";
import { FamilyScene, InviteScene, QualityDropScene, TranscodeSeekScene } from "../scenes/v1_26_0";

/**
 * 1.26.0 — la Famille, puis deux gestes du lecteur.
 *
 * La Famille se gère dans Réglages › Famille (le lien profond y mène) : la
 * famille partagée, les invitations, les invités et leur code PIN, et les
 * droits que règle le propriétaire — un invité autorisé demande à SON nom.
 * L'affiche des invitations a sa scène à elle.
 *
 * Le lecteur : « Qualité réduite » dit pourquoi (et se relit dans le menu
 * Qualité) ; sauter pendant une vidéo convertie montre l'attente et ne
 * relance la conversion qu'une fois.
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_26_0_<id>_title / _body).
 */
export const RELEASE_1_26_0: WhatsNewRelease = {
  version: "1.26.0",
  features: [
    { id: "family", kind: "new", titleKey: "v1_26_0_family_title", bodyKey: "v1_26_0_family_body", Scene: FamilyScene, route: "/settings/family" },
    { id: "familyInvite", kind: "new", titleKey: "v1_26_0_familyInvite_title", bodyKey: "v1_26_0_familyInvite_body", Scene: InviteScene },
    { id: "qualityDrop", kind: "improved", titleKey: "v1_26_0_qualityDrop_title", bodyKey: "v1_26_0_qualityDrop_body", Scene: QualityDropScene },
    { id: "transcodeSeek", kind: "improved", titleKey: "v1_26_0_transcodeSeek_title", bodyKey: "v1_26_0_transcodeSeek_body", Scene: TranscodeSeekScene },
  ],
};
