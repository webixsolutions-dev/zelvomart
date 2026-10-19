import Archive from '@/components/launch/shop/Archive';
import {collections} from '@/lib/launch/catalog';
export const revalidate=30;
export const metadata={title:collections['bestsellers'].seoTitle,description:collections['bestsellers'].seoDescription,alternates:{canonical:'/bestsellers/'}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Archive collection="bestsellers" searchParams={await searchParams}/>;}
