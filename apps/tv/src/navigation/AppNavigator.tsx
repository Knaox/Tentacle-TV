import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTentacleConfig } from "@tentacle/api-client";
import type { RootStackParamList } from "./types";
import { ServerSetupScreen } from "../screens/ServerSetupScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { MediaDetailScreen } from "../screens/MediaDetailScreen";
import { PlayerScreen } from "../screens/PlayerScreen";
import { SearchScreen } from "../screens/SearchScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { storage } = useTentacleConfig();
  const hasServerUrl = !!storage.getItem("tentacle_server_url");
  const isAuthenticated = hasServerUrl && !!storage.getItem("tentacle_token");

  const initialRouteName = !hasServerUrl
    ? "ServerSetup"
    : isAuthenticated
      ? "Home"
      : "Login";

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: "#0a0a0f" },
      }}
    >
      <Stack.Screen name="ServerSetup" component={ServerSetupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="MediaDetail" component={MediaDetailScreen} />
      <Stack.Screen name="Player" component={PlayerScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
    </Stack.Navigator>
  );
}
