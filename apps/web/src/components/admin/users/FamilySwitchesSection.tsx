import { useTranslation } from "react-i18next";
import { useFamilySwitches, useSetFamilySwitches } from "@tentacle-tv/api-client";
import type { FamilySwitches } from "@tentacle-tv/shared";
import { useFamilyAvailability } from "../../../family/useFamilyAvailability";
import { SettingToggleRow } from "../../settings/SettingToggleRow";
import { AdminSection } from "../kit";

/**
 * Admin › Utilisateurs › Familles : les deux interrupteurs du serveur,
 * activés par défaut — « Familles » et « Profils invités ». Un RÉGLAGE, pas
 * une alerte : rien de la Famille ne monte au tableau des points à régler.
 *
 * Couper ferme aussitôt, côté serveur, les sessions de profil concernées ;
 * ce qui réduit (quitter, retirer, supprimer un invité, dissoudre) reste
 * possible. L'état affiché est celui que le serveur RÉPOND, jamais celui
 * qu'on a cliqué. Serveur d'avant la Famille : la section n'existe pas.
 */
export function FamilySwitchesSection() {
  const { t } = useTranslation("familyWeb");
  const { available } = useFamilyAvailability();
  const switches = useFamilySwitches({ enabled: available });
  const save = useSetFamilySwitches();

  if (!available) return null;
  const current = switches.data;
  const set = (patch: Partial<FamilySwitches>) => save.mutate(patch);

  return (
    <AdminSection title={t("admin.title")} description={t("admin.description")}>
      {current ? (
        <div className="space-y-5">
          <SettingToggleRow
            title={t("admin.families")}
            hint={t("admin.familiesHint")}
            active={current.families}
            onChange={(families) => set({ families })}
          />
          <SettingToggleRow
            title={t("admin.guests")}
            hint={current.families ? t("admin.guestsHint") : `${t("admin.guestsHint")} ${t("admin.guestsNeedFamilies")}`}
            active={current.guests}
            onChange={(guests) => set({ guests })}
          />
          {save.isError && <p role="alert" className="text-sm text-status-error-fg">{t("admin.saveError")}</p>}
        </div>
      ) : switches.isError ? (
        <p className="text-sm text-status-error-fg">{t("admin.loadError")}</p>
      ) : (
        <div aria-hidden="true" className="h-24 animate-pulse rounded-xl bg-fill-subtle" />
      )}
    </AdminSection>
  );
}
