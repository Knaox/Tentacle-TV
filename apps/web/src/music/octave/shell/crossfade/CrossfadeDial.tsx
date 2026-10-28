/**
 * Octave — le RÉGLAGE de la transition douce dans le lecteur (bureau, web) : la valeur en mots, le dessin du
 * fondu, une réglette à douze crans (coupée, puis 2 → 12 s : `CROSSFADE_STOPS_S`) et « couper / activer » en un
 * clic. Le même réglage que la page Réglages d'Octave (`engine/crossfadeSetting.ts`, magasin partagé).
 */

import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CROSSFADE_DEFAULT_MS, CROSSFADE_STOPS_S, crossfadeStopIndex } from "@tentacle-tv/shared/octave";
import { setCrossfadeMs, useCrossfadeMs } from "../../../engine/crossfadeSetting";
import { RangeSlider } from "../RangeSlider";
import { CrossfadeGraph } from "./CrossfadeGraph";

const LAST = CROSSFADE_STOPS_S.length - 1;

export const CrossfadeDial = memo(function CrossfadeDial() {
  const { t } = useTranslation("octaveShell");
  const ms = useCrossfadeMs();
  const on = ms > 0;
  const lastOn = useRef(on ? ms : CROSSFADE_DEFAULT_MS);
  if (on) lastOn.current = ms;
  const index = crossfadeStopIndex(ms);
  const label = on ? t("crossfade.seconds", { count: ms / 1000 }) : t("crossfade.off");
  return (
    <div className="flex w-72 flex-col gap-3" data-crossfade-dial>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-content-primary">{t("crossfade.label")}</p>
          <p className={`text-xs font-semibold tabular-nums ${on ? "text-octave-accent-text" : "text-content-tertiary"}`} aria-live="polite">{label}</p>
        </div>
        <button
          type="button"
          onClick={() => setCrossfadeMs(on ? 0 : lastOn.current)}
          className="h-8 shrink-0 cursor-pointer rounded-full border border-line-subtle px-3 text-xs font-semibold text-content-primary transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {on ? t("crossfade.turnOff") : t("crossfade.turnOn")}
        </button>
      </div>
      <div>
        <CrossfadeGraph ms={ms} />
        <div className="mt-1 flex justify-between text-[11px] text-content-tertiary" aria-hidden>
          <span>{t("crossfade.outgoing")}</span>
          <span>{t("crossfade.incoming")}</span>
        </div>
      </div>
      <div>
        <RangeSlider
          className="w-full"
          fill="progress"
          ratio={index / LAST}
          min={0}
          max={LAST}
          step={1}
          value={index}
          aria-label={t("crossfade.duration")}
          aria-valuetext={label}
          onChange={(e) => setCrossfadeMs((CROSSFADE_STOPS_S[Number(e.target.value)] ?? 0) * 1000)}
        />
        <div className="mt-1 flex justify-between text-[11px] font-semibold text-content-tertiary" aria-hidden>
          <span className={on ? "" : "text-octave-accent-text"}>{t("crossfade.off")}</span>
          <span>{t("crossfade.seconds", { count: CROSSFADE_STOPS_S[LAST] })}</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-content-tertiary">{on ? t("crossfade.controlHint") : t("crossfade.controlOff")}</p>
    </div>
  );
});
