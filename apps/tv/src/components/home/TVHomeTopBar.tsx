import { forwardRef } from "react";
import { View } from "react-native";
import type { View as RNView } from "react-native";
import { Focusable } from "../focus/Focusable";
import { MenuIcon, SearchIcon } from "../icons/TVIcons";
import { Colors } from "../../theme/colors";

interface TVHomeTopBarProps {
  onMenuPress: () => void;
  onSearchPress: () => void;
  /** When true, the top bar can't steal focus (sidebar is open). */
  disabled?: boolean;
}

/**
 * Floating top-bar with menu (left) and search (right) buttons.
 * Extracted from HomeScreen to keep the screen file lean.
 */
export const TVHomeTopBar = forwardRef<RNView, TVHomeTopBarProps>(function TVHomeTopBar(
  { onMenuPress, onSearchPress, disabled = false },
  ref,
) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 16,
        marginBottom: -64,
        zIndex: 50,
      }}
      pointerEvents={disabled ? "none" : "auto"}
    >
      <Focusable ref={ref} variant="button" onPress={onMenuPress}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "rgba(15, 15, 24, 0.8)",
            borderWidth: 1,
            borderColor: Colors.glassBorder,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <MenuIcon size={20} color={Colors.accentPurpleLight} />
        </View>
      </Focusable>

      <Focusable variant="button" onPress={onSearchPress}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "rgba(15, 15, 24, 0.8)",
            borderWidth: 1,
            borderColor: Colors.glassBorder,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <SearchIcon size={20} color={Colors.accentPurpleLight} />
        </View>
      </Focusable>
    </View>
  );
});
