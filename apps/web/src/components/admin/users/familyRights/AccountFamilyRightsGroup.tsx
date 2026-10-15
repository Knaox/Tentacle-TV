import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { useAccountFamilyRights, useServerCapability, useSetAccountFamilyRights } from "@tentacle-tv/api-client";
import type { FamilyCreationRightValue } from "@tentacle-tv/shared";
import { RightsGroup } from "../rights/RightsGroup";
import { CreationRightField } from "./CreationRightField";
import { CREATION_RIGHT_KEYS, familyPlace, familyRightsSummary, isEditable, type CreationRightKey } from "./familyRightsModel";

/**
 * La rubrique « Famille » de la fiche des droits d'un compte (serveur 1.30.0,
 * `family.creationRights`), montée après « Gestion » dans la liste des rubriques :
 * ses deux droits de création — créer une famille, créer des profils invités —,
 * chacun « Par défaut », « Permis » ou « Refusé », ce qui en vaut, sa place dans
 * une famille, et « Restreint par la famille de … » quand un contrôle parental de
 * la famille s'ajoute à ses droits. Ce ne sont pas des champs de la politique
 * Jellyfin : Tentacle les garde. Un serveur qui ne déclare pas la capacité : rien.
 */
export function AccountFamilyRightsGroup({ userId }: { userId: string }) {
  const { t } = useTranslation("familyWeb");
  const capable = useServerCapability("family.creationRights");
  const query = useAccountFamilyRights(userId, { enabled: capable });
  const save = useSetAccountFamilyRights();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<CreationRightKey | null>(null);
  if (!capable) return null;

  const dto = query.data;
  const summary = dto
    ? familyRightsSummary(dto)
        .map((part) => t(`accountRights.${part.key}`, { ...part.values, ...(part.valueKey && { value: t(`accountRights.${part.valueKey}`) }) }))
        .join(" · ")
    : t(query.isError ? "accountRights.loadError" : "accountRights.description");
  const place = dto ? familyPlace(dto) : null;
  const change = (right: CreationRightKey, value: FamilyCreationRightValue) => {
    if (!dto) return;
    setFailed(null);
    save.mutate({ userId: dto.userId, rights: { [right]: value } }, { onError: () => setFailed(right) });
  };

  return (
    <RightsGroup title={t("accountRights.title")} summary={summary} open={open} onToggle={() => setOpen((current) => !current)}>
      {dto ? (
        <>
          <p className="text-xs leading-relaxed text-content-tertiary">
            {t("accountRights.description")}
            {place && <> {t(`accountRights.${place.key}`, { owner: place.owner })}</>}
          </p>
          {dto.restrictedBy && (
            <p className="flex items-start gap-2 text-xs leading-relaxed text-content-secondary">
              <ShieldCheck size={14} aria-hidden="true" className="mt-px shrink-0 text-[var(--brand-light)]" />
              {t("accountRights.restrictedBy", { owner: dto.restrictedBy.ownerName })}
            </p>
          )}
          {isEditable(dto) &&
            CREATION_RIGHT_KEYS.map((right) => (
              <CreationRightField
                key={right}
                dto={dto}
                right={right}
                pending={save.isPending}
                error={failed === right ? t("accountRights.saveError") : null}
                onChange={(value) => change(right, value)}
              />
            ))}
        </>
      ) : (
        <p role={query.isError ? "alert" : undefined} className="text-xs text-content-tertiary">
          {t(query.isError ? "accountRights.loadError" : "accountRights.description")}
        </p>
      )}
    </RightsGroup>
  );
}
