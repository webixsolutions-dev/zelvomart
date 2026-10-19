"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useEffect, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import type {Product} from "@/lib/launch/catalog";
import {designProduct} from "@/lib/launch/adapter";
import { money } from "@/lib/launch/format";
import { CategoryBrowser } from "./CategoryBrowser";

const popular = ["Tumbler", "Earbuds", "Handbag", "Jewellery set", "Magnetic tiles", "Perfume"];

export function SearchBox({ autoFocus = false, onDone, withCategories = false }: { autoFocus?: boolean; onDone?: () => void; withCategories?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const wrap = useRef<HTMLFormElement>(null);
  const [results,setResults]=useState<Product[]>([]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>{if(q.trim().length<2){setResults([]);return;}void fetch('/api/store-proxy/api/products?limit=5&search='+encodeURIComponent(q.trim()),{signal:controller.signal}).then(r=>r.ok?r.json():null).then(d=>{if(d&&!controller.signal.aborted)setResults(d.items.map(designProduct));}).catch(()=>undefined);},250);return()=>{clearTimeout(timer);controller.abort();};},[q]);

  function go(term: string) {
    if (!term.trim()) return;
    setOpen(false);
    onDone?.();
    router.push(`/search/?q=${encodeURIComponent(term.trim())}`);
  }

  return (
    <form
      ref={wrap}
      className={`search ${withCategories ? "with-cats" : ""}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {withCategories && <CategoryBrowser />}
      <span className="search-field">
      <Search className="search-ico" size={18} aria-hidden="true" />
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Search tumblers, jewellery sets, gadgets…"
        aria-label="Search products"
        aria-controls={listId}
        aria-expanded={open}
        autoComplete="off"
      />
      {q && (
        <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQ("")}>
          <X size={16} />
        </button>
      )}
      </span>
      <button type="submit" className="search-btn">
        Search
      </button>
      {open && (
        <div className="search-panel" id={listId}>
          {!q.trim() ? (
            <div className="search-popular">
              <span>Popular searches</span>
              <div>
                {popular.map((t) => (
                  <button type="button" key={t} onClick={() => go(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length ? (
            <>
              <ul>
                {results.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/product/${p.slug}/`}
                      onClick={() => {
                        setOpen(false);
                        onDone?.();
                      }}
                    >
                      <Image src={p.image} alt="" width={48} height={48} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.categoryName}</small>
                      </span>
                      <b>{money(p.price)}</b>
                    </Link>
                  </li>
                ))}
              </ul>
              <button type="submit" className="search-all">
                See all results for “{q}” <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <p className="search-empty">No products match “{q}”. Try a different word or browse categories.</p>
          )}
        </div>
      )}
    </form>
  );
}
