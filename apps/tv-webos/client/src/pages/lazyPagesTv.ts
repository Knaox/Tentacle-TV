import { lazy } from "react";
import { EcranIndisponible } from "./ecranIndisponible";

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

const Indisponible = EcranIndisponible;

/* -- Périmètre du téléviseur -- */

export const Home = lazy(() => import("@/pages/Home").then((m) => ({ default: m.Home })));
export const Login = lazy(() => import("@/pages/Login").then((m) => ({ default: m.Login })));
export const Register = lazy(() => import("@/pages/Register").then((m) => ({ default: m.Register })));
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
export const SettingsAppearance = lazy(() =>
  import("@/pages/settings/SettingsAppearance").then((m) => ({ default: m.SettingsAppearance })));
export const SettingsSecurity = lazy(() =>
  import("@/pages/settings/SettingsSecurity").then((m) => ({ default: m.SettingsSecurity })));

/* -- Hors périmètre : le code n'est pas compilé -- */

// Administration : gestion de serveur, à faire depuis un ordinateur.
export const AdminLayout = Indisponible;
export const AdminInvites = Indisponible;
export const AdminPlugins = Indisponible;
export const AdminUsers = Indisponible;
export const AdminDownloads = Indisponible;
export const AdminTicketsPage = Indisponible;
export const AdminServicesPage = Indisponible;
export const AdminTheme = Indisponible;
export const AdminThemeTokens = Indisponible;
export const AdminThemeReference = Indisponible;

// Téléchargements et mode hors ligne : le stockage d'une dalle ne s'y prête pas.
export const DownloadsPage = Indisponible;
export const OfflineCatalog = Indisponible;
export const OfflineSeriesView = Indisponible;
export const SettingsDownloads = Indisponible;
export const SettingsData = Indisponible;

// Partage et assistance : demandent une saisie de texte suivie.
export const SharedListView = Indisponible;
export const SharedItemDetail = Indisponible;
export const Support = Indisponible;

// Écrans pensés pour un téléphone.
export const MobileProfile = Indisponible;

// Ancienne page de préférences, déjà redirigée vers `/settings` par le routeur.
export const Preferences = Indisponible;
