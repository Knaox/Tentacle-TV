import { useTranslation } from "react-i18next";
import { SYNC_PLAY_ACCESS, type UserRights, type UserRightsOptions } from "@tentacle-tv/shared";
import { bitsFromMbps, mbpsFromBits, toggleInList } from "../../../parental/parentalModel";
import { ChoiceRight } from "./ChoiceRight";
import { CheckList, NumberRight, ToggleRight } from "./RightRows";
import { MANAGEMENT_FLAGS, lockedForSelf } from "./rightsModel";
import type { RightsWriter } from "./useRightsWriter";

export interface GroupProps {
  rights: UserRights;
  options: UserRightsOptions | undefined;
  writer: RightsWriter;
  isSelf: boolean;
}

/** Le compte : qui il est pour Jellyfin, d'où et combien de fois il se connecte. */
export function AccountBody({ rights, writer, isSelf }: GroupProps) {
  const { t } = useTranslation("userRights");
  const locked = (field: "isAdministrator" | "isDisabled") =>
    lockedForSelf(field, isSelf, rights) ? t(`self.${field}`) : undefined;
  return (
    <>
      <ToggleRight field="isAdministrator" checked={rights.isAdministrator} writer={writer} lockedReason={locked("isAdministrator")} />
      <ToggleRight field="isDisabled" checked={rights.isDisabled} writer={writer} lockedReason={locked("isDisabled")} />
      <ToggleRight field="enableRemoteAccess" checked={rights.enableRemoteAccess} writer={writer} />
      <NumberRight field="maxActiveSessions" value={rights.maxActiveSessions} writer={writer} />
      <NumberRight field="loginAttemptsBeforeLockout" value={rights.loginAttemptsBeforeLockout} writer={writer} />
    </>
  );
}

/** La lecture : permise ou non, ce que le serveur a le droit de convertir, le débit hors de la maison. */
export function PlaybackBody({ rights, writer }: GroupProps) {
  const { t } = useTranslation("userRights");
  return (
    <>
      <ToggleRight field="enableMediaPlayback" checked={rights.enableMediaPlayback} writer={writer} />
      <ToggleRight field="enableAudioPlaybackTranscoding" checked={rights.enableAudioPlaybackTranscoding} writer={writer} />
      <ToggleRight field="enableVideoPlaybackTranscoding" checked={rights.enableVideoPlaybackTranscoding} writer={writer} />
      <ToggleRight field="enablePlaybackRemuxing" checked={rights.enablePlaybackRemuxing} writer={writer} />
      <ToggleRight field="forceRemoteSourceTranscoding" checked={rights.forceRemoteSourceTranscoding} writer={writer} />
      <NumberRight
        field="remoteClientBitrateLimit"
        value={mbpsFromBits(rights.remoteClientBitrateLimit)}
        decimals
        suffix="Mbit/s"
        toRight={bitsFromMbps}
        fromRight={mbpsFromBits}
        writer={writer}
      />
      {/* SyncPlay de Jellyfin, que Tentacle montre sous le nom de Watch Together. */}
      <ChoiceRight
        field="syncPlayAccess"
        value={rights.syncPlayAccess}
        choices={SYNC_PLAY_ACCESS.map((value) => ({
          value,
          label: t(`values.syncPlay.${value}`),
          detail: t(`values.syncPlayDetail.${value}`),
        }))}
        writer={writer}
      />
    </>
  );
}

/**
 * Hors ligne — la section « Téléchargements » d'avant, dans le même modèle :
 * l'écriture range aussi l'état relu dans la liste de la page
 * Téléchargements (même cache), qui le voit sans relecture.
 */
export function OfflineBody({ rights, writer }: GroupProps) {
  const { t } = useTranslation(["userRights", "admin"]);
  return (
    <>
      <ToggleRight field="enableContentDownloading" checked={rights.enableContentDownloading} writer={writer} />
      <ToggleRight field="enableMediaConversion" checked={rights.enableMediaConversion} writer={writer} />
      <p className="text-xs text-content-tertiary">
        {rights.enableAllFolders
          ? t("admin:downloadsAllLibraries")
          : t("admin:downloadsSomeLibraries", { count: rights.enabledFolders.length })}
      </p>
    </>
  );
}

/** La gestion : supprimer des titres, partager ses listes par un lien public. */
export function ManagementBody({ rights, options, writer }: GroupProps) {
  const { t } = useTranslation("userRights");
  const libraries = options?.libraries ?? [];
  return (
    <>
      {MANAGEMENT_FLAGS.map((field) => (
        <div key={field} className="space-y-4">
          <ToggleRight field={field} checked={rights[field]} writer={writer} />
          {/* Sans le droit de tout supprimer, celui de supprimer dans quelques bibliothèques. */}
          {field === "enableContentDeletion" && !rights.enableContentDeletion && (
            <CheckList
              title={t("fields.enableContentDeletionFromFolders.label")}
              hint={t("fields.enableContentDeletionFromFolders.hint")}
              items={libraries}
              value={rights.enableContentDeletionFromFolders}
              disabled={writer.isPending("enableContentDeletionFromFolders")}
              empty={t("libraries.none")}
              onToggle={(id, on) =>
                writer.write({ enableContentDeletionFromFolders: toggleInList(rights.enableContentDeletionFromFolders, id, on) })}
            />
          )}
        </div>
      ))}
    </>
  );
}
