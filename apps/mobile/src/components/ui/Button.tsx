import type { ViewStyle } from "react-native";

import { PlainButton, PrimaryButton, SecondaryButton } from "./buttons";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

/**
 * @deprecated Ancien bouton à variantes — passe désormais par le système de
 * boutons (`./buttons`). Pour un nouvel écran, prendre directement
 * `PrimaryButton`, `SecondaryButton` ou `PlainButton`.
 *
 * Correspondance : `primary` → `PrimaryButton` `contrast` (la pilule
 * blanche d'avant, sans son ombre : le dégradé ne se donne qu'explicitement) ;
 * `secondary` → `SecondaryButton` (neutre) ; `ghost` → `PlainButton` (texte
 * seul) ; `danger` → `SecondaryButton` au libellé rouge (plus de pavé rouge).
 */
export function Button({ title, variant = "primary", ...rest }: Props) {
  const props = { ...rest, label: title };
  switch (variant) {
    case "primary":
      return <PrimaryButton {...props} tone="contrast" />;
    case "danger":
      return <SecondaryButton {...props} tone="destructive" />;
    case "ghost":
      return <PlainButton {...props} />;
    default:
      return <SecondaryButton {...props} />;
  }
}
