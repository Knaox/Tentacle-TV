import { sessionApp, sessionAppText, type AdminSessionDto } from "@tentacle-tv/shared";

/**
 * « Tentacle Desktop **1.22.0** · MacBook » — l'application, sa version et
 * l'appareil, dans le ton de la ligne qui l'accueille. La version ressort d'un
 * cran (graisse, contraste, chiffres tabulaires) : c'est elle qu'on cherche
 * d'un coup d'œil, sans pastille de plus à côté de « Suivi Tentacle » et du
 * mode de diffusion. `after` prolonge la ligne (« Actif il y a 2 min »).
 * Le libellé entier reste lisible en infobulle quand la ligne est tronquée.
 */
export function SessionAppLabel({
  session,
  after,
  className,
}: {
  session: AdminSessionDto;
  after?: string | null;
  className?: string;
}) {
  const app = sessionApp(session);
  const tail = [app.device, after].filter(Boolean).join(" · ");
  const full = [sessionAppText(app), after].filter(Boolean).join(" · ");
  return (
    <span className={className} title={full}>
      {app.name}
      {app.version && (
        <>
          {app.name && " "}
          <span className="font-medium tabular-nums text-content-secondary">{app.version}</span>
        </>
      )}
      {tail && `${app.name || app.version ? " · " : ""}${tail}`}
    </span>
  );
}
