import { lazy } from "react";

/**
 * Pages chargees a la demande.
 *
 * Extraites de `App.tsx` : la refonte de l'admin et des reglages en
 * maitre-detail y a ajoute des routes imbriquees, ce qui poussait le fichier
 * au-dela de la limite de 300 lignes du projet. Le routeur garde la structure,
 * ce module garde la liste — chacun sa responsabilite.
 */

export const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
export const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
export const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));
export const SharedListView = lazy(() => import("./pages/SharedListView").then((m) => ({ default: m.SharedListView })));
export const SharedItemDetail = lazy(() => import("./pages/SharedItemDetail").then((m) => ({ default: m.SharedItemDetail })));
export const Watch = lazy(() => import("./pages/Watch").then((m) => ({ default: m.Watch })));
export const MediaDetail = lazy(() => import("./pages/MediaDetail").then((m) => ({ default: m.MediaDetail })));
export const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));

export const Support = lazy(() => import("./pages/Support").then((m) => ({ default: m.Support })));
export const AdminLayout = lazy(() => import("./components/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
export const AdminInvites = lazy(() => import("./pages/AdminInvites").then((m) => ({ default: m.AdminInvites })));
export const Preferences = lazy(() => import("./pages/Preferences").then((m) => ({ default: m.Preferences })));
export const SettingsLayout = lazy(() => import("./components/settings/SettingsLayout").then((m) => ({ default: m.SettingsLayout })));
export const SettingsIndex = lazy(() => import("./components/settings/SettingsLayout").then((m) => ({ default: m.SettingsIndex })));
export const SettingsAppearance = lazy(() => import("./pages/settings/SettingsAppearance").then((m) => ({ default: m.SettingsAppearance })));
export const SettingsSecurity = lazy(() => import("./pages/settings/SettingsSecurity").then((m) => ({ default: m.SettingsSecurity })));
export const About = lazy(() => import("./pages/About").then((m) => ({ default: m.About })));
export const Credits = lazy(() => import("./pages/Credits").then((m) => ({ default: m.Credits })));
export const PairDevice = lazy(() => import("./pages/PairDevice").then((m) => ({ default: m.PairDevice })));
export const AdminPlugins = lazy(() => import("./pages/AdminPlugins").then((m) => ({ default: m.AdminPlugins })));
export const AdminUsers = lazy(() => import("./pages/AdminUsers").then((m) => ({ default: m.AdminUsers })));
export const AdminDownloads = lazy(() => import("./pages/AdminDownloads").then((m) => ({ default: m.AdminDownloads })));
export const AdminTicketsPage = lazy(() => import("./pages/AdminTicketsPage").then((m) => ({ default: m.AdminTicketsPage })));
export const AdminServicesPage = lazy(() => import("./pages/AdminServicesPage").then((m) => ({ default: m.AdminServicesPage })));
export const AdminTheme = lazy(() => import("./pages/AdminTheme").then((m) => ({ default: m.AdminTheme })));
export const AdminThemeTokens = lazy(() => import("./pages/AdminThemeTokens").then((m) => ({ default: m.AdminThemeTokens })));
export const AdminThemeReference = lazy(() => import("./pages/AdminThemeReference").then((m) => ({ default: m.AdminThemeReference })));
export const Watchlist = lazy(() => import("./pages/Watchlist").then((m) => ({ default: m.Watchlist })));
export const Favorites = lazy(() => import("./pages/Favorites").then((m) => ({ default: m.Favorites })));
export const DownloadsPage = lazy(() => import("./downloads/DownloadsPage").then((m) => ({ default: m.DownloadsPage })));
export const OfflineCatalog = lazy(() => import("./downloads/OfflineCatalog").then((m) => ({ default: m.OfflineCatalog })));
export const OfflineSeriesView = lazy(() => import("./downloads/OfflineSeriesView").then((m) => ({ default: m.OfflineSeriesView })));
export const SettingsDownloads = lazy(() => import("./pages/settings/SettingsDownloads").then((m) => ({ default: m.SettingsDownloads })));
export const SettingsData = lazy(() => import("./pages/settings/SettingsData").then((m) => ({ default: m.SettingsData })));
export const MobileProfile = lazy(() => import("./pages/MobileProfile").then((m) => ({ default: m.MobileProfile })));
export const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));
