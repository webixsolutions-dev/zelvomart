"use client";
import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {useAdminRole} from '@/components/admin/AdminRoleContext';
import {useEffect, useState, type CSSProperties, type FormEvent} from 'react';
import {useAdminData, AdminLoading, AdminError} from '@/components/admin/useAdminData';
import {clientApi} from '@/lib/client-api';
import {money} from '@/lib/format';
import {toast} from 'react-toastify';
import './order-detail.css';

const STATUSES = ['NEW', 'CONFIRMED', 'ON_HOLD', 'BOOKED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED', 'SETTLED'];
const LOCKED = ['CANCELLED', 'RETURNED', 'DELIVERED', 'SETTLED'];
// Same colours as the orders list.
const TONES: Record<string, string> = {
  NEW: '#eea009', ON_HOLD: '#eea009', CONFIRMED: '#187bff', BOOKED: '#8a4cff', IN_TRANSIT: '#8a4cff',
  DELIVERED: '#00b578', SETTLED: '#00b578', CANCELLED: '#ff4261', RETURNED: '#ed338c',
};
const statusLabel = (s: string) => s.replaceAll('_', ' ').toLowerCase();
const when = (s: string) => new Date(s).toLocaleString('en-PK', {day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Karachi'});
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

function Status({status}: {status: string}) {
  return <span className="ode-status" style={{'--tone': TONES[status] || '#187bff'} as CSSProperties}>{statusLabel(status)}</span>;
}

export default function OrderDetail() {
  const {id} = useParams<{id: string}>();
  const router = useRouter();
  const role = useAdminRole();
  const canDelete = role === 'OWNER' || role === 'MANAGER';
  const {data: o, loading, error, reload} = useAdminData<any>(`/api/admin/orders/${id}`, null);
  const [items, setItems] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (o) setItems(o.items); }, [o]);
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => void clientApi<any>('/api/admin/orders/catalog?search=' + encodeURIComponent(query), {signal: controller.signal}, true).then(d => setResults(d.items || [])).catch(() => undefined), 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query]);

  async function action(path: string, body: any) {
    setBusy(true);
    try {
      await clientApi(`/api/admin/orders/${id}${path}`, {method: path === '/notes' || path === '/resend-purchase' || path === '/mark-test' ? 'POST' : 'PATCH', body: JSON.stringify(body)}, true);
      await reload();
      toast.success('Order updated.');
    } catch {} finally { setBusy(false); }
  }
  // One confirm, then the order is gone for good (jobs removed, no restock) and the list opens again.
  async function deleteOrder() {
    if (busy || !canDelete || !window.confirm('Delete 1 order? This cannot be undone.')) return;
    setBusy(true);
    try {
      await clientApi(`/api/admin/orders/${id}`, {method: 'DELETE'}, true);
      toast.success('Order deleted.');
      router.replace('/admin/orders');
    } catch { setBusy(false); }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action('', {...Object.fromEntries(f), updatedAt: o.updatedAt, items: LOCKED.includes(o.status) ? undefined : items.map(i => ({id: i.id, productId: i.productId, variantId: i.variantId, quantity: Number(i.quantity)}))});
  }

  if (loading) return <AdminLoading/>;
  if (error || !o) return <AdminError message={error || 'Order not found'}/>;
  const editable = !LOCKED.includes(o.status);
  const phoneDigits = String(o.phone || '').replace(/\D/g, '');
  const history = o.customerHistory;
  const pastOrders = history?.orders.length || 0;
  const timeline = [
    ...(o.statusHistory || []).map((h: any) => ({...h, kind: 'status', text: 'Status → ' + statusLabel(h.to) + (h.note ? ' · ' + h.note : ''), author: h.user?.name || 'System'})),
    ...(o.privateNotes || []).map((n: any) => ({...n, kind: 'note', text: n.body, author: n.authorName || 'Staff'})),
  ].sort((a: any, b: any) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const campaign = o.lastTouch?.utm_campaign || o.firstTouch?.utm_campaign;
  const landing = o.replay?.landingUrl || o.firstTouch?.landing_page;

  return <div className="order-editor" key={o.updatedAt}>
    {/* Inputs in several cards submit together through form="order-edit". */}
    <form id="order-edit" onSubmit={save} hidden/>
    <CityList/>

    <header className="ode-head">
      <div className="ode-head-top">
        <Link href="/admin/orders" className="ode-back">← All orders</Link>
        <nav className="ode-pager" aria-label="Other orders">
          {o.previous ? <Link className="admin-btn admin-btn-light" href={'/admin/orders/' + o.previous}>← Previous</Link> : null}
          {o.next ? <Link className="admin-btn admin-btn-light" href={'/admin/orders/' + o.next}>Next →</Link> : null}
        </nav>
      </div>
      <div className="ode-head-main">
        <div>
          <h1>{o.orderNumber} <Status status={o.status}/>{o.test ? <span className="ode-chip">Test order</span> : null}</h1>
          <p>{when(o.createdAt)} · <b>{money(o.total)}</b> · {o.paymentMethod === 'NAYAPAY' ? 'NayaPay' : 'Cash on Delivery'} · Source: {o.source || 'direct'}</p>
        </div>
        <div className="ode-actions">
          {o.status === 'NEW' && <button type="button" disabled={busy} className="admin-btn admin-btn-primary" onClick={() => void action('/status', {status: 'CONFIRMED'})}>✓ Confirm order</button>}
          <a className="admin-btn admin-btn-light" href={'https://wa.me/' + phoneDigits} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="admin-btn admin-btn-light" href={'tel:' + o.phone}>Call</a>
          <Link className="admin-btn admin-btn-light" href={`/admin/orders/${id}/print?type=invoice`} target="_blank">Print invoice</Link>
          {!o.test && <button type="button" className="admin-btn admin-btn-light" disabled={busy} onClick={() => { if (window.confirm('Mark this order as a test? Pending emails and tracking jobs will be skipped.')) void action('/mark-test', {}); }}>Mark as test</button>}
          {canDelete && <button type="button" disabled={busy} className="admin-btn ode-danger" onClick={() => void deleteOrder()}>Delete</button>}
        </div>
      </div>
      {(o.possibleDuplicate || o.blocklistedAtOrder || o.customer?.blocklisted) && <div className="ode-alerts" role="status">
        {o.possibleDuplicate && <p>⚠ Possible duplicate: the same customer ordered within 24 hours.</p>}
        {o.blocklistedAtOrder && <p>⚠ This customer was blocklisted when they ordered.</p>}
        {o.customer?.blocklisted && !o.blocklistedAtOrder && <p>⚠ This customer is blocklisted now.</p>}
      </div>}
    </header>

    <div className="ode-layout">
      <div className="ode-col ode-col-main">
        <section className="ode-card ode-customer" aria-labelledby="ode-customer-title">
          <div className="ode-card-head"><h2 id="ode-customer-title">Customer and delivery</h2><span className="ode-muted">{pastOrders > 1 ? `Returning customer · ${pastOrders} orders` : 'First order'}</span></div>
          <div className="ode-person">
            <span className="ode-avatar" aria-hidden="true">{initials(o.fullName || '')}</span>
            <div><strong>{o.fullName}</strong><span className="ode-muted">{o.city}</span></div>
          </div>
          <dl className="ode-facts">
            <div><dt>Phone</dt><dd><a href={'tel:' + o.phone}>{o.phone}</a> <a className="ode-link" href={'https://wa.me/' + phoneDigits} target="_blank" rel="noreferrer">WhatsApp ↗</a></dd></div>
            <div><dt>Email</dt><dd>{o.email ? <a href={'mailto:' + o.email}>{o.email}</a> : <span className="ode-muted">Not given, so no order or status emails go to the customer</span>}</dd></div>
            <div className="ode-wide"><dt>Address</dt><dd>{o.address}{o.city ? `, ${o.city}` : ''}</dd></div>
            <div><dt>Estimated delivery</dt><dd>{o.deliveryEstimate || '—'}</dd></div>
          </dl>
          {o.notes ? <div className="ode-note"><b>Customer note</b><p>{o.notes}</p></div> : null}
          <details className="ode-edit">
            <summary>Edit customer and delivery details</summary>
            <div className="admin-reference-form">
              {[['fullName', 'Name'], ['phone', 'Phone'], ['email', 'Email (optional)'], ['city', 'City'], ['address', 'Delivery address']].map(([key, label]) => <label className={'field' + (key === 'address' ? ' full' : '')} key={key}><span>{label}</span><input form="order-edit" name={key} defaultValue={o[key] || ''} required={key !== 'email'} type={key === 'email' ? 'email' : 'text'} list={key === 'city' ? 'order-cities' : undefined}/></label>)}
              <label className="field full"><span>Customer note</span><textarea form="order-edit" name="notes" maxLength={1000} defaultValue={o.notes || ''}/></label>
            </div>
            <button form="order-edit" className="admin-btn admin-btn-primary" disabled={busy}>Save changes</button>
          </details>
        </section>

        <section className="ode-card ode-items" aria-labelledby="ode-items-title">
          <div className="ode-card-head"><h2 id="ode-items-title">Items</h2><span className="ode-muted">{items.reduce((n, i) => n + Number(i.quantity || 0), 0)} pieces</span></div>
          <ul className="ode-lines">
            {items.map((item, index) => <li key={item.id || index}>
              {item.imageUrl ? <img src={item.imageUrl} width="56" height="56" alt=""/> : <span className="ode-thumb" aria-hidden="true">▧</span>}
              <div className="ode-line-info">
                <strong>{item.title}</strong>
                <span className="ode-muted">{[item.variantLabel, item.sku ? 'SKU ' + item.sku : 'SKU set on save', money(item.unitPrice || 0) + ' each'].filter(Boolean).join(' · ')}</span>
              </div>
              <label className="ode-qty"><span className="ode-sr">Quantity for {item.title}</span><input type="number" min={1} max={100} disabled={!editable} value={item.quantity} onChange={e => setItems(rows => rows.map((r, i) => i === index ? {...r, quantity: Number(e.target.value)} : r))}/></label>
              <b className="ode-line-total">{money((Number(item.unitPrice || 0) - Number(item.bundleDiscount || 0) / (o.items.find((i: any) => i.id === item.id)?.quantity || 1)) * item.quantity)}</b>
              {editable && <button type="button" className="ode-remove" aria-label={'Remove ' + item.title} disabled={items.length < 2} onClick={() => setItems(rows => rows.filter((_, i) => i !== index))}>×</button>}
            </li>)}
          </ul>
          {editable && <div className="ode-add">
            <input aria-label="Find product to add" placeholder="+ Find a product to add…" value={query} onChange={e => setQuery(e.target.value)}/>
            {results.length > 0 && <ul>
              {results.map(p => <li key={p.id}>
                <span>{p.title}</span>
                <div>{p.variants?.length
                  ? p.variants.map((v: any) => <button type="button" className="admin-btn admin-btn-light" key={v.id} onClick={() => setItems(rows => [...rows, {productId: p.id, variantId: v.id, title: p.title, variantLabel: v.name, unitPrice: v.pricing?.price ?? v.priceOverride ?? p.price, sku: v.sku, imageUrl: p.image, quantity: 1}])}>Add {v.name}</button>)
                  : <button type="button" className="admin-btn admin-btn-light" onClick={() => setItems(rows => [...rows, {productId: p.id, title: p.title, unitPrice: p.price, sku: p.sku, imageUrl: p.image, quantity: 1}])}>Add</button>}</div>
              </li>)}
            </ul>}
          </div>}
          <dl className="ode-totals">
            <div><dt>Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
            {Number(o.bundleSaving) > 0 && <div><dt>Bundle saving</dt><dd>−{money(o.bundleSaving)}</dd></div>}
            {o.couponCode && <div><dt>Coupon {o.couponCode}</dt><dd>−{money(o.couponDiscount)}</dd></div>}
            <div><dt>Delivery</dt><dd>{Number(o.deliveryFee) ? money(o.deliveryFee) : 'Free'}</dd></div>
            <div className="ode-grand"><dt>Total to collect</dt><dd>{money(o.total)}</dd></div>
          </dl>
          <div className="ode-save">
            <small className="ode-muted">{editable ? 'Stock and totals recalculate when you save.' : 'Items are locked once an order is delivered, returned, cancelled or settled.'}</small>
            <button form="order-edit" className="admin-btn admin-btn-primary" disabled={busy}>Save changes</button>
          </div>
        </section>

        <section className="ode-card ode-timeline" aria-labelledby="ode-timeline-title">
          <div className="ode-card-head"><h2 id="ode-timeline-title">Staff notes and history</h2><span className="ode-muted">Private, never shown to the customer</span></div>
          <form className="ode-note-form" onSubmit={async e => { e.preventDefault(); await action('/notes', {body: note}); setNote(''); }}>
            <textarea aria-label="Private staff note" maxLength={5000} value={note} onChange={e => setNote(e.target.value)} placeholder="Add a private note, e.g. “Customer asked to deliver after 5 pm”"/>
            <button className="admin-btn admin-btn-primary" disabled={busy || !note.trim()}>Add note</button>
          </form>
          {timeline.length ? <ol>
            {timeline.map((n: any) => <li key={n.kind + n.id} className={'ode-entry ode-entry-' + n.kind}>
              <div><b>{n.author}</b><time dateTime={n.createdAt}>{when(n.createdAt)}</time></div>
              <p>{n.text}</p>
            </li>)}
          </ol> : <p className="ode-muted">No notes yet.</p>}
        </section>
      </div>

      <aside className="ode-col ode-col-side">
        <section className="ode-card ode-shipping" aria-labelledby="ode-status-title">
          <div className="ode-card-head"><h2 id="ode-status-title">Status and shipping</h2><Status status={o.status}/></div>
          <form className="ode-inline" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action('/status', {status: f.get('status')}); }}>
            <label><span>Change status</span><select name="status" defaultValue={o.status}>{STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>
            <button className="admin-btn admin-btn-primary" disabled={busy}>Update</button>
          </form>
          <p className="ode-hint">{o.email ? `The customer gets an email at ${o.email} when the status changes.` : 'No email on this order, so the customer is not emailed. Use WhatsApp to update them.'}</p>
          <form className="ode-inline" onSubmit={e => { e.preventDefault(); void action('/tracking', {tracking: new FormData(e.currentTarget).get('tracking')}); }}>
            <label><span>PostEx tracking number</span><input name="tracking" defaultValue={o.postexTracking || ''} placeholder="e.g. 2201234567"/></label>
            <button className="admin-btn admin-btn-light" disabled={busy}>Save</button>
          </form>
          {o.trackingUrl && <a className="ode-link" href={o.trackingUrl} target="_blank" rel="noreferrer">Track shipment ↗</a>}
        </section>

        <section className="ode-card" aria-labelledby="ode-history-title">
          <div className="ode-card-head"><h2 id="ode-history-title">Customer history</h2></div>
          <div className="ode-stats">
            <div><b>{pastOrders}</b><span>Orders</span></div>
            <div><b>{history?.delivered || 0}</b><span>Delivered</span></div>
            <div className={(history?.returned || 0) > 0 ? 'ode-bad' : ''}><b>{history?.returned || 0}</b><span>Returned</span></div>
            <div className={(o.customer?.refusalCount || 0) > 0 ? 'ode-bad' : ''}><b>{o.customer?.refusalCount || 0}</b><span>Refused</span></div>
          </div>
          <dl className="ode-totals ode-compact">
            <div><dt>Total spent</dt><dd>{money(history?.spent || 0)}</dd></div>
            <div><dt>Average order</dt><dd>{money(history?.aov || 0)}</dd></div>
          </dl>
          {o.customer && <label className="admin-check ode-block"><input type="checkbox" checked={o.customer.blocklisted} onChange={async e => { await clientApi(`/api/admin/customers/${o.customer.id}/blocklist`, {method: 'PATCH', body: JSON.stringify({blocklisted: e.target.checked})}, true); await reload(); }}/> Blocklist this customer</label>}
          {o.customer?.notes ? <div className="ode-note"><b>Customer notes</b><p>{o.customer.notes}</p></div> : null}
          {pastOrders > 0 && <ul className="ode-past">
            {history.orders.slice(0, 5).map((h: any) => <li key={h.id}>{h.id === o.id ? <span>{h.orderNumber} (this order)</span> : <Link href={'/admin/orders/' + h.id}>{h.orderNumber}</Link>}<Status status={h.status}/><b>{money(h.total)}</b></li>)}
          </ul>}
          <Link className="ode-link" href="/admin/customers">Manage customer notes →</Link>
        </section>

        <section className="ode-card" aria-labelledby="ode-source-title">
          <div className="ode-card-head"><h2 id="ode-source-title">Where the order came from</h2></div>
          <dl className="ode-facts ode-facts-list">
            <div><dt>Source</dt><dd>{o.source || 'direct'}</dd></div>
            <div><dt>Campaign</dt><dd>{campaign || '—'}</dd></div>
            <div><dt>Ad</dt><dd>{o.lastTouch?.utm_content || '—'}</dd></div>
            <div><dt>Landing page</dt><dd className="ode-break">{landing || '—'}</dd></div>
            <div><dt>Device</dt><dd>{o.replay?.device || 'Unknown'} · {o.replay?.pageViews || 'unknown'} pages viewed</dd></div>
            {['server', 'tiktok-server'].map(channel => {
              const event = o.purchaseEvents?.find((e: any) => e.channel === channel);
              const state = event ? event.accepted ? 'Accepted' : 'Not accepted' : 'Not recorded';
              return <div key={channel}><dt>{channel === 'server' ? 'Meta' : 'TikTok'} Purchase</dt><dd><span className={'ode-pill ' + (event?.accepted ? 'ode-ok' : event ? 'ode-fail' : '')}>{state}</span></dd></div>;
            })}
          </dl>
          <div className="ode-row">
            {o.replaySessionId && <Link className="admin-btn admin-btn-light" href={'/admin/session-replays/' + o.replaySessionId}>Watch session</Link>}
            <button type="button" className="admin-btn admin-btn-light" disabled={busy || o.test || o.staffCreated} onClick={() => void action('/resend-purchase', {})}>Resend Purchase events</button>
          </div>
        </section>
      </aside>
    </div>
  </div>;
}

function CityList() {
  const {data} = useAdminData<any[]>('/api/cities', []);
  return <datalist id="order-cities">{data.map(c => <option key={c.name} value={c.name}/>)}</datalist>;
}
