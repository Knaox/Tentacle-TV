import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from "react-native";
import { keyboardAvoidanceBehavior } from "./keyboardAvoidance";

interface KeyboardAvoidingAreaProps {
  children: ReactNode;
  /** Défaut : `{ flex: 1 }`. */
  style?: StyleProp<ViewStyle>;
  /**
   * Éviter aussi le clavier sur iOS (défaut : oui). `false` pour un écran qui
   * ne le faisait pas sur iOS : il y reste tel quel, Android seul change.
   */
  ios?: boolean;
}

/**
 * LE conteneur des écrans de saisie du mobile : il se replie au-dessus du
 * clavier, et le `ScrollView` qu'il contient ramène le champ actif en vue
 * (Android le fait de lui-même quand sa hauteur change). Tout écran ou
 * feuille avec un champ passe par lui — jamais un `KeyboardAvoidingView`
 * réglé à la main, qui oublierait le bord à bord d'Android
 * (`keyboardAvoidance.ts`).
 */
export function KeyboardAvoidingArea({ children, style, ios = true }: KeyboardAvoidingAreaProps) {
  return (
    <KeyboardAvoidingView style={style ?? FILL} behavior={keyboardAvoidanceBehavior(Platform.OS, ios)}>
      {children}
    </KeyboardAvoidingView>
  );
}

const FILL: ViewStyle = { flex: 1 };
