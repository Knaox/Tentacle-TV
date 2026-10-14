import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { UsersRound } from "lucide-react";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { InfoIcon, SettingsIcon, StatsIcon } from "../../../components/userMenu/icons";
import { Place, type Animated } from "../Place";
import { sceneTween } from "../sceneMotion";
import type { SceneProfile } from "./FauxProfilePicker";

/** Le menu, accroché sous le rond du compte, aligné sur le bord droit de la capsule. */
export const MENU = { x: 412, y: 66, w: 216 } as const;
const HEADER_H = 58;
const ROW_H = 32;
/** Le voyage du pointeur (`cursorTravel`, 0,55 s), presque achevé. */
const HOVER_DELAY_S = 0.4;

/** Le centre de « Changer de profil », en px du canevas (la cible du pointeur). */
export const SWITCH_ROW = { x: MENU.x + 92, y: MENU.y + HEADER_H + 6 + ROW_H / 2 } as const;

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
 * jumelage, ni déconnexion). Fond plein du menu, sans flou (règle du kit).
 */
export function FauxAvatarMenu({ profile, hoverSwitch, ...animated }: FauxAvatarMenuProps) {
  const { t } = useTranslation(["profilePicker", "nav"]);
  return (
    // Au-dessus des cartes de l'accueil : leurs badges ont leur propre z-index.
    <Place x={MENU.x} y={MENU.y} w={MENU.w} style={{ transformOrigin: "top right", zIndex: 15 }} {...animated}>
      <div
        className="overflow-hidden"
        style={{
          background: "var(--surface-dropdown)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-dropdown)",
        }}
      >
        <div className="flex items-center gap-2.5 border-b border-line-subtle px-3" style={{ height: HEADER_H }}>
          <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={null} size={34} />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-content-primary">{profile.name}</p>
            <p className="text-[10px] text-content-quaternary">{t("profilePicker:session.memberBadge")}</p>
          </div>
        </div>
        <div className="border-b border-line-subtle py-1.5">
          <Row icon={<UsersRound size={15} strokeWidth={1.8} aria-hidden />} label={t("profilePicker:switcher.title")} hovered={hoverSwitch} />
        </div>
        <div className="py-1.5">
          <Row icon={<StatsIcon className="h-[15px] w-[15px]" />} label={t("nav:stats")} />
          <Row icon={<SettingsIcon className="h-[15px] w-[15px]" />} label={t("nav:preferences")} />
          <Row icon={<InfoIcon className="h-[15px] w-[15px]" />} label={t("nav:about")} />
        </div>
      </div>
    </Place>
  );
}

function Row({ icon, label, hovered = false }: { icon: ReactNode; label: string; hovered?: boolean }) {
  return (
    <div className={`relative flex items-center px-3 text-[12px] ${hovered ? "text-content-primary" : "text-content-secondary"}`} style={{ height: ROW_H }}>
      {/* Le survol s'allume quand le pointeur ARRIVE (après son voyage), pas à son départ. */}
      <motion.span
        className="absolute inset-0 bg-fill-subtle"
        initial={false}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={hovered ? { ...sceneTween, delay: HOVER_DELAY_S } : sceneTween}
      />
      <span className="relative mr-2.5 flex w-4 justify-center">{icon}</span>
      <span className="relative whitespace-nowrap">{label}</span>
    </div>
  );
}
