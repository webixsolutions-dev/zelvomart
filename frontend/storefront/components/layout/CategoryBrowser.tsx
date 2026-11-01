"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BadgePercent, ChevronDown, Flame, LayoutGrid, Sparkle } from "lucide-react";
import { categories, categoryPath, upsertProducts, type CategoryId, type Product } from "@store/lib/catalog";
import { money } from "@store/lib/format";
import { CategoryIcon } from "@store/components/ui/CategoryIcon";

type Group = { key: string; label: string; href: string; icon: React.ReactNode };
type MenuData = Record<string, { count: number; items: Product[] }>;

const groups: Group[] = [
  { key: "all", label: "All Products", href: "/shop/", icon: <LayoutGrid size={16} /> },
  { key: "best", label: "Best selling", href: "/bestsellers/", icon: <Flame size={16} /> },
  { key: "new", label: "New arrival", href: "/new-arrivals/", icon: <Sparkle size={16} /> },
  { key: "deals", label: "Discounts", href: "/deals-and-offers/", icon: <BadgePercent size={16} /> },
  ...categories.map((c) => ({
    key: c.id,
    label: c.name,
    href: categoryPath(c.id),
    icon: <CategoryIcon id={c.id as CategoryId} size={16} />,
  })),
];

// Counts and the first 6 products per group come from /api/catalog/menu (cached), loaded once per page view.
let menuRequest: Promise<MenuData | null> | null = null;
function loadMenu() {
  menuRequest ??= fetch("/api/catalog/menu")
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { groups?: MenuData } | null) => {
      const menu = data?.groups || null;
      if (menu) upsertProducts(Object.values(menu).flatMap((g) => g.items));
      return menu;
    })
    .catch(() => {
      menuRequest = null;
      return null;
    });
  return menuRequest;
}

/** "Categories" button that lives inside the search bar: list of collections on the left, live product preview on the right. */
export function CategoryBrowser() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(groups[0].key);
  const wrap = useRef<HTMLDivElement>(null);
  const g = groups.find((x) => x.key === active)!;
  const [menu, setMenu] = useState<MenuData | null>(null);
  const items = menu?.[g.key]?.items ?? [];

  useEffect(() => {
    if (!open || menu) return;
    let live = true;
    void loadMenu().then((data) => live && setMenu(data));
    return () => {
      live = false;
    };
  }, [open, menu]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="cat-browser" ref={wrap}>
      <button
        type="button"
        className={`cat-scope ${open ? "open" : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
        onPointerEnter={() => void loadMenu()}
        onClick={() => setOpen((o) => !o)}
      >
        Categories <ChevronDown size={15} />
      </button>
      {open && (
        <div className="cat-panel" role="menu">
          <ul className="cat-list">
            {groups.map((x) => (
              <li key={x.key}>
                <Link
                  href={x.href}
                  role="menuitem"
                  className={x.key === active ? "active" : ""}
                  onMouseEnter={() => setActive(x.key)}
                  onFocus={() => setActive(x.key)}
                  onClick={() => setOpen(false)}
                >
                  <span className="cat-ico">{x.icon}</span>
                  {x.label}
                  {menu && <small>{menu[x.key]?.count ?? 0}</small>}
                </Link>
              </li>
            ))}
          </ul>
          <div className="cat-preview">
            <div className="cat-preview-head">
              <span>{g.label}</span>
              <Link href={g.href} onClick={() => setOpen(false)}>
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <ul>
              {!menu && <li className="cat-preview-loading">Loading…</li>}
              {items.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/product/${p.slug}/`} onClick={() => setOpen(false)}>
                    <Image src={p.image} alt="" width={52} height={52} />
                    <span>
                      <strong>{p.name}</strong>
                      <b>{money(p.price)}</b>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
