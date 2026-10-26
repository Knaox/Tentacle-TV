/**
 * Labo — `?vue=maquette` : le verre de la MAQUETTE du 26/10 (« Octave ·
 * Playlist — Liquid Glass »), construit avec le SOCLE seulement : le fond
 * ambiant (`GlassAmbient`, nos couleurs ou les teintes d'une image), des
 * panneaux `.lg-pane`, des pastilles `.lg-bead`, des rangées `.lg-pane-row`,
 * la navigation `.lg-pane-nav` et l'action principale par `PressableGlass`
 * (`material: "pane"`). Rien en ligne pour le matériau : seulement la mise en
 * page. `?verre=plat` montre la variante sans flou, pour juger à l'œil si la
 * passe de flou se voit sur le fond seul.
 */

import { useState } from "react";
import { Heart, Home, Library, ListMusic, Pause, Play, Search, Shuffle } from "lucide-react";
import { PressableGlass } from "../../components/ui/glass/PressableGlass";
import { GlassAmbient } from "../../theme/glass";

const TRACKS = [
  { n: 1, title: "Worth It", artist: "Corbin", album: "Cyberpunk: Edgerunners 2", dur: "2:41", art: "linear-gradient(135deg,#22d3ee,#7c3aed)" },
  { n: 2, title: "A Rusty Dream", artist: "DOUDOU", album: "Cyberpunk: Edgerunners 2", dur: "4:59", art: "linear-gradient(135deg,#ec4899,#22d3ee)" },
  { n: 3, title: "Sucker for Pain", artist: "Lil Wayne, Wiz Khalifa", album: "Suicide Squad: The Album", dur: "4:04", art: "linear-gradient(135deg,#f97316,#16a34a)" },
  { n: 4, title: "Rise Up", artist: "Imagine Dragons", album: "Evolve", dur: "3:51", art: "linear-gradient(135deg,#1e1b4b,#f59e0b)" },
];

const NAV = [
  { label: "Accueil", Icon: Home, current: true },
  { label: "Rechercher", Icon: Search, current: false },
  { label: "Bibliothèque", Icon: Library, current: false },
  { label: "Titres likés", Icon: Heart, current: false },
  { label: "Playlists", Icon: ListMusic, current: false },
];

const flatAsked = (): boolean => new URLSearchParams(window.location.search).get("verre") === "plat";

