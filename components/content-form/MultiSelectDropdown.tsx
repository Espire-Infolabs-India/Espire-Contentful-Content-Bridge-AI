// components/MultiSelectDropdown.tsx
import React from "react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  selected: string[];
  onChange: (newSelected: string[]) => void;
}

export default function MultiSelectDropdown({
  options,
  selected,
  onChange,
}: Props) {
  return (
    <div
      className="multi-select-container"
      style={{ display: "flex", gap: 16 }}
    >
      <div style={{ minWidth: 150, border: "1px solid #ccc", padding: 8 }}>
        <strong>Selected:</strong>
        {selected.length ? (
          selected.map((v) => (
            <div key={v}>{options.find((o) => o.value === v)?.label ?? v}</div>
          ))
        ) : (
          <div style={{ fontStyle: "italic" }}>None selected</div>
        )}
      </div>
      <div style={{ border: "1px solid #ccc", padding: 8, flexGrow: 1 }}>
        {options.length ? (
          options.map((opt) => (
            <label
              key={opt.value}
              style={{ display: "block", marginBottom: 4 }}
            >
              <input
                type="checkbox"
                value={opt.value}
                checked={selected.includes(opt.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, opt.value]
                      : selected.filter((s) => s !== opt.value)
                  )
                }
                style={{ marginRight: 8 }}
              />
              {opt.label}
            </label>
          ))
        ) : (
          <div>No options available</div>
        )}
      </div>
    </div>
  );
}
