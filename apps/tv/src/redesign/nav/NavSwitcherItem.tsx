import { memo, useCallback } from "react";
import { colors } from "../theme/tokens";
import { NavItem } from "./NavItem";
import type { NavSwitcher } from "./NavRail";
import { ProfileStack } from "./ProfileStack";

/** Le liseré de l'empilement des profils, sur le verre du rail. */
const STACK_RING = "rgba(16, 16, 22, 0.95)";

/**
 * « Changer de profil » (Famille) : une entrée du bloc du profil, juste
 * au-dessus de lui, dont le pictogramme empile les profils de la famille
 * (`ProfileStack`). Jamais la page courante : elle mène à « Qui regarde ? ».
 */
export const NavSwitcherItem = memo(function NavSwitcherItem({ switcher, onSelect, onLongPress, onFocusChange }: {
  switcher: NavSwitcher;
  onSelect?: (key: string) => void;
  onLongPress?: (key: string) => void;
  onFocusChange?: (key: string, focused: boolean) => void;
}) {
  const { profiles } = switcher;
  // Le liseré des ronds : la pilule blanche au focus (texte noir), le verre sombre au repos.
  const glyph = useCallback(
    (color: string) => <ProfileStack profiles={profiles} color={color} ring={color === colors.ctaFg ? colors.ctaBg : STACK_RING} />,
    [profiles],
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
