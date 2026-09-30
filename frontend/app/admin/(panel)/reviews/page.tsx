import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/admin";

export default async function ReviewsPage() {
  await requireAdmin("content.write");
  const reviews = await prisma.review.findMany({
    include: { product: { select: { title: true, slug: true } }, order: { select: { orderNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  async function moderate(formData: FormData) {
    "use server";
    const user = await requireAdmin("content.write");
    const id = String(formData.get("id"));
    const status = String(formData.get("status")) as "APPROVED" | "REJECTED" | "PENDING";
    const review = await prisma.review.update({ where: { id }, data: { status } });
    await audit(user.id, "moderate", "Review", id, { status });
    revalidatePath("/admin/reviews");
    revalidatePath(`/product/${review.productId}`);
  }

  return (
    <>
      <div className="admin-title"><div><h1>Reviews</h1><p className="mt-1 text-sm text-slate-500">Only approved real customer reviews are shown on product pages.</p></div></div>
      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead><tr><th>Customer</th><th>Product</th><th>Rating</th><th>Review</th><th>Verified</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id}>
                <td>{review.name}<div className="text-xs text-slate-400">{review.order?.orderNumber || "No linked order"}</div></td>
                <td><a href={`/product/${review.product.slug}/`} target="_blank" className="font-bold text-sky-700">{review.product.title}</a></td>
                <td>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</td>
                <td className="max-w-md whitespace-normal">{review.body}</td>
                <td>{review.verified ? "Verified" : "Unverified"}</td>
                <td><b>{review.status}</b></td>
                <td>
                  <form action={moderate} className="flex gap-2">
                    <input type="hidden" name="id" value={review.id}/>
                    <button name="status" value="APPROVED" className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-bold text-emerald-700">Approve</button>
                    <button name="status" value="REJECTED" className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-700">Reject</button>
                  </form>
                </td>
              </tr>
            ))}
            {!reviews.length ? <tr><td colSpan={7}>No reviews yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
