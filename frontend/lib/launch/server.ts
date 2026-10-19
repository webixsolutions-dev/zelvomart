import {cache} from 'react';
import {apiFetch} from '@/lib/api';
import {designProduct,designCategory} from './adapter';
import type {ProductListResponse,Category} from '@/types/product';

// No mock-catalog fallback: a failed API produces an explicit unavailable state.
export const launchProducts=cache(async(query='')=>{
  const data=await apiFetch<ProductListResponse>('/api/products?'+query,{next:{revalidate:30,tags:['products']}});
  return {...data,items:data.items.map(designProduct)};
});
export const launchCategories=cache(async()=>{
  const data=await apiFetch<Category[]>('/api/categories',{next:{revalidate:30,tags:['categories']}});
  return data.map(designCategory);
});
