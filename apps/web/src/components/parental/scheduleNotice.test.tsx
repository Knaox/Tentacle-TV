import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * L'administrateur qui règle ses PROPRES plages lit, sous l'aide, qu'elles
 * s'appliquent aussi à lui ; un autre compte, ou un invité de la Famille, non.
 * Rendu à plat : `t()` rend la clé.
 */
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const { ScheduleListField } = await import("./ScheduleListField");
const { ParentalBody } = await import("../admin/users/rights/ParentalBody");
const { PLAIN_RIGHTS } = await import("../admin/users/rights/rightsFixture");

const writer = { write: () => undefined, isPending: () => false, errorFor: () => null, confirming: null, confirm: () => undefined, cancel: () => undefined };

describe("l'avertissement des plages sur soi", () => {
  it("ScheduleListField ne montre l'avertissement que s'il lui est donné", () => {
    expect(renderToStaticMarkup(<ScheduleListField value={[]} onChange={() => undefined} />)).not.toContain("role=\"note\"");
    expect(renderToStaticMarkup(<ScheduleListField value={[]} onChange={() => undefined} notice="Attention" />)).toContain("Attention");
  });

  it("la fiche le donne pour son propre compte seulement", () => {
    const body = (isSelf: boolean) => renderToStaticMarkup(<ParentalBody rights={PLAIN_RIGHTS} options={undefined} writer={writer} isSelf={isSelf} />);
    expect(body(true)).toContain("parental.scheduleSelfNotice");
    expect(body(false)).not.toContain("parental.scheduleSelfNotice");
  });
});
