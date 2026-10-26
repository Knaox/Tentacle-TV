import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info } from "lucide-react";
import { useOctaveRights, useServerCapability } from "@tentacle-tv/api-client";
import type { UserRights, UserRightsOptions } from "@tentacle-tv/shared";
import { toggleInList } from "../../../parental/parentalModel";
import { RightsGroup } from "../rights/RightsGroup";
import { CheckList, RightError, ToggleRight } from "../rights/RightRows";
import type { RightsWriter } from "../rights/useRightsWriter";
import { OctaveAccessRight } from "./OctaveAccessRight";
import { bitrateMbps, musicLibrariesOf, octaveSummary } from "./octaveRightsModel";

interface OctaveRightsGroupProps {
  userId: string;
  rights: UserRights;
  options: UserRightsOptions | undefined;
  writer: RightsWriter;
}

/** Une ligne d'information (un réglage partagé, un avertissement) : une icône ET des mots, jamais la couleur seule. */
function Note({ tone, children }: { tone: "info" | "warning"; children: string }) {
  const Icon = tone === "warning" ? AlertTriangle : Info;
  return (
    <p role={tone === "warning" ? "status" : undefined} className={`flex items-start gap-2 text-xs leading-relaxed ${tone === "warning" ? "text-status-warning-fg" : "text-content-tertiary"}`}>
      <Icon size={14} aria-hidden="true" className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * La rubrique « Musique · Octave » de la fiche des droits (serveur 1.40.0,
 * `octave.rights`), montée après la Famille : « Accès à Octave » (droit
 * Tentacle), puis, dits à la façon d'Octave, les droits JELLYFIN qui touchent
 * la musique — ses bibliothèques, le hors ligne, la conversion du son —, écrits
 * dans les MÊMES champs que les rubriques d'origine (même écriture, même état
 * relu). Le débit à distance et la lecture se lisent ici, se règlent dans
 * « Lecture ». Les paroles (`EnableLyricManagement`) n'y sont pas : Octave n'en
 * montre aucune. Un serveur qui ne déclare pas la capacité : rien.
 */
export function OctaveRightsGroup({ userId, rights, options, writer }: OctaveRightsGroupProps) {
  const { t } = useTranslation("userRights");
  const capable = useServerCapability("octave.rights");
  const access = useOctaveRights(userId, { enabled: capable });
  const [open, setOpen] = useState(false);
  if (!capable) return null;

  const libraries = musicLibrariesOf(options);
  const summary = octaveSummary(access.data?.access ?? null, rights, libraries)
    .map((part) => t(part.key, part.values))
    .join(" · ");
  const mbps = bitrateMbps(rights.remoteClientBitrateLimit);

  return (
    <RightsGroup title={t("octave.title")} summary={summary} open={open} onToggle={() => setOpen((current) => !current)}>
      <p className="text-xs leading-relaxed text-content-tertiary">{t("octave.hint")}</p>
      <OctaveAccessRight userId={userId} />
      {!rights.enableMediaPlayback && <Note tone="warning">{t("octave.playbackOff")}</Note>}
      {libraries.length === 0 ? (
        <Note tone="info">{t("octave.noMusicLibrary")}</Note>
      ) : rights.enableAllFolders ? (
        <Note tone="info">{t("octave.allLibraries")}</Note>
      ) : (
        <div>
          <CheckList
            title={t("octave.libraries.label")}
            hint={t("octave.libraries.hint")}
            items={libraries}
            value={rights.enabledFolders}
            disabled={writer.isPending("enabledFolders")}
            empty={t("octave.noMusicLibrary")}
            onToggle={(id, on) => writer.write({ enabledFolders: toggleInList(rights.enabledFolders, id, on) })}
          />
          <RightError text={writer.errorFor("enabledFolders")} />
        </div>
      )}
      <ToggleRight
        field="enableContentDownloading"
        checked={rights.enableContentDownloading}
        writer={writer}
        label={t("octave.offline.label")}
        hint={t("octave.offline.hint")}
      />
      <ToggleRight
        field="enableAudioPlaybackTranscoding"
        checked={rights.enableAudioPlaybackTranscoding}
        writer={writer}
        label={t("octave.convert.label")}
        hint={t("octave.convert.hint")}
      />
      <Note tone="info">{mbps === null ? t("octave.bitrateNone") : t("octave.bitrate", { mbps })}</Note>
    </RightsGroup>
  );
}
