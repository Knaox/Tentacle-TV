import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePlaybackSettings } from "@tentacle-tv/api-client";
import { detectPreset } from "@tentacle-tv/shared";
import { PlaybackAdvancedPanel } from "./PlaybackAdvancedPanel";
import { PlaybackPresetPicker } from "./PlaybackPresetPicker";

/**
 * Tout ce que le lecteur a le droit de faire tout seul, en un seul endroit.
 *
 * Deux étages, et cet ordre-là compte : le MODE — le lecteur propose, ou il
 * fait — puis, replié, le réglage fin. Les vingt contrôles d'avant étaient
 * tous justifiés pris un par un ; ensemble ils formaient un tableau de bord
 * qu'il fallait traverser pour dire « passe-moi les intros ».
 *
 * Ces choix suivent le COMPTE (`playback_settings` côté serveur, cache local
 * pour le hors ligne) : ce qu'on règle ici se retrouve sur le mobile et sur le
 * téléviseur, qui n'en montrent que le mode.
 */
export function PlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  const settings = usePlaybackSettings();
  // Ouvert d'emblée si les réglages ne correspondent à aucun mode : quelqu'un
  // a déjà réglé finement, lui cacher son propre travail serait absurde.
  const [advancedOpen, setAdvancedOpen] = useState(() => detectPreset(settings) === "custom");

  return (
    <div className="mb-8 rounded-xl border border-line-subtle bg-fill-subtle p-5">
      <h3 className="text-sm font-semibold text-content-primary">{t("playbackModeTitle")}</h3>
      <p className="mt-1 text-xs leading-relaxed text-content-quaternary">
        {t("playbackSettingsAccount")}
      </p>

      <div className="mt-4">
        <PlaybackPresetPicker settings={settings} />
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen((open) => !open)}
        aria-expanded={advancedOpen}
        className="mt-6 flex min-h-11 items-center gap-2 text-sm font-medium text-content-secondary transition-colors hover:text-content-primary"
      >
        <svg
          className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${advancedOpen ? "rotate-90" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {t("playbackAdvancedToggle")}
      </button>

      {advancedOpen && (
        <div className="mt-5 border-t border-line-subtle pt-6">
          <PlaybackAdvancedPanel settings={settings} />
        </div>
      )}
    </div>
  );
}
