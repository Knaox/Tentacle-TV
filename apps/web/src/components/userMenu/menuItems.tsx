/**
 * Définitions partagées entre UserAvatarMenu (dropdown desktop) et
 * MobileUserSheet (bottom sheet mobile). Source unique de vérité pour les
 * entrées du menu utilisateur, leurs FAMILLES (`buildUserMenuGroups`), l'état
 * admin et l'avatar.
 */

import type { CSSProperties, ReactNode } from "react";
import { profileColorStops, type FamilyProfileColor } from "@tentacle-tv/shared";
import { profileGradient } from "../../family/profileColors";
import { AdminIcon, CreditsIcon, HelpIcon, InfoIcon, LogoutIcon, OfflineIcon, OnDeviceIcon, PairIcon, SettingsIcon, StatsIcon } from "./icons";

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
   * Le catalogue local est-il atteignable ? Il l'est EN LIGNE aussi : ce qui
   * est sur la machine s'y trouve encore quand le serveur répond, et le mobile
   * l'ouvre depuis son profil depuis toujours. Sans cette entrée, la seule
   * façon de le voir était d'attendre une coupure.
   */
  onDevice?: boolean;
  /**
   * Mode hors ligne actif : les entrées que le routeur refuse sont retirées.
   *
   * Proposer une destination qui renvoie aussitôt à l'accueil est pire que ne
   * rien proposer — l'utilisateur croit à une panne. La liste ci-dessous suit
   * EXACTEMENT les routes marquées `onlineOnly` dans `App.tsx` : statistiques,
   * administration, jumelage et aide. Préférences, à propos et crédits restent
   * atteignables.
   */
  offline?: boolean;
  /**
   * Bureau : la session d'un PROFIL de la famille (`auth/profileSession.ts`).
   * Elle regarde et n'administre rien : ni jumelage, ni contenu gardé sur la
   * machine (le serveur les refuse à une session de profil), ni déconnexion du
   * compte — on revient d'abord à son propre profil, comme sur une TV. Un
   * INVITÉ n'a pas non plus l'Aide (ses tickets lui sont refusés).
   */
  profileSession?: { guest: boolean } | null;
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
 * Les familles du menu, dans l'ordre où elles s'affichent. Chacune est
 * séparée de la suivante par un filet ; une famille vide n'est pas rendue.
 *
 * - `account` — MOI : mes statistiques, mes paramètres, l'administration
 *   (un rôle du compte, à côté de ses réglages) ;
 * - `device` — CET APPAREIL : ce qu'il garde, le passage hors ligne, le
 *   jumelage d'une TV ;
 * - `support` — l'aide, à propos (et les crédits sur la feuille) : le
 *   secondaire, en pied de menu ;
 * - `session` — la déconnexion, seule, à part et en dernier.
 *
 * Le menu s'ouvrait sur dix entrées à plat (revue du 15/10) : des familles
 * courtes, séparées, se lisent d'un coup d'œil (Apple HIG : regrouper ce qui
 * va ensemble ; NN/g : un menu court ; la déconnexion à part, en dernier).
 */
export type UserMenuGroupKey = "account" | "device" | "support" | "session";

export interface UserMenuGroup {
  key: UserMenuGroupKey;
  items: UserMenuItem[];
}

export const USER_MENU_GROUP_ORDER: readonly UserMenuGroupKey[] = ["account", "device", "support", "session"];

/**
 * Les familles du menu (voir plus haut), sans les familles vides. La session
 * d'un PROFIL tait ce que le serveur lui refuse (`profileSessionRefusals`).
 */
export function buildUserMenuGroups(opts: BuildItemsOptions): UserMenuGroup[] {
  const refused = opts.profileSession ? profileSessionRefusals(opts.profileSession) : null;
  const all = buildAllGroups(opts);
  return USER_MENU_GROUP_ORDER
    .map((key) => ({ key, items: all[key].filter((item) => !refused?.has(item.key)) }))
    .filter((group) => group.items.length > 0);
}

/** Les entrées du menu à plat, dans l'ordre des familles. */
export function buildUserMenuItems(opts: BuildItemsOptions): UserMenuItem[] {
  return buildUserMenuGroups(opts).flatMap((group) => group.items);
}

