/**
 * Octave — le formulaire « Importer une sortie » : un LIEN Bandcamp (reconnu sans réseau en tapant), OU des
 * FICHIERS audio — déposés sur la zone, ou choisis par le bouton (le glisser-déposer a toujours son bouton). Une
 * seule action principale à la fois : celle de ce qui est rempli. Seules les sources que l'extension déclare
 * s'offrent (`sources`).
 */

import { useId, useRef, useState, type DragEvent } from "react";
import { FileAudio, Link2, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RELEASE_ACCEPT } from "@tentacle-tv/api-client";
import { RELEASE_FILES_PER_JOB, recognizeReleaseUrl, type ReleaseSource } from "@tentacle-tv/shared/music";
import { formatBytes, pickAudio, type PickedFiles } from "./webReleaseFiles";

const BUTTON = "min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default disabled:opacity-50";

interface Props {
  titleId: string;
  sources: readonly ReleaseSource[];
  link: string;
  onLinkChange: (value: string) => void;
  picked: PickedFiles | null;
  onPick: (picked: PickedFiles | null) => void;
  onImportLink: (url: string) => void;
  onImportFiles: () => void;
  onCancel: () => void;
}

export function ReleaseImportForm({ titleId, sources, link, onLinkChange, picked, onPick, onImportLink, onImportFiles, onCancel }: Props) {
  const { t, i18n } = useTranslation("musicReleases");
  const fieldId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const allowLink = sources.includes("bandcamp");
  const allowFiles = sources.includes("files");
  const recognized = link.trim() ? recognizeReleaseUrl(link) : null;
  const files = picked?.files ?? [];
  const bytes = files.reduce((sum, f) => sum + f.size, 0);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length) onPick(pickAudio(e.dataTransfer.files));
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (files.length) onImportFiles();
        else if (recognized) onImportLink(recognized.url);
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
          {t("title")}
        </h2>
        <p className="text-sm text-content-secondary">{t("intro")}</p>
      </div>

      {allowLink && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId} className="text-sm font-semibold text-content-primary">
            {t("linkLabel")}
          </label>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" aria-hidden />
            <input
              id={fieldId}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={link}
              disabled={files.length > 0}
              onChange={(e) => onLinkChange(e.target.value)}
              placeholder={t("linkPlaceholder")}
              aria-describedby={hintId}
              className="h-11 w-full rounded-xl border border-line-subtle bg-fill-subtle pl-9 pr-3 text-sm text-content-primary placeholder:text-content-quaternary focus-visible:border-line-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
            />
          </div>
          <p id={hintId} aria-live="polite" className={`min-h-5 text-sm ${recognized ? "text-content-primary" : link.trim() ? "text-amber-300" : "text-content-tertiary"}`}>
            {recognized ? t(recognized.kind === "album" ? "linkRecognizedAlbum" : "linkRecognizedTrack") : link.trim() ? t("linkUnknown") : ""}
          </p>
        </div>
      )}

      {allowLink && allowFiles && (
        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-content-quaternary" aria-hidden>
          <span className="h-px flex-1 bg-line-subtle" />
          {t("or")}
          <span className="h-px flex-1 bg-line-subtle" />
        </div>
      )}

      {allowFiles && (
        <div className="flex flex-col gap-2">
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors duration-150 ${over ? "border-line-focus bg-octave-hover" : "border-line-subtle"}`}
          >
            <Upload className="h-6 w-6 text-content-tertiary" aria-hidden />
            <p className="text-sm font-semibold text-content-primary">{t(over ? "dropActive" : "dropHere")}</p>
            <p className="max-w-sm text-xs text-content-tertiary">{t("filesHint")}</p>
            <button type="button" onClick={() => input.current?.click()} className={`${BUTTON} border border-line-subtle text-content-primary hover:bg-octave-hover`}>
              {t("chooseFiles")}
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept={RELEASE_ACCEPT.join(",")}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                if (e.target.files?.length) onPick(pickAudio(e.target.files));
                e.target.value = "";
              }}
            />
          </div>
          {picked && (
            <div className="flex flex-col gap-1" aria-live="polite">
              {files.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-fill-subtle px-3 py-2 text-sm text-content-primary">
                  <FileAudio className="h-4 w-4 shrink-0 text-content-tertiary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate" title={files.map((f) => f.name).join("\n")}>
                    {t("selected", { count: files.length, size: formatBytes(bytes, i18n.language) })}
                  </span>
                  <button type="button" onClick={() => onPick(null)} aria-label={t("clear")} title={t("clear")} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-content-tertiary hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
              {picked.ignored > 0 && <p className="text-xs text-amber-300">{t("ignored", { count: picked.ignored })}</p>}
              {picked.truncated && <p className="text-xs text-amber-300">{t("tooMany", { max: RELEASE_FILES_PER_JOB })}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={`${BUTTON} text-content-tertiary hover:text-content-primary`}>
          {t("cancel")}
        </button>
        <button type="submit" disabled={!files.length && !recognized} className={`${BUTTON} octave-brand-fill px-6`}>
          {t(files.length ? "importFiles" : "importLink")}
        </button>
      </div>
    </form>
  );
}
