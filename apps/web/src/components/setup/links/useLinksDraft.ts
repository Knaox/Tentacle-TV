import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateServerLinks,
  isLinkUrl,
  normalizeLinkUrl,
  suggestServerLinks,
  type LinkEndpointVerdict,
  type LinkRole,
  type ServerLinksDraft,
} from "@tentacle-tv/shared";
import { getBackendBase } from "../../../lib/backendBase";
import { serverLinksApi } from "../../serverLinks/serverLinksApi";

/**
 * L'état de l'étape « Accès » : les trois adresses, pré-remplies (ce que le
 * serveur a déjà, sinon ce qu'on devine de l'installation), leur validation
 * au départ du champ, et le verdict de la dernière vérification — effacé dès
 * qu'une adresse change, pour ne jamais montrer le verdict d'autre chose.
 */

export type LinkField = keyof ServerLinksDraft;

export const FIELD_ROLE: Record<LinkField, LinkRole> = {
  publicUrl: "tentacle",
  jellyfinPublicUrl: "jellyfinPublic",
  jellyfinPrivateUrl: "jellyfinPrivate",
};

const EMPTY: ServerLinksDraft = { publicUrl: "", jellyfinPublicUrl: "", jellyfinPrivateUrl: "" };
const FIELDS = Object.keys(EMPTY) as LinkField[];

const normalized = (draft: ServerLinksDraft): ServerLinksDraft => ({
  publicUrl: normalizeLinkUrl(draft.publicUrl),
  jellyfinPublicUrl: normalizeLinkUrl(draft.jellyfinPublicUrl),
  jellyfinPrivateUrl: normalizeLinkUrl(draft.jellyfinPrivateUrl),
});

export function useLinksDraft(token: string) {
  const [values, setValues] = useState<ServerLinksDraft>(EMPTY);
  const [suggested, setSuggested] = useState<ReadonlySet<LinkField>>(new Set());
  const [touched, setTouched] = useState<ReadonlySet<LinkField>>(new Set());
  const [verdicts, setVerdicts] = useState<Partial<Record<LinkRole, LinkEndpointVerdict>> | null>(null);
  const [busy, setBusy] = useState<"check" | "save" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Ce que le serveur a déjà (l'environnement, un passage précédent), sinon une
  // proposition. La lecture sonde les adresses : elle peut arriver après la
  // première frappe, qui l'emporte alors.
  const typed = useRef(false);
  useEffect(() => {
    let alive = true;
    serverLinksApi.report(token).then((report) => {
      if (!alive || typed.current) return;
      const guess = suggestServerLinks({ pageOrigin: getBackendBase() || window.location.origin, jellyfinUrl: report.jellyfinUrl });
      setValues({
        publicUrl: report.tentacle.url ?? guess.publicUrl,
        jellyfinPublicUrl: report.direct.publicUrl ?? "",
        jellyfinPrivateUrl: report.direct.privateUrl ?? guess.jellyfinPrivateUrl,
      });
      const guessed = new Set<LinkField>();
      if (!report.tentacle.url && guess.publicUrl) guessed.add("publicUrl");
      if (!report.direct.privateUrl && guess.jellyfinPrivateUrl) guessed.add("jellyfinPrivateUrl");
      setSuggested(guessed);
    }, () => undefined);
    return () => {
      alive = false;
    };
  }, [token]);

  const draft = useMemo(() => normalized(values), [values]);
  const errors = useMemo(() => {
    const out: Partial<Record<LinkField, boolean>> = {};
    for (const field of FIELDS) out[field] = draft[field] !== "" && !isLinkUrl(draft[field]);
    return out;
  }, [draft]);

  const edit = useCallback((field: LinkField, value: string) => {
    typed.current = true;
    setValues((current) => ({ ...current, [field]: value }));
    setSuggested((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
    setVerdicts(null);
    setFailure(null);
  }, []);

  const blur = useCallback((field: LinkField) => setTouched((current) => new Set(current).add(field)), []);

  const hasInvalid = FIELDS.some((field) => errors[field]);
  const filled = FIELDS.some((field) => draft[field] !== "");

  const check = useCallback(async () => {
    setTouched(new Set(FIELDS));
    if (hasInvalid) return;
    setBusy("check");
    setFailure(null);
    try {
      const checks = evaluateServerLinks(await serverLinksApi.check(draft, token));
      const byRole: Partial<Record<LinkRole, LinkEndpointVerdict>> = {};
      for (const endpoint of checks.flatMap((c) => c.endpoints)) if (endpoint.url) byRole[endpoint.role] = endpoint;
      setVerdicts(byRole);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }, [draft, hasInvalid, token]);

  /** Vrai une fois enregistré : l'étape peut se refermer. */
  const save = useCallback(async (): Promise<boolean> => {
    setTouched(new Set(FIELDS));
    if (hasInvalid) return false;
    setBusy("save");
    setFailure(null);
    try {
      await serverLinksApi.save(draft, token);
      return true;
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setBusy(null);
    }
  }, [draft, hasInvalid, token]);

  return {
    values,
    draft,
    suggested,
    showError: (field: LinkField) => Boolean(errors[field]) && touched.has(field),
    verdict: (field: LinkField) => verdicts?.[FIELD_ROLE[field]] ?? null,
    edit,
    blur,
    check,
    save,
    busy,
    failure,
    filled,
    /** Une seule des deux adresses de Jellyfin : gardée, mais le direct reste éteint. */
    directHalf: (draft.jellyfinPublicUrl === "") !== (draft.jellyfinPrivateUrl === ""),
  };
}
