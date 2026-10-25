/**
 * Octave — LA bascule du mode : un interrupteur dont le pouce porte le logo
 * d'Octave. Allumé, on est dans la musique ; éteint, dans les films et séries.
 * Le mode reste tel quel quand on quitte l'application (`octaveMode.ts`).
 *
 * - `placement="tentacle"` (barre de Tentacle) : n'existe qu'avec la musique
 *   (`useOctaveAvailability`) ; reflète le mode. L'allumer passe dans Octave ;
 *   l'éteindre (mode resté allumé, page vidéo ouverte par un lien) l'éteint
 *   sur place.
 * - `placement="octave"` (coquille d'Octave) : toujours allumé ; l'éteindre,
 *   c'est `onExit`.
 *
 * INSTANTANÉ : le pouce glisse au clic (état optimiste), et l'on ne change de
 * page qu'une fois le module d'Octave en main et son cache gardé relu (borné à
 * 200 ms) — jamais d'écran vide entre les deux. Le module se prépare dès le
 * survol ou le focus.
 *
 * `role="switch"` + `aria-checked` : annoncé « activé / désactivé ». Espace et
 * Entrée par le `<button>` natif ; cible de 50 × 36 px ; mouvement réduit :
 * plus de glissement (`octaveModeSwitch.css`).
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./octaveModeSwitch.css";
import { OctaveSwitchGlyph } from "./octaveSwitchGlyph";
import { loadOctaveApp } from "./OctaveEntry";
import { OCTAVE_BASE_PATH, setOctaveMode, useOctaveMode } from "./octaveMode";
import { useOctaveAvailability } from "./useOctaveAvailability";

type OctaveModeSwitchProps =
  | { placement: "tentacle"; showLabel?: boolean; className?: string }
  | { placement: "octave"; onExit: () => void; showLabel?: boolean; className?: string };

const preload = () => void loadOctaveApp().catch(() => undefined);

export function OctaveModeSwitch(props: OctaveModeSwitchProps) {
  const { t } = useTranslation("music");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mode = useOctaveMode();
  const inOctave = props.placement === "octave";
  // Dans Octave, la disponibilité est déjà acquise (sa porte l'a vérifiée).
  const { available } = useOctaveAvailability(!inOctave);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  if (!inOctave && !available) return null;

  const checked = optimistic ?? (inOctave || mode);

  const toggle = () => {
    if (props.placement === "octave") {
      setOptimistic(false);
      props.onExit();
      return;
    }
    if (checked) {
      setOptimistic(null);
      setOctaveMode(false);
      return;
    }
    setOptimistic(true);
    loadOctaveApp()
      .then((octave) => octave.warmOctaveCache(queryClient))
      .then(
        () => {
          setOctaveMode(true);
          navigate(OCTAVE_BASE_PATH);
        },
        () => setOptimistic(null),
      );
  };

  const label = t("mode.switchLabel");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={checked ? t("mode.exitHint") : t("mode.enterHint")}
      onClick={toggle}
      onPointerEnter={inOctave ? undefined : preload}
      onFocus={inOctave ? undefined : preload}
      className={`octave-switch shrink-0 ${props.className ?? ""}`}
      data-octave-switch={props.placement}
    >
      {props.showLabel && <span className="text-sm font-semibold text-content-secondary">{label}</span>}
      <span aria-hidden className="octave-switch-track">
        <span className="octave-switch-thumb">
          <OctaveSwitchGlyph size={18} />
        </span>
      </span>
    </button>
  );
}
