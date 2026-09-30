import { memo, type ReactNode } from "react";
import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { useFocusBinding } from "./focusBinding";

/**
 * Un GROUPE d'éléments focalisables, nommé par sa clé : l'habillage du
 * lecteur, la pilule de saut, un panneau, une rangée. La vue dit seulement
 * « ceci forme un tout » ; l'intégration décide ce que cela veut dire pour le
 * focus — mémoriser le dernier élément, retenir le focus, le rediriger — en
 * liant la clé à un `container` (`focusBinding.tsx`).
 *
 * Non lié (au banc, ou tant que l'écran n'est pas branché), c'est une View
 * simple, aux mêmes style et `pointerEvents` : ni changement de rendu, ni
 * changement de mise en page. Les clés de groupe se documentent dans l'en-tête
 * des vues, comme celles des éléments.
 */

export interface FocusGroupProps {
  focusKey: string;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps["pointerEvents"];
  children?: ReactNode;
}

export const FocusGroup = memo(function FocusGroup({ focusKey, style, pointerEvents, children }: FocusGroupProps) {
  const Container = useFocusBinding(focusKey)?.container;
  if (Container) {
    return (
      <Container style={style} pointerEvents={pointerEvents}>
        {children}
      </Container>
    );
  }
  return (
    <View style={style} pointerEvents={pointerEvents}>
      {children}
    </View>
  );
});
