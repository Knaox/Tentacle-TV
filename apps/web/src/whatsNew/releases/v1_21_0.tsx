import type { WhatsNewRelease } from "../types";
import {
  AutoQualityScene, HomeComposeScene, LogoScene, PlatformFilterScene, PlayFromRecoScene, RateScene, RecoScene,
  TicketsBoardScene,
} from "../scenes/v1_21_0";

/**
 * 1.21.0 — la première version qui embarque l'écran. Huit nouveautés qui se
 * MONTRENT, retenues parmi les vingt-six puces du changelog ; les textes sont
 * dans l'espace i18n `whatsNew` (v1_21_0_<id>_title / _body).
 */
export const RELEASE_1_21_0: WhatsNewRelease = {
  version: "1.21.0",
  features: [
    { id: "reco", kind: "new", titleKey: "v1_21_0_reco_title", bodyKey: "v1_21_0_reco_body", Scene: RecoScene, route: "/recommendations" },
    { id: "rate", kind: "new", titleKey: "v1_21_0_rate_title", bodyKey: "v1_21_0_rate_body", Scene: RateScene },
    { id: "platforms", kind: "new", titleKey: "v1_21_0_platforms_title", bodyKey: "v1_21_0_platforms_body", Scene: PlatformFilterScene, route: "/recommendations" },
    { id: "home", kind: "improved", titleKey: "v1_21_0_home_title", bodyKey: "v1_21_0_home_body", Scene: HomeComposeScene, route: "/settings/personalization" },
    { id: "autoQuality", kind: "new", titleKey: "v1_21_0_autoQuality_title", bodyKey: "v1_21_0_autoQuality_body", Scene: AutoQualityScene, route: "/settings/playback" },
    { id: "playReco", kind: "improved", titleKey: "v1_21_0_playReco_title", bodyKey: "v1_21_0_playReco_body", Scene: PlayFromRecoScene, route: "/recommendations" },
    { id: "tickets", kind: "improved", titleKey: "v1_21_0_tickets_title", bodyKey: "v1_21_0_tickets_body", Scene: TicketsBoardScene, route: "/support" },
    { id: "logo", kind: "new", titleKey: "v1_21_0_logo_title", bodyKey: "v1_21_0_logo_body", Scene: LogoScene, route: "/about" },
  ],
};
