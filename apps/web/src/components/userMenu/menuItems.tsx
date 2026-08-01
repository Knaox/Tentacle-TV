/**
 * Définitions partagées entre UserAvatarMenu (dropdown desktop) et
 * MobileUserSheet (bottom sheet mobile). Source unique de vérité pour la liste
 * des actions du menu utilisateur, l'état admin/Tauri, et l'avatar.
 */

import type { ReactNode } from "react";
import { AdminIcon, CreditsIcon, HelpIcon, InfoIcon, LogoutIcon, OfflineIcon, PairIcon, SettingsIcon } from "./icons";

export interface UserInfo {
  name: string;
  initial: string;
  isAdmin: boolean;
}

export interface UserMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  action: () => void;
  danger?: boolean;
}

interface BuildItemsOptions {
  t: (key: string) => string;
  isAdmin: boolean;
  isTauri?: boolean;
  navigate: (path: string) => void;
  handleLogout: () => void;
  /** When true, include extra entries that are only relevant on mobile (Credits). */
  extended?: boolean;
  /** Bascule manuelle en mode hors ligne (desktop Tauri, uniquement en ligne). */
  goOffline?: () => void;
  /**
   * Mode hors ligne actif : les entrées que le routeur refuse sont retirées.
   *
   * Proposer une destination qui renvoie aussitôt à l'accueil est pire que ne
   * rien proposer — l'utilisateur croit à une panne. La liste ci-dessous suit
   * EXACTEMENT les routes marquées `onlineOnly` dans `App.tsx` : administration,
   * jumelage et aide. Préférences, à propos et crédits restent atteignables.
   */
  offline?: boolean;
}

export function getUserInfo(): UserInfo {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return { name: "", initial: "?", isAdmin: false };
    const user = JSON.parse(raw);
    const name: string = user?.Name ?? "";
    const initial = (name || "?").charAt(0).toUpperCase() || "?";
    const isAdmin = user?.Policy?.IsAdministrator === true;
    return { name, initial, isAdmin };
  } catch {
    return { name: "", initial: "?", isAdmin: false };
  }
}

/**
 * Ordre canonique : Préférences → Admin (si admin) → Jumeler → À propos →
 * Aide → Crédits (mobile uniquement) → séparateur → Déconnexion.
 */
export function buildUserMenuItems(opts: BuildItemsOptions): UserMenuItem[] {
  const { t, isAdmin, navigate, handleLogout, extended, goOffline, offline } = opts;
  const items: UserMenuItem[] = [
    { key: "settings", label: t("preferences"), icon: <SettingsIcon />, action: () => navigate("/settings") },
  ];
  if (isAdmin && !offline) {
    items.push({ key: "admin", label: t("admin"), icon: <AdminIcon />, action: () => navigate("/admin") });
  }
  if (!offline) {
    items.push({ key: "pair", label: t("pairDevice"), icon: <PairIcon />, action: () => navigate("/pair-device") });
  }
  items.push({ key: "about", label: t("about"), icon: <InfoIcon />, action: () => navigate("/about") });
  if (!offline) {
    items.push({ key: "help", label: t("help"), icon: <HelpIcon />, action: () => navigate("/support") });
  }
  if (extended) {
    items.push({ key: "credits", label: t("credits"), icon: <CreditsIcon />, action: () => navigate("/credits") });
  }
  if (goOffline) {
    items.push({ key: "goOffline", label: t("goOffline"), icon: <OfflineIcon />, action: goOffline });
  }
  items.push({ key: "logout", label: t("logout"), icon: <LogoutIcon />, action: handleLogout, danger: true });
  return items;
}

/** CSS gradient utilisé pour l'avatar — réutilisé par TopNavMobile, MobileTabBar et MobileUserSheet. */
export const AVATAR_GRADIENT_BG = "linear-gradient(135deg, var(--brand-dark), var(--brand))";
/**
 * Habillage de la photo de profil. PLUS de bordure : le liseré de 2 px rognait
 * la photo d'autant sur un disque de 36 px, et se lisait comme un cadre posé
 * dessus plutôt que comme une mise en valeur. Le dégradé de marque subsiste — il
 * sert de fond quand il n'y a pas de photo, sous l'initiale — et le halo aussi,
 * qui détache le disque sans mordre sur l'image.
 */
export const AVATAR_RING_STYLE = {
  background: AVATAR_GRADIENT_BG,
  boxShadow: "0 2px 12px rgba(var(--brand-rgb), 0.35)",
} as const;
