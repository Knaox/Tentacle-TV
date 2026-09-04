import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { preloadable } from "@/lib/preloadable";
import { UnavailableScreen } from "./unavailableScreen";
import { UnpairedScreen } from "../ui/screens/UnpairedScreen";
import { AccountScreenTv } from "../ui/settings/AccountScreenTv";
import { AboutScreenTv } from "../ui/settings/AboutScreenTv";
import { PlaybackScreenTv } from "../ui/settings/PlaybackScreenTv";

/**
 * Sécurité n'existe plus, mais son adresse reste déclarée dans `App.tsx` — et
 * `SettingsAppearance` y est encore la cible d'une redirection hors ligne. On
 * renvoie donc sur le Compte plutôt que d'y laisser un écran vide : une URL
 * déclarée doit mener quelque part.
 */
function AccountRedirect() {
  return <Navigate to="/settings/data" replace />;
}

/**
 * Les écrans que le téléviseur embarque, et ceux qu'il n'embarque pas.
 *
 * Substitué à `apps/web/src/lazyPages.ts`. C'est le seul endroit qui décide du
 * périmètre, et il agit là où ça compte : un écran absent d'ici n'est pas
 * caché, son code n'entre jamais dans le bundle. `App.tsx` n'est pas touché —
 * il déclare toujours les mêmes routes, mais celles qui sortent du périmètre
 * mènent à un écran d'explication.
 *
 * Ce qui reste : parcourir, chercher, ouvrir une fiche, lire, régler, appairer.
 * Ce qui part : administration, visionnage synchronisé, téléchargements et
 * mode hors ligne, partage, tickets, marché de plugins. Rien de tout cela n'a
 * de sens à trois mètres, avec une télécommande pour seule saisie.
 */

const Unavailable = UnavailableScreen;

/* -- Périmètre du téléviseur -- */

export const Home = lazy(() => import("@/pages/Home").then((m) => ({ default: m.Home })));
// Pas de connexion sur un téléviseur : l'authentification vient du jumelage,
// qui se fait dans la coquille. On n'y arrive que si le jeton a été révoqué.
export const Login = UnpairedScreen;
export const Register = UnpairedScreen;
export const Watch = lazy(() => import("@/pages/Watch").then((m) => ({ default: m.Watch })));
export const MediaDetail = lazy(() => import("@/pages/MediaDetail").then((m) => ({ default: m.MediaDetail })));
export const Library = lazy(() => import("@/pages/Library").then((m) => ({ default: m.Library })));
export const Watchlist = lazy(() => import("@/pages/Watchlist").then((m) => ({ default: m.Watchlist })));
export const Favorites = lazy(() => import("@/pages/Favorites").then((m) => ({ default: m.Favorites })));
export const PairDevice = lazy(() => import("@/pages/PairDevice").then((m) => ({ default: m.PairDevice })));
export const About = lazy(() => import("@/pages/About").then((m) => ({ default: m.About })));
export const Credits = lazy(() => import("@/pages/Credits").then((m) => ({ default: m.Credits })));
export const NotFound = lazy(() => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })));

export const SettingsLayout = lazy(() =>
  import("@/components/settings/SettingsLayout").then((m) => ({ default: m.SettingsLayout })));
export const SettingsIndex = lazy(() =>
  import("@/components/settings/SettingsLayout").then((m) => ({ default: m.SettingsIndex })));

/**
 * Les trois sections du téléviseur, et les adresses qu'elles occupent.
 *
 * `App.tsx` déclare cinq routes de réglages et ne bouge pas ; c'est ici qu'on
 * décide de ce qu'on met derrière. L'identifiant d'une section n'est affiché
 * nulle part sur une dalle, et deux de ces routes n'avaient plus d'écran à
 * montrer : on reprend leurs adresses plutôt que d'en ajouter à un fichier
 * partagé pour une cible sur neuf.
 *
 *   `/settings/data`       → Compte      (l'écran d'économie de données était
 *                                         de toute façon hors périmètre)
 *   `/settings/playback`   → Lecture     (sa vraie adresse, cf. plus bas)
 *   `/settings/appearance` → À propos    (l'apparence ne se règle plus)
 *   `/settings/security`   → renvoie sur Compte
 */
export const SettingsData = AccountScreenTv;
export const SettingsAppearance = AboutScreenTv;
export const SettingsSecurity = AccountRedirect;

/**
 * Lecture. Le contenu est celui de `pages/Preferences.tsx` — mêmes hooks,
 * même stockage serveur — mais sa mise en page suppose une souris : six
 * `<select>` natifs et un mode édition par bibliothèque. On la remplace, on ne
 * la masque pas : le graphe hors ligne qu'elle tirait avec elle n'entre pas
 * dans le bundle, et un téléviseur ne passe pas hors ligne, il s'éteint.
 */
export const Preferences = PlaybackScreenTv;

/* -- Hors périmètre : le code n'est pas compilé -- */

// Administration : gestion de serveur, à faire depuis un ordinateur.
export const AdminLayout = Unavailable;
export const AdminMetadata = Unavailable;
export const AdminInvites = Unavailable;
export const AdminPlugins = Unavailable;
export const AdminUsers = Unavailable;
export const AdminDownloads = Unavailable;
export const AdminTicketsPage = Unavailable;
export const AdminServicesPage = Unavailable;
export const AdminTheme = Unavailable;
export const AdminThemeTokens = Unavailable;
export const AdminThemeReference = Unavailable;

// Téléchargements et mode hors ligne : le stockage d'une dalle ne s'y prête pas.
export const DownloadsPage = Unavailable;
export const OfflineCatalog = Unavailable;
export const OfflineSeriesView = Unavailable;
export const SettingsDownloads = Unavailable;

// Partage et assistance : demandent une saisie de texte suivie.
export const SharedListView = Unavailable;
export const SharedItemDetail = Unavailable;
export const Support = Unavailable;

// Écrans pensés pour un téléphone.
export const MobileProfile = Unavailable;

// L'accueil se compose depuis un ordinateur ou un téléphone : le téléviseur
// LIT la mise en page du compte (rangées, ordre, recommandations), il ne la
// règle pas. La page Recommandations n'a pas de version télécommande — ses
// rangées vivent sur l'accueil ; `preloadable`, car le préchargement de
// session appelle `Recommendations.preload()` au démarrage.
export const SettingsPersonalization = Unavailable;
export const Recommendations = preloadable(async () => UnavailableScreen);
