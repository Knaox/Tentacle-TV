import type { WideSettingId } from "./wideSettingsTypes";

/**
 * UNE structure, deux rendus : chaque entrée du catalogue du mobile et du web
 * étroit (`settingsSections.ts`) que le web rend a son pendant dans le
 * catalogue du web large — le MÊME réglage, avec la MÊME portée (le test le
 * vérifie) —, ou la raison pour laquelle l'écran large le met ailleurs. Clé :
 * « genre:identifiant » (`control:theme`). Les entrées réservées au mobile
 * (`platforms: ["mobile"]`) n'y figurent pas.
 */
export type WideEquivalent = { wide: WideSettingId } | { elsewhere: string };

export const WIDE_EQUIVALENTS: Readonly<Record<string, WideEquivalent>> = {
  "control:photo": { elsewhere: "La photo se change par le menu de l'avatar (« Changer la photo », galerie des personnages)." },
  "control:userName": { elsewhere: "Le nom du compte est une information, affichée dans le menu de l'avatar." },
  "control:switchProfile": { elsewhere: "Changer de profil : un geste du menu de l'avatar, pas un réglage." },
  "control:askAtLaunch": { wide: "askAtLaunch" },
  "control:intros": { wide: "skipPassages" },
  "control:nextAutoPlay": { wide: "upNext" },
  "control:stillWatching": { wide: "stillWatching" },
  "control:language": { wide: "interfaceLanguage" },
  "control:trendingNow": { wide: "trendingNow" },
  "control:theme": { wide: "theme" },
  "control:dataSaver": { wide: "dataSaver" },
  "control:advancedOnDesktop": { elsewhere: "Renvoi vers l'app de bureau : l'écran large EST cet endroit, chaque réglage fin y a sa ligne." },
  "pane:password": { wide: "password" },
  "pane:mediaLanguages": { wide: "libraryTracks" },
  "pane:personalization": { wide: "heroSource" },
  "pane:devices": { wide: "pairedDevices" },
  "pane:invites": { elsewhere: "Les invitations relèvent de l'administration (Administration › Utilisateurs)." },
  "screen:family": { wide: "familyProfiles" },
  "screen:sessions": { elsewhere: "Les sessions en cours relèvent de l'administration (Administration › Sessions)." },
  "screen:support": { elsewhere: "Le support est une page de l'app (menu de l'avatar), pas un réglage." },
  "screen:about": { elsewhere: "« À propos » est une page de l'app (menu de l'avatar), pas un réglage." },
  "action:clearCache": { wide: "clearCache" },
  "action:deleteAccount": { wide: "deleteAccount" },
  "action:privacyPolicy": { elsewhere: "La politique de confidentialité se lit depuis « À propos »." },
  "block:scopeIntro": { elsewhere: "La phrase de portée : chaque rubrique du web large a la sienne (`sections.<id>.intro`)." },
};
