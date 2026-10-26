/**
 * Octave — le mot d'accueil en tête de l'accueil (`greeting.ts`). Lu UNE fois,
 * au montage : le prénom du compte (`tentacle_user`), l'artiste du lecteur
 * repris ou de la dernière écoute déjà en cache. La phrase ne change pas sous
 * les yeux quand les données arrivent ou que le titre change.
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { musicKeys } from "@tentacle-tv/api-client";
import type { MusicHomeResponse } from "@tentacle-tv/shared/music";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { greetingName, pickGreeting, type Greeting } from "./greeting";

function storedAccount(): { id: string; name: string | null } {
  try {
    const user = JSON.parse(localStorage.getItem("tentacle_user") ?? "null") as { Id?: unknown; Name?: unknown } | null;
    return { id: typeof user?.Id === "string" ? user.Id : "", name: typeof user?.Name === "string" ? user.Name : null };
  } catch {
    return { id: "", name: null };
  }
}

export const HomeGreeting = memo(function HomeGreeting() {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const qc = useQueryClient();
  const [greeting] = useState<Greeting>(() => {
    const account = storedAccount();
    const cached = qc.getQueryData<MusicHomeResponse>(musicKeys.home());
    const track = player.snapshot.get().current ?? cached?.recentlyPlayed[0] ?? null;
    return pickGreeting({ now: new Date(), name: greetingName(account.name), artist: track?.artists[0]?.name ?? null, seed: account.id });
  });
  return <h1 className="px-2 oc-display text-3xl text-content-primary text-balance">{t(greeting.key, greeting.params)}</h1>;
});
