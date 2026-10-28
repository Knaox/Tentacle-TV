/**
 * Octave mobile — le mot d'accueil (`pickGreeting`, la règle du bureau) : le
 * prénom du compte, l'artiste qu'on écoutait — choisi UNE fois par moment de la
 * journée et gardé pour la vie de l'application (le `sessionStorage` du web) :
 * un remontage de l'accueil ne le change pas.
 */

import { memo, useState } from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { musicKeys } from "@tentacle-tv/api-client";
import { greetingName, greetingSlot, pickGreeting, type Greeting } from "@tentacle-tv/shared/octave";
import type { MusicHomeResponse } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { useDeviceStore } from "../env/pagesEnv";
import { usePagesPlayer } from "../env/pagesPlayer";
import { usePageMetrics } from "../ui/pageStyle";

let said: { slot: string; greeting: Greeting } | null = null;

function accountOf(raw: string | null): { id: string; name: string | null } {
  try {
    const user = JSON.parse(raw ?? "null") as { Id?: unknown; Name?: unknown } | null;
    return { id: typeof user?.Id === "string" ? user.Id : "", name: typeof user?.Name === "string" ? user.Name : null };
  } catch {
    return { id: "", name: null };
  }
}

export const HomeGreeting = memo(function HomeGreeting() {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const store = useDeviceStore();
  const player = usePagesPlayer();
  const qc = useQueryClient();
  const { gutter, isTablet } = usePageMetrics();
  const [greeting] = useState<Greeting>(() => {
    const account = accountOf(store.getItem("tentacle_user"));
    const now = new Date();
    const slot = greetingSlot(now, account.id);
    if (said?.slot === slot) return said.greeting;
    const cached = qc.getQueryData<MusicHomeResponse>(musicKeys.home());
    const track = player?.snapshot.get().current ?? cached?.recentlyPlayed[0] ?? null;
    const chosen = pickGreeting({ now, name: greetingName(account.name), artist: track?.artists[0]?.name ?? null, seed: account.id });
    said = { slot, greeting: chosen };
    return chosen;
  });
  return (
    <Text accessibilityRole="header" style={[typography.hero, { color: theme.colors.text.primary, paddingHorizontal: gutter, fontSize: isTablet ? 34 : 28 }]}>
      {t(greeting.key, greeting.params)}
    </Text>
  );
});
