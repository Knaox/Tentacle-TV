/**
 * Définitions partagées entre UserAvatarMenu (dropdown desktop) et
 * MobileUserSheet (bottom sheet mobile). Source unique de vérité pour la liste
 * des actions du menu utilisateur, l'état admin/Tauri, et l'avatar.
 */

import type { ReactNode } from "react";
import { AdminIcon, CreditsIcon, HelpIcon, InfoIcon, LogoutIcon, PairIcon, SettingsIcon } from "./icons";

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
  const { t, isAdmin, navigate, handleLogout, extended } = opts;
  const items: UserMenuItem[] = [
    { key: "settings", label: t("preferences"), icon: <SettingsIcon />, action: () => navigate("/settings") },
  ];
  if (isAdmin) {
    items.push({ key: "admin", label: t("admin"), icon: <AdminIcon />, action: () => navigate("/admin") });
  }
  items.push({ key: "pair", label: t("pairDevice"), icon: <PairIcon />, action: () => navigate("/pair-device") });
  items.push({ key: "about", label: t("about"), icon: <InfoIcon />, action: () => navigate("/about") });
  items.push({ key: "help", label: t("help"), icon: <HelpIcon />, action: () => navigate("/support") });
  if (extended) {
    items.push({ key: "credits", label: t("credits"), icon: <CreditsIcon />, action: () => navigate("/credits") });
  }
  items.push({ key: "logout", label: t("logout"), icon: <LogoutIcon />, action: handleLogout, danger: true });
  return items;
}

/** CSS gradient utilisé pour l'avatar — réutilisé par TopNavMobile, MobileTabBar et MobileUserSheet. */
export const AVATAR_GRADIENT_BG = "linear-gradient(135deg, var(--brand-dark), var(--brand))";
export const AVATAR_RING_STYLE = {
  background: AVATAR_GRADIENT_BG,
  border: "2px solid rgba(139,92,246,0.32)",
  boxShadow: "0 2px 12px rgba(139,92,246,0.35)",
} as const;
