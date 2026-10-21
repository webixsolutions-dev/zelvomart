/** Woo variants can inherit their parent's tracked stock. Never synthesize 9,999 stock. */
export function wooStock(
  row: { manage_stock?: boolean | string; stock_quantity?: number | null; stock_status?: string },
  parent?: { manage_stock?: boolean | string; stock_quantity?: number | null; stock_status?: string },
) {
  const inherited = row.manage_stock === "parent" || (row.manage_stock !== true && parent?.manage_stock === true);
  const source = inherited && parent ? parent : row;
  // Parent-managed variations must share one parent pool. They remain untracked;
  // the importer rejects them until that inventory model is explicitly mapped.
  if (inherited && parent?.manage_stock === true)
    throw new Error("Parent-managed variation stock needs an explicit shared-stock mapping before import.");
  return {
    trackStock: source.manage_stock === true,
    stock: source.manage_stock === true ? Math.max(0, Math.floor(Number(source.stock_quantity) || 0)) : 0,
    stockStatus: source.stock_status === "instock" ? "instock" : "outofstock",
  };
}
