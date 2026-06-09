"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import {
  FILTER_FIELDS,
  type FilterRule,
  type FilterOperator,
  type FilterField,
} from "@/hooks/useScreener";

const NUMERIC_OPS: { op: FilterOperator; label: string }[] = [
  { op: ">", label: ">" },
  { op: "<", label: "<" },
  { op: ">=", label: "≥" },
  { op: "<=", label: "≤" },
  { op: "==", label: "=" },
  { op: "!=", label: "≠" },
];

const ENUM_OPS: { op: FilterOperator; label: string }[] = [
  { op: "==", label: "is" },
  { op: "!=", label: "is not" },
];

const DOMAINS = ["Market", "Derivatives", "Options", "Regime"] as const;

function FilterChip({
  rule,
  onRemove,
}: {
  rule: FilterRule;
  onRemove: () => void;
}) {
  const field = FILTER_FIELDS.find((f) => f.key === rule.field);
  const opLabel =
    [...NUMERIC_OPS, ...ENUM_OPS].find((o) => o.op === rule.operator)?.label ??
    rule.operator;
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-mono"
      style={{
        background: "var(--glass-bg-hover)",
        border: "1px solid var(--glass-border)",
        color: "var(--text-secondary)",
      }}
    >
      <span style={{ color: "var(--accent-blue)" }}>{field?.label ?? rule.field}</span>
      <span style={{ color: "var(--text-muted)" }}>{opLabel}</span>
      <span style={{ color: "var(--text-primary)" }}>{rule.value}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 hover:opacity-70 transition-opacity"
        style={{ color: "var(--text-muted)" }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

function AddFilterPanel({
  onAdd,
  onClose,
  anchorRect,
}: {
  onAdd: (rule: Omit<FilterRule, "id">) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}) {
  const [selectedField, setSelectedField] = useState<FilterField | null>(null);
  const [operator, setOperator] = useState<FilterOperator>(">");
  const [value, setValue] = useState("");
  const [activeTab, setActiveTab] = useState<string>("Market");
  const ref = useRef<HTMLDivElement>(null);

  const top = anchorRect ? anchorRect.bottom + 8 : 60;
  const left = anchorRect ? anchorRect.left : 0;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);

  function handleAdd() {
    if (!selectedField || !value) return;
    onAdd({ field: selectedField.key, operator, value });
    setValue("");
    setSelectedField(null);
  }

  const fieldsInDomain = FILTER_FIELDS.filter((f) => f.domain === activeTab);
  const ops = selectedField?.type === "enum" ? ENUM_OPS : NUMERIC_OPS;

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-[var(--radius-lg)] p-4 space-y-3 w-72"
      style={{
        top,
        left,
        background: "var(--glass-bg-solid, #141414)",
        border: "1px solid var(--glass-border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Domain tabs */}
      <div className="flex gap-1 flex-wrap">
        {DOMAINS.map((d) => (
          <button
            key={d}
            onClick={() => {
              setActiveTab(d);
              setSelectedField(null);
              setValue("");
            }}
            className="px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider transition-all"
            style={{
              background:
                activeTab === d ? "var(--accent-blue)" : "var(--glass-bg)",
              color: activeTab === d ? "#000" : "var(--text-muted)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Field select */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "var(--text-muted)" }}>
          Field
        </p>
        <div className="grid grid-cols-2 gap-1">
          {fieldsInDomain.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setSelectedField(f);
                setValue("");
                setOperator(f.type === "enum" ? "==" : ">");
              }}
              className="text-left px-2 py-1.5 rounded text-xs font-mono truncate transition-all"
              style={{
                background:
                  selectedField?.key === f.key
                    ? "rgba(56,189,248,0.15)"
                    : "var(--glass-bg)",
                border: `1px solid ${selectedField?.key === f.key ? "var(--accent-blue)" : "var(--glass-border)"}`,
                color:
                  selectedField?.key === f.key
                    ? "var(--accent-blue)"
                    : "var(--text-secondary)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Operator + value */}
      {selectedField && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="space-y-1 flex-shrink-0">
              <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "var(--text-muted)" }}>
                Op
              </p>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as FilterOperator)}
                className="px-2 py-1.5 rounded text-xs font-mono"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                {ops.map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 flex-1">
              <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "var(--text-muted)" }}>
                Value{selectedField.unit ? ` (${selectedField.unit})` : ""}
              </p>
              {selectedField.type === "enum" ? (
                <select
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-2 py-1.5 rounded text-xs font-mono"
                  style={{
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                >
                  <option value="">Select…</option>
                  {selectedField.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="w-full px-2 py-1.5 rounded text-xs font-mono"
                  style={{
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              )}
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!value}
            className="w-full py-1.5 rounded text-xs font-mono font-semibold uppercase tracking-wider transition-all disabled:opacity-40"
            style={{
              background: "var(--accent-blue)",
              color: "#000",
            }}
          >
            Add Filter
          </button>
        </div>
      )}
    </div>
  );
}

export function ScreenerFilters({
  rules,
  onAdd,
  onRemove,
  onClear,
}: {
  rules: FilterRule[];
  onAdd: (rule: Omit<FilterRule, "id">) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleToggle() {
    if (!open && btnRef.current) {
      setAnchorRect(btnRef.current.getBoundingClientRect());
    }
    setOpen((v) => !v);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Add filter button */}
      <div>
        <button
          ref={btnRef}
          onClick={handleToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-mono font-semibold transition-all"
          style={{
            background: open ? "var(--accent-blue)" : "var(--glass-bg)",
            border: `1px solid ${open ? "var(--accent-blue)" : "var(--glass-border)"}`,
            color: open ? "#000" : "var(--text-secondary)",
          }}
        >
          <Plus size={12} />
          Add Filter
          <ChevronDown
            size={11}
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          />
        </button>
        {open && (
          <AddFilterPanel
            onAdd={(rule) => {
              onAdd(rule);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
            anchorRect={anchorRect}
          />
        )}
      </div>

      {/* Active filter chips */}
      {rules.map((rule) => (
        <FilterChip key={rule.id} rule={rule} onRemove={() => onRemove(rule.id)} />
      ))}

      {/* Clear all */}
      {rules.length > 0 && (
        <button
          onClick={onClear}
          className="text-[11px] font-mono transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}
