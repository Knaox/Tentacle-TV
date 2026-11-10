import { useContext, useEffect, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { WIDE_SETTINGS_BY_ID, isWideSettingVisible, type WideSettingId } from "@tentacle-tv/shared";
import { SettingTargetCtx, useCatalogText, useWideSettings } from "./wideSettingsMeta";

interface AdvancedFoldProps {
  /** Ce que le repli contient, dit en clair TANT QU'IL EST FERMÉ : rien ne disparaît de la page. */
  summary: string;
  /** Ouvert d'emblée (une ancre le vise, ou l'on y a déjà réglé quelque chose). */
  defaultOpen?: boolean;
  /** Passe à vrai : le repli s'ouvre (la recherche vient de viser une de ses lignes). */
  openSignal?: boolean;
  /** `inset` : dans une ligne de réglage, sous ses contrôles courants — sans marge à lui. */
  inset?: boolean;
  children: ReactNode;
}

/**
 * « AVANCÉ » — le repli des réglages rares (refonte de nov. 2026). Fermé, il tient en une
 * ligne qui NOMME ce qu'il cache ; ouvert, il montre des lignes comme les autres. Le contenu
 * n'est monté qu'ouvert : ni peinture, ni minuteur d'aperçu, ni champ caché dans le parcours du
 * clavier. Rien ne s'anime que le chevron (une rotation) : un repli qu'on ouvre au clavier ou
 * dix fois de suite ne doit pas faire attendre.
 */
export function AdvancedFold({ summary, defaultOpen = false, openSignal = false, inset = false, children }: AdvancedFoldProps) {
  const { t } = useTranslation("settingsWeb");
  const [open, setOpen] = useState(defaultOpen || openSignal);
  const panelId = useId();

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  return (
    <div className={inset ? "" : "border-line-subtle [&:not(:first-child)]:border-t"}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? undefined : `${t("advanced.title")} — ${summary}`}
        className={`flex w-full items-center gap-3 text-left transition-colors duration-hover hover:bg-fill-faint focus-visible:bg-fill-faint focus-visible:outline-none ${inset ? "min-h-10 rounded-field px-2 py-1.5 -mx-2" : "min-h-[52px] px-5 py-3"}`}
      >
        <CaretRightIcon
          size={14}
          weight="bold"
          aria-hidden
          className={`shrink-0 text-content-tertiary transition-transform duration-hover ease-out motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-content-primary">{t("advanced.title")}</span>
          {open ? null : <span className="block truncate text-[13px] leading-relaxed text-content-tertiary">{summary}</span>}
        </span>
      </button>
      <div id={panelId} hidden={!open} className={inset ? "pt-3" : "border-t border-line-subtle"}>
        {open ? children : null}
      </div>
    </div>
  );
}

interface AdvancedSettingsProps {
  /** Les réglages du catalogue que le repli contient (ceux marqués `advanced`). */
  settings: readonly WideSettingId[];
  /** Ouvert d'emblée — un réglage du repli n'est plus à sa valeur livrée. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Le repli « Avancé » d'un GROUPE : ses lignes sont des réglages du catalogue. Fermé, il les
 * nomme (leurs libellés) ; la recherche les trouve, et l'adresse qui en vise un (`#<id>`) ouvre
 * le repli. Rien si aucun de ses réglages n'existe ici.
 */
export function AdvancedSettings({ settings, defaultOpen, children }: AdvancedSettingsProps) {
  const { t } = useTranslation("settingsWeb");
  const text = useCatalogText();
  const ctx = useWideSettings();
  const target = useContext(SettingTargetCtx);
  const shown = settings.filter((id) => ctx === null || isWideSettingVisible(WIDE_SETTINGS_BY_ID[id], ctx));
  if (shown.length === 0) return null;
  const list = shown.map((id) => text(WIDE_SETTINGS_BY_ID[id].label)).join(", ");
  return (
    <AdvancedFold
      summary={t("advanced.summary", { list })}
      defaultOpen={defaultOpen}
      openSignal={target !== null && (settings as readonly string[]).includes(target)}
    >
      {children}
    </AdvancedFold>
  );
}
