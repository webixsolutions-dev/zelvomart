"use client";

import { ReactNode, useRef } from "react";

type AdminModalProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl" | "full";
  triggerClassName?: string;
};

export default function AdminModal({
  trigger,
  title,
  description,
  children,
  size = "lg",
  triggerClassName = "admin-btn admin-btn-primary",
}: AdminModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" className={triggerClassName} onClick={open}>
        {trigger}
      </button>
      <dialog ref={dialogRef} className={`admin-modal admin-modal-${size}`} onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}>
        <div className="admin-modal-shell">
          <div className="admin-modal-head">
            <div>
              <h2>{title}</h2>
              {description ? <p>{description}</p> : null}
            </div>
            <button type="button" className="admin-modal-close" onClick={close} aria-label="Close modal">×</button>
          </div>
          <div className="admin-modal-body">{children}</div>
        </div>
      </dialog>
    </>
  );
}
