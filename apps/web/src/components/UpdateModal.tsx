import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAutoUpdate } from "../hooks/useAutoUpdate";
import { useDesktopVersion } from "../hooks/useDesktopVersion";
import { useInViewport } from "../hooks/useInViewport";
import { Modal } from "./ui/Modal";
import { ModalHeader } from "./ui/ModalHeader";
import { UPDATE_CHANNEL_LABEL, UPDATE_CHANNEL_READY_KEY, updateChannel } from "./update/updateChannel";
import { parseUpdateNotes } from "./update/updateNotes";
import { UpdateActions } from "./update/UpdateActions";
import { UpdateNotesList } from "./update/UpdateNotesList";
import { UpdateStage } from "./update/UpdateStage";
import { UpdateVersionBanner } from "./update/UpdateVersionBanner";

export type UpdateState = ReturnType<typeof useAutoUpdate>;

interface UpdateModalProps {
  update: UpdateState;
  /**
   * Un autre recouvrement de démarrage est à l'écran (les nouveautés) : la
   * pop-up attend. L'état du hook persiste, `available` est un état — elle
   * paraîtra à la fermeture de l'autre.
   */
  suspended?: boolean;
}

const noop = () => {};

/**
 * La pop-up de mise à jour : présentation seule, sur la primitive `Modal`. Elle
 * parle de la version SUIVANTE, avant d'installer, à partir des notes du
 * manifeste. Esc et le scrim valent « Plus tard » — uniquement tant qu'on n'a
 * rien lancé : un téléchargement ou une installation ne s'interrompt pas d'un
 * geste malheureux.
 */
export function UpdateModal({ update, suspended = false }: UpdateModalProps) {
  const { t } = useTranslation("notifications");
  const {
    available, phase, version, notes, progress, indeterminate, error, isStoreUpdate, storeOpened,
    installUpdate, dismiss,
  } = update;
  const current = useDesktopVersion();
  // Onglet caché ou fenêtre en arrière-plan : la bande et l'anneau s'arrêtent.
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const canClose = phase === "available";
  const channel = updateChannel(isStoreUpdate);
  const parsedNotes = useMemo(() => parseUpdateNotes(notes), [notes]);
  const onInstall = useCallback(() => {
    void installUpdate();
  }, [installUpdate]);
  const describedBy = canClose && parsedNotes.length > 0 ? "update-notes" : undefined;

  return (
    <Modal
      open={available && !suspended}
      onClose={canClose ? dismiss : noop}
      dismissOnBackdrop={canClose}
      maxWidth={560}
      labelledBy="update-title"
      describedBy={describedBy}
    >
      <ModalHeader
        title={t("notifications:updateAvailable")}
        subtitle={t(UPDATE_CHANNEL_READY_KEY[channel])}
        onClose={canClose ? dismiss : undefined}
        titleId="update-title"
      />
      <div ref={ref} className="space-y-5 px-6 pb-6 pt-5">
        <UpdateVersionBanner from={current} to={version} channelLabel={UPDATE_CHANNEL_LABEL[channel]} />
        {canClose ? (
          <>
            <UpdateNotesList id="update-notes" notes={parsedNotes} />
            <UpdateActions
              isStoreUpdate={isStoreUpdate}
              storeOpened={storeOpened}
              error={error}
              onInstall={onInstall}
              onDismiss={dismiss}
            />
          </>
        ) : (
          phase !== "idle" && (
            <UpdateStage phase={phase} progress={progress} indeterminate={indeterminate} visible={visible} />
          )
        )}
      </div>
    </Modal>
  );
}

/** Monte le hook de détection et la pop-up — le point d'entrée d'App.tsx. */
export function UpdateModalHost() {
  const update = useAutoUpdate();
  return <UpdateModal update={update} />;
}
