"use client";

import { useEffect, useId, useState, type InputHTMLAttributes } from "react";
import { MapPin } from "lucide-react";
import {
  addressSearchText,
  applyAddressSuggestion,
  citySuggestions,
} from "@store/lib/checkout-address";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  kind: "city" | "address";
  city?: string;
};

/** An optional suggestion, never a forced selection. Custom Pakistani delivery locations remain valid. */
export function AddressInput({
  value,
  onValueChange,
  kind,
  city = "",
  ...props
}: Props) {
  const list = useId();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const [matches, setMatches] = useState<{ key: string; items: string[] }>({
    key: "",
    items: [],
  });
  const query = addressSearchText(value);
  const key = `${city.trim()}:${query}`;
  const cityItems = kind === "city" ? citySuggestions(value) : [];
  const items =
    kind === "city" ? cityItems : matches.key === key ? matches.items : [];
  const open = focused && !dismissed && items.length > 0;

  useEffect(() => {
    if (
      kind !== "address" ||
      !focused ||
      dismissed ||
      city.trim().length < 2 ||
      query.length < 3 ||
      query.length > 120
    )
      return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(
        `/api/store-proxy/api/checkout/address-suggestions?${new URLSearchParams({ city: city.trim(), q: query })}`,
        { signal: controller.signal },
      )
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!controller.signal.aborted)
            setMatches({
              key,
              items: Array.isArray(data?.suggestions)
                ? data.suggestions
                    .filter((x: unknown) => typeof x === "string")
                    .slice(0, 6)
                : [],
            });
        })
        .catch(() => undefined);
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [city, dismissed, focused, key, kind, query]);

  const choose = (item: string) => {
    onValueChange(kind === "city" ? item : applyAddressSuggestion(value, item));
    setDismissed(true);
    setActive(-1);
  };
  return (
    <div className="address-autocomplete">
      <input
        {...props}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={list}
        aria-activedescendant={
          open && active >= 0 ? `${list}-${active}` : undefined
        }
        onChange={(event) => {
          onValueChange(event.target.value);
          setDismissed(false);
          setActive(-1);
        }}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => {
          setFocused(false);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDismissed(true);
            return;
          }
          if (!open) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive((n) =>
              n < 0
                ? event.key === "ArrowDown"
                  ? 0
                  : items.length - 1
                : (n + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length,
            );
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            choose(items[active]);
          }
        }}
      />
      <div
        id={list}
        role="listbox"
        aria-label={
          kind === "city" ? "City suggestions" : "Area and street suggestions"
        }
        className="address-suggestions"
        hidden={!open}
      >
        {items.map((item, index) => (
          <button
            id={`${list}-${index}`}
            type="button"
            role="option"
            aria-selected={active === index}
            tabIndex={-1}
            key={item}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(item)}
          >
            <MapPin size={15} aria-hidden="true" />
            <span>{item}</span>
          </button>
        ))}
        {kind === "address" && (
          <small className="address-attribution">
            Map data:{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              onMouseDown={(event) => event.preventDefault()}
            >
              OpenStreetMap contributors
            </a>
          </small>
        )}
      </div>
    </div>
  );
}
