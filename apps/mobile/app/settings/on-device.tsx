import { Redirect } from "expo-router";

/** Ancien volet « Réglages hors ligne », devenu la rubrique « Hors ligne » : les liens d'avant y mènent. */
export default function LegacyOnDeviceRedirect() {
  return <Redirect href="/profile/offline" />;
}
