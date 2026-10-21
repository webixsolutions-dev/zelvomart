"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import {
  Check,
  ChevronDown,
  Search,
  Star,
  X,
  LoaderCircle,
  Film,
} from "lucide-react";
import type { Media } from "./types";
export function Button({
  children,
  variant = "secondary",
  busy = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`rw-button rw-button-${variant} ${className}`}
      disabled={props.disabled || busy}
    >
      {busy && <LoaderCircle size={16} className="rw-spin" />}
      {children}
    </button>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose an option",
  searchable = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; detail?: string }[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    search = useRef<HTMLInputElement>(null),
    popover = useRef<HTMLDivElement>(null),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const chosen = options.find((o) => o.value === value),
    filtered = options
      .filter((o) =>
        `${o.label} ${o.detail || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
      .slice(0, 80);
  useEffect(() => {
    if (!open) return;
    const menu = popover.current,
      button = trigger.current;
    if (menu && button) {
      const rect = button.getBoundingClientRect(),
        width = Math.max(170, Math.min(rect.width, window.innerWidth - 24)),
        below = window.innerHeight - rect.bottom,
        above = rect.top;
      const up = below < 250 && above > below;
      menu.style.position = "fixed";
      menu.style.width = `${width}px`;
      menu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
      menu.style.top = up ? "auto" : `${rect.bottom + 6}px`;
      menu.style.bottom = up
        ? `${window.innerHeight - rect.top + 6}px`
        : "auto";
      menu.showPopover?.();
    }
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    if (searchable) search.current?.focus();
    const moved = () => setOpen(false);
    window.addEventListener("resize", moved);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", moved);
      if (menu?.matches(":popover-open")) menu.hidePopover();
    };
  }, [open, searchable]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  }
  return (
    <div
      className={`rw-select ${open ? "is-open" : ""}`}
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!open) {
            setOpen(true);
            setQuery("");
            setActive(0);
          } else
            setActive((a) =>
              Math.max(
                0,
                Math.min(
                  filtered.length - 1,
                  a + (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
        }
        if (e.key === "Enter" && open) {
          e.preventDefault();
          if (filtered[active]) choose(filtered[active].value);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        aria-activedescendant={
          open && filtered[active] ? `${id}-${active}` : undefined
        }
        disabled={disabled}
        className={`rw-select-trigger ${!chosen ? "is-placeholder" : ""}`}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
          setActive(0);
        }}
      >
        <span>{chosen?.label || placeholder}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="rw-select-popover" ref={popover} popover="manual">
          {searchable && (
            <div className="rw-select-search">
              <Search size={15} />
              <input
                ref={search}
                role="searchbox"
                aria-controls={`${id}-list`}
                aria-activedescendant={
                  filtered[active] ? `${id}-${active}` : undefined
                }
                aria-label={`Search ${label.toLowerCase()}`}
                placeholder="Type to search…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
              />
            </div>
          )}
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label={`${label} options`}
            className="rw-select-options"
          >
            {filtered.map((option, index) => (
              <button
                type="button"
                id={`${id}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={option.value === value}
                key={option.value}
                className={active === index ? "is-active" : ""}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option.value)}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.detail && <small>{option.detail}</small>}
                </span>
                {option.value === value && <Check size={16} />}
              </button>
            ))}
            {!filtered.length && <p>No matching options</p>}
          </div>
          {options.length > 80 && !query && (
            <small className="rw-select-hint">Type to find more products</small>
          )}
        </div>
      )}
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`rw-modal ${wide ? "rw-modal-wide" : ""}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="rw-modal-content">
        <header className="rw-modal-head">
          <div>
            <h2 id={id}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="rw-icon-button"
            aria-label={`Close ${title.toLowerCase()}`}
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Rating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (value: number) => void;
}) {
  return (
    <div
      className={`rw-rating ${onChange ? "is-editable" : ""}`}
      role={onChange ? "radiogroup" : undefined}
      aria-label={onChange ? "Review rating" : `${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            type="button"
            key={n}
            role="radio"
            tabIndex={value === n ? 0 : -1}
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = Math.min(
                  5,
                  Math.max(1, value + (e.key === "ArrowRight" ? 1 : -1)),
                );
                onChange(next);
                const buttons =
                  e.currentTarget.parentElement?.querySelectorAll("button");
                (buttons?.[next - 1] as HTMLButtonElement)?.focus();
              }
            }}
          >
            <Star
              size={25}
              fill={n <= value ? "currentColor" : "none"}
              className={n <= value ? "filled" : ""}
            />
          </button>
        ) : (
          <Star
            key={n}
            size={14}
            fill={n <= value ? "currentColor" : "none"}
            className={n <= value ? "filled" : ""}
          />
        ),
      )}
    </div>
  );
}
export function Badge({
  status,
  test = false,
}: {
  status: string;
  test?: boolean;
}) {
  return (
    <span
      className={`rw-badge ${test ? "rw-badge-test" : `rw-badge-${status.toLowerCase()}`}`}
    >
      <span />
      {test ? "Demo / admin only" : status[0] + status.slice(1).toLowerCase()}
    </span>
  );
}
export function Attachments({ media }: { media: Media[] }) {
  return (
    <div className="rw-attachments">
      {media
        .filter((m) => m.url)
        .map((m, i) =>
          m.type === "video" ? (
            <video
              key={m.url || i}
              controls
              preload="metadata"
              src={m.url}
              aria-label="Review video"
            />
          ) : (
            <a key={m.url || i} href={m.url} target="_blank" rel="noreferrer">
              <img
                src={m.url}
                alt={m.avatar ? "Reviewer avatar" : "Review photo"}
                loading="lazy"
              />
            </a>
          ),
        )}
    </div>
  );
}
