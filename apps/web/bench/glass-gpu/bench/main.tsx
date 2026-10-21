/**
 * Page du banc GPU du verre (construite en PRODUCTION par `run-bench.mjs`).
 * `window.__bench.set({...})` règle la passe : physique allumée ou non,
 * capsules rapprochées ou non.
 */

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import "../../../src/theme/tokens.css";
import "../../../src/theme/liquidGlassTokens.css";
import "../../../src/theme/glass/physics.css";
import "../../../src/theme/motion-reduce.css";
import "./bench.css";
import { GlassFusion } from "../../../src/theme/glass/GlassFusion";
import { GlassSpecular } from "../../../src/theme/glass/GlassSpecular";
import { installGlassAccessibility } from "../../../src/theme/glass/accessibility";
import { useSpecularHighlight } from "../../../src/theme/glass/useSpecularHighlight";

interface BenchState {
  physics: boolean;
  fused: boolean;
}

declare global {
  interface Window {
    __bench: { set: (next: Partial<BenchState>) => void; ready: boolean };
  }
}

function Capsule({ physics, label }: { physics: boolean; label: string }) {
  const specRef = useSpecularHighlight<HTMLButtonElement>();
  return physics ? (
    <button ref={specRef} className="bench-glass" data-lg-lens="">
      {label}
      <GlassSpecular />
    </button>
  ) : (
    <button className="bench-glass">{label}</button>
  );
}

/** Surface au reflet diffus du socle (`--lgc-sheen`) : la lumière PLACÉE dans le dégradé. */
function SheenCapsule({ physics }: { physics: boolean }) {
  const specRef = useSpecularHighlight<HTMLButtonElement>({ sheen: true });
  return (
    <button ref={physics ? specRef : undefined} className="bench-glass bench-sheen">
      Reflet diffus
    </button>
  );
}

function Bench() {
  const [state, setState] = useState<BenchState>({ physics: true, fused: false });
  useEffect(() => {
    window.__bench = { set: (next) => setState((s) => ({ ...s, ...next })), ready: true };
  }, []);
  const gap = state.fused ? 4 : 48;
  return (
    <>
      <div className="bench-backdrop" />
      <div className="bench-stage">
        {["Lecture", "Pistes", "Épisodes", "Sous-titres", "Qualité", "Plein écran"].map((l) => (
          <Capsule key={`${l}-${state.physics}`} physics={state.physics} label={l} />
        ))}
        <SheenCapsule key={`sheen-${state.physics}`} physics={state.physics} />
      </div>
      <GlassFusion className="bench-fusion" spacing={state.physics ? 12 : 0} shapeClassName="bench-fuse-shape">
        {["a", "b", "c"].map((id, i) => (
          <div key={id} data-lg-fuse={id} style={{ marginLeft: i === 0 ? 0 : gap }}>
            {id.toUpperCase()}
          </div>
        ))}
      </GlassFusion>
    </>
  );
}

installGlassAccessibility();
createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Bench />
  </StrictMode>,
);