export function LabMockup({ top, poster }: { top: number; poster: string }) {
  const [tinted, setTinted] = useState(false);
  const [flat, setFlat] = useState(flatAsked);
  const [playing, setPlaying] = useState(false);
  const pane = flat ? "lg-pane lg-pane-flat" : "lg-pane";
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--surface-0)", color: "var(--text-primary)" }}>
      <GlassAmbient position="absolute" image={tinted ? poster : null} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 20, padding: `${top}px 20px 132px` }}>
        <aside className={pane} style={{ width: 280, minHeight: 620, padding: "22px 16px", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Octave</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.28em", color: "var(--lg-pane-glyph-secondary)" }}>TENTACLE</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="lg-bead" style={{ width: 32, height: 32 }} aria-label="Précédent">‹</button>
              <button type="button" className="lg-bead" style={{ width: 32, height: 32 }} aria-label="Suivant">›</button>
            </div>
          </div>
          <div className="lg-bead" style={{ borderRadius: 20, padding: 6 }}>
            <div style={{ padding: "10px 12px", fontSize: 15, fontWeight: 600 }}>Mode musique</div>
            <a className="lg-pane-nav" href="#films" style={{ display: "block", padding: "10px 12px", borderRadius: 14 }}>Films et séries</a>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {NAV.map(({ label, Icon, current }) => (
              <a key={label} className="lg-pane-nav" href={`#${label}`} aria-current={current ? "page" : undefined} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 14, fontSize: 16, fontWeight: 500 }}>
                <Icon size={20} aria-hidden />
                {label}
              </a>
            ))}
          </nav>
        </aside>
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 28, padding: "24px 12px 0" }}>
          <section style={{ display: "flex", alignItems: "flex-end", gap: 36 }}>
            <div className={pane} style={{ width: 240, height: 240, padding: 10, flexShrink: 0 }}>
              <div style={{ width: "100%", height: "100%", borderRadius: 22, background: TRACKS[0]?.art }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="lg-bead" style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.24em" }}>PLAYLIST</div>
              <h1 style={{ margin: 0, fontSize: 76, lineHeight: 0.95, fontWeight: 800, letterSpacing: "-0.04em" }}>Musique 2026</h1>
              <div style={{ fontSize: 16, color: "var(--text-secondary)" }}>4 titres · 16 min</div>
            </div>
          </section>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <PressableGlass appearance={{ material: "pane", level: "prominent", shape: "capsule" }} className="flex h-14 items-center gap-3 px-8 text-[17px] font-bold" fallbackClassName="hero-cta-primary rounded-full">
              <Play size={18} fill="currentColor" aria-hidden /> Lecture
            </PressableGlass>
            <PressableGlass appearance={{ material: "pane", shape: "capsule" }} className="flex h-14 items-center gap-3 px-7 text-[17px] font-semibold" fallbackClassName="rounded-full border border-line-subtle">
              <Shuffle size={18} aria-hidden /> Aléatoire
            </PressableGlass>
            <button type="button" className="lg-bead" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => setTinted((t) => !t)}>
              {tinted ? "nos couleurs" : "teinte d'une image"}
            </button>
            <button type="button" className="lg-bead" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => setFlat((f) => !f)}>
              {flat ? "givre" : "sans flou"}
            </button>
          </div>
          <section className={pane} style={{ padding: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "56px 2fr 1.6fr 80px", gap: 16, padding: "14px 18px", fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "var(--lg-pane-glyph-secondary)", borderBottom: "1px solid var(--lg-pane-separator)" }}>
              <div style={{ textAlign: "center" }}>N°</div><div>TITRE</div><div>ALBUM</div><div style={{ textAlign: "right" }}>DURÉE</div>
            </div>
            {TRACKS.map((t) => (
              <div key={t.n} className="lg-pane-row" data-selected={t.n === 2 ? "true" : undefined} style={{ display: "grid", gridTemplateColumns: "56px 2fr 1.6fr 80px", gap: 16, alignItems: "center", padding: "10px 18px", borderRadius: 18, marginTop: 4 }}>
                <div style={{ textAlign: "center", fontSize: 15, color: "var(--lg-pane-glyph-secondary)" }}>{t.n}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <div style={{ width: 50, height: 50, flexShrink: 0, borderRadius: 12, background: t.art }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: 14, color: "var(--lg-pane-glyph-secondary)" }}>{t.artist}</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "var(--lg-pane-glyph-secondary)" }}>{t.album}</div>
                <div style={{ textAlign: "right", fontSize: 14, color: "var(--lg-pane-glyph-secondary)" }}>{t.dur}</div>
              </div>
            ))}
          </section>
        </main>
      </div>
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 20, zIndex: 2 }}>
        <div className="lg-pane" style={{ borderRadius: 32, padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 58, height: 58, borderRadius: 14, background: "linear-gradient(135deg,#22d3ee,#7c3aed 60%,#ec4899)" }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Welcome Back to Night City</div>
              <div style={{ fontSize: 13, color: "var(--lg-pane-glyph-secondary)" }}>Tsuneo Imahori · Cyberpunk: Edgerunners 2</div>
            </div>
          </div>
          <PressableGlass appearance={{ material: "pane", level: "prominent", shape: "circle" }} className="flex h-[58px] w-[58px] items-center justify-center" fallbackClassName="hero-cta-primary rounded-full" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Lecture"}>
            {playing ? <Pause size={22} fill="currentColor" aria-hidden /> : <Play size={22} fill="currentColor" aria-hidden />}
          </PressableGlass>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="lg-bead" style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>Opus</div>
            <div className="lg-bead" style={{ width: 120, height: 6, position: "relative" }}>
              <div style={{ position: "absolute", inset: "0 18% 0 0", borderRadius: 999, background: "linear-gradient(90deg, var(--brand-mid), var(--brand-accent))" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
