import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AdminSection, StatusPill } from "../admin/kit";

/** Une étape du parcours : la carte de section, et « Étape n sur 3 » à côté du titre. */
export function StepSection({ n, id, title, description, children }: { n: number; id: string; title: string; description: string; children: ReactNode }) {
  const { t } = useTranslation("remoteAccess");
  return (
    <AdminSection
      id={id}
      title={title}
      description={description}
      badges={
        <StatusPill tone="brand" size="sm" dot={false}>
          {t("stepOf", { n })}
        </StatusPill>
      }
    >
      {children}
    </AdminSection>
  );
}
