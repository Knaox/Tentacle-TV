import { useEffect, useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Modal } from "../../components/ui/Modal";
import { useWatchTogether } from "../WatchTogetherProvider";
import { closeRoomModal, useRoomModal } from "../roomModalStore";
import { RoomView } from "./RoomView";
import { InviteView } from "./InviteView";

/**
 * La modale de salle Watch Together — ce qu'on voit juste après avoir créé
 * une salle, et d'où l'on invite.
 *
 * Créer une salle n'ouvre plus d'office le choix des invités : on arrive sur
 * la SALLE (vous, l'hôte ; ce qui est au programme ; qui est invité), puis
 * « Inviter des membres » passe au choix — une ou plusieurs personnes — et y
 * revient une fois les invitations parties, pour les voir « en attente ».
 *
 * Une seule modale, deux vues qui glissent l'une vers l'autre : le focus, le
 * voile et Échap restent ceux de `Modal`. La salle disparue (quittée,
 * dissoute), la modale se ferme d'elle-même.
 */
export function WatchTogetherRoomModal() {
  const { open, view, fresh } = useRoomModal();
  const { room } = useWatchTogether();
  const reduced = useReducedMotion();
  const titleId = useId();

  useEffect(() => {
    if (open && room === null) closeRoomModal();
  }, [open, room]);

  if (!open || room === null) return null;
  const forward = view === "invite";

  return (
    <Modal open onClose={closeRoomModal} labelledBy={titleId} maxWidth={480} className="overflow-hidden">
      <motion.div
        key={view}
        initial={reduced ? false : { opacity: 0, x: forward ? 24 : -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-h-[min(640px,85vh)] flex-col"
      >
        {view === "room" ? <RoomView room={room} fresh={fresh} titleId={titleId} /> : <InviteView room={room} titleId={titleId} />}
      </motion.div>
    </Modal>
  );
}
