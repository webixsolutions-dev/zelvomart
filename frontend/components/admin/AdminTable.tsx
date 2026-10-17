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
      headers.forEach((cell,index)=>{cell.dataset.columnHidden=String(hidden.includes(index)&&!next[index]?.required);cell.scope='col';cell.setAttribute('role','columnheader');});
      for(const body of Array.from(table.tBodies))for(const row of Array.from(body.rows)){
        row.setAttribute('role','row');
        const spanning=row.cells.length===1&&row.cells[0].colSpan>1;
        row.dataset.tableSpanning=String(spanning);
        if(spanning){row.cells[0].colSpan=Math.max(1,next.length-hidden.length);continue;}
        Array.from(row.cells).forEach((cell,index)=>{
          cell.setAttribute('role','cell');
          cell.dataset.columnLabel=next[index]?.label||'';
          cell.dataset.columnHidden=String(hidden.includes(index)&&!next[index]?.required);
          cell.dataset.columnKind=cell.querySelector('input[type=checkbox]')?'selection':cell.querySelector('button,select,details')?'actions':'text';
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
    const close=(event:PointerEvent)=>{if(menuRef.current&&!menuRef.current.contains(event.target as Node))menuRef.current.open=false};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menuRef.current?.open){menuRef.current.open=false;menuRef.current.querySelector('summary')?.focus()}};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)};
  },[]);
  function save(next:number[]){setPreferences({key,hidden:next});try{localStorage.setItem(key,JSON.stringify(next))}catch{}}
  return <div className="admin-data-table-shell">
    {columnChooser&&columns.length>1&&<div className="admin-table-options"><details ref={menuRef} className="admin-column-chooser"><summary aria-controls={menuId}>☷ Columns <span>{columns.length-hidden.length}/{columns.length}</span></summary><div id={menuId} className="admin-column-menu"><strong>Show columns</strong>{columns.map(column=><label key={column.index}><input type="checkbox" checked={!hidden.includes(column.index)} disabled={column.required} onChange={event=>save(event.target.checked?hidden.filter(n=>n!==column.index):[...hidden,column.index])}/>{column.label}{column.required&&<small>Required</small>}</label>)}<button type="button" onClick={()=>save([])}>Reset columns</button></div></details></div>}
    <div className="admin-data-table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table {...props} role={props.role||'table'} ref={tableRef} className={`admin-data-table ${className}`}>{children}</table>
    </div>
  </div>;
}
