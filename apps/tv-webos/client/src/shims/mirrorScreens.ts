/**
 * Les écrans du miroir de l'app mobile, absents.
 *
 * Sur le web, `ByFormFactor` choisit à l'exécution entre la page du bureau et
 * l'écran du miroir (téléphone, iPad). Un téléviseur n'est jamais tactile et
 * sa largeur dépasse le seuil du téléphone : `resolveFormFactor` y rend
 * toujours « desktop », et ces écrans ne s'affichent jamais. Mais l'aiguillage
 * étant dynamique, le bundler les compilait quand même — avec des primitives
 * CSS que Chrome 53 ignore (`clamp()`, `color-mix()`), que les gardes du
 * socle refusent à juste titre. Les sortir du graphe coûte ce module inerte.
 */

function Absent(): null {
  return null;
}

export const MirrorSearch = Absent;
export const MirrorMediaDetail = Absent;
export const MirrorPerson = Absent;
export const MirrorLibraries = Absent;
export const MirrorLibraryCatalog = Absent;
export const MirrorWatchlist = Absent;
export const MirrorFavorites = Absent;
export const MirrorProfile = Absent;
export const MirrorSettingsPane = Absent;
export const MirrorAbout = Absent;
export const MirrorCredits = Absent;
export const MirrorSupport = Absent;
export const MirrorPairDevice = Absent;
export const MirrorLogin = Absent;
export const MirrorRegister = Absent;
export const MirrorHome = Absent;
export const MirrorForYou = Absent;
