import { memo } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { sessionApp, sessionAppText, type AdminSessionDto } from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme } from "@/theme";

/**
 * « Tentacle Mobile **1.8.1** · iPhone » — l'application, sa version et
 * l'appareil. La version ressort d'un cran : c'est elle qu'on cherche d'un
 * coup d'œil. `after` prolonge la ligne (« Actif il y a 2 min »).
 */
export const AppLabel = memo(function AppLabel({ session, after, style }: {
  session: AdminSessionDto;
  after?: string | null;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const app = sessionApp(session);
  const tail = [app.device, after].filter(Boolean).join(" · ");
  return (
    <Text style={style} numberOfLines={1} accessibilityLabel={[sessionAppText(app), after].filter(Boolean).join(" · ")}>
      {app.name}
      {app.version !== null && (
        <Text style={{ fontFamily: FONT_FAMILY.semibold, color: theme.colors.text.secondary, fontVariant: ["tabular-nums"] }}>
          {app.name ? " " : ""}{app.version}
        </Text>
      )}
      {tail !== "" && `${app.name || app.version ? " · " : ""}${tail}`}
    </Text>
  );
});