/**
 * Les entrées de profils que le MENU garde : « Changer de profil » seul, sous
 * l'en-tête d'identité. « Gérer les profils » n'y est plus — il est sur
 * l'écran « Qui regarde ? » que « Changer de profil » ouvre (le modèle de
 * Netflix), et dans Paramètres › Famille ; la page Profil d'une fenêtre
 * étroite (`ProfileLinks`) le garde, elle.
 */
export function menuProfileItems(items: readonly UserMenuItem[]): UserMenuItem[] {
  return items.filter((item) => item.key === "switchProfile");
}

/**
 * Les entrées qu'une session de PROFIL tait (voir `profileSession` plus haut) —
 * la règle du menu de l'avatar, de la feuille mobile et de la page Profil
 * d'une fenêtre étroite (`ProfileLinks`), par leurs clés.
 */
export function profileSessionRefusals(profile: { guest: boolean }): ReadonlySet<string> {
  return new Set(["admin", "pair", "onDevice", "goOffline", "logout", ...(profile.guest ? ["help"] : [])]);
}

function buildAllGroups(opts: BuildItemsOptions): Record<UserMenuGroupKey, UserMenuItem[]> {
  const { t, isAdmin, navigate, handleLogout, extended, goOffline, offline, onDevice } = opts;
  const account: UserMenuItem[] = [];
  const device: UserMenuItem[] = [];
  const support: UserMenuItem[] = [];
  // Les statistiques ouvrent le menu : la seule entrée qui parle de l'utilisateur plutôt que de l'application.
  if (!offline) account.push({ key: "stats", label: t("stats"), icon: <StatsIcon />, action: () => navigate("/stats") });
  account.push({ key: "settings", label: t("preferences"), icon: <SettingsIcon />, action: () => navigate("/settings") });
  if (isAdmin && !offline) account.push({ key: "admin", label: t("admin"), icon: <AdminIcon />, action: () => navigate("/admin") });

  // Hors ligne, la barre porte déjà les destinations locales (`OfflineNavLinks`) :
  // « Sur cet appareil » n'a de sens qu'EN LIGNE, où rien d'autre n'y mène.
  if (onDevice && !offline) device.push({ key: "onDevice", label: t("onDevice"), icon: <OnDeviceIcon />, action: () => navigate("/on-device") });
  if (goOffline) device.push({ key: "goOffline", label: t("goOffline"), icon: <OfflineIcon />, action: goOffline });
  if (!offline) device.push({ key: "pair", label: t("pairDevice"), icon: <PairIcon />, action: () => navigate("/pair-device") });

  if (!offline) support.push({ key: "help", label: t("help"), icon: <HelpIcon />, action: () => navigate("/support") });
  support.push({ key: "about", label: t("about"), icon: <InfoIcon />, action: () => navigate("/about") });
  if (extended) support.push({ key: "credits", label: t("credits"), icon: <CreditsIcon />, action: () => navigate("/credits") });

  const session: UserMenuItem[] = [
    { key: "logout", label: t("logout"), icon: <LogoutIcon />, action: handleLogout, danger: true },
  ];
  return { account, device, support, session };
}

/** Le dégradé de marque du rond du compte (hors famille) — repris par `avatarBackgroundFor`, `avatarRingStyleFor` et le miroir. */
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

/**
 * Le fond du rond du compte à la couleur de son PROFIL de la Famille (bureau,
 * `profiles/face/useAccountFaceColor.ts`) — celle de « Qui regarde ? » ; null :
 * le dégradé de marque, comme avant.
 */
export function avatarBackgroundFor(color: FamilyProfileColor | null): string {
  return color ? profileGradient(color) : AVATAR_GRADIENT_BG;
}

/** L'habillage du rond (fond et halo) à la couleur du profil ; null : `AVATAR_RING_STYLE`. */
export function avatarRingStyleFor(color: FamilyProfileColor | null): CSSProperties {
  if (!color) return AVATAR_RING_STYLE;
  // Le halo de la marque (0,35 d'opacité), dans la teinte sombre du profil : 0x59 ≈ 0,35.
  return { background: avatarBackgroundFor(color), boxShadow: `0 2px 12px ${profileColorStops(color)[0]}59` };
}
