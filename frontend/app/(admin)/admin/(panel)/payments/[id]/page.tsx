"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import "@/components/admin/catalog-pages.css";
import { StatusBadge } from "@/components/admin/AdminListView";
import { PROOF_STATUS } from "@/components/admin/PaymentBits";
import { AdvancePaymentPanel, when } from "@/components/admin/AdvancePaymentPanel";

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="admin-catalog-page">
      <p>
        <Link href="/admin/payments">← All payments</Link>
      </p>
      <AdvancePaymentPanel
        proofId={id}
        header={({ proof, order }) => (
          <div className="admin-title">
            <div>
              <h1>
                Payment for{" "}
                <Link href={`/admin/orders/${order.id}`}>
                  {order.orderNumber}
                </Link>{" "}
                <StatusBadge
                  value={proof.status}
                  label={PROOF_STATUS[proof.status]?.label}
                  tone={PROOF_STATUS[proof.status]?.tone}
                />
              </h1>
              <p>
                {order.fullName} · {order.city} · ordered{" "}
                {when(order.createdAt)} · proof sent {when(proof.createdAt)}
              </p>
            </div>
          </div>
        )}
      />
    </div>
  );
}
