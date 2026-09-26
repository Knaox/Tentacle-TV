import { memo, type ReactNode } from "react";
import { brandTile } from "../shared/sectionStyles";

/**
 * Une ligne de `CreditsScreen` : pastille 32 rayon 8 (icône 14, décalée de 2),
 * nom 14 semi-gras `brand.light`, description 13/18 tertiaire.
 */
export const CreditRow = memo(function CreditRow({ icon, name, description }: {
  icon: ReactNode;
  name: string;
  description: string;
}) {
  return (
    <div className="flex items-start" style={{ gap: 12 }}>
      <span style={{ ...brandTile(32, 8), marginTop: 2 }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold" style={{ fontSize: 14, letterSpacing: -0.1, color: "var(--brand-light)" }}>{name}</p>
        <p className="text-content-tertiary" style={{ fontSize: 13, lineHeight: "18px", marginTop: 2 }}>{description}</p>
      </div>
    </div>
  );
});
