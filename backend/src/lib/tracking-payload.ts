/** Translate the shared ecommerce payload into TikTok's catalog-compatible format. */
export function tiktokProperties(params: Record<string, unknown>) {
  const ids=Array.isArray(params.content_ids)?params.content_ids:[];
  const entries=Array.isArray(params.contents)?params.contents:ids.map(id=>({id}));
  const contents=entries.map((entry:any,index:number)=>({
    content_id:String(entry.content_id||entry.id||ids[index]||''),
    content_type:entry.content_type||params.content_type||'product',
    ...(entry.content_name||params.content_name?{content_name:String(entry.content_name||params.content_name)}:{}),
    quantity:Number(entry.quantity||params.quantity||1),
    price:Number(entry.price??entry.item_price??params.value??0),
  })).filter(item=>item.content_id);
  const {content_ids: _ids,contents:_contents,...rest}=params;
  return {...rest,...(contents.length?{contents}:{}),...(params.currency?{currency:String(params.currency)}:{})};
}
