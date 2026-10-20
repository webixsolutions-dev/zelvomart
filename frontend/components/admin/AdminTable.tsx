"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import { usePathname } from 'next/navigation';
import './admin-table.css';

type AdminTableProps = ComponentPropsWithoutRef<'table'> & {
  scrollLabel?: string;
  /** Supply an explicit key when multiple tables have identical headings on one page. */
  tableId?: string;
  columnChooser?: boolean;
};
type Column={index:number;label:string;required:boolean};

export default function AdminTable({children,className='',scrollLabel,tableId,columnChooser=true,...props}:AdminTableProps) {
  const label=scrollLabel||props['aria-label']||'Data table';
  const pathname=usePathname();
  const menuId=useId();
  const tableRef=useRef<HTMLTableElement>(null);
  const scrollRef=useRef<HTMLDivElement>(null);
  const [scrollState,setScrollState]=useState({left:false,right:false});
  const menuRef=useRef<HTMLDetailsElement>(null);
  const [columns,setColumns]=useState<Column[]>([]);
  const [preferences,setPreferences]=useState<{key:string;hidden:number[]}|null>(null);
  const signature=columns.map(c=>c.label).join('|');
  const key=`zelvomart-table-columns:${tableId||`${pathname}:${label}:${signature}`}`;
  const hidden=preferences?.key===key?preferences.hidden:[];

  useEffect(()=>{
    if(!columns.length)return;
    let saved:number[]=[];
    try{const value=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(value))saved=value.filter((n:unknown):n is number=>typeof n==='number'&&columns.some(c=>c.index===n&&!c.required));}catch{}
    // At least one data column always remains visible.
    if(columns.filter(c=>!c.required).every(c=>saved.includes(c.index)))saved=[];
    setPreferences({key,hidden:saved});
  },[key,signature]);

  useLayoutEffect(()=>{
    const table=tableRef.current;if(!table)return;
    function decorate(){
      if(!table)return;
      const headers=Array.from(table.tHead?.rows[0]?.cells||[]);
      const namedPrimary=headers.findIndex(cell=>/^(product name|product|customer|name|order id|order|item)$/i.test(cell.textContent?.trim()||''));
      const firstData=namedPrimary>=0?namedPrimary:headers.findIndex(cell=>!cell.querySelector('input[type=checkbox]')); 
      const next=headers.map((cell,index)=>({index,label:cell.textContent?.trim()||(cell.querySelector('input[type=checkbox]')?'Select':'Actions'),required:!!cell.querySelector('input[type=checkbox]')||index===firstData}));
      setColumns(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
      const readableWidth=next.filter(column=>!hidden.includes(column.index)||column.required).reduce((sum,column)=>sum+(/customer|product|item|email|description|error|landing|destination/i.test(column.label)?220:/actions|watch|retry/i.test(column.label)?140:column.label==='Select'?44:120),0);
      table.style.setProperty('--table-readable-width',`${Math.max(560,readableWidth)}px`);
      headers.forEach((cell,index)=>{cell.dataset.columnKind=index===firstData?'primary':'text';cell.style.setProperty('--column-readable-width',`${/customer|product|item|email|description|error|landing|destination/i.test(next[index]?.label||'')?220:next[index]?.label==='Select'?44:/actions|watch|retry/i.test(next[index]?.label||'')?150:120}px`);cell.dataset.columnHidden=String(hidden.includes(index)&&!next[index]?.required);cell.scope='col';cell.setAttribute('role','columnheader');});
      for(const body of Array.from(table.tBodies))for(const row of Array.from(body.rows)){
        row.setAttribute('role','row');
        const spanning=row.cells.length===1&&row.cells[0].colSpan>1;
        row.dataset.tableSpanning=String(spanning);
        if(spanning){row.cells[0].colSpan=Math.max(1,next.length-hidden.length);continue;}
        Array.from(row.cells).forEach((cell,index)=>{
          cell.setAttribute('role','cell');
          cell.dataset.columnLabel=next[index]?.label||'';
          cell.dataset.columnHidden=String(hidden.includes(index)&&!next[index]?.required);
          cell.dataset.columnKind=index===firstData?'primary':cell.querySelector('input[type=checkbox]')&&index===0?'selection':/^(actions?|watch|retry|remove|edit)$/i.test(next[index]?.label||'')||(!headers[index]?.textContent?.trim()&&index===headers.length-1)?'actions':'text';
          // Preserve full text on hover when a long value is visually shortened.
          cell.title=cell.textContent?.trim()||'';
        });
      }
    }
    decorate();
    // Rows may come from child components, skeletons, or async API updates.
    const observer=new MutationObserver(decorate);observer.observe(table,{childList:true,subtree:true,characterData:true});
    return()=>observer.disconnect();
  },[children,signature,hidden.join(',')]);

  useEffect(()=>{
    const region=scrollRef.current,table=tableRef.current;if(!region||!table)return;
    const update=()=>{const next={left:region.scrollLeft>1,right:region.scrollLeft+region.clientWidth<region.scrollWidth-1};setScrollState(previous=>previous.left===next.left&&previous.right===next.right?previous:next);};
    const observer=new ResizeObserver(update);observer.observe(region);observer.observe(table);region.addEventListener('scroll',update,{passive:true});update();
    return()=>{observer.disconnect();region.removeEventListener('scroll',update);};
  },[signature,hidden.join(',')]);

  useEffect(()=>{
    const close=(event:PointerEvent)=>{if(menuRef.current&&!menuRef.current.contains(event.target as Node))menuRef.current.open=false};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menuRef.current?.open){menuRef.current.open=false;menuRef.current.querySelector('summary')?.focus()}};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)};
  },[]);
  function save(next:number[]){setPreferences({key,hidden:next});try{localStorage.setItem(key,JSON.stringify(next))}catch{}}
  return <div className="admin-data-table-shell">
    <div className="admin-table-tools"><div className="admin-table-scroll-controls">{(scrollState.left||scrollState.right)&&<><span className="admin-table-scroll-hint">Scroll to view columns</span><button type="button" aria-label={`Scroll ${label} table left`} disabled={!scrollState.left} onClick={()=>scrollRef.current?.scrollBy({left:-Math.max(220,(scrollRef.current?.clientWidth||300)*0.75),behavior:'smooth'})}>←</button><button type="button" aria-label={`Scroll ${label} table right`} disabled={!scrollState.right} onClick={()=>scrollRef.current?.scrollBy({left:Math.max(220,(scrollRef.current?.clientWidth||300)*0.75),behavior:'smooth'})}>→</button></>}</div>
    {columnChooser&&columns.length>1&&<div className="admin-table-options"><details ref={menuRef} className="admin-column-chooser"><summary aria-controls={menuId}>☷ Columns <span>{columns.length-hidden.length}/{columns.length}</span></summary><div id={menuId} className="admin-column-menu"><strong>Show columns</strong>{columns.map(column=><label key={column.index}><input type="checkbox" checked={!hidden.includes(column.index)} disabled={column.required} onChange={event=>save(event.target.checked?hidden.filter(n=>n!==column.index):[...hidden,column.index])}/>{column.label}{column.required&&<small>Required</small>}</label>)}<button type="button" onClick={()=>save([])}>Reset columns</button></div></details></div>}
    </div>
    <div ref={scrollRef} className="admin-data-table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table {...props} role={props.role||'table'} ref={tableRef} className={`admin-data-table ${className}`}>{children}</table>
    </div>
  </div>;
}
