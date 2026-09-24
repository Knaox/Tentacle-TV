import { memo, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { FONT_FAMILY, useTheme } from "@/theme";

/**
 * Le visage d'un compte — la photo Jellyfin, la même source que le bureau —,
 * et l'initiale sur la teinte de la marque quand il n'y en a pas (ou qu'elle
 * ne se charge pas).
 */
export const UserAvatar = memo(function UserAvatar({ userId, name, hasAvatar, size }: {
  userId: string;
  name: string;
  hasAvatar: boolean;
  size: number;
}) {
  const client = useJellyfinClient();
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (hasAvatar && !failed) {
    return (
      <Image
        source={{ uri: `${client.getBaseUrl()}/Users/${encodeURIComponent(userId)}/Images/Primary?maxWidth=${Math.round(size * 3)}&quality=85` }}
        style={[box, { backgroundColor: theme.colors.surface.s3 }]}
        contentFit="cover"
        onError={() => setFailed(true)}
        accessible={false}
      />
    );
  }
  return (
    <View style={[box, { alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand.soft }]}>
      <Text style={{ fontSize: Math.round(size * 0.44), fontFamily: FONT_FAMILY.bold, color: theme.colors.brand.light }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
});
