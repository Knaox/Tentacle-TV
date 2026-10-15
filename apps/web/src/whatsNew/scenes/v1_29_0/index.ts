// Les scènes de la 1.29.0 — même kit, mêmes règles : de vraies affiches et de
// vrais décors (sceneMedia), les vrais mots de l'app. La mini-carte, « Qui
// regarde ? », le menu de l'avatar, la galerie, l'encart « Vous regardez
// encore ? », les fenêtres du code PIN, la cloche, la fiche des droits d'un compte
// et le contrôle parental d'un invité y sont RECOPIÉS (balisage), jamais importés :
// leurs dossiers (`components/cards/preview`, `profiles`, `components/admin`,
// `components/parental`) ne sont pas compilés par le client LG, où l'écran des
// nouveautés entre.
export { TrailerPreviewScene } from "./TrailerPreviewScene";
export { WhoIsWatchingScene } from "./WhoIsWatchingScene";
export { FamilyPinScene } from "./FamilyPinScene";
export { StillWatchingScene } from "./StillWatchingScene";
export { AvatarsScene } from "./AvatarsScene";
export { NotificationsScene } from "./NotificationsScene";
export { GuestParentalScene } from "./GuestParentalScene";
export { UserRightsScene } from "./UserRightsScene";
export { HeroSourceScene } from "./HeroSourceScene";
