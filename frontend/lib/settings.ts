import { apiFetch } from './api';

export async function getSetting<T>(key:string,fallback:T):Promise<T>{
  try {
    const r=await apiFetch<Record<string,T>>(`/api/settings/public?keys=${encodeURIComponent(key)}`, {
      next: { revalidate: 300, tags: ['settings', `setting:${key}`] },
    });
    return (r[key] ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export async function getSettings(keys:string[]){
  try{
    return await apiFetch<Record<string,unknown>>(`/api/settings/public?keys=${encodeURIComponent(keys.join(','))}`, {
      next: { revalidate: 300, tags: ['settings', ...keys.map((key) => `setting:${key}`)] },
    });
  }catch{
    return {};
  }
}
