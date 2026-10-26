import type { ReactNode } from "react";
import { SettingsSection } from "@tentacle-tv/ui";
import { WIDE_SETTINGS_SECTIONS, isWideSettingVisible, type WideSettingsSectionId } from "@tentacle-tv/shared";
import { ScopeBadge } from "../ScopeBadge";
import { useCatalogText, useWideSettings } from "./wideSettingsMeta";

interface WideGroupProps {
  section: WideSettingsSectionId;
  group: string;
  caption?: ReactNode;
  /** Sans carte : le contenu porte déjà les siennes (la Famille, Octave). */
  bare?: boolean;
  /** Ni titre ni carte : le contenu porte son propre titre (les réglages d'Octave). */
  untitled?: boolean;
  children: ReactNode;
}

/**
 * Un GROUPE du catalogue (une carte titrée), tel que le catalogue le nomme ;
 * rien si aucune de ses lignes n'existe ici. Un groupe d'une seule portée la
 * porte sur son titre quand son contenu n'a pas de lignes à lui (`bare`).
 */
export function WideGroup({ section, group, caption, bare, untitled, children }: WideGroupProps) {
  const text = useCatalogText();
  const ctx = useWideSettings();
  const found = WIDE_SETTINGS_SECTIONS.find((s) => s.id === section)?.groups.find((g) => g.id === group);
  if (!found) return null;
  if (ctx && !found.entries.some((entry) => isWideSettingVisible(entry, ctx))) return null;
  if (untitled) return <>{children}</>;
  if (bare) {
    const scopes = [...new Set(found.entries.map((e) => e.scope))];
    const only = scopes.length === 1 ? scopes[0] : null;
    return (
      <section id={group} className="mb-6 scroll-mt-24">
        <div className="mb-2 flex items-center gap-2 px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">{text(found.title)}</h2>
          {only ? <ScopeBadge scope={only} /> : null}
        </div>
        {children}
      </section>
    );
  }
  return (
    <SettingsSection id={group} title={text(found.title)} caption={caption}>
      {/* La dernière ligne rendue n'a pas de filet : une ligne absente ici (HDR hors Windows) ne laisse pas de trait. */}
      <div className="[&>[data-setting]:last-child]:border-b-0">{children}</div>
    </SettingsSection>
  );
}
