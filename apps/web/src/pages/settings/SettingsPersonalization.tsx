import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  isVigieRecoAvailable,
  useFavoritesAll,
  useHomeLayout,
  useLibraries,
  useRecoSettings,
  useResetTasteProfile,
  useSaveHomeLayoutPatch,
  useSaveRecoSettingsPatch,
  useServerCapabilities,
  useTrendingNowSetting,
} from "@tentacle-tv/api-client";
import type { CardDensity, HomeLayoutData, RecoSettingsData } from "@tentacle-tv/api-client";
import { heroModesOffered } from "@tentacle-tv/shared";
import { SettingsSection } from "@tentacle-tv/ui";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { SegmentedChoice } from "../../components/settings/SegmentedChoice";
import { SettingToggleRow } from "../../components/settings/SettingToggleRow";
import { HeroSourcePicker } from "../../components/settings/personalization/HeroSourcePicker";
import { HomeRowsEditor } from "../../components/settings/personalization/HomeRowsEditor";
import { useHomeRowsEditorModel } from "../../components/settings/personalization/useHomeRowsEditorModel";
import { LinkedAccounts } from "../../components/settings/personalization/LinkedAccounts";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { rangeFill } from "../../lib/rangeFill";

/** Le curseur n'écrit qu'au repos : une mutation par cran ferait vingt allers-retours. */
const BALANCE_SAVE_MS = 300;

/**
 * Onglet « Personnalisation », en trois groupes qui disent chacun ce qu'ils
 * règlent : le BANDEAU PRINCIPAL (sa source, décrite par ce qu'elle montre —
 * `HeroSourcePicker`), les RANGÉES DE L'ACCUEIL (taille des cartes, ordre et
 * activation), puis le moteur de recommandation (activation,
 * Vigie, communautaire, désinscription vie privée, curseur Sûr ↔ Aventureux,
 * remise à zéro du profil). Chaque changement se sauvegarde immédiatement en
 * « lire avant d'écrire » : le serveur est relu, seul le changement demandé
 * s'applique au bloc frais — un autre appareil qui écrit au même moment n'est
 * pas écrasé, et lui-même reçoit ce changement en direct.
 */
