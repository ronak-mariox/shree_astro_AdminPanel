/**
 * Orders — every store purchase, and the shipping status the customer watches.
 *
 * Status only moves forward (placed → packed → shipped → out for delivery →
 * delivered); a cancellation refunds the wallet and restocks, so it is behind
 * a confirmation.
 */

import { useState } from 'react';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/Shell';
import {
  Button,
  Chips,
  DetailList,
  Drawer,
  Field,
  Identity,
  LoadingBlock,
  Modal,
  Note,
  Select,
  StatCard,
  StatusBadge,
  Textarea,
  Thumb,
  Timeline,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { getOrder, listOrders, updateOrderStatus } from '../services/admin';
import { can } from '../services/session';
import { count, date, dateTime, label, money, phone as formatPhone, shortMoney } from '../utils/format';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

/** The shipping pipeline, in order. */
const FLOW = ['placed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
const isOpen = (status) => !['delivered', 'cancelled'].includes(status);
const inTransit = (status) => ['shipped', 'out_for_delivery'].includes(status);

/** Everything after the current step, for the "advance" control. */
const nextStatuses = (status) => FLOW.slice(FLOW.indexOf(status) + 1);

const PAGE_LIMIT = 100;
const DAY = 24 * 60 * 60 * 1000;

export function OrdersPage({ notify }) {
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [advance, setAdvance] = useState({ status: '', note: '' });
  const [cancelling, setCancelling] = useState(null);
  const [cancelNote, setCancelNote] = useState('');
  const [run, busy] = useAction(notify);

  const { data, loading, error, reload } = useApi(
    () => listOrders({ status: filter === 'all' ? undefined : filter, limit: PAGE_LIMIT }),
    [filter],
  );
  const { data: detail, loading: loadingDetail, reload: reloadDetail } = useApi(
    () => getOrder(openId),
    [openId],
    { skip: !openId },
  );

  const rows = data?.items ?? [];
  const canManage = can('shop.manage');

  const startOfToday = new Date().setHours(0, 0, 0, 0);
  /** Thirty full days back from this morning. */
  const since30d = startOfToday - 30 * DAY;
  const ordersToday = rows.filter((row) => new Date(row.createdAt).getTime() >= startOfToday);
  const pendingRows = rows.filter((row) => ['placed', 'packed'].includes(row.status));
  const transitRows = rows.filter((row) => inTransit(row.status));
  const revenue30d = rows
    .filter(
      (row) =>
        row.status !== 'cancelled' && new Date(row.createdAt).getTime() >= since30d,
    )
    .reduce((sum, row) => sum + (row.total || 0), 0);

  const open = detail?.order;

  const openOrder = (id) => {
    setAdvance({ status: '', note: '' });
    setOpenId(id);
  };

  const after = async () => {
    await reload();
    if (openId) await reloadDetail();
  };

  const submitAdvance = () => {
    const status = advance.status || nextStatuses(open.status)[0];
    return run(() => updateOrderStatus(open.id, { status, note: advance.note.trim() || undefined }), {
      success: `${open.reference} marked ${label(status).toLowerCase()}`,
      onDone: async () => {
        setAdvance({ status: '', note: '' });
        await after();
      },
    });
  };

  const submitCancel = () =>
    run(
      () =>
        updateOrderStatus(cancelling.id, {
          status: 'cancelled',
          note: cancelNote.trim() || undefined,
        }),
      {
        success: `${cancelling.reference} cancelled and refunded`,
        onDone: async () => {
          setCancelling(null);
          setCancelNote('');
          await after();
        },
      },
    );

  const columns = [
    {
      key: 'reference',
      label: 'Order',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong mono">{row.reference}</p>
          <p className="faint nowrap" style={{ fontSize: 11.5 }}>
            {dateTime(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortable: true,
      sortValue: (row) => row.user?.name || row.shipping?.fullName || '',
      render: (row) => (
        <Identity
          name={row.user?.name || row.shipping?.fullName || 'Customer'}
          meta={formatPhone(row.user?.phone || row.shipping?.phone)}
          size="sm"
        />
      ),
    },
    {
      key: 'items',
      label: 'Items',
      render: (row) => {
        const qty = (row.items || []).reduce((sum, item) => sum + (item.qty || 0), 0);
        const first = row.items?.[0]?.name;
        return (
          <div style={{ maxWidth: 260 }}>
            <p className="strong">
              {count(qty)} item{qty === 1 ? '' : 's'}
            </p>
            <p className="faint truncate" style={{ fontSize: 11.5 }}>
              {first}
              {row.items?.length > 1 ? ` +${row.items.length - 1} more` : ''}
            </p>
          </div>
        );
      },
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono strong">{money(row.total)}</span>,
    },
    {
      key: 'payment',
      label: 'Payment',
      sortable: true,
      sortValue: (row) => row.payment?.status || '',
      render: (row) => <StatusBadge status={row.payment?.status || 'paid'} />,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      sortValue: (row) => new Date(row.updatedAt).getTime(),
      render: (row) => <span className="nowrap">{date(row.updatedAt)}</span>,
    },
  ];

  const trail = (open?.tracking ?? []).map((entry, index, list) => ({
    title: label(entry.status),
    meta: [dateTime(entry.at), entry.note].filter(Boolean).join(' · '),
    state:
      index === list.length - 1 && isOpen(open.status)
        ? 'active'
        : 'done',
  }));

  return (
    <div className="page">
      <PageHeader
        title="Orders"
        subtitle="Store purchases paid from the wallet — move each one along to delivered"
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="Orders today"
          value={count(ordersToday.length)}
          icon="package"
          tone="brand"
          hint="placed since midnight"
        />
        <StatCard
          label="Pending"
          value={count(pendingRows.length)}
          icon="clock"
          tone="yellow"
          hint="placed or packed"
        />
        <StatCard
          label="In transit"
          value={count(transitRows.length)}
          icon="activity"
          hint="shipped or out for delivery"
        />
        <StatCard
          label="Revenue (30d)"
          value={shortMoney(revenue30d)}
          icon="rupee"
          tone="success"
          hint="in this view, excluding cancellations"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows.map((row) => ({
          ...row,
          customer: row.user?.name || row.shipping?.fullName || '',
          customerPhone: row.user?.phone || row.shipping?.phone || '',
        }))}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['reference', 'customer', 'customerPhone', 'status']}
        searchPlaceholder="Search by order, customer or phone…"
        onRowClick={(row) => openOrder(row.id)}
        toolbar={<Chips value={filter} onChange={setFilter} items={FILTERS} />}
        empty={{ icon: 'package', title: 'No orders in this view' }}
      />

      {openId && (
        <Drawer
          wide
          title={open?.reference || 'Loading…'}
          subtitle={open ? `Placed ${dateTime(open.createdAt)}` : ''}
          onClose={() => setOpenId(null)}
          footer={
            open && canManage && isOpen(open.status) ? (
              <Button
                variant="danger"
                icon="x"
                disabled={busy}
                onClick={() => setCancelling(open)}
              >
                Cancel order
              </Button>
            ) : undefined
          }
        >
          {loadingDetail || !open ? (
            <LoadingBlock />
          ) : (
            <div className="stack" style={{ gap: 18 }}>
              <div className="profile-head">
                <Identity
                  name={open.user?.name || open.shipping?.fullName || 'Customer'}
                  meta={formatPhone(open.user?.phone || open.shipping?.phone)}
                  size="lg"
                />
                <div className="row" style={{ gap: 6 }}>
                  <StatusBadge status={open.status} />
                  <StatusBadge status={open.payment?.status || 'paid'} />
                </div>
              </div>

              <div className="mini-stats">
                <div>
                  <p className="eyebrow">Items</p>
                  <p className="mini-stats__value">
                    {count((open.items || []).reduce((sum, item) => sum + (item.qty || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Subtotal</p>
                  <p className="mini-stats__value">{money(open.subtotal)}</p>
                </div>
                <div>
                  <p className="eyebrow">Shipping</p>
                  <p className="mini-stats__value">
                    {open.shippingFee ? money(open.shippingFee) : 'Free'}
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Total</p>
                  <p className="mini-stats__value">{money(open.total)}</p>
                </div>
              </div>

              {canManage && isOpen(open.status) && (
                <section>
                  <h3 className="section-title">Advance status</h3>
                  <div className="stack" style={{ gap: 12 }}>
                    <div className="grid grid--2" style={{ gap: 14 }}>
                      <Field label="Move to">
                        <Select
                          value={advance.status || nextStatuses(open.status)[0]}
                          onChange={(event) =>
                            setAdvance((current) => ({ ...current, status: event.target.value }))
                          }
                          options={nextStatuses(open.status).map((status) => ({
                            value: status,
                            label: label(status),
                          }))}
                        />
                      </Field>
                      <Field label="Note" hint="Optional — shown to the customer in tracking">
                        <Textarea
                          rows={1}
                          placeholder="e.g. Handed to Delhivery, AWB 1234567890"
                          value={advance.note}
                          onChange={(event) =>
                            setAdvance((current) => ({ ...current, note: event.target.value }))
                          }
                        />
                      </Field>
                    </div>
                    <div>
                      <Button variant="primary" icon="check" disabled={busy} onClick={submitAdvance}>
                        Update
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              <section>
                <h3 className="section-title">Items</h3>
                <div className="table-wrap">
                  <table className="table table--dense">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="num">Price</th>
                        <th className="num">Qty</th>
                        <th className="num">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(open.items || []).map((item, index) => (
                        <tr key={item.product?.id || index}>
                          <td>
                            <div className="identity">
                              <Thumb src={item.imageUrl || item.product?.imageUrl} size={32} />
                              <div className="truncate">
                                <div className="identity__name truncate">{item.name}</div>
                                {item.product?.slug && (
                                  <div className="identity__meta truncate">{item.product.slug}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="num mono">{money(item.price)}</td>
                          <td className="num mono">{item.qty}</td>
                          <td className="num mono strong">{money(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="section-title">Totals</h3>
                <DetailList
                  rows={[
                    { label: 'Subtotal', value: money(open.subtotal) },
                    { label: 'Tax (18%)', value: money(open.tax) },
                    { label: 'Shipping', value: open.shippingFee ? money(open.shippingFee) : 'Free' },
                    { label: 'Total charged', value: money(open.total) },
                    {
                      label: 'Payment',
                      value: `${label(open.payment?.method || 'wallet')} · ${label(
                        open.payment?.status || 'paid',
                      )}`,
                    },
                  ]}
                />
              </section>

              <section>
                <h3 className="section-title">Shipping address</h3>
                <DetailList
                  rows={[
                    { label: 'Name', value: open.shipping?.fullName || '—' },
                    { label: 'Phone', value: formatPhone(open.shipping?.phone) },
                    { label: 'Email', value: open.shipping?.email || '—' },
                    { label: 'Address', value: open.shipping?.address || '—' },
                    {
                      label: 'City / State',
                      value:
                        [open.shipping?.city, open.shipping?.state].filter(Boolean).join(', ') ||
                        '—',
                    },
                    { label: 'PIN code', value: open.shipping?.pincode || '—' },
                  ]}
                />
              </section>

              <section>
                <h3 className="section-title">Tracking</h3>
                {trail.length === 0 ? (
                  <p className="faint" style={{ fontSize: 12.5 }}>
                    No tracking entries yet.
                  </p>
                ) : (
                  <Timeline items={trail} />
                )}
              </section>

              {open.status === 'cancelled' && (
                <Note tone="danger" icon="alert">
                  Cancelled {dateTime(open.cancelledAt)} — the wallet was refunded and the
                  items restocked.
                </Note>
              )}
            </div>
          )}
        </Drawer>
      )}

      {cancelling && (
        <Modal
          title={`Cancel ${cancelling.reference}?`}
          subtitle="The full amount goes back to the customer's wallet and the stock is returned"
          onClose={() => {
            setCancelling(null);
            setCancelNote('');
          }}
          footer={
            <>
              <Button
                onClick={() => {
                  setCancelling(null);
                  setCancelNote('');
                }}
              >
                Keep order
              </Button>
              <Button variant="danger" icon="x" disabled={busy} onClick={submitCancel}>
                Cancel &amp; refund {money(cancelling.total)}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <Note tone="danger" icon="alert">
              This cannot be undone. The customer is notified, and the reason below is shown
              in their order tracking.
            </Note>
            <Field label="Reason" hint="Optional">
              <Textarea
                placeholder="e.g. Item damaged in the warehouse; refunded in full."
                value={cancelNote}
                onChange={(event) => setCancelNote(event.target.value)}
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default OrdersPage;
