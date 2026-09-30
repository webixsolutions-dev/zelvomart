import { revalidatePath } from "next/cache";
import { ExperimentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import AdminModal from "@/components/admin/AdminModal";

export default async function ExperimentsPage() {
  await requireAdmin("reports.read");
  const rows = await prisma.experiment.findMany({ orderBy: { createdAt: "desc" } });

  async function create(formData: FormData) {
    "use server";
    await requireAdmin("content.write");
    await prisma.experiment.create({ data: { name: String(formData.get("name") || ""), pagePattern: String(formData.get("pagePattern") || ""), variants: ["A", "B"], trafficSplit: { A: 50, B: 50 }, status: "DRAFT" } });
    revalidatePath("/admin/experiments");
  }

  async function setStatus(formData: FormData) {
    "use server";
    await requireAdmin("content.write");
    const id = String(formData.get("id"));
    const status = String(formData.get("status")) as ExperimentStatus;
    if (status === "RUNNING") {
      const row = await prisma.experiment.findUnique({ where: { id } });
      if (row) await prisma.experiment.updateMany({ where: { pagePattern: row.pagePattern, status: "RUNNING", id: { not: id } }, data: { status: "PAUSED" } });
    }
    await prisma.experiment.update({ where: { id }, data: { status, startsAt: status === "RUNNING" ? new Date() : undefined, endsAt: status === "ENDED" ? new Date() : undefined } });
    revalidatePath("/admin/experiments");
  }

  return (
    <>
      <div className="admin-title">
        <div><h1>Experiments</h1><p>P1 A/B testing framework. One experiment per page at a time.</p></div>
        <AdminModal trigger={<><span className="text-base">＋</span> Create Experiment</>} title="Create Experiment" description="Create the experiment in draft, then start it from the list." size="md">
          <form action={create} className="admin-reference-shell">
            <div className="admin-reference-form">
              <label className="field"><span>Experiment name</span><input name="name" placeholder="Required email field" required /></label>
              <label className="field"><span>Page pattern</span><input name="pagePattern" placeholder="/product/*" required /></label>
            </div>
            <div className="admin-modal-footer-actions"><button className="admin-btn admin-btn-primary">Create A/B Test</button></div>
          </form>
        </AdminModal>
      </div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Page</th><th>Status</th><th>Traffic</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.name}</b></td><td>{row.pagePattern}</td><td><span className="status-pill">{row.status}</span></td><td>{JSON.stringify(row.trafficSplit)}</td><td><form action={setStatus} className="admin-inline-action"><input type="hidden" name="id" value={row.id}/><select name="status" defaultValue={row.status}>{Object.values(ExperimentStatus).map((status) => <option key={status}>{status}</option>)}</select><button className="admin-row-action">Save</button></form></td></tr>)}</tbody></table></div>
    </>
  );
}
