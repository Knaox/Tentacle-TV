/**
 * Octave — le REJEU de la file d'envoi des ordres (`orderOutbox.ts`) : au démarrage en ligne et à chaque retour
 * du réseau (la bascule de connectivité de la plateforme, la même qui relance la tenue à jour des playlists
 * gardées), tout ce qui attend part, fusionné avec le serveur, puis la vérité fusionnée revient à l'écran et dans
 * la copie gardée hors ligne ; puis les pages d'ordre des collections gardées sont relues (`refreshKeptOrderPages`).
 * Le bureau et le mobile le montent une fois, dans Octave.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flushOrderOutbox } from "./orderOutbox";
import { orderOutboxApi, refetchAfterOrderWrite, refreshKeptOrderPages } from "./orderOutboxApi";

/** `keptCollections` : les clés des collections gardées par le compte de l'appareil (leurs pages d'ordre se relisent). */
export function useOrderOutboxReplay(online: boolean, keptCollections: readonly string[] = []): void {
  const qc = useQueryClient();
  // Lues au moment du retour : une collection gardée de plus ne relance rien.
  const kept = useRef(keptCollections);
  kept.current = keptCollections;
  useEffect(() => {
    if (!online) return;
    void flushOrderOutbox(orderOutboxApi, (write) => refetchAfterOrderWrite(qc, write)).then(() => refreshKeptOrderPages(qc, kept.current));
  }, [online, qc]);
}
