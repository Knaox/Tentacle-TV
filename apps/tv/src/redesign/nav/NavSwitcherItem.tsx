import { memo, useCallback } from "react";
import { colors } from "../theme/tokens";
import { NavItem } from "./NavItem";
import type { NavSwitcher } from "./NavRail";
import { ProfileSwitcherGlyph } from "./ProfileSwitcherGlyph";

/** Le verre sombre du rail, sous l'entrée au repos : le liseré de la pastille. */
const GLASS_RING = "rgba(16, 16, 22, 0.95)";

/**
 * « Changer de profil » (Famille) : une entrée du bloc du profil, juste
 * au-dessus des réglages, dont le pictogramme est la photo du profil connecté
 * et une pastille « +N » pour les autres profils de la TV
 * (`ProfileSwitcherGlyph`). Jamais la page courante : elle mène à « Qui
 * regarde ? ».
 */
export const NavSwitcherItem = memo(function NavSwitcherItem({ switcher, onSelect, onLongPress, onFocusChange }: {
  switcher: NavSwitcher;
  onSelect?: (key: string) => void;
  onLongPress?: (key: string) => void;
  onFocusChange?: (key: string, focused: boolean) => void;
}) {
  const { current, badge } = switcher;
  // Au focus, l'entrée devient la pilule blanche au texte noir (`NavItem`).
  const glyph = useCallback(
    (color: string) => {
      const focused = color === colors.ctaFg;
      return <ProfileSwitcherGlyph current={current} badge={badge} color={color} ring={focused ? colors.ctaBg : GLASS_RING} focused={focused} />;
    },
    [current, badge],
  );
  return (
    <NavItem
      itemKey={switcher.key}
      label={switcher.label}
      glyph={glyph}
      active={false}
      onSelect={onSelect}
      onLongPress={onLongPress}
      onFocusChange={onFocusChange}
    />
  );
});
