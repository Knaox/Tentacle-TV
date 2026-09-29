import { useTranslation } from "react-i18next";
import { Globe, Zap, type LucideIcon } from "lucide-react";
import type { LinkCheckId } from "@tentacle-tv/shared";
import { AuthField } from "../../auth/AuthField";
import { LinkBenefits } from "../../serverLinks/LinkBenefits";
import { LinkEndpointLine } from "../../serverLinks/LinkEndpointLine";
import type { LinkField, useLinksDraft } from "./useLinksDraft";

/**
 * Une recommandation de l'étape « Accès » : son titre, son pourquoi — les
 * mêmes mots que la vue d'ensemble —, puis ses champs, chacun avec le
 * verdict de la dernière vérification juste en dessous.
 */

const GROUP_ICON: Record<LinkCheckId, LucideIcon> = { publicUrl: Globe, directPlay: Zap };

const FIELD_COPY: Record<LinkField, { label: string; hint: string; placeholder: string }> = {
  publicUrl: { label: "fieldTentacle", hint: "fieldTentacleHint", placeholder: "https://tentacle.example.com" },
  jellyfinPublicUrl: { label: "fieldJellyfinPublic", hint: "fieldJellyfinPublicHint", placeholder: "https://jellyfin.example.com" },
  jellyfinPrivateUrl: { label: "fieldJellyfinPrivate", hint: "fieldJellyfinPrivateHint", placeholder: "http://192.168.1.50:8096" },
};

interface Props {
  id: LinkCheckId;
  fields: LinkField[];
  links: ReturnType<typeof useLinksDraft>;
}

export function LinksGroup({ id, fields, links }: Props) {
  const { t } = useTranslation("serverLinks");
  const Icon = GROUP_ICON[id];

  return (
    <fieldset className="space-y-3 rounded-2xl border border-line-subtle bg-fill-faint p-4">
      <legend className="sr-only">{t(`check_${id}`)}</legend>
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-light)]">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-content-primary">{t(`check_${id}`)}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-content-tertiary">{t(`summary_${id}`)}</p>
        </div>
      </div>
      <LinkBenefits id={id} />
      {fields.map((field) => {
        const copy = FIELD_COPY[field];
        const verdict = links.verdict(field);
        return (
          <div key={field} className="space-y-2">
            <AuthField
              id={`setup-link-${field}`}
              type="url"
              inputMode="url"
              label={t(copy.label)}
              placeholder={copy.placeholder}
              value={links.values[field]}
              onChange={(event) => links.edit(field, event.target.value)}
              onBlur={() => links.blur(field)}
              error={links.showError(field) ? t("invalidUrl") : undefined}
              hint={links.suggested.has(field) ? `${t(copy.hint)} ${t("suggested")}` : t(copy.hint)}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
            />
            {verdict && (
              <div role="status">
                <LinkEndpointLine endpoint={verdict} showRole={false} />
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
