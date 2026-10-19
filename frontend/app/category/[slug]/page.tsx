import {notFound} from 'next/navigation';
import Archive from '@/components/launch/shop/Archive';
import {launchCategories} from '@/lib/launch/server';
export const revalidate=30;
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const c=(await launchCategories().catch(()=>[])).find(c=>c.slug===slug);return c?{title:c.seoTitle||c.name,description:c.seoDescription,alternates:{canonical:`/category/${slug}/`}}:{};}
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {slug}=await params;const cats=await launchCategories();if(!cats.some(c=>c.slug===slug))notFound();return <Archive category={slug} searchParams={await searchParams}/>;}
