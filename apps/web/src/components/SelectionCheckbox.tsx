import { memo } from "react";

interface SelectionCheckboxProps {
  checked: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export const SelectionCheckbox = memo(function SelectionCheckbox({ checked, onClick }: SelectionCheckboxProps) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className={`absolute left-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full transition-all ${
        checked
          ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
          : "border border-white/40 bg-black/40 backdrop-blur-sm"
      }`}
    >
      {checked && (
        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
});
