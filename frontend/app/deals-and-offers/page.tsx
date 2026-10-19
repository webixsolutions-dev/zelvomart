import Archive from '@/components/launch/shop/Archive';
import {collections} from '@/lib/launch/catalog';
export const revalidate=30;
export const metadata={title:collections['deals'].seoTitle,description:collections['deals'].seoDescription,alternates:{canonical:'/deals-and-offers/'}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Archive collection="deals" searchParams={await searchParams}/>;}
