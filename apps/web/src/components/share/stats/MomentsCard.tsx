import { memo } from "react";
import { DAYPART_ORDER, habitsInsight, type ViewingHabits } from "@tentacle-tv/shared";
import { HBarList } from "../../stats/HBarList";
import { StatsSection } from "../../stats/StatsSection";
import { useStatsFormat } from "../../stats/useStatsFormat";

/**
 * « À quel moment ? » — ce que la page publique garde du rythme : la part du
 * temps mesuré de chaque grand moment de la journée, puis le poids du
 * week-end. Aucune heure précise, aucun jour : la grille jour × heure reste
 * au propriétaire.
 *
 * Une seule teinte de données (la marque), comme toutes les barres de la
 * page ; les moments dans l'ordre d'une journée, jamais triés par part — on
 * lit une journée, pas un classement. Le week-end, une part seule contre
 * 100 %, se lit comme une jauge.
 */
export const MomentsCard = memo(function MomentsCard({ habits }: { habits: ViewingHabits }) {
  const f = useStatsFormat();
  const { topDaypart } = habitsInsight(habits);
  const base = habits.measuredSeconds;
  return (
    <StatsSection title={f.t("momentsTitle")} hint={f.t("momentsHint")}>
      {topDaypart && <p className="mb-4 text-[15px] font-semibold text-content-primary">{f.t(`momentsHeadline_${topDaypart}`)}</p>}
      <HBarList
        ariaLabel={f.t("momentsTitle")}
        max={1}
        items={DAYPART_ORDER.map((part) => ({
          key: part,
          label: f.t(`moment_${part}`),
          hint: f.t(`momentRange_${part}`),
          value: habits.dayparts[part],
          display: f.percent(habits.dayparts[part]),
          secondary: f.duration(habits.dayparts[part] * base),
        }))}
      />
      <div className="mt-6 border-t border-line-subtle pt-5">
        <h3 className="mb-3 text-[13px] font-semibold text-content-secondary">{f.t("momentsWeekend")}</h3>
        <HBarList
          ariaLabel={f.t("momentsWeekend")}
          max={1}
          items={[{
            key: "weekend",
            label: f.t("momentsWeekendLabel"),
            value: habits.weekendShare,
            display: f.percent(habits.weekendShare),
            secondary: f.duration(habits.weekendShare * base),
          }]}
        />
      </div>
    </StatsSection>
  );
});
