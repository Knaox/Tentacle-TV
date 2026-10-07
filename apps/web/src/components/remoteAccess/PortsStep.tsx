import { useTranslation } from "react-i18next";
import { lanAddressOf, planPorts, type PortRule, type RemoteAccessState, type RemoteAccessSettingsPatch } from "@tentacle-tv/shared";
import { guessLanUrl } from "./lanAddress";
import { RouterGuideCard } from "./RouterGuideCard";

interface PortsStepProps {
  state: RemoteAccessState;
  save: (patch: RemoteAccessSettingsPatch) => Promise<unknown>;
}

/**
 * Les redirections à créer sur la box — les DEUX ports avec leurs vrais
 * numéros sans mandataire (Jellyfin dit facultatif tant que la lecture
 * directe extérieure est coupée) ; un tableau sur ordinateur, des cartes sur
 * téléphone, jamais de défilement de côté — et le guide de la box. La cible
 * est l'adresse de ce serveur sur le réseau (`LanAddressField`).
 */
export function PortsStep({ state, save }: PortsStepProps) {
  const { t } = useTranslation("remoteAccess");
  const rules = planPorts({
    proxy: state.settings.proxy,
    hostPort: state.hostPort,
    jellyfinHostPort: state.jellyfinHostPort,
    directPlayPublic: state.jellyfinPublicUrl !== null,
  });
  const target = lanAddressOf(state.settings.localUrl) ?? lanAddressOf(guessLanUrl()) ?? t("targetUnknown");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-content-primary">{t("portsTitle")}</h3>
        <p className="mb-3 text-sm leading-relaxed text-content-tertiary">{t("portsIntro")}</p>
        <RulesTable rules={rules} target={target} />
        <RulesCards rules={rules} target={target} />
      </div>

      <RouterGuideCard routerId={state.settings.routerId} onChange={(routerId) => void save({ routerId })} />
    </div>
  );
}

/** « Jellyfin (lecture directe) », et pour une ligne facultative, quand elle sert. */
function Purpose({ rule }: { rule: PortRule }) {
  const { t } = useTranslation("remoteAccess");
  return (
    <>
      {t(`purpose_${rule.purpose}`)}
      {rule.optional ? <span className="mt-0.5 block text-xs text-content-tertiary">{t("portOptional")}</span> : null}
    </>
  );
}

function RulesTable({ rules, target }: { rules: PortRule[]; target: string }) {
  const { t } = useTranslation("remoteAccess");
  const th = "px-3 py-2 text-left text-xs font-medium text-content-tertiary";
  const td = "px-3 py-2.5 text-sm text-content-primary";
  return (
    <table className="hidden w-full overflow-hidden rounded-xl border border-line-subtle sm:table">
      <thead className="bg-fill-subtle">
        <tr>
          <th scope="col" className={th}>{t("colExternal")}</th>
          <th scope="col" className={th}>{t("colInternal")}</th>
          <th scope="col" className={th}>{t("colProtocol")}</th>
          <th scope="col" className={th}>{t("colTarget")}</th>
          <th scope="col" className={th}>{t("colPurpose")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-subtle">
        {rules.map((rule) => (
          <tr key={`${rule.external}-${rule.purpose}`}>
            <td className={`${td} font-mono tabular-nums`}>{rule.external}</td>
            <td className={`${td} font-mono tabular-nums`}>{rule.internal}</td>
            <td className={td}>{rule.protocol}</td>
            <td className={`${td} font-mono`}>{target}</td>
            <td className={`${td} text-content-secondary`}>
              <Purpose rule={rule} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RulesCards({ rules, target }: { rules: PortRule[]; target: string }) {
  const { t } = useTranslation("remoteAccess");
  return (
    <ul className="space-y-2 sm:hidden">
      {rules.map((rule) => (
        <li key={`${rule.external}-${rule.purpose}`} className="rounded-xl border border-line-subtle bg-fill-faint p-3">
          <p className="text-sm font-semibold text-content-primary">
            <Purpose rule={rule} />
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-content-tertiary">{t("colExternal")}</dt>
            <dd className="font-mono tabular-nums text-content-primary">{rule.external}</dd>
            <dt className="text-content-tertiary">{t("colInternal")}</dt>
            <dd className="font-mono tabular-nums text-content-primary">{rule.internal}</dd>
            <dt className="text-content-tertiary">{t("colProtocol")}</dt>
            <dd className="text-content-primary">{rule.protocol}</dd>
            <dt className="text-content-tertiary">{t("colTarget")}</dt>
            <dd className="break-all font-mono text-content-primary">{target}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
