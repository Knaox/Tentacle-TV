import { describe, expect, it } from "vitest";
import frWizard from "./locales/fr/setupWizard";
import enWizard from "./locales/en/setupWizard";
import type { SetupErrorCode } from "../setupWizard/setupWizardContract";

/**
 * L'espace `setupWizard` : mêmes clés dans les deux langues, rien de vide, le
 * français ne coupe pas devant sa ponctuation haute, et CHAQUE code d'erreur
 * du contrat a ses mots — le serveur n'envoie que des codes.
 */
const CODES: Record<SetupErrorCode, true> = {
  setup_closed: true, session_required: true, code_required: true, setup_in_progress: true, invalid_token: true, rate_limited: true, invalid_input: true,
  db_unreachable: true, db_auth_failed: true, db_unknown_database: true, db_schema_failed: true, db_managed_by_stack: true,
  jf_invalid_url: true, jf_forbidden_address: true, jf_localhost_in_docker: true, jf_unreachable: true, jf_timeout: true,
  jf_tls_invalid: true, jf_not_jellyfin: true, jf_incompatible_version: true, jf_not_blank: true, jf_bad_credentials: true,
  jf_not_admin: true, jf_api_key_invalid: true, jf_api_key_failed: true, jf_startup_failed: true, jf_path_not_found: true,
  jf_library_failed: true, jf_not_configured: true, jf_claim_pending: true, jf_sibling_elsewhere: true, internal: true,
};

describe("vocabulaire de l'assistant d'installation", () => {
  it("les deux langues portent les mêmes clés, aucune vide", () => {
    expect(Object.keys(enWizard).sort()).toEqual(Object.keys(frWizard).sort());
    const empty = [...Object.entries(frWizard), ...Object.entries(enWizard)].filter(([, v]) => v.trim() === "");
    expect(empty).toEqual([]);
  });

  it("le français ne coupe pas devant sa ponctuation haute", () => {
    expect(Object.entries(frWizard).filter(([, value]) => / [?:!»]|« /.test(value))).toEqual([]);
  });

  it("chaque code d'erreur du contrat a ses mots, et l'erreur réseau aussi", () => {
    for (const code of [...Object.keys(CODES), "network"]) expect(Object.keys(frWizard)).toContain(`error_${code}`);
  });
});
