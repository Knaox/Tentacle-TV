import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { useToast } from "../contexts/ToastContext";
import { openRoomModal } from "./roomModalStore";
import { useWatchTogether } from "./WatchTogetherProvider";

export interface WtDetailAction {
  label: string;
  /** Déjà en groupe (l'hôte y invite) : le bouton se dit « actif ». */
  active: boolean;
  run: () => Promise<void>;
}

/**
 * « Regarder ensemble » sur une fiche — la règle du web, lue par la capsule du
 * bureau (`DetailActionCapsule`) et la pilule du miroir (`WtDetailPill`) :
 * hors groupe, créer le groupe avec CE titre au programme et ouvrir sa
 * feuille ; l'hôte d'un groupe y invite ; un groupe du compte sur un AUTRE
 * appareil : « Rejoindre ici » (jamais un second groupe). Un membre qui n'est
 * pas l'hôte, une collection, un compte sans droit de créer : rien (`null`).
 */
export function useWtDetailAction(item: MediaItem): WtDetailAction | null {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { isInGroup, isHost, mayCreate, elsewhere, actions } = useWatchTogether();
  // Créer un salon, ou y inviter en hôte : « Créer et rejoindre » seulement (SyncPlayAccess).
  if (item.Type === "BoxSet" || !mayCreate || (isInGroup && !isHost)) return null;
  return {
    active: isInGroup,
    label: isInGroup ? t("invite") : elsewhere ? t("elsewhereJoinHere") : t("watchTogetherAction"),
    run: async () => {
      if (isInGroup) {
        openRoomModal("invite");
        return;
      }
      // En groupe sur un autre appareil : cet appareil s'y ajoute.
      if (elsewhere) {
        await actions.joinHere().catch(() => show("error", t("elsewhereJoinFailed")));
        return;
      }
      try {
        await actions.create(item.Id);
        openRoomModal("room", { fresh: true });
      } catch {
        show("error", t("alreadyInGroup"));
      }
    },
  };
}