export function SettingsPersonalization() {
  const { t } = useTranslation("preferences");
  const { t: tCommon } = useTranslation("common");
  const { t: tHome } = useTranslation("homeSettings");
  const { data: layout } = useHomeLayout();
  const { data: settings } = useRecoSettings();
  const { data: libraries } = useLibraries();
  const { data: favorites } = useFavoritesAll();
  const libs = useMemo(() => (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name })), [libraries]);
  const saveLayout = useSaveHomeLayoutPatch({ libraries: libs });
  const saveSettings = useSaveRecoSettingsPatch();
  const resetProfile = useResetTasteProfile();
  // « Tendances actuelles » : seulement face à un serveur qui déclare `reco.trending`.
  const trendingNow = useTrendingNowSetting();
  const [confirmReset, setConfirmReset] = useState(false);

  // Le curseur garde un état local pendant le geste et n'écrit qu'au repos ;
  // tant qu'une sauvegarde attend ou vole, le serveur ne dicte rien (le
  // rafraîchissement d'une sauvegarde précédente ramènerait l'ancienne valeur).
  const [balance, setBalance] = useState(settings?.explorationBalance ?? 70);
  const balanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverBalance = settings?.explorationBalance;
  useEffect(() => {
    if (serverBalance !== undefined && !saveSettings.isPending && balanceTimer.current === null) setBalance(serverBalance);
  }, [serverBalance, saveSettings.isPending]);
  useEffect(() => () => { if (balanceTimer.current) clearTimeout(balanceTimer.current); }, []);
  const changeBalance = (value: number) => {
    setBalance(value);
    if (balanceTimer.current) clearTimeout(balanceTimer.current);
    balanceTimer.current = setTimeout(() => {
      balanceTimer.current = null;
      saveSettings.mutate({ explorationBalance: value });
    }, BALANCE_SAVE_MS);
  };
  // « Hors bibliothèque » n'a de sens que si CE serveur sait servir du hors
  // bibliothèque : il le dit lui-même (`vigieAvailable`), avec le terme exact
  // du moteur — plugin installé, activé, intégration allumée ET configurée.
  // La liste des plugins ne reste que le repli des serveurs d'avant ce champ.
  const vigie = isVigieRecoAvailable(settings?.vigieAvailable, useActivePluginsMeta());

  const serverCaps = useServerCapabilities();
  const homeRows = useHomeRowsEditorModel();

  if (!layout || !settings) return null;

  const patchLayout = (patch: Partial<Omit<HomeLayoutData, "stored" | "catalog">>) => {
    saveLayout.mutate(patch);
  };
  const patchSettings = (patch: Partial<RecoSettingsData>) => {
    saveSettings.mutate(patch);
  };

  // Les sources que CE serveur sait servir ; la valeur en vigueur reste lisible.
  const heroModes = heroModesOffered(serverCaps.capabilities, layout.heroMode);
  const densityOptions: ReadonlyArray<{ value: CardDensity; label: string }> = [
    { value: "compact", label: t("persoDensityCompact") },
    { value: "normal", label: t("persoDensityNormal") },
    { value: "large", label: t("persoDensityLarge") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title={tHome("heroTitle")} caption={tHome("heroCaption")}>
        {/* SettingsSection ne pose AUCUN padding (et rogne via overflow-hidden) :
            le p-5 est à la charge du contenu, comme partout ailleurs. */}
        <div className="p-5">
          <HeroSourcePicker
            modes={heroModes}
            value={layout.heroMode}
            onChange={(heroMode) => patchLayout({ heroMode })}
            favorites={favorites}
            fixedItemId={layout.heroFixedItemId}
            onFixedItemChange={(heroFixedItemId) => patchLayout({ heroFixedItemId })}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={tHome("rowsTitle")} caption={tHome("rowsCaption")}>
        <div className="flex flex-col gap-5 p-5">
          <div>
            <p className="mb-2 text-sm font-medium text-content-primary">{tHome("densityTitle")}</p>
            <SegmentedChoice
              label={tHome("densityTitle")}
              value={layout.cardDensity}
              options={densityOptions}
              onChange={(cardDensity) => patchLayout({ cardDensity })}
            />
            <p className="mt-2 text-xs text-content-tertiary">{tHome("densityCaption")}</p>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-content-primary">{t("persoRowsTitle")}</p>
            <p className="mb-3 text-xs leading-relaxed text-content-tertiary">{t("persoRowsHint")}</p>
            <HomeRowsEditor rows={homeRows.rows} labelFor={homeRows.labelFor} onChange={homeRows.onChange} />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t("persoRecoTitle")} caption={t("persoRecoCaption")}>
        <div className="flex flex-col gap-4 p-5">
          {/* En tête : c'est la PREMIÈRE rangée de « Pour vous ». */}
          {trendingNow.available && (
            <SettingToggleRow
              title={t("persoRecoTrending")}
              hint={t("persoRecoTrendingHint")}
              active={trendingNow.enabled}
              onChange={trendingNow.setEnabled}
            />
          )}
          <SettingToggleRow
            title={t("persoRecoPersonalized")}
            hint={t("persoRecoPersonalizedHint")}
            active={settings.personalized}
            onChange={(personalized) => patchSettings({ personalized })}
          />
          {vigie && (
            <SettingToggleRow
              title={t("persoRecoVigie")}
              hint={t("persoRecoVigieHint")}
              active={settings.includeVigie}
              onChange={(includeVigie) => patchSettings({ includeVigie })}
            />
          )}
          <SettingToggleRow
            title={t("persoRecoCommunity")}
            hint={t("persoRecoCommunityHint")}
            active={settings.community}
            onChange={(community) => patchSettings({ community })}
          />
          <SettingToggleRow
            title={t("persoRecoShareHistory")}
            hint={t("persoRecoShareHistoryHint")}
            active={settings.shareHistory}
            onChange={(shareHistory) => patchSettings({ shareHistory })}
          />

          <div>
            <p className="mb-1 text-sm font-medium text-content-primary">{t("persoBalance")}</p>
            <p className="mb-2 text-xs leading-relaxed text-content-tertiary">{t("persoBalanceHint")}</p>
            <div className="flex items-center gap-3">
              {/* shrink-0 : en flex, min-width:auto écraserait la piste au lieu
                  de laisser le libellé entier. */}
              <span className="shrink-0 text-xs text-content-tertiary">{t("persoBalanceAdventurous")}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={balance}
                onChange={(e) => changeBalance(Number(e.target.value))}
                className="ctl-range flex-1"
                style={rangeFill(balance, 0, 100)}
                aria-label={t("persoBalance")}
              />
              <span className="shrink-0 text-xs text-content-tertiary">{t("persoBalanceSafe")}</span>
            </div>
          </div>

          <div className="border-t border-line-subtle pt-4">
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="rounded-full border border-danger-border bg-danger-surface px-4 py-2 text-sm font-medium text-status-error transition-colors hover:bg-danger-surface-hover"
            >
              {t("persoResetProfile")}
            </button>
          </div>
        </div>
      </SettingsSection>

      <LinkedAccounts />

      <ConfirmDialog
        open={confirmReset}
        title={t("persoResetProfile")}
        message={t("persoResetProfileBody")}
        confirmLabel={t("persoResetProfileConfirm")}
        cancelLabel={tCommon("common:cancel")}
        danger
        pending={resetProfile.isPending}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() =>
          resetProfile.mutate(undefined, { onSettled: () => setConfirmReset(false) })
        }
      />
    </div>
  );
}
