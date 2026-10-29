/**
 * Octave — « Fichiers » : des fichiers audio de l'ordinateur (ou le ZIP d'un album), choisis ou déposés ici. Ils
 * entrent dans Octave par la chaîne des sorties, puis dans la playlist, dans l'ordre de leurs albums. La playlist
 * neuve prend le nom saisi, sinon celui de l'album lu, sinon « Import du … » — renommable ensuite.
 */

import { useId, useRef, useState, type DragEvent } from "react";
import { FileAudio, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RELEASE_ACCEPT } from "@tentacle-tv/api-client";
import { formatBytes, pickAudio, type PickedFiles } from "../../releases/webReleaseFiles";

const BUTTON = "min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

interface Props {
  /** L'import vise une playlist existante : pas de nom à donner. */
  into: boolean;
  onStart: (picked: PickedFiles, name: string) => void;
  onCancel: () => void;
}

export function ImportFilesPane({ into, onStart, onCancel }: Props) {
  const { t, i18n } = useTranslation("musicImport");
  const nameId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PickedFiles | null>(null);
  const [name, setName] = useState("");
  const [over, setOver] = useState(false);
  const files = picked?.files ?? [];
  const bytes = files.reduce((sum, f) => sum + f.size, 0);
  const onDrop = (e: DragEvent) => {
    // Pris ICI : la boîte « Importer une sortie » (dépôt n'importe où dans Octave) ne s'ouvre pas en plus.
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length) setPicked(pickAudio(e.dataTransfer.files));
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (picked && files.length > 0) onStart(picked, name.trim());
      }}
    >
      <p className="text-sm text-content-secondary">{t("filesIntro")}</p>
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
        <button type="button" onClick={() => input.current?.click()} className={`${BUTTON} border border-line-subtle text-content-primary hover:bg-octave-hover`}>
          {t(files.length > 0 ? "filesChange" : "filesChoose")}
        </button>
        <p className="text-xs text-content-tertiary">{t("filesDrop")}</p>
        <input
          ref={input}
          type="file"
          multiple
          accept={RELEASE_ACCEPT.join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) setPicked(pickAudio(e.target.files));
            e.target.value = "";
          }}
        />
      </div>
      {picked && (
        <div className="flex flex-col gap-1" aria-live="polite">
          {files.length > 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-fill-subtle px-3 py-2 text-sm text-content-primary">
              <FileAudio className="h-4 w-4 shrink-0 text-content-tertiary" aria-hidden />
              <span className="min-w-0 flex-1 truncate" title={files.map((f) => f.name).join("\n")}>
                {t("filesPicked", { count: files.length, size: formatBytes(bytes, i18n.language) })}
              </span>
            </p>
          )}
          {picked.ignored > 0 && <p className="text-xs text-amber-300">{t("filesIgnored", { count: picked.ignored })}</p>}
        </div>
      )}
      {!into && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-xs font-semibold text-content-secondary">
            {t("nameLabel")}
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="min-h-[44px] w-full rounded-xl border border-line-subtle bg-fill-subtle px-3 py-2.5 text-sm text-content-primary placeholder:text-content-quaternary focus-visible:border-line-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-[44px] cursor-pointer rounded-full px-4 text-sm font-semibold text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          {t("cancel")}
        </button>
        <button type="submit" disabled={files.length === 0} className="octave-brand-fill min-h-[44px] cursor-pointer rounded-full px-6 text-sm font-semibold disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          {t("filesStart")}
        </button>
      </div>
    </form>
  );
}
