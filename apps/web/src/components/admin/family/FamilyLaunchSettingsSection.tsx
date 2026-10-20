import { useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Monitor, Smartphone, Tv, type LucideProps } from "lucide-react";
import { useFamilyLaunchPolicy, useSetFamilyLaunchPolicy } from "@tentacle-tv/api-client";
import { FAMILY_LAUNCH_ASK_PLATFORMS, type FamilyLaunchAskPlatform, type FamilyLaunchSettings } from "@tentacle-tv/shared";
import { cls } from "../../../pages/adminUtils";
import { CHECKBOX } from "../../parental/fieldStyles";
import { SettingToggleRow } from "../../settings/SettingToggleRow";
import { AdminSection } from "../kit";
import { asksNowhere, launchSettingsBody, launchSettingsOf, sameLaunchSettings, togglePlatform } from "./launchSettingsModel";

const ICONS: Record<FamilyLaunchAskPlatform, ComponentType<LucideProps>> = {
  desktop: Monitor,
  web: Globe,
  mobile: Smartphone,
  tv: Tv,
};

/**
 * Admin › Famille : « Qui regarde ? à l'ouverture » (serveur 1.31.1,
 * `family.launchPlatforms`). Un interrupteur, les plateformes où la question
 * s'affiche PAR DÉFAUT, et « Enregistrer » — rien ne part avant. Chaque
 * appareil garde sa case « Ne plus proposer au démarrage » ; une plateforme
 * décochée ne la propose jamais d'office, « Changer de profil » reste.
 * L'état de départ est celui que le serveur RÉPOND ; la règle vaut au
 * prochain lancement de chaque appareil.
 */
export function FamilyLaunchSettingsSection() {
  const { t } = useTranslation("profilePicker");
  const policy = useFamilyLaunchPolicy();
  const saved = policy.data ? launchSettingsOf(policy.data) : null;

  return (
    <AdminSection title={t("launchSettings.title")} description={t("launchSettings.description")}>
      {saved ? (
        // La clé : un enregistrement (ou une relecture) repart de la réponse du serveur.
        <LaunchSettingsForm key={JSON.stringify(saved)} saved={saved} />
      ) : policy.isError ? (
        <p className="text-sm text-status-error-fg">{t("adminPolicy.loadError")}</p>
      ) : (
        <div aria-hidden="true" className="h-40 animate-pulse rounded-xl bg-fill-subtle" />
      )}
    </AdminSection>
  );
}

function LaunchSettingsForm({ saved }: { saved: FamilyLaunchSettings }) {
  const { t } = useTranslation("profilePicker");
  const save = useSetFamilyLaunchPolicy();
  const [draft, setDraft] = useState(saved);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = !sameLaunchSettings(draft, saved);

  const change = (next: FamilyLaunchSettings) => {
    setDraft(next);
    setJustSaved(false);
  };
  const submit = () => {
    save.mutate(launchSettingsBody(draft), { onSuccess: () => setJustSaved(true) });
  };

  return (
    <div className="space-y-6">
      <SettingToggleRow
        title={t("launchSettings.enabled")}
        hint={t("launchSettings.enabledHint")}
        active={draft.enabled}
        onChange={(enabled) => change({ ...draft, enabled })}
      />
      <fieldset disabled={!draft.enabled} className={draft.enabled ? undefined : "opacity-50"}>
        <legend className="text-sm font-medium text-content-primary">{t("launchSettings.platformsLegend")}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FAMILY_LAUNCH_ASK_PLATFORMS.map((platform) => (
            <PlatformTile
              key={platform}
              platform={platform}
              checked={draft.platforms[platform]}
              onChange={(on) => change(togglePlatform(draft, platform, on))}
            />
          ))}
        </div>
      </fieldset>
      {asksNowhere(draft) && <p className="text-xs text-status-warning-fg">{t("launchSettings.nowhere")}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle pt-5">
        <button type="button" className={cls.bp} disabled={!dirty || save.isPending} onClick={submit}>
          {save.isPending ? t("launchSettings.saving") : t("launchSettings.save")}
        </button>
        <p aria-live="polite" className="text-xs text-content-tertiary">
          {save.isError ? (
            <span role="alert" className="text-status-error-fg">{t("adminPolicy.saveError")}</span>
          ) : justSaved && !dirty ? (
            t("launchSettings.saved")
          ) : dirty ? (
            t("launchSettings.unsaved")
          ) : null}
        </p>
      </div>
    </div>
  );
}

interface PlatformTileProps {
  platform: FamilyLaunchAskPlatform;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Une plateforme : la case, son pictogramme, son nom, ce que « décochée » y fait. */
function PlatformTile({ platform, checked, onChange }: PlatformTileProps) {
  const { t } = useTranslation("profilePicker");
  const Icon = ICONS[platform];
  const frame = checked
    ? "border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)]"
    : "border-line-subtle bg-fill-faint hover:border-line-strong";
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150 has-[:disabled]:cursor-not-allowed ${frame}`}>
      <input type="checkbox" className={`${CHECKBOX} mt-0.5`} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <Icon size={18} aria-hidden="true" className="mt-px shrink-0 text-content-secondary" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-content-primary">{t(`launchSettings.platform_${platform}`)}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-content-tertiary">{t(`launchSettings.platformHint_${platform}`)}</span>
      </span>
    </label>
  );
}
