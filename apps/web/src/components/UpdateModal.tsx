import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowCircleUpIcon } from "@phosphor-icons/react/dist/csr/ArrowCircleUp";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import type { useAutoUpdate } from "../hooks/useAutoUpdate";
import { useDesktopVersion } from "../hooks/useDesktopVersion";
import { useInViewport } from "../hooks/useInViewport";
import { UPDATE_CHANNEL_LABEL, UPDATE_CHANNEL_READY_KEY, updateChannel } from "./update/updateChannel";
import { parseUpdateNotes } from "./update/updateNotes";
import { UpdateActions } from "./update/UpdateActions";
import { UpdateDialog } from "./update/UpdateDialog";
import { UpdateNotesList } from "./update/UpdateNotesList";
import { UpdateStage } from "./update/UpdateStage";
import { UpdateVersionBanner } from "./update/UpdateVersionBanner";

export type UpdateState = ReturnType<typeof useAutoUpdate>;

interface UpdateModalProps {
  update: UpdateState;
  /**
   * Ce n'est pas son tour (`startup/startupOrder.ts` : une fenêtre qui la
   * précède n'a pas fini, ou l'on est sur le lecteur) : la pop-up attend.
   * L'état du hook persiste, `available` est un état — elle paraîtra à son tour.
   */
  suspended?: boolean;
}

/**
 * La pop-up de mise à jour (refonte de nov. 2026) : présentation seule, sur sa feuille
 * (`update/UpdateDialog`). Deux visages :
 *
 *  - DISPONIBLE — elle parle de la version SUIVANTE, avant d'installer, à partir des notes du
 *    manifeste. Échap, la croix et le voile valent « Plus tard ». Un essai qui a échoué se dit
 *    ici, et le bouton devient « Réessayer » ;
 *  - EN COURS — téléchargement, installation, redémarrage : les étapes en mots, la jauge, et
 *    PLUS RIEN derrière. Elle verrouille l'application (`update/updateLock.ts`) : la lecture se
 *    met en pause, les raccourcis se taisent, le focus n'en sort pas, Échap et le clic dehors
 *    sont inertes. Un utilisateur avait continué sa lecture pendant une mise à jour.
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
  const running = phase !== "idle" && phase !== "available";
  const channel = updateChannel(isStoreUpdate);
  const parsedNotes = useMemo(() => parseUpdateNotes(notes), [notes]);
  const onInstall = useCallback(() => {
    void installUpdate();
  }, [installUpdate]);
  const describedBy = running ? "update-subtitle" : parsedNotes.length > 0 ? "update-notes" : "update-subtitle";

  return (
    <UpdateDialog open={available && !suspended} blocking={running} onDismiss={dismiss} labelledBy="update-title" describedBy={describedBy}>
      <header className="flex items-start gap-3.5 px-6 pb-1 pt-6">
        <span aria-hidden className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent">
          <ArrowCircleUpIcon size={24} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="update-title" className="font-display text-heading-3 text-content-primary">
            {running ? t("notifications:updateRunningTitle") : t("notifications:updateAvailable")}
          </h2>
          <p id="update-subtitle" className="mt-0.5 text-sm text-content-tertiary">
            {running ? t("notifications:updateLockedHint") : t(UPDATE_CHANNEL_READY_KEY[channel])}
          </p>
        </div>
        {!running && (
          <button type="button" onClick={dismiss} aria-label={t("common:close")} title={t("common:close")} className="icon-btn -mr-2 -mt-1.5 h-9 w-9">
            <XIcon className="h-5 w-5" aria-hidden />
          </button>
        )}
      </header>
      <div ref={ref} className="space-y-5 px-6 pb-6 pt-4">
        <UpdateVersionBanner from={current} to={version} channelLabel={UPDATE_CHANNEL_LABEL[channel]} />
        {running ? (
          <UpdateStage phase={phase} progress={progress} indeterminate={indeterminate} visible={visible} />
        ) : (
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
        )}
      </div>
    </UpdateDialog>
  );
}
