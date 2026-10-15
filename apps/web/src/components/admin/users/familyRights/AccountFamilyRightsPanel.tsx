import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { useAccountFamilyRights, useServerCapability, useSetAccountFamilyRights } from "@tentacle-tv/api-client";
import type { AccountFamilyRightsDto, FamilyCreationRightValue } from "@tentacle-tv/shared";
import { useToast } from "../../../../contexts/ToastContext";
import { SHEET_LIST, SheetSkeleton, UserSheetSection } from "../UserSheetSection";
import { CreationRightChoice } from "./CreationRightChoice";
import { CREATION_RIGHT_KEYS, creationNote, familyPlace, inheritValue, isEditable, type CreationRightKey } from "./familyRightsModel";

/**
 * La rubrique « Famille » de la fiche d'un compte (serveur 1.30.0,
 * `family.creationRights`) : ses deux droits de création — créer une famille,
 * créer des profils invités —, chacun « Par défaut », « Permis » ou « Refusé »,
 * ce qui en vaut, sa place dans une famille, et « Restreint par la famille de
 * … » quand un contrôle parental de la famille s'ajoute à ses droits. Monté
 * par UNE ligne dans la fiche ; un serveur qui ne déclare pas la capacité : rien.
 */
export function AccountFamilyRightsPanel({ userId }: { userId: string }) {
  const { t } = useTranslation("familyWeb");
  const capable = useServerCapability("family.creationRights");
  const query = useAccountFamilyRights(userId, { enabled: capable });
  if (!capable) return null;
  return (
    <UserSheetSection title={t("accountRights.title")}>
      {query.data ? (
        <AccountFamilyRightsBody dto={query.data} />
      ) : query.isError ? (
        <p role="alert" className="text-sm text-status-error-fg">{t("accountRights.loadError")}</p>
      ) : (
        <SheetSkeleton />
      )}
    </UserSheetSection>
  );
}

function AccountFamilyRightsBody({ dto }: { dto: AccountFamilyRightsDto }) {
  const { t } = useTranslation("familyWeb");
  const place = familyPlace(dto);
  return (
    <div className={SHEET_LIST}>
      <p className="px-4 py-2.5 text-xs leading-relaxed text-content-tertiary">
        {t("accountRights.description")}
        {place && <> {t(`accountRights.${place.key}`, { owner: place.owner })}</>}
      </p>
      {dto.restrictedBy && (
        <p className="flex items-start gap-2 px-4 py-2.5 text-xs leading-relaxed text-content-secondary">
          <ShieldCheck size={14} aria-hidden="true" className="mt-px shrink-0 text-[var(--brand-light)]" />
          {t("accountRights.restrictedBy", { owner: dto.restrictedBy.ownerName })}
        </p>
      )}
      {isEditable(dto) && CREATION_RIGHT_KEYS.map((key) => <CreationRightRow key={key} dto={dto} right={key} />)}
    </div>
  );
}

function CreationRightRow({ dto, right }: { dto: AccountFamilyRightsDto; right: CreationRightKey }) {
  const { t } = useTranslation("familyWeb");
  const { show } = useToast();
  const labelId = useId();
  const save = useSetAccountFamilyRights();
  const note = creationNote(dto, right);
  const labels: Record<FamilyCreationRightValue, string> = {
    inherit: t("accountRights.inherit", { value: t(inheritValue(dto, right) ? "accountRights.yes" : "accountRights.no") }),
    allow: t("accountRights.allow"),
    deny: t("accountRights.deny"),
  };
  const change = (value: FamilyCreationRightValue) =>
    save.mutate({ userId: dto.userId, rights: { [right]: value } }, { onError: () => show("error", t("accountRights.saveError")) });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-sm font-medium text-content-primary">{t(`accountRights.${right}`)}</p>
        <p className="mt-0.5 text-xs text-content-tertiary">
          {t(dto.allowed[right] ? "accountRights.allowed" : "accountRights.denied")}
          {note && <> · {t(`accountRights.${note}`)}</>}
        </p>
      </div>
      <CreationRightChoice labelledBy={labelId} value={dto.rights[right]} labels={labels} disabled={save.isPending} onChange={change} />
    </div>
  );
}
