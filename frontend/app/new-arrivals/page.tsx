import Archive from '@/components/launch/shop/Archive';
import {collections} from '@/lib/launch/catalog';
export const revalidate=30;
export const metadata={title:collections['new-arrivals'].seoTitle,description:collections['new-arrivals'].seoDescription,alternates:{canonical:'/new-arrivals/'}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Archive collection="new-arrivals" searchParams={await searchParams}/>;}
