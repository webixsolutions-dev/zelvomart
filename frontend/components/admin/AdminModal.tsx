"use client";

import { ReactNode, useRef, useState, useId } from "react";
import { ToastContainer } from "react-toastify";

type AdminModalProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl" | "full";
  triggerClassName?: string;
  className?: string;
};

export default function AdminModal({
  trigger,
  title,
  description,
  children,
  size = "lg",
  triggerClassName = "admin-btn admin-btn-primary",
  className = '',
}: AdminModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [opened,setOpened]=useState(false);
  const titleId=useId();

  const open = () => {setOpened(true);dialogRef.current?.showModal();};
  const busy=()=>!!dialogRef.current?.querySelector('form[aria-busy="true"]');
  const close = () => {if(!busy())dialogRef.current?.close();};

  return (
    <>
      <button type="button" className={triggerClassName} onClick={open}>
        {trigger}
      </button>
      <dialog ref={dialogRef} aria-labelledby={titleId} className={`admin-modal admin-modal-${size} ${className}`} onClose={()=>setOpened(false)} onCancel={event=>{if(busy())event.preventDefault();}} onClick={(event) => {
        if (event.target !== dialogRef.current) return;
        const rect=event.currentTarget.getBoundingClientRect();
        if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
      }}>
        {opened ? <ToastContainer containerId="admin-modal" position="top-right" autoClose={5000} limit={3} newestOnTop closeOnClick pauseOnHover pauseOnFocusLoss theme="light" style={{zIndex:999999,fontFamily:'inherit',fontSize:13}}/> : null}
        <div className="admin-modal-shell">
          <div className="admin-modal-head">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description ? <p>{description}</p> : null}
            </div>
            <button type="button" className="admin-modal-close" onClick={close} aria-label="Close modal">×</button>
          </div>
          <div className="admin-modal-body">{opened?children:null}</div>
        </div>
      </dialog>
    </>
  );
}
