/**
 * Octave — le premier écran de l'import : un seul champ (un lien, ou une
 * liste collée), ce qu'Octave en a compris SOUS le champ (la source et sa
 * marque, ou le nombre de titres), et ce qui entrera dans la playlist.
 */

import { useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CORE_IMPORT_SOURCES, type MusicImportSource } from "@tentacle-tv/shared/music";
import { classifyPasted, type ImportUserInput } from "@tentacle-tv/api-client";
import { SourceMark, SourceRow } from "./SourceMark";

interface Props {
  titleId: string;
  value: string;
  onChange: (value: string) => void;
  extensionSources: readonly MusicImportSource[];
  /** Le serveur lit un lien de partage d'un autre Tentacle (`music.playlistShare`). */
  tentacleShare?: boolean;
  outsideSupported: boolean;
  onStart: (input: ImportUserInput) => void;
  onCancel: () => void;
  /** Le choix « Lien ou liste · Un album · Fichiers », sous le titre. */
  tabs?: ReactNode;
}

export function ImportForm({ titleId, value, onChange, extensionSources, tentacleShare = false, outsideSupported, onStart, onCancel, tabs }: Props) {
  const { t } = useTranslation("musicImport");
  const fieldId = useId();
  const hintId = useId();
  const pasted = useMemo(() => classifyPasted(value, extensionSources, tentacleShare), [value, extensionSources, tentacleShare]);
  const sources = useMemo(
    () => [...CORE_IMPORT_SOURCES, ...extensionSources.filter((s) => !CORE_IMPORT_SOURCES.includes(s) && s !== "tentacle"), ...(tentacleShare ? (["tentacle"] as const) : [])],
    [extensionSources, tentacleShare],
  );
  const input = (pasted.kind === "url" && pasted.readable) || pasted.kind === "text" ? pasted.input : null;

  let hint: { text: string; tone: "ok" | "warn" | "muted"; source?: MusicImportSource } = { text: t("sources"), tone: "muted" };
  if (pasted.kind === "url") {
    const source = t(`source.${pasted.source}`);
    const refusal = pasted.source === "tentacle" ? t("notRecognized") : t("needsExtension");
    hint = pasted.readable ? { text: t(pasted.album ? "recognizedAlbum" : "recognized", { source }), tone: "ok", source: pasted.source } : { text: refusal, tone: "warn", source: pasted.source };
  } else if (pasted.kind === "unknownUrl") hint = { text: t("notRecognized"), tone: "warn" };
  else if (pasted.kind === "text") hint = { text: t("recognizedText", { count: pasted.lines }), tone: "ok", source: "text" };

  const submit = () => {
    if (input) onStart(input);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
            {t("title")}
          </h2>
          <p className="text-sm text-content-secondary">{t("intro")}</p>
        </div>
        <SourceRow sources={sources} />
      </div>
      {tabs}
      <label htmlFor={fieldId} className="sr-only">
        {t("fieldLabel")}
      </label>
      <textarea
        id={fieldId}
        autoFocus
        value={value}
        rows={value.includes("\n") ? 6 : 2}
        spellCheck={false}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Entrée envoie un LIEN ; dans une liste, elle passe à la ligne.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && pasted.kind === "url") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t("placeholder")}
        className="min-h-[56px] w-full resize-y rounded-xl border border-line-subtle bg-fill-subtle px-3 py-2.5 font-mono text-[13px] leading-relaxed text-content-primary placeholder:font-sans placeholder:text-content-quaternary focus-visible:border-line-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      />
      <p id={hintId} aria-live="polite" className={`flex min-h-[24px] items-center gap-2 text-sm ${hint.tone === "warn" ? "text-amber-300" : hint.tone === "ok" ? "text-content-primary" : "text-content-tertiary"}`}>
        {hint.source && <SourceMark source={hint.source} className="h-5 w-5" />}
        {hint.text}
      </p>
      <p className="text-xs text-content-tertiary">{t(outsideSupported ? "withOutside" : "libraryOnly")}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-[44px] cursor-pointer rounded-full px-4 text-sm font-semibold text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          {t("cancel")}
        </button>
        <button type="submit" disabled={!input} className="octave-brand-fill min-h-[44px] cursor-pointer rounded-full px-6 text-sm font-semibold disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          {t("start")}
        </button>
      </div>
    </form>
  );
}
