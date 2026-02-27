import { useState, useCallback } from "react";
import { View, Text, Alert } from "react-native";
import { useLibraries } from "@tentacle/api-client";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import {
  HomeIcon, SearchIcon, LibraryIcon,
  SettingsIcon, InfoIcon, LogoutIcon, TentacleIcon,
} from "./icons/TVIcons";

interface SidebarProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

interface SidebarItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const ICON_SIZE = 22;
const ICON_COLOR = "#c4b5fd";

const TOP_ITEMS: SidebarItem[] = [
  { key: "Home", label: "nav:home", icon: <HomeIcon size={ICON_SIZE} color={ICON_COLOR} /> },
  { key: "Search", label: "nav:search", icon: <SearchIcon size={ICON_SIZE} color={ICON_COLOR} /> },
];

const BOTTOM_ITEMS: SidebarItem[] = [
  { key: "Preferences", label: "nav:preferences", icon: <SettingsIcon size={ICON_SIZE} color={ICON_COLOR} /> },
  { key: "About", label: "nav:about", icon: <InfoIcon size={ICON_SIZE} color={ICON_COLOR} /> },
  { key: "Logout", label: "nav:logout", icon: <LogoutIcon size={ICON_SIZE} color="#ef4444" /> },
];

export function Sidebar({ onNavigate }: SidebarProps) {
  const { t } = useTranslation("nav");
  const [expanded, setExpanded] = useState(false);
  const { data: libraries } = useLibraries();

  const handleFocus = useCallback(() => setExpanded(true), []);
  const handleBlur = useCallback(() => setExpanded(false), []);

  const handlePress = useCallback((key: string) => {
    if (key === "Logout") {
      Alert.alert(
        t("nav:logoutConfirmTitle", { defaultValue: "Logout" }),
        t("nav:logoutConfirmMessage", { defaultValue: "Are you sure you want to disconnect?" }),
        [
          { text: t("nav:cancel", { defaultValue: "Cancel" }), style: "cancel" },
          { text: t("nav:logout"), onPress: () => onNavigate("Logout"), style: "destructive" },
        ],
      );
      return;
    }
    onNavigate(key);
  }, [onNavigate, t]);

  const sidebarWidth = expanded ? 220 : 72;

  const renderItem = (item: SidebarItem, py = 12, px = 16, iconColor?: string) => (
    <Focusable key={item.key} onPress={() => handlePress(item.key)}>
      <View style={{
        flexDirection: "row", alignItems: "center", paddingVertical: py,
        paddingHorizontal: expanded ? px : 12, borderRadius: 8, marginBottom: 4,
      }}>
        {item.icon}
        {expanded && (
          <Text
            numberOfLines={1}
            style={{
              color: item.key === "Logout" ? "#ef4444" : "#fff",
              fontSize: 16, marginLeft: 12,
            }}
          >
            {t(item.label)}
          </Text>
        )}
      </View>
    </Focusable>
  );

  return (
    <View
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{
        width: sidebarWidth,
        backgroundColor: "#12121a",
        borderRightWidth: 1,
        borderRightColor: "#1e1e2e",
        paddingVertical: 32,
        paddingHorizontal: 8,
        justifyContent: "space-between",
      }}
    >
      <View>
        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 32, flexDirection: "row", justifyContent: "center" }}>
          <TentacleIcon size={expanded ? 32 : 28} color="#8b5cf6" />
          {expanded && (
            <Text style={{ color: "#8b5cf6", fontSize: 20, fontWeight: "800", marginLeft: 8 }}>
              Tentacle
            </Text>
          )}
        </View>

        {/* Top navigation items */}
        {TOP_ITEMS.map((item) => renderItem(item))}

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: "#1e1e2e", marginVertical: 16, marginHorizontal: 8 }} />

        {/* Libraries */}
        {(libraries ?? []).map((lib) => (
          <Focusable key={lib.Id} onPress={() => onNavigate("Home", { libraryId: lib.Id })}>
            <View style={{
              flexDirection: "row", alignItems: "center", paddingVertical: 10,
              paddingHorizontal: expanded ? 16 : 12, borderRadius: 8, marginBottom: 4,
            }}>
              <LibraryIcon size={20} color="rgba(255,255,255,0.5)" />
              {expanded && (
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginLeft: 12 }}>
                  {lib.Name}
                </Text>
              )}
            </View>
          </Focusable>
        ))}
      </View>

      {/* Bottom section: Preferences, About, Logout */}
      <View>
        <View style={{ height: 1, backgroundColor: "#1e1e2e", marginVertical: 12, marginHorizontal: 8 }} />
        {BOTTOM_ITEMS.map((item) => renderItem(item, 10, 16))}
      </View>
    </View>
  );
}
