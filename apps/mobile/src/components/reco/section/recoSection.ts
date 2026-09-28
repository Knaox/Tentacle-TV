export type RecoSection = "forYou" | "refine";

/** La section que désigne le paramètre `section` — tout sauf « refine » vaut « Pour vous ». */
export function recoSectionOf(param: string | string[] | undefined): RecoSection {
  const value = Array.isArray(param) ? param[0] : param;
  return value === "refine" ? "refine" : "forYou";
}
