import { memo } from "react";

/** Une marche à suivre : une étape par ligne du texte traduit, numérotée — elle se lit, et se coche, ligne par ligne. */
export const GuideSteps = memo(function GuideSteps({ text }: { text: string }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-content-secondary">
      {text
        .split("\n")
        .filter((step) => step.trim())
        .map((step) => (
          <li key={step}>{step}</li>
        ))}
    </ol>
  );
});

/** Le titre d'une partie de la marche à suivre. */
export const GuideTitle = memo(function GuideTitle({ children }: { children: string }) {
  return <h4 className="text-sm font-semibold text-content-primary">{children}</h4>;
});
