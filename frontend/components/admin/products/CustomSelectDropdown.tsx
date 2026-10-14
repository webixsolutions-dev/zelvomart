"use client";

import { useEffect, useRef, useState } from "react";

export interface DropdownOption {
  id: string;
  label: string;
  count?: number;
}

interface CustomSelectDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
}

export default function CustomSelectDropdown({
  label,
  value,
  onChange,
  options,
  placeholder,
}: CustomSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.id === value) || options[0];
  const displayLabel = selectedOption
    ? `${selectedOption.label}${selectedOption.count !== undefined ? ` (${selectedOption.count})` : ""}`
    : placeholder || "Select...";

  return (
    <div className="admin-custom-select-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`admin-custom-select-trigger${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="admin-custom-select-text">
          <span className="admin-custom-select-kicker">{label}</span>
          <span className="admin-custom-select-val">{displayLabel}</span>
        </div>
        <span className={`admin-custom-select-chevron${open ? " is-rotated" : ""}`} aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="admin-custom-select-menu" role="listbox">
          <div className="admin-custom-select-menu-inner">
            {options.map((option) => {
              const isSelected = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`admin-custom-select-option${isSelected ? " is-selected" : ""}`}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <span className="admin-custom-select-opt-label">{option.label}</span>
                  <div className="admin-custom-select-opt-meta">
                    {option.count !== undefined && (
                      <span className="admin-custom-select-count">({option.count})</span>
                    )}
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-600">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
