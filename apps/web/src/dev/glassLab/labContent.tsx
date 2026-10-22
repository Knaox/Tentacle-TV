/**
 * Labo du verre — la vue « contenu » (`/dev/verre?vue=contenu`).
 *
 * ⚠️ Ce fichier APPARTIENT à la couche de contenu (lot lg2, axe D) : les VRAIS
 * composants des pages, posés sur les mêmes dessous (`?fond=…`), pour juger
 * les remplissages qui remplacent le verre — groupe de réglages, contrôle
 * segmenté des réglages et des barres d'outils, pastilles de filtre, tuiles du
 * bilan de Mes favoris (l'une choisie, l'une désactivée). Les panneaux à
 * droite chevauchent le dessous : un remplissage du contenu y reste OPAQUE.
 *
 * Aucun appel réseau ; paquets de développement seulement, comme tout le labo.
 */

import { useState, type CSSProperties } from "react";
import { Moon, Sparkles, Sun } from "lucide-react";
import type { CollectionTypeTab } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";

import { FavoritesOverview } from "../../components/favorites/FavoritesOverview";
import { SegmentedControl } from "../../components/library/SegmentedControl";
import { chipCls } from "../../components/library/filterChip";
import { SegmentedChoice } from "../../components/settings/SegmentedChoice";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";

// Deux films, dont un entamé : « Séries » reste à 0, donc désactivée.
const ITEMS = [
  { Id: "lab-1", Name: "Abysse", Type: "Movie", UserData: { Played: false, PlaybackPositionTicks: 0 } },
  { Id: "lab-2", Name: "Ambre", Type: "Movie", UserData: { Played: false, PlaybackPositionTicks: 6e9 } },
] as unknown as MediaItem[];

const GROUPS = [
  { value: "none", label: "Aucun" },
  { value: "type", label: "Type" },
  { value: "genre", label: "Genre" },
] as const;

const column = (top: number, left: number, width: number): CSSProperties => ({
  position: "absolute", top, left, width, display: "flex", flexDirection: "column", gap: 16,
});

export function LabContent({ top }: { top: number }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [on, setOn] = useState(true);
  const [delay, setDelay] = useState<"05" | "08" | "12">("08");
  const [group, setGroup] = useState<(typeof GROUPS)[number]["value"]>("none");
  const [type, setType] = useState<CollectionTypeTab>("Movie");
  const [status, setStatus] = useState<string | null>(null);

  return (
    <>
      <div style={column(top, 24, 460)}>
        <SettingsSection title="Thème" caption="Le groupe de réglages : un remplissage, jamais un verre.">
          <SettingsRow icon={<Sun size={18} />} label="Clair" onClick={() => setTheme("light")} value={theme === "light" ? "✓" : undefined} />
          <SettingsRow icon={<Moon size={18} />} label="Sombre" description="Suit le réglage du système" onClick={() => setTheme("dark")} last />
        </SettingsSection>
        <SettingsSection title="Effets">
          <SettingsRow
            icon={<Sparkles size={18} />}
            label="Liquid Glass"
            trailing={<ToggleSwitch checked={on} onChange={setOn} label="Liquid Glass" />}
          />
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-content-primary">Délai avant l&apos;aperçu</span>
            <SegmentedChoice
              label="Délai"
              value={delay}
              onChange={setDelay}
              options={[{ value: "05", label: "0,5 s" }, { value: "08", label: "0,8 s" }, { value: "12", label: "1,2 s" }]}
            />
          </div>
        </SettingsSection>
      </div>

      <div style={column(top, 520, 720)}>
        <section className="lg-content rounded-[var(--radius-xl)] bg-surface-1 p-3 ring-1 ring-line-subtle">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl label="Regrouper" markerId="lab-group-marker" options={GROUPS} value={group} onChange={setGroup} />
            <button type="button" className={chipCls(false)}>Genres</button>
            <button type="button" className={chipCls(true)}>Favoris</button>
            <button type="button" className={chipCls(true, "rose")}>Non vus</button>
          </div>
        </section>
        <FavoritesOverview items={ITEMS} type={type} status={status} onTypeChange={setType} onStatusChange={setStatus} />
      </div>
    </>
  );
}
