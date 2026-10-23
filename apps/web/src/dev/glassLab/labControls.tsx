/**
 * Labo du verre — la vue « contrôles » (`/dev/verre?vue=controles`, lot lg4).
 *
 * Les CONTRÔLES des pages en verre (`glass` / `glassProminent` de macOS 26),
 * avec les VRAIS composants : champ de recherche, pastilles de filtre (une
 * posée), tri et sens du tri, « Partager », « Sélectionner », segmentés (la
 * lentille qui glisse), interrupteur, et les boutons ad hoc reconnus à leur
 * forme (principal, secondaire, « Modifier », danger). Deux dessous : le
 * panneau d'outils OPAQUE (le contenu) et le fond nu de la page. Le tout dans
 * une `.lg-page`, comme les pages : la peau n'existe que là.
 *
 * Aucun appel réseau ; paquets de développement seulement, comme tout le labo.
 */

import { useState, type CSSProperties } from "react";
import { ArrowDownWideNarrow, CheckSquare, Share2 } from "lucide-react";

import { SegmentedControl } from "../../components/library/SegmentedControl";
import { chipCls } from "../../components/library/filterChip";
import { ScopedSearchField } from "../../components/search/ScopedSearchField";
import { SegmentedChoice } from "../../components/settings/SegmentedChoice";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";

const GROUPS = [
  { value: "none", label: "Aucun" },
  { value: "type", label: "Type" },
  { value: "watch", label: "Visionnage" },
  { value: "genre", label: "Genre" },
] as const;

// Les formes des boutons ad hoc des pages, recopiées telles quelles.
const PRIMARY = "inline-flex h-11 items-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 text-sm font-bold text-cta-primary-fg";
const SECONDARY = "inline-flex h-11 items-center gap-2 rounded-full bg-[color:var(--surface-2)] px-6 text-sm font-semibold text-content-secondary ring-1 ring-line-strong";
const EDIT = "rounded-lg bg-fill-soft px-3 py-1.5 text-xs text-content-secondary hover:bg-fill-medium";
const DANGER = "rounded-full border border-danger-border bg-danger-surface px-4 py-2 text-sm font-medium text-status-error";
const ROUND = "lg-content-control flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--surface-2)] text-content-secondary ring-1 ring-line-strong";
const SHARE = "lg-content-control lg-content-accent inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-[color:var(--surface-2)] px-3.5 text-xs font-semibold text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.5)]";

const row: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 };

function Controls() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]["value"]>("none");
  const [delay, setDelay] = useState<"05" | "08" | "12" | "20">("08");
  const [on, setOn] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={row}>
        <ScopedSearchField value={query} onChange={setQuery} placeholder="Rechercher dans Mes favoris…" className="max-w-[340px]" />
        <button type="button" className={chipCls(false)}><ArrowDownWideNarrow size={14} className="mr-1 inline" />Titre A→Z</button>
        <button type="button" aria-label="Sens du tri" className={ROUND}><ArrowDownWideNarrow size={15} /></button>
        <button type="button" className={SHARE}><Share2 size={14} />Partager mes titres likés</button>
        <button type="button" className={chipCls(false)}><CheckSquare size={14} className="mr-1 inline" />Sélectionner</button>
      </div>
      <div style={row}>
        <SegmentedControl label="Regrouper" markerId="lab-controls-group" options={GROUPS} value={group} onChange={setGroup} />
        <button type="button" className={chipCls(false)}>Genres</button>
        <button type="button" className={chipCls(true)}>Favoris</button>
        <button type="button" className={chipCls(true, "rose")}>Non vus</button>
      </div>
      <div style={row}>
        <SegmentedChoice
          label="Délai avant l'aperçu"
          value={delay}
          onChange={setDelay}
          options={[{ value: "05", label: "0,5 s" }, { value: "08", label: "0,8 s" }, { value: "12", label: "1,2 s" }, { value: "20", label: "2 s" }]}
        />
        <ToggleSwitch checked={on} onChange={setOn} label="Liquid Glass" />
        <ToggleSwitch checked={!on} onChange={(v) => setOn(!v)} label="Aperçus" />
      </div>
      <div style={row}>
        <button type="button" className={PRIMARY}>Explorer l&apos;accueil</button>
        <button type="button" className={SECONDARY}>Chercher un titre</button>
        <button type="button" className={EDIT}>Modifier</button>
        <button type="button" className={DANGER}>Réinitialiser mon profil</button>
      </div>
    </div>
  );
}

export function LabControls({ top }: { top: number }) {
  return (
    <div className="lg-page" style={{ position: "absolute", top, left: 24, right: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <section className="lg-content rounded-[var(--radius-xl)] bg-surface-1 p-4 ring-1 ring-line-subtle" style={{ maxWidth: 1040 }}>
        <Controls />
      </section>
      <section className="rounded-[var(--radius-xl)] p-4" style={{ maxWidth: 1040, background: "var(--surface-0)" }}>
        <Controls />
      </section>
    </div>
  );
}
