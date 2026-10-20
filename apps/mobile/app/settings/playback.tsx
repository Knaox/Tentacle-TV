import { Redirect } from "expo-router";

/** Ancien volet, fondu dans « Lecture et apparence » : les liens d'avant y mènent. */
export default function LegacySettingsRedirect() {
  return <Redirect href="/profile/playback" />;
}
