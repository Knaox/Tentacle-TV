/**
 * Octave — le mot d'accueil en tête de l'accueil (`greeting.ts`). Choisi UNE
 * fois par moment de la journée : le prénom du compte (`tentacle_user`),
 * l'artiste du lecteur repris ou de la dernière écoute déjà en cache — puis
 * gardé pour la session (`sessionStorage`) : un remontage de l'accueil, des
 * données arrivées entre-temps, un titre qui change ne le changent pas.
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { musicKeys } from "@tentacle-tv/api-client";
import type { MusicHomeResponse } from "@tentacle-tv/shared/music";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { greetingName, greetingSlot, pickGreeting, type Greeting } from "./greeting";

/** Clé de stockage de SESSION : ne jamais la renommer. */
const SAID_KEY = "tentacle_octave_greeting";

function saidGreeting(slot: string): Greeting | null {
  try {
    const said = JSON.parse(sessionStorage.getItem(SAID_KEY) ?? "null") as { slot?: unknown; greeting?: Greeting } | null;
    return said?.slot === slot && typeof said.greeting?.key === "string" ? said.greeting : null;
  } catch {
    return null;
  }
}

function remember(slot: string, greeting: Greeting): void {
  try {
    sessionStorage.setItem(SAID_KEY, JSON.stringify({ slot, greeting }));
  } catch {
    /* stockage refusé : la phrase sera choisie à nouveau au prochain montage */
  }
}

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
    const now = new Date();
    const slot = greetingSlot(now, account.id);
    const said = saidGreeting(slot);
    if (said) return said;
    const cached = qc.getQueryData<MusicHomeResponse>(musicKeys.home());
    const track = player.snapshot.get().current ?? cached?.recentlyPlayed[0] ?? null;
    const chosen = pickGreeting({ now, name: greetingName(account.name), artist: track?.artists[0]?.name ?? null, seed: account.id });
    remember(slot, chosen);
    return chosen;
  });
  return <h1 className="px-2 oc-display text-3xl text-content-primary text-balance">{t(greeting.key, greeting.params)}</h1>;
});
