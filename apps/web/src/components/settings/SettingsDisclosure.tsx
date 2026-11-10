/**
 * Un repli de réglages : un titre qu'on ouvre, et ce qu'il cache.
 *
 * # Pourquoi replier, et pourquoi FERMÉ par défaut
 *
 * Le panneau avancé de lecture déversait d'un coup quatre passages et cinq
 * réglages de fin d'épisode — une vingtaine de contrôles sur un seul écran.
 * Chacun se justifie ; ensemble ils forment un mur, et un mur ne se lit pas :
 * on ne sait plus où poser les yeux, donc on referme.
 *
 * Fermé par défaut, chaque groupe redevient une PHRASE — « les passages d'un
 * épisode », « à la fin d'un épisode » — qu'on ouvre quand on la cherche. Le
 * réglage fin ne disparaît pas, il cesse d'être le premier écueil.
 *
 * Le contenu n'est pas monté tant qu'il est fermé : rien à peindre, rien à
 * mesurer, et pas de champ caché qui capte le focus au clavier.
 */

import { useState, type ReactNode } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";

interface SettingsDisclosureProps {
  title: string;
  /** Ce que le groupe contient, en une ligne — visible même replié. */
  summary?: string;
  /** Ouvert d'emblée : réservé au cas où l'utilisateur y a déjà travaillé. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SettingsDisclosure({
  title, summary, defaultOpen = false, children,
}: SettingsDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-field text-left transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <CaretRightIcon
          size={14}
          weight="bold"
          aria-hidden
          className={`shrink-0 text-content-tertiary transition-transform duration-hover ease-out motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-content-primary">{title}</span>
          {summary !== undefined && !open && (
            <span className="block text-[13px] leading-relaxed text-content-tertiary">{summary}</span>
          )}
        </span>
      </button>

      {open && <div className="mt-4 pl-6">{children}</div>}
    </div>
  );
}
