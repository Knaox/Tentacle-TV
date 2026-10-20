import { Stack } from "expo-router";
import { withScreenBoundary } from "@/components/problems/ScreenErrorBoundary";
import { useTheme } from "@/theme";

export default function AuthLayout() {
  const theme = useTheme();
  return (
    <Stack screenLayout={withScreenBoundary} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.surface.s0 } }} />
  );
}
