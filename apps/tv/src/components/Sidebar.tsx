import { useEffect, useCallback } from "react";
import { View, Text, Alert } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useLibraries } from "@tentacle/api-client";
import { useTranslation } from "react-i18next";
import { useSidebar } from "../context/SidebarContext";
import { Focusable } from "./focus/Focusable";
import { TentacleLogo } from "./icons/TentacleLogo";
import {
  HomeIcon, SearchIcon, LibraryIcon,
  SettingsIcon, InfoIcon, LogoutIcon,
  TVIcon, MusicIcon, BookIcon,
} from "./icons/TVIcons";
import { Colors, Spacing, Radius, Typography } from "../theme/colors";

interface SidebarProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  currentRoute?: string;
}

const ICON_SIZE = 22;
const ICON_COLOR = Colors.accentPurpleLight;
const ANIM_DURATION = 250;

function getLibraryIcon(collectionType?: string) {
  switch (collectionType?.toLowerCase()) {
    case "movies": return <LibraryIcon size={20} color={ICON_COLOR} />;
    case "tvshows": return <TVIcon size={20} color={ICON_COLOR} />;
    case "music": return <MusicIcon size={20} color={ICON_COLOR} />;
    case "books": return <BookIcon size={20} color={ICON_COLOR} />;
    default: return <LibraryIcon size={20} color={ICON_COLOR} />;
  }
}

export function Sidebar({ onNavigate, currentRoute }: SidebarProps) {
  const { t } = useTranslation("nav");
  const { isVisible, closeSidebar } = useSidebar();
  const { data: libraries } = useLibraries();

  const slideX = useSharedValue(-Spacing.sidebarWidth);
  const dimOpacity = useSharedValue(0);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    slideX.value = withTiming(isVisible ? 0 : -Spacing.sidebarWidth, { duration: ANIM_DURATION, easing });
    dimOpacity.value = withTiming(isVisible ? 1 : 0, { duration: ANIM_DURATION, easing });
  }, [isVisible, slideX, dimOpacity]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: dimOpacity.value,
  }));

  const handlePress = useCallback((key: string) => {
    if (key === "Logout") {
      Alert.alert(
        t("logoutConfirmTitle", { defaultValue: "Logout" }),
        t("logoutConfirmMessage", { defaultValue: "Are you sure you want to disconnect?" }),
        [
          { text: t("cancel", { defaultValue: "Cancel" }), style: "cancel" },
          { text: t("logout"), onPress: () => { closeSidebar(); onNavigate("Logout"); }, style: "destructive" },
        ],
      );
      return;
    }
    closeSidebar();
    onNavigate(key);
  }, [onNavigate, t, closeSidebar]);

  const isActive = (key: string) => currentRoute === key;

  const renderItem = (key: string, label: string, icon: React.ReactNode) => (
    <Focusable
      key={key}
      onPress={() => handlePress(key)}
      onBlur={() => {
        // If all sidebar items lose focus, close sidebar
      }}
    >
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: Radius.small,
        marginBottom: 2,
        backgroundColor: isActive(key) ? "rgba(139, 92, 246, 0.15)" : "transparent",
      }}>
        {isActive(key) && (
          <View style={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            backgroundColor: Colors.accentPurple,
            borderRadius: 2,
          }} />
        )}
        {icon}
        <Text
          numberOfLines={1}
          style={{
            color: key === "Logout" ? Colors.error : Colors.textPrimary,
            fontSize: 16,
            fontWeight: isActive(key) ? "600" : "400",
            marginLeft: 16,
            flex: 1,
          }}
        >
          {label}
        </Text>
      </View>
    </Focusable>
  );

  return (
    <>
      {/* Dim overlay behind sidebar */}
      <Animated.View
        pointerEvents={isVisible ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: Colors.overlayDim,
            zIndex: 99,
          },
          dimStyle,
        ]}
      />

      {/* Sidebar panel */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: Spacing.sidebarWidth,
            backgroundColor: Colors.glassBgHeavy,
            borderRightWidth: 1,
            borderRightColor: Colors.glassBorder,
            paddingVertical: 40,
            paddingHorizontal: 16,
            zIndex: 100,
            justifyContent: "space-between",
          },
          sidebarStyle,
        ]}
      >
        <View>
          {/* Logo */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            marginBottom: 40,
          }}>
            <TentacleLogo size={40} />
            <Text style={{
              color: Colors.accentPurple,
              fontSize: 22,
              fontWeight: "800",
              marginLeft: 12,
            }}>
              Tentacle
            </Text>
          </View>

          {/* Navigation items */}
          {renderItem("Home", t("home"), <HomeIcon size={ICON_SIZE} color={ICON_COLOR} />)}
          {renderItem("Search", t("search"), <SearchIcon size={ICON_SIZE} color={ICON_COLOR} />)}

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: Colors.divider, marginVertical: 16, marginHorizontal: 8 }} />

          {/* Dynamic libraries */}
          {(libraries ?? []).map((lib) => (
            renderItem(
              `Library_${lib.Id}`,
              lib.Name,
              getLibraryIcon(lib.CollectionType),
            )
          ))}
        </View>

        {/* Bottom section */}
        <View>
          <View style={{ height: 1, backgroundColor: Colors.divider, marginVertical: 16, marginHorizontal: 8 }} />
          {renderItem("Preferences", t("preferences"), <SettingsIcon size={ICON_SIZE} color={ICON_COLOR} />)}
          {renderItem("About", t("about"), <InfoIcon size={ICON_SIZE} color={ICON_COLOR} />)}
          {renderItem("Logout", t("logout"), <LogoutIcon size={ICON_SIZE} color={Colors.error} />)}
        </View>
      </Animated.View>
    </>
  );
}
