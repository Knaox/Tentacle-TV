import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { InfoIcon, SettingsIcon, StatsIcon } from "../../../components/userMenu/icons";
import { Place, type Animated } from "../Place";
import { sceneTween } from "../sceneMotion";
import { MENU, MENU_HEADER_H, MenuPanel, MenuRow } from "./fauxMenuParts";

/** La photo de l'en-tête (44 px dans l'app, 36 ici) — la cible du pointeur. */
const PHOTO = 36;
export const ACCOUNT_PHOTO = { x: MENU.x + 12 + PHOTO / 2, y: MENU.y + MENU_HEADER_H / 2 } as const;

interface FauxAccountMenuProps extends Animated {
  name: string;
  /** Le pointeur est sur la photo : le voile et l'appareil photo de l'app. */
  photoHover: boolean;
}

/** Le dégradé de marque du rond d'un compte sans photo (`AVATAR_GRADIENT_BG`). */
export const ACCOUNT_GRADIENT = "linear-gradient(135deg, var(--brand-dark), var(--brand))";

/**
 * Le menu de l'avatar de la session PERSONNELLE, en faux, au balisage de
 * `UserAvatarMenu` › `AccountHeader` : la photo du compte (son initiale tant
 * qu'il n'en a pas), cliquable — au survol, le voile et l'appareil photo —,
 * son nom et « Changer la photo de profil » ; puis le menu.
 */
export function FauxAccountMenu({ name, photoHover, ...animated }: FauxAccountMenuProps) {
  const { t } = useTranslation(["profile", "nav"]);
  return (
    <MenuPanel {...animated}>
      <div className="flex items-center gap-2.5 border-b border-line-subtle px-3" style={{ height: MENU_HEADER_H }}>
        <span
          className="relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-bold text-cta-brand-fg"
          style={{ width: PHOTO, height: PHOTO, background: ACCOUNT_GRADIENT }}
        >
          {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
          {/* Le voile s'allume quand le pointeur ARRIVE sur la photo, pas à son départ. */}
          <Place
            x={0} y={0} w={PHOTO} h={PHOTO} visible={photoHover} className="flex items-center justify-center rounded-full bg-black/55 text-white"
            transition={photoHover ? { ...sceneTween, delay: 0.4 } : sceneTween}
          >
            <Camera size={14} aria-hidden />
          </Place>
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-content-primary">{name}</p>
          <p className="truncate text-[10px] text-content-quaternary">{t("profile:changePhoto")}</p>
        </div>
      </div>
      <div className="py-1.5">
        <MenuRow icon={<StatsIcon className="h-[15px] w-[15px]" />} label={t("nav:stats")} />
        <MenuRow icon={<SettingsIcon className="h-[15px] w-[15px]" />} label={t("nav:preferences")} />
        <MenuRow icon={<InfoIcon className="h-[15px] w-[15px]" />} label={t("nav:about")} />
      </div>
    </MenuPanel>
  );
}
