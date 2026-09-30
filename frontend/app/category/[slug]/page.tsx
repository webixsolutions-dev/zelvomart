import { redirect } from "next/navigation";
export default async function CategoryAlias({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; redirect(`/product-category/${slug}/`); }
