import { memo } from "react";

/** Une ligne grise de la hauteur d'un texte — `animate-pulse` ne joue que sur l'opacité. */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-fill-soft ${className}`} />;
}

/**
 * La page pendant sa première lecture : les deux cartes à leur place et à la
 * taille d'une `AdminSection`, pour que rien ne saute quand l'état arrive.
 * Remplace le `return null` d'avant, qui laissait une page blanche — et la
 * laissait blanche pour de bon quand la lecture échouait.
 */
export const MetadataSkeleton = memo(function MetadataSkeleton() {
  return (
    <div aria-hidden className="grid items-start gap-6 xl:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-4 rounded-2xl border border-line-subtle bg-fill-faint p-5">
          <div className="flex items-center gap-3">
            <Bar className="h-5 w-32" />
            <Bar className="h-7 w-24 rounded-full" />
          </div>
          <Bar className="h-3.5 w-full" />
          <Bar className="h-3.5 w-3/4" />
          <Bar className="h-16 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
});
