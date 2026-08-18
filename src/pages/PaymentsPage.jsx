/**
 * Payment Management — the Razorpay ledger: captured, processing, failed and
 * refunded orders, with the verification detail behind each payment id.
 */

import { useMemo, useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Chips,
  DetailList,
  Drawer,
  Identity,
  Modal,
  Note,
  StatCard,
  StatusBadge,
  Timeline,
} from '../components/ui';
import { payments as seed } from '../data/operations';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'captured', label: 'Captured' },
  { key: 'processing', label: 'Processing' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
];

const METHOD_ICON = { UPI: 'zap', Card: 'card', Netbanking: 'globe', Wallet: 'wallet' };

export function PaymentsPage({ notify }) {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [refunding, setRefunding] = useState(null);

  const counts = useMemo(
    () =>
      FILTERS.reduce(
        (acc, item) => ({
          ...acc,
          [item.key]:
            item.key === 'all' ? seed.length : seed.filter((row) => row.status === item.key).length,
        }),
        {},
      ),
    [],
  );

  const filtered = filter === 'all' ? seed : seed.filter((row) => row.status === filter);
  const captured = seed
    .filter((row) => row.status === 'captured')
    .reduce((sum, row) => sum + row.amount, 0);

  const columns = [
    {
      key: 'id',
      label: 'Payment ID',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong mono" style={{ fontSize: 12 }}>
            {row.id}
          </p>
          <p className="faint" style={{ fontSize: 11 }}>
            {row.orderId}
          </p>
        </div>
      ),
    },
    {
      key: 'user',
      label: 'Paid by',
      sortable: true,
      render: (row) => <Identity name={row.user} meta={row.purpose} size="sm" />,
    },
    {
      key: 'method',
      label: 'Method',
      sortable: true,
      render: (row) => (
        <span className="row" style={{ gap: 6, fontSize: 12.5 }}>
          <Icon name={METHOD_ICON[row.method] || 'card'} size={14} />
          {row.method}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono strong">₹{row.amount.toLocaleString('en-IN')}</span>,
    },
    {
      key: 'fee',
      label: 'Gateway fee',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono faint">₹{row.fee.toFixed(2)}</span>,
    },
    {
      key: 'net',
      label: 'Net',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">₹{row.net.toLocaleString('en-IN')}</span>,
    },
    {
      key: 'at',
      label: 'When',
      sortable: true,
      render: (row) => <span className="nowrap">{row.at}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) => (
        <RowActions
          actions={[
            { label: 'View', icon: 'eye', onClick: () => setOpen(row) },
            ...(row.status === 'captured'
              ? [{ label: 'Refund', icon: 'refresh', variant: 'danger', onClick: () => setRefunding(row) }]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Payment Management"
        subtitle="Razorpay orders, settlements and refunds"
        actions={
          <>
            <Button icon="refresh" onClick={() => notify('Reconciled with Razorpay')}>
              Reconcile
            </Button>
            <Button variant="primary" icon="download">
              Settlement report
            </Button>
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard label="Collected (MTD)" value="₹18.4L" icon="rupee" tone="success" delta="+15.7%" hint="net of fees" />
        <StatCard label="Captured today" value={`₹${captured.toLocaleString('en-IN')}`} icon="card" tone="brand" delta="+₹4,200" hint="12 orders" />
        <StatCard label="Failure rate" value="3.8%" icon="alert" tone="yellow" delta="-0.6%" deltaTone="up" hint="last 7 days" />
        <StatCard label="Refunds issued" value="₹1,100" icon="refresh" delta="2 orders" deltaTone="flat" hint="this month" />
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        searchKeys={['id', 'orderId', 'user', 'method']}
        searchPlaceholder="Search by payment id, order id or user…"
        onRowClick={setOpen}
        toolbar={
          <Chips
            value={filter}
            onChange={setFilter}
            items={FILTERS.map((item) => ({ ...item, count: counts[item.key] }))}
          />
        }
        empty={{ icon: 'card', title: 'No payments in this view' }}
      />

      {open && (
        <Drawer
          title="Payment detail"
          subtitle={open.id}
          onClose={() => setOpen(null)}
          footer={
            <>
              <Button icon="copy" onClick={() => notify('Payment ID copied')}>
                Copy ID
              </Button>
              {open.status === 'captured' && (
                <Button variant="danger" icon="refresh" onClick={() => setRefunding(open)}>
                  Refund
                </Button>
              )}
            </>
          }
        >
          <div className="stack" style={{ gap: 18 }}>
            <div className="amount-hero">
              <p className="eyebrow">Amount</p>
              <p className="amount-hero__value">₹{open.amount.toLocaleString('en-IN')}</p>
              <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                <StatusBadge status={open.status} />
                <Badge tone="neutral">{open.method}</Badge>
              </div>
            </div>

            <section>
              <h3 className="section-title">Transaction</h3>
              <DetailList
                rows={[
                  { label: 'Payment ID', value: open.id },
                  { label: 'Order ID', value: open.orderId },
                  { label: 'Paid by', value: open.user },
                  { label: 'Purpose', value: open.purpose },
                  { label: 'Captured at', value: open.at },
                ]}
              />
            </section>

            <section>
              <h3 className="section-title">Settlement</h3>
              <DetailList
                rows={[
                  { label: 'Gross', value: `₹${open.amount.toLocaleString('en-IN')}` },
                  { label: 'Gateway fee', value: `− ₹${open.fee.toFixed(2)}` },
                  { label: 'Net to platform', value: `₹${open.net.toLocaleString('en-IN')}` },
                  { label: 'Settlement date', value: '19 Aug 2026' },
                ]}
              />
            </section>

            <section>
              <h3 className="section-title">Verification trail</h3>
              <Timeline
                items={[
                  { title: 'Order created', meta: `${open.at} · ${open.orderId}`, state: 'done' },
                  {
                    title: 'Payment authorised',
                    meta: `${open.method} · signature verified`,
                    state: open.status === 'failed' ? '' : 'done',
                  },
                  {
                    title: open.status === 'failed' ? 'Payment failed' : 'Payment captured',
                    meta:
                      open.status === 'failed'
                        ? 'Issuer declined · BAD_REQUEST_ERROR'
                        : 'Webhook payment.captured received',
                    state: open.status === 'failed' ? 'active' : 'done',
                  },
                  {
                    title: 'Wallet credited',
                    meta:
                      open.status === 'captured'
                        ? `₹${open.amount} added to ${open.user}'s wallet`
                        : 'Not credited',
                    state: open.status === 'captured' ? 'done' : '',
                  },
                ]}
              />
            </section>

            {open.status === 'failed' && (
              <Note tone="danger" icon="alert">
                The issuing bank declined this payment. The user was not charged and no
                wallet credit was made.
              </Note>
            )}
          </div>
        </Drawer>
      )}

      {refunding && (
        <Modal
          title="Issue a refund?"
          subtitle={`${refunding.id} · ₹${refunding.amount.toLocaleString('en-IN')} to ${refunding.user}`}
          onClose={() => setRefunding(null)}
          footer={
            <>
              <Button onClick={() => setRefunding(null)}>Cancel</Button>
              <Button
                variant="danger"
                icon="refresh"
                onClick={() => {
                  notify('Refund initiated with Razorpay');
                  setRefunding(null);
                  setOpen(null);
                }}
              >
                Refund ₹{refunding.amount.toLocaleString('en-IN')}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <Note tone="danger" icon="alert">
              Refunds reach the customer&rsquo;s bank in 5–7 working days and cannot be
              reversed. The gateway fee of ₹{refunding.fee.toFixed(2)} is not returned.
            </Note>
            <DetailList
              rows={[
                { label: 'Refund amount', value: `₹${refunding.amount.toLocaleString('en-IN')}` },
                { label: 'Wallet adjustment', value: `− ₹${refunding.amount.toLocaleString('en-IN')}` },
                { label: 'Destination', value: `${refunding.method} · original method` },
              ]}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PaymentsPage;
