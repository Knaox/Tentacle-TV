import { useCallback, useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useUserRights, useUserRightsOptions, userRightsRefusalOf } from "@tentacle-tv/api-client";
import type { UserRightsGroup } from "@tentacle-tv/shared";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";
import { currentRating, ratingChoices, ratingLabel } from "../../../parental/parentalModel";
import { SMALL_BUTTON } from "../../../parental/fieldStyles";
import { SHEET_LIST, SheetSkeleton, UserSheetSection } from "../UserSheetSection";
import { AccountFamilyRightsGroup } from "../familyRights/AccountFamilyRightsGroup";
import { AccountBody, ManagementBody, OfflineBody, PlaybackBody, type GroupProps } from "./GroupBodies";
import { LibrariesBody } from "./LibrariesBody";
import { ParentalBody } from "./ParentalBody";
import { RightsGroup } from "./RightsGroup";
import { RIGHTS_GROUPS, groupSummary, refusalKey } from "./rightsModel";
import { useRightsWriter } from "./useRightsWriter";

const BODIES: Record<UserRightsGroup, ComponentType<GroupProps>> = {
  account: AccountBody,
  libraries: LibrariesBody,
  parental: ParentalBody,
  playback: PlaybackBody,
  offline: OfflineBody,
  management: ManagementBody,
};

interface UserRightsPanelProps {
  userId: string;
  name: string;
  isSelf: boolean;
}

/**
 * Tous les droits d'un compte, tels que sa politique Jellyfin les tient — six
 * rubriques repliables, chacune résumée en une ligne. Rien n'est gardé par
 * Tentacle : la fiche relit Jellyfin, y écrit, et montre l'état RELU. Monté
 * seulement face à un serveur qui déclare `admin.userRights`.
 */
export function UserRightsPanel({ userId, name, isSelf }: UserRightsPanelProps) {
  const { t } = useTranslation("userRights");
  const rightsQuery = useUserRights(userId);
  const optionsQuery = useUserRightsOptions();
  const writer = useRightsWriter(userId);
  const [open, setOpen] = useState<ReadonlySet<UserRightsGroup>>(new Set());
  const toggle = useCallback((group: UserRightsGroup) => {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(group)) next.add(group);
      return next;
    });
  }, []);

  const rights = rightsQuery.data?.rights;
  const options = optionsQuery.data;
  const ratingName = useMemo(() => {
    if (!rights || !options) return null;
    const choice = currentRating(ratingChoices(options.parentalRatings), rights.maxParentalRating, rights.maxParentalSubRating);
    return choice && choice.names.length ? ratingLabel(choice, 2) : null;
  }, [rights, options]);

  const confirmField = writer.confirming && "isAdministrator" in writer.confirming ? "isAdministrator" : "isDisabled";

  return (
    <UserSheetSection title={t("sectionTitle")}>
      <p className="-mt-1 mb-3 text-xs leading-relaxed text-content-tertiary">{t("sectionHint")}</p>
      {rightsQuery.isPending ? (
        <SheetSkeleton />
      ) : !rights ? (
        <div className={`${SHEET_LIST} flex items-center gap-3 px-4 py-3`}>
          <p role="alert" className="min-w-0 flex-1 text-sm text-content-secondary">
            {userRightsRefusalOf(rightsQuery.error) ? t(refusalKey(userRightsRefusalOf(rightsQuery.error)?.error ?? null)) : t("loadError")}
          </p>
          <button type="button" onClick={() => void rightsQuery.refetch()} className={SMALL_BUTTON}>{t("retry")}</button>
        </div>
      ) : (
        <>
          {optionsQuery.isError && <p className="mb-2 text-xs text-status-warning-fg">{t("optionsError")}</p>}
          <div className={SHEET_LIST}>
            {RIGHTS_GROUPS.map((group) => {
              const Body = BODIES[group];
              const summary = groupSummary(group, rights, { libraryCount: options?.libraries.length ?? 0, ratingName })
                .map((part) => t(part.key, part.values))
                .join(" · ");
              return (
                <RightsGroup key={group} title={t(`groups.${group}`)} summary={summary} open={open.has(group)} onToggle={() => toggle(group)}>
                  <Body rights={rights} options={options} writer={writer} isSelf={isSelf} />
                </RightsGroup>
              );
            })}
            {/* Les droits de la FAMILLE (une rubrique de plus, après « Gestion ») : ils ne sont pas
                un champ de la politique Jellyfin, Tentacle les garde (`family.creationRights`). */}
            <AccountFamilyRightsGroup userId={userId} />
          </div>
        </>
      )}
      <ConfirmDialog
        open={writer.confirming !== null}
        title={t(`confirm.${confirmField}.title`, { name })}
        message={t(`confirm.${confirmField}.message`)}
        confirmLabel={t(`confirm.${confirmField}.confirm`)}
        cancelLabel={t("confirm.cancel")}
        danger={confirmField === "isDisabled"}
        onConfirm={writer.confirm}
        onCancel={writer.cancel}
      />
    </UserSheetSection>
  );
}
