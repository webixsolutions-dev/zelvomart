"use client";

import Image from "next/image";
import { CircleCheck } from "lucide-react";
import { useShop } from "@/lib/store";

export function Toaster() {
  const { toasts } = useShop();
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          {t.image ? <Image src={t.image} alt="" width={42} height={42} /> : <CircleCheck size={22} />}
          <div>
            <strong>{t.title}</strong>
            {t.body && <span>{t.body}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
