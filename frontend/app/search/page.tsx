import Archive from '@/components/launch/shop/Archive';
import {collections} from '@/lib/launch/catalog';
export const revalidate=30;
export const metadata={title:collections['shop'].seoTitle,description:collections['shop'].seoDescription,alternates:{canonical:'/search/'}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Archive collection="shop" searchParams={await searchParams}/>;}
