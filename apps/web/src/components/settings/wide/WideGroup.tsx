import { createContext, useContext, type ReactNode } from "react";
import {
  WIDE_SETTINGS_SECTIONS, isWideSettingVisible, type WideSettingScope, type WideSettingsSectionId,
} from "@tentacle-tv/shared";
import { ScopeBadge } from "../ScopeBadge";
import { useCatalogText, useWideSettings } from "./wideSettingsMeta";

interface WideGroupProps {
  section: WideSettingsSectionId;
  group: string;
  caption?: ReactNode;
  /** Sans panneau : le contenu porte déjà les siens (la Famille, Octave). */
  bare?: boolean;
  /** Ni titre ni panneau : le contenu porte son propre titre (les réglages d'Octave). */
  untitled?: boolean;
  children: ReactNode;
}

/**
 * La portée que le TITRE du groupe porte déjà (toutes ses lignes ont la même) : une ligne ne la
 * répète pas. `null` : portées mêlées, ou ligne montée hors d'un groupe — chacune dit la sienne.
 */
const GroupScopeCtx = createContext<WideSettingScope | null>(null);

export function useGroupScope(): WideSettingScope | null {
  return useContext(GroupScopeCtx);
}

/**
 * Un GROUPE du catalogue, tel que le catalogue le nomme : un titre (la police des titres), la
 * portée commune de ses réglages à côté, puis UN panneau dont chaque ligne est un réglage ; rien
 * si aucune de ses lignes n'existe ici. Dire la portée une fois, sur le titre, plutôt que sur
 * chaque ligne : c'est ce qui allège la page sans rien taire (refonte de nov. 2026).
 */
export function WideGroup({ section, group, caption, bare, untitled, children }: WideGroupProps) {
  const text = useCatalogText();
  const ctx = useWideSettings();
  const found = WIDE_SETTINGS_SECTIONS.find((s) => s.id === section)?.groups.find((g) => g.id === group);
  if (!found) return null;
  const shown = ctx ? found.entries.filter((entry) => isWideSettingVisible(entry, ctx)) : found.entries;
  if (shown.length === 0) return null;
  if (untitled) return <>{children}</>;

  // Une information ou un geste ponctuel (portée `null`) ne compte pas : il n'a rien à dire.
  const scopes = [...new Set(shown.map((e) => e.scope).filter((s): s is WideSettingScope => s !== null))];
  const only = scopes.length === 1 ? scopes[0] : null;

  return (
    <section id={group} className="mb-9 scroll-mt-24">
      <header className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1">
        <h2 className="text-heading-3 text-content-primary">{text(found.title)}</h2>
        {only ? <ScopeBadge scope={only} /> : null}
      </header>
      <GroupScopeCtx.Provider value={only}>
        {bare ? children : <div className="lg-content ui-panel overflow-hidden">{children}</div>}
      </GroupScopeCtx.Provider>
      {caption ? <p className="mt-2 px-1 text-xs leading-5 text-content-tertiary">{caption}</p> : null}
    </section>
  );
}
