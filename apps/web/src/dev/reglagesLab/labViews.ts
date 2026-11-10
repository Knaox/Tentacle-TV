/**
 * Les VUES du labo : une par écran (ou par état d'écran) de l'axe « réglages et
 * administration ». `?vue=<id>` en ouvre une ; le banc de capture les parcourt toutes.
 */

export interface LabView {
  id: string;
  /** Le nom lu dans l'index du labo. */
  label: string;
  group: "Réglages" | "Administration" | "Compte et profils" | "Installation et aide";
  /** L'adresse ouverte dans le routeur du monde. */
  path: string;
  /** L'état du faux serveur (`labFixtures` › `routesFor`). */
  state?: "healthy" | "broken" | "advice" | "empty";
  /** Une coquille de bureau simulée (le banc la pose avant le chargement : `?bureau=`). */
  desktop?: "linux" | "windows";
}

export const LAB_VIEWS: readonly LabView[] = [
  { id: "lecture", label: "Lecture", group: "Réglages", path: "/settings/playback" },
  { id: "lecture-personnalisee", label: "Lecture — réglages personnalisés", group: "Réglages", path: "/settings/playback" },
  { id: "lecture-bureau", label: "Lecture (bureau Linux)", group: "Réglages", path: "/settings/playback", desktop: "linux" },
  { id: "langues", label: "Langues et sous-titres", group: "Réglages", path: "/settings/languages" },
  { id: "telechargements", label: "Téléchargements (bureau)", group: "Réglages", path: "/settings/downloads", desktop: "linux" },
  { id: "apparence", label: "Apparence", group: "Réglages", path: "/settings/appearance" },
  { id: "accueil", label: "Accueil et découverte", group: "Réglages", path: "/settings/personalization" },
  { id: "famille", label: "Famille", group: "Réglages", path: "/settings/family" },
  { id: "compte", label: "Compte et sécurité", group: "Réglages", path: "/settings/security" },

  { id: "admin", label: "Vue d'ensemble — tout va bien", group: "Administration", path: "/admin", state: "healthy" },
  { id: "admin-a-regler", label: "Vue d'ensemble — deux « À régler »", group: "Administration", path: "/admin", state: "broken" },
  { id: "admin-recommandations", label: "Vue d'ensemble — recommandations", group: "Administration", path: "/admin", state: "advice" },
  { id: "admin-sessions", label: "Sessions", group: "Administration", path: "/admin/sessions" },
  { id: "admin-tickets", label: "Tickets", group: "Administration", path: "/admin/tickets" },
  { id: "admin-utilisateurs", label: "Utilisateurs", group: "Administration", path: "/admin/users" },
  { id: "admin-invitations", label: "Invitations", group: "Administration", path: "/admin/invites" },
  { id: "admin-famille", label: "Famille", group: "Administration", path: "/admin/family" },
  { id: "admin-telechargements", label: "Téléchargements", group: "Administration", path: "/admin/downloads" },
  { id: "admin-services", label: "Services", group: "Administration", path: "/admin/services" },
  { id: "admin-metadonnees", label: "Métadonnées", group: "Administration", path: "/admin/metadata" },
  { id: "admin-acces-distant", label: "Accès à distance", group: "Administration", path: "/admin/remote-access" },
  { id: "admin-extensions", label: "Extensions", group: "Administration", path: "/admin/plugins" },
  { id: "admin-systeme", label: "Système", group: "Administration", path: "/admin/system" },

  { id: "qui-regarde", label: "« Qui regarde ? »", group: "Compte et profils", path: "/lab/who" },
  { id: "connexion", label: "Connexion", group: "Compte et profils", path: "/login" },
  { id: "inscription", label: "Inscription", group: "Compte et profils", path: "/register?invite=LAB-INVITE" },
  { id: "jumelage", label: "Jumeler un appareil", group: "Compte et profils", path: "/pair-device" },

  { id: "assistant", label: "Assistant d'installation", group: "Installation et aide", path: "/lab/setup" },
  { id: "aide", label: "Aide", group: "Installation et aide", path: "/support" },
  { id: "aide-bandes-annonces", label: "Guide « Bandes-annonces »", group: "Installation et aide", path: "/help/trailers" },
  { id: "a-propos", label: "À propos", group: "Installation et aide", path: "/about" },
  { id: "credits", label: "Crédits", group: "Installation et aide", path: "/credits" },
];

export function labViewOf(id: string | null): LabView | null {
  return LAB_VIEWS.find((view) => view.id === id) ?? null;
}
