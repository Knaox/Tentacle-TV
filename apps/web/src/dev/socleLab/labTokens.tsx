/**
 * Labo du socle — les JETONS : encres, texte, accent, rayons, ombres, typographie.
 * Chaque spécimen lit le jeton par `var()` : la page suit le thème, sombre ou clair.
 */

import { LabPanel, LabRow, LabSection, Specimen } from "./labKit";

const INKS = [
  ["--surface-0", "la page"],
  ["--surface-1", "panneau, feuille"],
  ["--surface-2", "carte, tuile, champ"],
  ["--surface-3", "survol, menu, avis"],
  ["--surface-4", "sélection"],
] as const;

const TEXTS = ["--text-primary", "--text-secondary", "--text-tertiary", "--text-quaternary", "--text-disabled"] as const;

const RADII = [
  ["--radius-sm", "6 · puce"],
  ["--radius-md", "10 · champ"],
  ["--radius-lg", "12 · carte"],
  ["--radius-xl", "16 · tuile, menu"],
  ["--radius-2xl", "20 · panneau"],
  ["--radius-3xl", "24 · feuille"],
  ["--radius-pill", "pilule · tout bouton"],
] as const;

const SHADOWS = ["--shadow-edge", "--elev-1", "--elev-2", "--elev-3", "--shadow-dropdown", "--shadow-modal"] as const;

const TYPE = [
  ["text-display-2", "Sueurs froides"],
  ["text-display-3", "La Mort aux trousses"],
  ["text-heading-1", "Reprendre la lecture"],
  ["text-heading-2", "Derniers ajouts"],
  ["text-heading-3", "Langues et sous-titres"],
] as const;

export function LabTokens() {
  return (
    <>
      <LabSection title="Encres" note="Une surface se distingue par sa teinte, plus par un liseré. Cinq encres, de la page à la sélection.">
        <LabRow>
          {INKS.map(([name, role]) => (
            <Specimen key={name} name={name}>
              <div className="h-20 w-36 rounded-tile shadow-edge" style={{ background: `var(${name})` }} />
              <span className="text-xs text-content-tertiary">{role}</span>
            </Specimen>
          ))}
        </LabRow>
        <LabRow>
          {TEXTS.map((name) => (
            <Specimen key={name} name={name}>
              {/* L'encre des contrôles inactifs se repère sans se lire (≥ 2:1) : son spécimen est dit inactif. */}
              <span className="text-base font-semibold" aria-disabled={name === "--text-disabled" || undefined} style={{ color: `var(${name})` }}>Tentacle TV</span>
            </Specimen>
          ))}
        </LabRow>
      </LabSection>

      <LabSection title="Accent" note="Le dégradé du logo ne sert qu'à lire (l'action de lecture) et à mesurer (les jauges). Un état actif prend la teinte franche. Jamais d'orange.">
        <LabRow>
          <Specimen name="--cta-brand-gradient">
            <div className="h-14 w-40 rounded-pill" style={{ background: "var(--cta-brand-gradient)" }} />
          </Specimen>
          <Specimen name="--gauge-gradient">
            <div className="h-14 w-40 rounded-pill" style={{ background: "var(--gauge-gradient)" }} />
          </Specimen>
          <Specimen name="--accent · --on-accent">
            <div className="flex h-14 w-40 items-center justify-center rounded-pill bg-accent text-sm font-semibold text-accent-on">Actif</div>
          </Specimen>
          <Specimen name="--accent-soft">
            <div className="flex h-14 w-40 items-center justify-center rounded-pill bg-accent-soft text-sm font-semibold text-accent">Choisi</div>
          </Specimen>
        </LabRow>
      </LabSection>

      <LabSection title="Rayons et ombres" note="Cinq rayons et la pilule. Le liseré d'avant est une ombre intérieure discrète (--shadow-edge).">
        <LabRow>
          {RADII.map(([name, role]) => (
            <Specimen key={name} name={name}>
              <div className="h-16 w-24 bg-surface-2" style={{ borderRadius: `var(${name})` }} />
              <span className="text-xs text-content-tertiary">{role}</span>
            </Specimen>
          ))}
        </LabRow>
        <LabRow>
          {SHADOWS.map((name) => (
            <Specimen key={name} name={name}>
              <div className="h-16 w-28 rounded-tile bg-surface-2" style={{ boxShadow: `var(${name})` }} />
            </Specimen>
          ))}
        </LabRow>
      </LabSection>

      <LabSection title="Typographie" note="Titres en Bricolage Grotesque, serrés ; texte en Figtree ; chiffres à chasse fixe là où un nombre change. Embarquées, jamais chargées d'un CDN.">
        <LabPanel>
          {TYPE.map(([cls, sample]) => (
            <Specimen key={cls} name={cls}>
              <span className={`${cls} text-content-primary`}>{sample}</span>
            </Specimen>
          ))}
          <Specimen name="texte · 14 px · Figtree">
            <p className="max-w-[65ch] text-sm leading-relaxed text-content-secondary">
              Un ancien policier sujet au vertige est chargé de suivre une femme que le passé semble posséder. Été 1958, San
              Francisco : « Voilà l'œuvre », dit-on — ÉÀÇ, œ, 0123456789.
            </p>
          </Specimen>
          <Specimen name=".ui-eyebrow">
            <span className="ui-eyebrow">Saison 2 · épisode 4</span>
          </Specimen>
          <Specimen name=".num (tabular-nums)">
            <span className="num text-heading-2 text-content-primary">1:11:11 — 0:48:27 — 42 %</span>
          </Specimen>
        </LabPanel>
      </LabSection>
    </>
  );
}
