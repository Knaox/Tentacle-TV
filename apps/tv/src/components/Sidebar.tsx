import { useState, useEffect, useCallback, useRef, memo } from "react";
import { View, Text, ScrollView, Pressable, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useLibraries } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { useSidebar } from "../context/SidebarContext";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";
import { TentacleLogo } from "./icons/TentacleLogo";
import {
  HomeIcon, SearchIcon, LibraryIcon,
  SettingsIcon, InfoIcon, LogoutIcon,
  TVIcon, MusicIcon, BookIcon,
} from "./icons/TVIcons";
import { SelectionModal } from "./SelectionModal";
import { Colors, Spacing, Radius } from "../theme/colors";

interface SidebarProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  currentRoute?: string;
  /** Called after the sidebar close animation finishes — use to restore focus */
  onClosed?: () => void;
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

export const Sidebar = memo(function Sidebar({ onNavigate, currentRoute, onClosed }: SidebarProps) {
  const { t } = useTranslation("nav");
  const { isVisible, closeSidebar } = useSidebar();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const { data: libraries } = useLibraries();

  const slideX = useSharedValue(-Spacing.sidebarWidth);
  const dimOpacity = useSharedValue(0);

  // BACK button closes the sidebar
  useTVRemote({ onBack: isVisible && !logoutModalVisible ? closeSidebar : undefined });

  const wasVisible = useRef(false);
  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    slideX.value = withTiming(isVisible ? 0 : -Spacing.sidebarWidth, { duration: ANIM_DURATION, easing });
    dimOpacity.value = withTiming(isVisible ? 1 : 0, { duration: ANIM_DURATION, easing });
    // Fire onClosed after close animation completes
    if (wasVisible.current && !isVisible) {
      const timer = setTimeout(() => onClosed?.(), ANIM_DURATION + 50);
      return () => clearTimeout(timer);
    }
    wasVisible.current = isVisible;
  }, [isVisible, slideX, dimOpacity, onClosed]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: dimOpacity.value,
  }));

  const handlePress = useCallback((key: string) => {
    if (key === "Logout") {
      setLogoutModalVisible(true);
      return;
    }
    closeSidebar();
    onNavigate(key);
  }, [onNavigate, closeSidebar]);

  const handleLogoutSelect = useCallback((value: string) => {
    setLogoutModalVisible(false);
    if (value === "confirm") {
      closeSidebar();
      onNavigate("Logout");
    }
  }, [closeSidebar, onNavigate]);

  const isActive = (key: string) => currentRoute === key;

  const renderItem = (key: string, label: string, icon: React.ReactNode, grabFocus = false) => (
    <Focusable
      key={key}
      variant="row"
      onPress={() => handlePress(key)}
      hasTVPreferredFocus={grabFocus}
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
        <Pressable style={{ flex: 1 }} onPress={closeSidebar} accessible={false} />
      </Animated.View>

      {/* Sidebar panel */}
      <Animated.View
        // @ts-ignore — Android TV accessibility
        importantForAccessibility={isVisible ? "auto" : "no-hide-descendants"}
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
        {/* @ts-ignore — TVFocusGuideView props from react-native-tvos */}
        <TVFocusGuideView autoFocus trapFocusLeft trapFocusRight style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingVertical: 32, paddingHorizontal: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo — decorative only, not focusable */}
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 8,
              marginBottom: 16,
            }}>
              <TentacleLogo size={36} />
              <Text style={{
                color: Colors.accentPurple,
                fontSize: 20,
                fontWeight: "800",
                marginLeft: 10,
              }}>
                Tentacle TV
              </Text>
            </View>

            {/* All navigation items — hide from focus graph when logout modal is open */}
            <View
              // @ts-ignore — Android TV accessibility
              importantForAccessibility={logoutModalVisible ? "no-hide-descendants" : "auto"}
            >
              {renderItem("Home", t("home"), <HomeIcon size={ICON_SIZE} color={ICON_COLOR} />, isVisible && !logoutModalVisible)}
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
            </View>
          </ScrollView>
        </TVFocusGuideView>
      </Animated.View>

      {/* Logout confirmation modal */}
      {logoutModalVisible && (
        <SelectionModal
          title={t("logoutConfirmTitle", { defaultValue: "Logout" })}
          options={[
            { value: "confirm", label: t("logout") },
            { value: "cancel", label: t("cancel", { defaultValue: "Cancel" }) },
          ]}
          selectedValue={null}
          onSelect={handleLogoutSelect}
          onClose={() => setLogoutModalVisible(false)}
        />
      )}
    </>
  );
});
