import type { WhatsNewRelease } from "../types";
import { OnDeviceScene, SeriesScopeScene, TransferDetailScene } from "../scenes/v1_21_1";

/**
 * 1.21.1 — trois nouveautés qui se MONTRENT : le périmètre d'un
 * téléchargement, le catalogue local atteignable en ligne, et une ligne de
 * transfert qui dit enfin ce qui se passe. Les textes vivent dans l'espace
 * i18n `whatsNew` (v1_21_1_<id>_title / _body).
 */
export const RELEASE_1_21_1: WhatsNewRelease = {
  version: "1.21.1",
  features: [
    { id: "scope", kind: "new", titleKey: "v1_21_1_scope_title", bodyKey: "v1_21_1_scope_body", Scene: SeriesScopeScene },
    { id: "onDevice", kind: "new", titleKey: "v1_21_1_onDevice_title", bodyKey: "v1_21_1_onDevice_body", Scene: OnDeviceScene, route: "/on-device" },
    { id: "transfers", kind: "improved", titleKey: "v1_21_1_transfers_title", bodyKey: "v1_21_1_transfers_body", Scene: TransferDetailScene, route: "/downloads" },
  ],
};
