import { useState, useCallback } from "react";
import { View, Text } from "react-native";
import { useLibraries } from "@tentacle/api-client";
import { Focusable } from "./focus/Focusable";

interface SidebarProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

interface SidebarItem {
  key: string;
  label: string;
  icon: string;
}

const FIXED_ITEMS: SidebarItem[] = [
  { key: "Home", label: "Accueil", icon: "🏠" },
  { key: "Search", label: "Rechercher", icon: "🔍" },
];

export function Sidebar({ onNavigate }: SidebarProps) {
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
            <Text style={{ fontSize: 20 }}>{item.icon}</Text>
            {expanded && (
              <Text style={{ color: "#fff", fontSize: 16, marginLeft: 12 }}>{item.label}</Text>
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
            <Text style={{ fontSize: 18 }}>📁</Text>
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
