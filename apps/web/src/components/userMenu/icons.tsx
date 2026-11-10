/**
 * Icônes partagées entre UserAvatarMenu (dropdown desktop) et MobileUserSheet
 * (bottom sheet mobile). Taille 18 px par défaut.
 */

import type { IconProps } from "@phosphor-icons/react";
import { ChartBarIcon } from "@phosphor-icons/react/dist/csr/ChartBar";
import { DevicesIcon } from "@phosphor-icons/react/dist/csr/Devices";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { InfoIcon as InfoBase } from "@phosphor-icons/react/dist/csr/Info";
import { MonitorIcon } from "@phosphor-icons/react/dist/csr/Monitor";
import { QuestionIcon } from "@phosphor-icons/react/dist/csr/Question";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { UserGearIcon } from "@phosphor-icons/react/dist/csr/UserGear";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";

// Les pictogrammes du menu du compte — les NOMS d'avant, dessinés par Phosphor (refonte de
// nov. 2026, docs/REFONTE-UI.md) : au trait, 18 px, `currentColor`.
const SIZE = "h-[18px] w-[18px]";

export function SettingsIcon(props: IconProps) {
  return <SlidersHorizontalIcon aria-hidden className={SIZE} {...props} />;
}

export function AdminIcon(props: IconProps) {
  return <ShieldCheckIcon aria-hidden className={SIZE} {...props} />;
}

export function PairIcon(props: IconProps) {
  return <DevicesIcon aria-hidden className={SIZE} {...props} />;
}

export function InfoIcon(props: IconProps) {
  return <InfoBase aria-hidden className={SIZE} {...props} />;
}

export function HelpIcon(props: IconProps) {
  return <QuestionIcon aria-hidden className={SIZE} {...props} />;
}

export function LogoutIcon(props: IconProps) {
  return <SignOutIcon aria-hidden className={SIZE} {...props} />;
}

export function OfflineIcon(props: IconProps) {
  return <WifiSlashIcon aria-hidden className={SIZE} {...props} />;
}

export function OnDeviceIcon(props: IconProps) {
  return <DownloadSimpleIcon aria-hidden className={SIZE} {...props} />;
}

export function CreditsIcon(props: IconProps) {
  return <MonitorIcon aria-hidden className={SIZE} {...props} />;
}

export function StatsIcon(props: IconProps) {
  return <ChartBarIcon aria-hidden className={SIZE} {...props} />;
}

export function SwitchProfileIcon() {
  return <UsersThreeIcon aria-hidden className={SIZE} />;
}

export function ManageProfilesIcon() {
  return <UserGearIcon aria-hidden className={SIZE} />;
}
