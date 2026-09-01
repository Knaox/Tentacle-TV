import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useFavoritesAll,
  useHomeLayout,
  useLibraries,
  useRecoSettings,
  useResetTasteProfile,
  useSaveHomeLayout,
  useSaveRecoSettings,
} from "@tentacle-tv/api-client";
import type { CardDensity, HeroMode, HomeLayoutData, RecoSettingsData } from "@tentacle-tv/api-client";
import { SettingsSection } from "@tentacle-tv/ui";
import { SegmentedChoice } from "../../components/settings/SegmentedChoice";
import { SettingToggleRow, SETTING_FIELD } from "../../components/settings/SettingToggleRow";
import { HomeRowsEditor } from "../../components/settings/personalization/HomeRowsEditor";
import { LinkedAccounts } from "../../components/settings/personalization/LinkedAccounts";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { rangeFill } from "../../lib/rangeFill";
import { reconcileHomeRows } from "../../lib/homeLayout";

/**
 * Onglet « Personnalisation » : accueil configurable (mode du bandeau, ordre
 * et activation des rangées, densité) et moteur de recommandation (activation,
 * Vigie, communautaire, désinscription vie privée, curseur Sûr ↔ Aventureux,
 * remise à zéro du profil). Chaque changement se sauvegarde immédiatement
 * (backend = source de vérité, visible sur les autres appareils au prochain
 * chargement — le cache local n'est qu'optimiste).
 */
export function SettingsPersonalization() {
  const { t } = useTranslation("preferences");
  const { t: tCommon } = useTranslation("common");
  const { t: tReco } = useTranslation("reco");
  const { data: layout } = useHomeLayout();
  const { data: settings } = useRecoSettings();
  const { data: libraries } = useLibraries();
  const { data: favorites } = useFavoritesAll();
  const saveLayout = useSaveHomeLayout();
  const saveSettings = useSaveRecoSettings();
  const resetProfile = useResetTasteProfile();
  const [confirmReset, setConfirmReset] = useState(false);

  const rows = useMemo(
    () =>
      layout
        ? reconcileHomeRows(layout.rows, (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name })))
        : [],
    [layout, libraries]
  );

  if (!layout || !settings) return null;

  const patchLayout = (patch: Partial<HomeLayoutData>) => {
    saveLayout.mutate({ ...layout, rows, ...patch });
  };
  const patchSettings = (patch: Partial<RecoSettingsData>) => {
    saveSettings.mutate({ ...settings, ...patch });
  };

  const librariesById = new Map((libraries ?? []).map((l) => [l.Id, l.Name]));
  const labelFor = (key: string): string => {
    if (key === "resume") return tCommon("common:resumeWatching");
    if (key === "nextUp") return tCommon("common:nextEpisodes");
    if (key === "watchlist") return tCommon("common:myList");
    if (key === "watched") return tCommon("common:alreadyWatched");
    if (key.startsWith("library:")) {
      return tCommon("common:latestAdditions", {
        name: librariesById.get(key.slice("library:".length)) ?? "?",
      });
    }
    if (key.startsWith("reco:")) {
      const sub = key.slice("reco:".length);
      const map: Record<string, string> = {
        forYou: "rowForYou",
        inLibrary: "rowInLibrary",
        discover: "rowDiscover",
        community: "rowCommunity",
        exploration: "rowExploration",
      };
      return tReco(map[sub] ?? sub);
    }
    return key;
  };

  const heroOptions: ReadonlyArray<{ value: HeroMode; label: string }> = [
    { value: "resume", label: t("persoHeroResume") },
    { value: "random", label: t("persoHeroRandom") },
    { value: "reco", label: t("persoHeroReco") },
    { value: "fixed", label: t("persoHeroFixed") },
  ];
  const densityOptions: ReadonlyArray<{ value: CardDensity; label: string }> = [
    { value: "compact", label: t("persoDensityCompact") },
    { value: "normal", label: t("persoDensityNormal") },
    { value: "large", label: t("persoDensityLarge") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title={t("persoHomeTitle")} caption={t("persoHomeCaption")}>
        {/* SettingsSection ne pose AUCUN padding (et rogne via overflow-hidden) :
            le p-5 est à la charge du contenu, comme partout ailleurs. */}
        <div className="flex flex-col gap-5 p-5">
          <div>
            <p className="mb-2 text-sm font-medium text-content-primary">{t("persoHeroMode")}</p>
            <SegmentedChoice
              label={t("persoHeroMode")}
              value={layout.heroMode}
              options={heroOptions}
              onChange={(heroMode) => patchLayout({ heroMode })}
            />
            {layout.heroMode === "fixed" && (
              <div className="mt-3">
                {favorites && favorites.length > 0 ? (
                  <select
                    className={SETTING_FIELD}
                    value={layout.heroFixedItemId ?? ""}
                    onChange={(e) => patchLayout({ heroFixedItemId: e.target.value || null })}
                    aria-label={t("persoHeroFixedPick")}
                  >
                    <option value="">{t("persoHeroFixedPick")}</option>
                    {favorites.map((f) => (
                      <option key={f.Id} value={f.Id}>
                        {f.Name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-content-tertiary">{t("persoHeroFixedEmpty")}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-content-primary">{t("persoDensity")}</p>
            <SegmentedChoice
              label={t("persoDensity")}
              value={layout.cardDensity}
              options={densityOptions}
              onChange={(cardDensity) => patchLayout({ cardDensity })}
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-content-primary">{t("persoRowsTitle")}</p>
            <p className="mb-3 text-xs leading-relaxed text-content-tertiary">{t("persoRowsHint")}</p>
            <HomeRowsEditor rows={rows} labelFor={labelFor} onChange={(next) => patchLayout({ rows: next })} />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t("persoRecoTitle")} caption={t("persoRecoCaption")}>
        <div className="flex flex-col gap-4 p-5">
          <SettingToggleRow
            title={t("persoRecoPersonalized")}
            hint={t("persoRecoPersonalizedHint")}
            active={settings.personalized}
            onChange={(personalized) => patchSettings({ personalized })}
          />
          <SettingToggleRow
            title={t("persoRecoVigie")}
            hint={t("persoRecoVigieHint")}
            active={settings.includeVigie}
            onChange={(includeVigie) => patchSettings({ includeVigie })}
          />
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
                value={settings.explorationBalance}
                onChange={(e) => patchSettings({ explorationBalance: Number(e.target.value) })}
                className="ctl-range flex-1"
                style={rangeFill(settings.explorationBalance, 0, 100)}
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
