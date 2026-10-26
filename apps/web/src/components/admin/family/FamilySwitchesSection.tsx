import { useTranslation } from "react-i18next";
import {
  useFamilyCreationDefaults,
  useFamilySwitches,
  useServerCapability,
  useSetFamilyCreationDefaults,
  useSetFamilySwitches,
} from "@tentacle-tv/api-client";
import type { FamilySwitches } from "@tentacle-tv/shared";
import { useFamilyAvailability } from "../../../family/useFamilyAvailability";
import { SettingToggleRow } from "../../settings/SettingToggleRow";
import { AdminSection } from "../kit";
import { FamilyAccessRow } from "./familyAccess/FamilyAccessRow";
import { accessChangesFor, accessLevelOf, type FamilyAccessFeature, type FamilyAccessLevel } from "./familyAccess/familyAccessModel";

/**
 * Admin › Utilisateurs › Familles : « Familles » et « Profils invités ». Un
 * RÉGLAGE, pas une alerte : rien de la Famille ne monte au tableau des points
 * à régler.
 *
 * Couper ferme aussitôt, côté serveur, les sessions de profil concernées ;
 * ce qui réduit (quitter, retirer, supprimer un invité, dissoudre) reste
 * possible. L'état affiché est celui que le serveur RÉPOND, jamais celui
 * qu'on a cliqué. Serveur d'avant la Famille : la section n'existe pas.
 *
 * 1.30.0 (`family.creationRights`) : le serveur a en plus le DÉFAUT des droits
 * de création. L'interrupteur et ce défaut ne se montrent plus en quatre
 * bascules qui semblaient dire deux fois la même chose : une rangée par
 * fonction, trois positions (`familyAccessModel`). Serveur d'avant : les deux
 * interrupteurs seuls, comme alors.
 *
 * 1.30.0 (`family.guestRequestsAdmin`) : une troisième rangée, « Les invités peuvent demander
 * des films », SEULEMENT si une extension sait demander un titre (`requestExtension`). Coupée
 * par défaut ; la couper suspend les cases des invités sans les effacer.
 */
export function FamilySwitchesSection() {
  const { t } = useTranslation("familyWeb");
  const { available } = useFamilyAvailability();
  const switches = useFamilySwitches({ enabled: available });
  const save = useSetFamilySwitches();
  const creationRights = useServerCapability("family.creationRights");
  const guestRequestsAdmin = useServerCapability("family.guestRequestsAdmin");
  const defaults = useFamilyCreationDefaults({ enabled: available && creationRights });
  const saveDefaults = useSetFamilyCreationDefaults();

  if (!available) return null;
  const current = switches.data;
  const set = (patch: Partial<FamilySwitches>) => save.mutate(patch);
  const guestsNote = current && !current.families ? t("admin.guestsNeedFamilies") : undefined;

  // Le défaut d'abord, l'interrupteur ensuite : rallumer n'ouvre jamais, même
  // un instant, plus largement que la position choisie.
  const choose = async (feature: FamilyAccessFeature, level: FamilyAccessLevel) => {
    if (!current || !defaults.data) return;
    const changes = accessChangesFor(feature, { switches: current, defaults: defaults.data }, level);
    try {
      if (changes.defaults) await saveDefaults.mutateAsync(changes.defaults);
      if (changes.switches) await save.mutateAsync(changes.switches);
    } catch {
      // Dit par `isError` ci-dessous ; l'affichage reste celui du serveur.
    }
  };

  const features: readonly FamilyAccessFeature[] =
    guestRequestsAdmin && current?.requestExtension === true ? ["families", "guests", "guestRequests"] : ["families", "guests"];
  const loadFailed = switches.isError || (creationRights && defaults.isError);
  const body = !current ? null : creationRights ? (
    defaults.data && (
      <div className="space-y-6">
        {features.map((feature) => (
          <FamilyAccessRow
            key={feature}
            feature={feature}
            level={accessLevelOf(feature, { switches: current, defaults: defaults.data })}
            onChange={(level) => void choose(feature, level)}
            note={feature === "guests" ? guestsNote : undefined}
          />
        ))}
      </div>
    )
  ) : (
    <div className="space-y-5">
      <SettingToggleRow
        title={t("admin.families")}
        hint={t("admin.familiesHint")}
        active={current.families}
        onChange={(families) => set({ families })}
      />
      <SettingToggleRow
        title={t("admin.guests")}
        hint={guestsNote ? `${t("admin.guestsHint")} ${guestsNote}` : t("admin.guestsHint")}
        active={current.guests}
        onChange={(guests) => set({ guests })}
      />
    </div>
  );

  return (
    <AdminSection scope="server" title={t("admin.title")} description={t("admin.description")}>
      {body ? (
        <>
          {body}
          {(save.isError || saveDefaults.isError) && <p role="alert" className="mt-4 text-sm text-status-error-fg">{t("admin.saveError")}</p>}
        </>
      ) : loadFailed ? (
        <p className="text-sm text-status-error-fg">{t("admin.loadError")}</p>
      ) : (
        <div aria-hidden="true" className="h-24 animate-pulse rounded-xl bg-fill-subtle" />
      )}
    </AdminSection>
  );
}
