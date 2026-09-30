import { prisma } from "@/lib/db";
import { cleanHtml } from "@/lib/sanitize";
export const metadata = { title: "Blog" };
export default async function BlogPage(){ const page=await prisma.page.findUnique({where:{slug:"blog"}}); return <div className="site-shell"><div className="page-head"><h1>Blog</h1><p>Guides, product updates and Zelvomart news.</p></div>{page?.bodyHtml?<article className="content-card" dangerouslySetInnerHTML={{__html:cleanHtml(page.bodyHtml)}}/>:<div className="content-card"><p>Blog content can be managed from the admin panel.</p></div>}</div>; }
