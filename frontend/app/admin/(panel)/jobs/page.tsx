import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/admin";
import { dispatchJobRow } from "@/lib/jobs";

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  await requireAdmin("settings.write");
  const sp = await searchParams;
  const status = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const jobs = await prisma.job.findMany({
    where: status && ["QUEUED","RUNNING","SUCCEEDED","FAILED"].includes(status) ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  async function retry(formData: FormData) {
    "use server";
    const user = await requireAdmin("settings.write");
    const id = String(formData.get("id"));
    await dispatchJobRow(id);
    await audit(user.id, "retry", "Job", id);
    revalidatePath("/admin/jobs");
  }

  return <>
    <div className="admin-title"><div><h1>Background jobs</h1><p className="mt-1 text-sm text-slate-500">Email, Meta and operational work is logged here so failures are never silent.</p></div></div>
    <form className="admin-card mb-5 flex gap-2"><select name="status" defaultValue={status || ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">All statuses</option><option>QUEUED</option><option>RUNNING</option><option>SUCCEEDED</option><option>FAILED</option></select><button className="btn-dark">Filter</button></form>
    <div className="admin-card overflow-x-auto"><table className="admin-table"><thead><tr><th>Created</th><th>Job</th><th>Order</th><th>Status</th><th>Attempts</th><th>Error</th><th></th></tr></thead><tbody>{jobs.map(job=><tr key={job.id}><td>{job.createdAt.toLocaleString()}</td><td><b>{job.name}</b></td><td>{job.orderId || "—"}</td><td>{job.status}</td><td>{job.attempts}</td><td className="max-w-md whitespace-normal text-xs text-red-700">{job.error || "—"}</td><td>{job.status === "FAILED" ? <form action={retry}><input type="hidden" name="id" value={job.id}/><button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold">Retry</button></form> : null}</td></tr>)}{!jobs.length?<tr><td colSpan={7}>No jobs found.</td></tr>:null}</tbody></table></div>
  </>;
}
