import { useEffect, useRef } from "react";
import { readShownInvites, rememberShownInvites, shouldAutoOpenInbox } from "@tentacle-tv/shared";
import { useTentacleConfig } from "../../context";

/**
 * La boîte des invitations qui s'ouvre d'elle-même — la MÊME règle pour le web,
 * le bureau et le mobile (`shouldAutoOpenInbox`, shared) : à l'accueil, quand
 * les recouvrements du démarrage se sont tus, d'après les invitations EN
 * ATTENTE (celle qui arrive comme celle reçue avant « Qui regarde ? »), et une
 * seule fois par invitation SUR CET APPAREIL (`inboxShown` : ni au rechargement,
 * ni au démarrage suivant). La plateforme ne dit que comment l'ouvrir.
 */
export function useInboxAutoOpen({ pathname, startupQuiet, inviteIds, enabled, open }: {
  pathname: string;
  startupQuiet: boolean;
  inviteIds: readonly string[];
  /** Faux : rien ne s'ouvre (compte sans Watch Together, séance éteinte). */
  enabled: boolean;
  open: () => void;
}): void {
  const { storage } = useTentacleConfig();
  const shown = useRef<Set<string> | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!enabled) return;
    shown.current ??= readShownInvites(storage);
    if (!shouldAutoOpenInbox({ pathname, startupQuiet, inviteIds, shownIds: shown.current })) return;
    rememberShownInvites(storage, shown.current, inviteIds);
    openRef.current();
  }, [enabled, pathname, startupQuiet, inviteIds, storage]);
}
