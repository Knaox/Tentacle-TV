/**
 * Octave — le REJEU de la file d'envoi des ordres (`orderOutbox.ts`) : au démarrage en ligne et à chaque retour
 * du réseau (la bascule de connectivité de la plateforme, la même qui relance la tenue à jour des playlists
 * gardées), tout ce qui attend part, fusionné avec le serveur, puis la vérité fusionnée revient à l'écran et dans
 * la copie gardée hors ligne. Le bureau et le mobile le montent une fois, dans Octave.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flushOrderOutbox } from "./orderOutbox";
import { orderOutboxApi, refetchAfterOrderWrite } from "./orderOutboxApi";

export function useOrderOutboxReplay(online: boolean): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!online) return;
    void flushOrderOutbox(orderOutboxApi, (write) => refetchAfterOrderWrite(qc, write));
  }, [online, qc]);
}
