import { useTranslation } from "react-i18next";
import { UsersRound } from "lucide-react";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { InfoIcon, SettingsIcon, StatsIcon } from "../../../components/userMenu/icons";
import type { Animated } from "../Place";
import type { SceneProfile } from "./FauxProfilePicker";
import { MENU, MENU_HEADER_H, MENU_ROW_H, MenuPanel, MenuRow } from "./fauxMenuParts";

export { MENU } from "./fauxMenuParts";

/** Le centre de « Changer de profil », en px du canevas (la cible du pointeur). */
export const SWITCH_ROW = { x: MENU.x + 92, y: MENU.y + MENU_HEADER_H + 6 + MENU_ROW_H / 2 } as const;

interface FauxAvatarMenuProps extends Animated {
  profile: SceneProfile;
  /** Le pointeur est sur « Changer de profil ». */
  hoverSwitch: boolean;
}

/**
 * Le menu de l'avatar pendant la session d'un profil, en faux, au balisage de
 * `UserAvatarMenu` et `ProfileMenuHeader` : le rond du profil, son nom, ce
 * qu'il est ; « Changer de profil », qui ramène à « Qui regarde ? » ; puis
 * les entrées qu'une session de profil garde (ni administration, ni
 * jumelage, ni déconnexion).
 */
export function FauxAvatarMenu({ profile, hoverSwitch, ...animated }: FauxAvatarMenuProps) {
  const { t } = useTranslation(["profilePicker", "nav"]);
  return (
    <MenuPanel {...animated}>
      <div className="flex items-center gap-2.5 border-b border-line-subtle px-3" style={{ height: MENU_HEADER_H }}>
        <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={null} size={34} />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-content-primary">{profile.name}</p>
          <p className="text-[10px] text-content-quaternary">{t("profilePicker:session.memberBadge")}</p>
        </div>
      </div>
      <div className="border-b border-line-subtle py-1.5">
        <MenuRow icon={<UsersRound size={15} strokeWidth={1.8} aria-hidden />} label={t("profilePicker:switcher.title")} hovered={hoverSwitch} />
      </div>
      <div className="py-1.5">
        <MenuRow icon={<StatsIcon className="h-[15px] w-[15px]" />} label={t("nav:stats")} />
        <MenuRow icon={<SettingsIcon className="h-[15px] w-[15px]" />} label={t("nav:preferences")} />
        <MenuRow icon={<InfoIcon className="h-[15px] w-[15px]" />} label={t("nav:about")} />
      </div>
    </MenuPanel>
  );
}
