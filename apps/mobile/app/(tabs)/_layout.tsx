import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useAppConfig } from "@tentacle-tv/api-client";

const TAB_ICON_SIZE = 20;

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: TAB_ICON_SIZE, opacity: focused ? 1 : 0.5 }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { data: config } = useAppConfig();
  const features = config?.features;
  const seerrEnabled = features?.seerr && features?.requests;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#12121a",
          borderTopColor: "#1e1e2e",
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 6,
        },
        tabBarActiveTintColor: "#8b5cf6",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Demandes",
          tabBarIcon: ({ focused }) => <TabIcon label="📋" focused={focused} />,
          href: seerrEnabled ? "/requests" : null,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Decouvrir",
          tabBarIcon: ({ focused }) => <TabIcon label="🧭" focused={focused} />,
          href: seerrEnabled ? "/discover" : null,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="pair-tv"
        options={{
          title: "TV",
          tabBarIcon: ({ focused }) => <TabIcon label="📺" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
