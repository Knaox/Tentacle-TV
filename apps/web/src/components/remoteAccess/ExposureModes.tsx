import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StatusPill } from "../admin/kit";

type Mode = "private" | "public";

/**
 * Privé ou public, en deux petits schémas : qui joint Tentacle, et par où.
 * Le réglage en cours est dit en toutes lettres (« Réglage actuel »), jamais
 * par la seule couleur. Les schémas sont décoratifs pour un lecteur d'écran
 * qui lit déjà la phrase — ils portent tout de même leur description.
 */
export const ExposureModes = memo(function ExposureModes({ current, ip }: { current: Mode; ip: string | null }) {
  const { t } = useTranslation("remoteAccess");
  const ipLabel = ip ?? "203.0.113.x";
  return (
    <section aria-labelledby="exposure-modes" className="space-y-3">
      <h2 id="exposure-modes" className="text-base font-semibold text-content-primary">{t("modesTitle")}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {(["private", "public"] as const).map((mode) => {
          const active = mode === current;
          return (
            <div
              key={mode}
              className={`rounded-xl border p-4 ${active ? "border-[rgba(var(--brand-rgb),0.55)] bg-[var(--brand-soft)]" : "border-line-subtle bg-fill-faint"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-content-primary">{t(mode === "private" ? "modePrivateTitle" : "modePublicTitle")}</p>
                {active ? (
                  <StatusPill tone="brand" size="sm" dot={false}>
                    {t("modeCurrent")}
                  </StatusPill>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                {mode === "private" ? t("modePrivateBody") : ip ? t("modePublicBody", { ip }) : t("modePublicBodyUnknown")}
              </p>
              <div className="mt-3 text-content-tertiary">
                {mode === "private" ? <PrivateDiagram label={t("diagramPrivateAlt")} /> : <PublicDiagram label={t("diagramPublicAlt", { ip: ipLabel })} ip={ipLabel} />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

const LINE = { stroke: "currentColor", strokeWidth: 1.5, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const LABEL = { fill: "currentColor", fontSize: 11, textAnchor: "middle" } as const;

/** Un téléphone et une TV, la box, le serveur — chez soi ; Internet reste dehors. */
function PrivateDiagram({ label }: { label: string }) {
  const { t } = useTranslation("remoteAccess");
  return (
    <svg viewBox="0 0 300 112" role="img" aria-label={label} className="h-auto w-full max-w-[300px]">
      <rect x="2" y="18" width="208" height="90" rx="12" {...LINE} strokeDasharray="4 4" />
      <text x="14" y="13" {...LABEL} textAnchor="start" fontWeight={600}>{t("diagramHome")}</text>
      <Devices x={16} y={42} />
      <Arrow from={74} to={96} y={62} />
      <BoxNode x={100} y={48} label={t("diagramBox")} />
      <Arrow from={146} to={160} y={62} />
      <ServerNode x={164} y={42} label={t("diagramServer")} />
      <Cloud x={234} y={40} label={t("diagramInternet")} />
      <path d="M232 62 H214" {...LINE} strokeDasharray="3 3" />
      <path d="M219 57 l8 10 M227 57 l-8 10" {...LINE} className="text-status-error-fg" stroke="currentColor" />
    </svg>
  );
}

/** Un proche, sur Internet, joint la box par l'adresse publique (écrite sous elle) ; la box transmet au serveur. */
function PublicDiagram({ label, ip }: { label: string; ip: string }) {
  const { t } = useTranslation("remoteAccess");
  return (
    <svg viewBox="0 0 300 112" role="img" aria-label={label} className="h-auto w-full max-w-[300px]">
      <rect x="18" y="44" width="20" height="34" rx="4" {...LINE} />
      <path d="M25 72 h6" {...LINE} />
      <text x="28" y="98" {...LABEL}>{t("diagramFriend")}</text>
      <Arrow from={42} to={56} y={62} />
      <Cloud x={56} y={40} label={t("diagramInternet")} />
      <Arrow from={118} to={144} y={62} />
      <rect x="122" y="18" width="176" height="90" rx="12" {...LINE} strokeDasharray="4 4" />
      <text x="132" y="13" {...LABEL} textAnchor="start" fontWeight={600}>{t("diagramHome")}</text>
      <BoxNode x={148} y={48} label={t("diagramBox")} />
      <text x="170" y="96" {...LABEL} fontSize={9} fontFamily="ui-monospace, monospace">{ip}</text>
      <Arrow from={194} to={226} y={62} />
      <ServerNode x={230} y={42} label={t("diagramServer")} />
    </svg>
  );
}

function Arrow({ from, to, y }: { from: number; to: number; y: number }) {
  return <path d={`M${from} ${y} H${to} m-5 -4 l5 4 l-5 4`} {...LINE} />;
}

function Devices({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="18" height="32" rx="4" {...LINE} />
      <rect x={x + 24} y={y + 4} width="30" height="20" rx="2" {...LINE} />
      <path d={`M${x + 34} ${y + 30} h10 M${x + 39} ${y + 24} v6`} {...LINE} />
    </g>
  );
}

function BoxNode({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width="44" height="28" rx="6" {...LINE} />
      <path d={`M${x + 12} ${y} l-4 -8 M${x + 32} ${y} l4 -8`} {...LINE} />
      <text x={x + 22} y={y + 18} {...LABEL}>{label}</text>
    </g>
  );
}

function ServerNode({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width="34" height="40" rx="4" {...LINE} />
      <path d={`M${x + 6} ${y + 12} h22 M${x + 6} ${y + 22} h22 M${x + 6} ${y + 32} h12`} {...LINE} />
      <text x={x + 17} y={y + 56} {...LABEL}>{label}</text>
    </g>
  );
}

function Cloud({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <path
        d={`M${x + 14} ${y + 34} h34 a10 10 0 0 0 0 -20 a14 14 0 0 0 -26 -4 a10 10 0 0 0 -8 24 z`}
        {...LINE}
      />
      <text x={x + 30} y={y + 56} {...LABEL}>{label}</text>
    </g>
  );
}
