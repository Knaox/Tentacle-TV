/**
 * Octave mobile — la recherche VALIDÉE vit dans l'adresse (`?q=`, `?f=` : le
 * retour arrière et un lien profond la retrouvent, comme le bureau). Une
 * nouvelle recherche repart sur « Tout » ; un filtre remplace l'adresse.
 */

import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { parseSearchFilter, type SearchFilter } from "@tentacle-tv/shared/octave";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function useSearchRoute() {
  const params = useLocalSearchParams<{ q?: string; f?: string }>();
  const router = useRouter();
  const query = first(params.q) ?? "";
  const filter = parseSearchFilter(first(params.f));
  const submit = useCallback((text: string) => router.setParams({ q: text, f: undefined }), [router]);
  const clear = useCallback(() => router.setParams({ q: undefined, f: undefined }), [router]);
  const setFilter = useCallback((next: SearchFilter) => router.setParams({ f: next === "all" ? undefined : next }), [router]);
  return { query, filter, submit, clear, setFilter };
}
