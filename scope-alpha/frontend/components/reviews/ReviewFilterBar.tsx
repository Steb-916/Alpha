"use client";

export type ReviewSort = "newest" | "highest" | "lowest" | "mostHelpful";

interface Props {
  sort: ReviewSort;
  verifiedOnly: boolean;
  tier: string;
  availableTiers: string[];
  onChange: (next: { sort: ReviewSort; verifiedOnly: boolean; tier: string }) => void;
}

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Most Recent" },
  { value: "highest", label: "Highest Rated" },
  { value: "lowest", label: "Lowest Rated" },
  { value: "mostHelpful", label: "Most Helpful" },
];

const selectStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

export function ReviewFilterBar({
  sort,
  verifiedOnly,
  tier,
  availableTiers,
  onChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-body uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Sort
        </span>
        <select
          value={sort}
          onChange={(e) =>
            onChange({ sort: e.target.value as ReviewSort, verifiedOnly, tier })
          }
          className="px-2 py-1 text-xs font-body rounded-[var(--radius-sm)] outline-none cursor-pointer"
          style={selectStyle}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={(e) => onChange({ sort, verifiedOnly: e.target.checked, tier })}
          className="cursor-pointer"
        />
        <span className="text-[10px] font-body" style={{ color: "var(--text-secondary)" }}>
          Verified subscribers only
        </span>
      </label>

      {availableTiers.length > 0 && (
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-body uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            Tier
          </span>
          <select
            value={tier}
            onChange={(e) => onChange({ sort, verifiedOnly, tier: e.target.value })}
            className="px-2 py-1 text-xs font-body rounded-[var(--radius-sm)] outline-none cursor-pointer"
            style={selectStyle}
          >
            <option value="">All tiers</option>
            {availableTiers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
