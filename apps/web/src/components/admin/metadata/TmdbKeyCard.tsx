import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard } from "lucide-react";
import {
  adminMetadataErrorCode,
  useTestTmdbKey,
  useUpdateAdminMetadata,
  type AdminMetadataStatus,
} from "@tentacle-tv/api-client";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { useToast } from "../../../contexts/ToastContext";
import { InlineNotice, MetadataCard, StatusPill } from "./MetadataUi";
import { TmdbKeyForm } from "./TmdbKeyForm";
import { TmdbSavedKey } from "./TmdbSavedKey";
import { testNotice, type Notice, type NoticeTone } from "./tmdbKey";

interface TmdbKeyCardProps {
  tmdb: AdminMetadataStatus["tmdb"];
  /** Sous la clé : l'avancement du calcul que sa pose déclenche. */
  children?: ReactNode;
}

/**
 * La carte TMDB : l'état de la clé d'un coup d'œil (pastille), la clé en
 * place (masquée, provenance), le test à la demande, le remplacement et le
 * retrait — confirmé, puisqu'il éteint les recommandations de tout le monde.
 * Chaque geste s'enregistre seul : plus de bouton commun aux deux cartes.
 */
export function TmdbKeyCard({ tmdb, children }: TmdbKeyCardProps) {
  const { t } = useTranslation("adminMetadata");
  const toast = useToast();
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const savedTest = useTestTmdbKey();
  const removal = useUpdateAdminMetadata();
  const fromEnv = tmdb.source === "env";

  let savedNotice: Notice | null = null;
  if (savedTest.isSuccess) savedNotice = testNotice(savedTest.data, true);
  else if (savedTest.isError) savedNotice = testNotice(adminMetadataErrorCode(savedTest.error), true);

  // La pastille dit ce qu'on sait de plus récent : un test raté l'emporte
  // sur « configurée ».
  const pill: { tone: NoticeTone; key: string } = !tmdb.configured
    ? { tone: "warning", key: "statusMissing" }
    : savedTest.data === "invalid"
      ? { tone: "error", key: "statusRejected" }
      : { tone: "success", key: "statusConfigured" };

  const startReplace = () => {
    savedTest.reset();
    setEditing(true);
  };

  const remove = () =>
    removal.mutate(
      { tmdbApiKey: "" },
      {
        onSuccess: () => {
          setConfirming(false);
          setEditing(false);
          savedTest.reset();
          toast.show("success", t("keyRemovedToast"));
        },
        onError: () => {
          setConfirming(false);
          toast.show("error", t("removeFailed"));
        },
      },
    );

  return (
    <MetadataCard
      id={titleId}
      icon={<Clapperboard size={20} />}
      title={t("tmdbTitle")}
      subtitle={t("tmdbSubtitle")}
      status={<StatusPill tone={pill.tone}>{t(pill.key)}</StatusPill>}
    >
      <p className="mb-4 text-sm leading-relaxed text-content-tertiary">{t("tmdbDescription")}</p>
      <div className="space-y-4">
        {tmdb.configured && !editing && (
          <TmdbSavedKey
            last4={tmdb.last4}
            source={tmdb.source}
            testing={savedTest.isPending}
            busy={removal.isPending}
            onTest={() => savedTest.mutate(undefined)}
            onReplace={startReplace}
            onRemove={() => setConfirming(true)}
          />
        )}
        <div aria-live="polite">
          {savedNotice && <InlineNotice tone={savedNotice.tone}>{t(savedNotice.key)}</InlineNotice>}
        </div>
        {fromEnv && <InlineNotice tone="neutral">{t("keyEnvNote")}</InlineNotice>}
        {!fromEnv && (!tmdb.configured || editing) && (
          <TmdbKeyForm
            replacing={tmdb.configured}
            onSaved={() => setEditing(false)}
            onCancel={tmdb.configured ? () => setEditing(false) : undefined}
          />
        )}
        {children}
      </div>
      <ConfirmDialog
        open={confirming}
        danger
        pending={removal.isPending}
        title={t("removeConfirmTitle")}
        message={t("removeConfirmMessage")}
        confirmLabel={t("removeConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </MetadataCard>
  );
}
