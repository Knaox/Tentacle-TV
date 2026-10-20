import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { closeRoomModal, useRoomModal } from "../../watchTogether/roomModalStore";
import { NotifTabletPanel } from "../shell/NotifTabletPanel";
import { BottomSheet } from "../ui/BottomSheet";
import { useFormFactor } from "../useFormFactor";
import { closeMirrorWtInbox, useMirrorWtInbox } from "./mirrorWtInbox";
import { MirrorWtInboxSheet } from "./MirrorWtInboxSheet";
import { MirrorWtInviteSheet } from "./MirrorWtInviteSheet";
import { MirrorWtRoomSheet } from "./MirrorWtRoomSheet";

/**
 * Les surfaces du Watch Together dans le web étroit — le `WtHost` du mobile :
 * la feuille du groupe, « Inviter des membres », les invitations reçues, une
 * à la fois. Feuille du bas sur téléphone, panneau ancré sur tablette. Elles
 * s'ouvrent par les MÊMES portes que le bureau (`roomModalStore` : fiche,
 * lecteur, bande de l'accueil) ; le fournisseur les monte à la place de la
 * modale de salle et de la boîte des invitations du bureau.
 */
export function MirrorWtHost({ autoInbox, onAutoInboxClose }: { autoInbox: boolean; onAutoInboxClose: () => void }) {
  const { t } = useTranslation("watchTogether");
  const { room, invites, mayJoin } = useWatchTogether();
  const modal = useRoomModal();
  const manualInbox = useMirrorWtInbox();
  const Surface = useFormFactor() === "tablet" ? NotifTabletPanel : BottomSheet;
  const closeInbox = useCallback(() => {
    closeMirrorWtInbox();
    onAutoInboxClose();
  }, [onAutoInboxClose]);

  const roomOpen = modal.open && !!room;
  const inboxOpen = !roomOpen && mayJoin && invites.length > 0 && (manualInbox || autoInbox);

  return (
    <>
      <Surface open={roomOpen} onClose={closeRoomModal} label={t("yourRoom")}>
        {modal.view === "invite" ? <MirrorWtInviteSheet /> : <MirrorWtRoomSheet />}
      </Surface>
      <Surface open={inboxOpen} onClose={closeInbox} label={t("invitations")}>
        <MirrorWtInboxSheet onClose={closeInbox} />
      </Surface>
    </>
  );
}
