import { useState, useCallback } from "react";
import { View, Text } from "react-native";
import { useLibraries } from "@tentacle/api-client";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { HomeIcon, SearchIcon, LibraryIcon } from "./icons/TVIcons";

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

const FIXED_ITEMS: SidebarItem[] = [
  { key: "Home", label: "nav:home", icon: <HomeIcon size={ICON_SIZE} color={ICON_COLOR} /> },
  { key: "Search", label: "nav:search", icon: <SearchIcon size={ICON_SIZE} color={ICON_COLOR} /> },
];

export function Sidebar({ onNavigate }: SidebarProps) {
  const { t } = useTranslation("nav");
  const [expanded, setExpanded] = useState(false);
  const { data: libraries } = useLibraries();

  const handleFocus = useCallback(() => setExpanded(true), []);
  const handleBlur = useCallback(() => setExpanded(false), []);

  const sidebarWidth = expanded ? 220 : 72;

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
      }}
    >
      {/* Logo */}
      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <Text style={{ color: "#8b5cf6", fontSize: 20, fontWeight: "800" }}>
          {expanded ? "Tentacle" : "T"}
        </Text>
      </View>

      {/* Fixed items */}
      {FIXED_ITEMS.map((item) => (
        <Focusable key={item.key} onPress={() => onNavigate(item.key)}>
          <View style={{
            flexDirection: "row", alignItems: "center", paddingVertical: 12,
            paddingHorizontal: expanded ? 16 : 12, borderRadius: 8, marginBottom: 4,
          }}>
            {item.icon}
            {expanded && (
              <Text style={{ color: "#fff", fontSize: 16, marginLeft: 12 }}>{t(item.label)}</Text>
            )}
          </View>
        </Focusable>
      ))}

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
  );
}
