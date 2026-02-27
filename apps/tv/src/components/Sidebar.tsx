import { useEffect, useCallback } from "react";
import { View, Text, ScrollView, Alert, Pressable } from "react-native";
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
import { Colors, Spacing, Radius } from "../theme/colors";

interface SidebarProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  currentRoute?: string;
}

const ICON_SIZE = 20;
const ICON_COLOR = Colors.accentPurpleLight;
const ANIM_DURATION = 250;

function getLibraryIcon(collectionType?: string) {
  switch (collectionType?.toLowerCase()) {
    case "movies": return <LibraryIcon size={ICON_SIZE} color={ICON_COLOR} />;
    case "tvshows": return <TVIcon size={ICON_SIZE} color={ICON_COLOR} />;
    case "music": return <MusicIcon size={ICON_SIZE} color={ICON_COLOR} />;
    case "books": return <BookIcon size={ICON_SIZE} color={ICON_COLOR} />;
    default: return <LibraryIcon size={ICON_SIZE} color={ICON_COLOR} />;
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
    >
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: Radius.small,
        marginBottom: 2,
        backgroundColor: isActive(key) ? "rgba(139, 92, 246, 0.15)" : "transparent",
      }}>
        {isActive(key) && (
          <View style={{
            position: "absolute",
            left: 0, top: 6, bottom: 6,
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
            fontSize: 15,
            fontWeight: isActive(key) ? "600" : "400",
            marginLeft: 14,
            flex: 1,
          }}
        >
          {label}
        </Text>
      </View>
    </Focusable>
  );

  const divider = (
    <View style={{ height: 1, backgroundColor: Colors.divider, marginVertical: 10, marginHorizontal: 8 }} />
  );

  return (
    <>
      {/* Dim overlay — closes sidebar on press */}
      <Animated.View
        pointerEvents={isVisible ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: Colors.overlayHeavy,
            zIndex: 99,
          },
          dimStyle,
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={closeSidebar} />
      </Animated.View>

      {/* Sidebar panel — all items in a single ScrollView for proper D-pad focus chain */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0, left: 0, bottom: 0,
            width: Spacing.sidebarWidth,
            backgroundColor: Colors.bgSurface,
            borderRightWidth: 1,
            borderRightColor: Colors.glassBorder,
            zIndex: 100,
          },
          sidebarStyle,
        ]}
      >
        <ScrollView
          contentContainerStyle={{ paddingVertical: 32, paddingHorizontal: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo — focusable, navigates Home on press */}
          <Focusable onPress={() => handlePress("Home")}>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 8,
              marginBottom: 16,
              borderRadius: Radius.small,
            }}>
              <TentacleLogo size={36} />
              <Text style={{
                color: Colors.accentPurple,
                fontSize: 20,
                fontWeight: "800",
                marginLeft: 10,
              }}>
                Tentacle
              </Text>
            </View>
          </Focusable>

          {/* All navigation items in a single flat list for D-pad focus */}
          {renderItem("Home", t("home"), <HomeIcon size={ICON_SIZE} color={ICON_COLOR} />)}
          {renderItem("Search", t("search"), <SearchIcon size={ICON_SIZE} color={ICON_COLOR} />)}

          {divider}

          {(libraries ?? []).map((lib) => (
            renderItem(
              `Library_${lib.Id}`,
              lib.Name,
              getLibraryIcon(lib.CollectionType),
            )
          ))}

          {divider}

          {renderItem("Preferences", t("preferences"), <SettingsIcon size={ICON_SIZE} color={ICON_COLOR} />)}
          {renderItem("About", t("about"), <InfoIcon size={ICON_SIZE} color={ICON_COLOR} />)}
          {renderItem("Logout", t("logout"), <LogoutIcon size={ICON_SIZE} color={Colors.error} />)}
        </ScrollView>
      </Animated.View>
    </>
  );
}
