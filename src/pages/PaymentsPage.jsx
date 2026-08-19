/**
 * Payment Management — the money ledger: top-ups, consultation charges,
 * astrologer earnings, refunds and payouts, with the detail behind each one.
 *
 * A refund never edits the row it reverses. It posts a new credit, because the
 * ledger is a history and history does not change.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Chips,
  DetailList,
  Drawer,
  Modal,
  Note,
  StatCard,
  StatusBadge,
  Textarea,
  Timeline,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { getDashboard, listTransactions, refundTransaction } from '../services/admin';
import { can } from '../services/session';
import { dateTime, label, money } from '../utils/format';

/** Every kind of movement, and what an admin usually wants to look at. */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'topup', label: 'Top-ups' },
  { key: 'consultation_charge', label: 'Charges' },
  { key: 'consultation_earning', label: 'Earnings' },
  { key: 'refund', label: 'Refunds' },
  { key: 'withdrawal', label: 'Payouts' },
];

const TYPE_ICON = {
  topup: 'card',
  consultation_charge: 'chat',
  consultation_earning: 'sparkle',
  refund: 'refresh',
  withdrawal: 'wallet',
  adjustment: 'edit',
};

const PAGE_LIMIT = 100;

export function PaymentsPage({ notify }) {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [refunding, setRefunding] = useState(null);
  const [reason, setReason] = useState('');
  const [run, busy] = useAction(notify);

  const { data, loading, error, reload } = useApi(
    () => listTransactions({ type: filter === 'all' ? undefined : filter, limit: PAGE_LIMIT }),
    [filter],
  );
  const { data: stats } = useApi(() => getDashboard(7), []);

  const rows = data?.items ?? [];
  const canRefund = can('payments.refund');

  const submitRefund = () =>
    run(() => refundTransaction(refunding._id, reason.trim() || 'Refunded by an admin'), {
      success: `${money(refunding.amount)} refunded`,
      onDone: async () => {
        setRefunding(null);
        setReason('');
        setOpen(null);
        await reload();
      },
    });

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (row) => (
        <span className="mono" style={{ fontSize: 12 }}>
          {row.reference}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (row) => (
        <span className="row" style={{ gap: 6, fontSize: 12.5 }}>
          <Icon name={TYPE_ICON[row.type] || 'rupee'} size={14} />
          {label(row.type)}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Description',
      render: (row) => <span className="truncate">{row.title || label(row.type)}</span>,
    },
    {
      key: 'ownerRole',
      label: 'Wallet',
      sortable: true,
      render: (row) => (
        <Badge tone={row.ownerRole === 'astrologer' ? 'lilac' : 'info'}>
          {label(row.ownerRole)}
        </Badge>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className={`mono strong ${row.direction === 'credit' ? 'amount-credit' : 'amount-debit'}`}>
          {row.direction === 'credit' ? '+' : '−'} {money(row.amount)}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      label: 'Balance after',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{money(row.balanceAfter)}</span>,
    },
    {
      key: 'createdAt',
      label: 'When',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => dateTime(row.createdAt),
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
            ...(canRefund && row.direction === 'debit' && row.status === 'success'
              ? [
                  {
                    label: 'Refund',
                    icon: 'refresh',
                    variant: 'danger',
                    onClick: () => setRefunding(row),
                  },
                ]
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
        subtitle="Every movement of money on the platform, and the detail behind each one"
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="Collected this month"
          value={money(stats?.revenue?.chargedThisMonth ?? 0)}
          icon="card"
          tone="success"
          hint="charged to wallets"
        />
        <StatCard
          label="Paid to astrologers"
          value={money(stats?.revenue?.paidToAstrologers ?? 0)}
          icon="sparkle"
          tone="yellow"
          hint="their share"
        />
        <StatCard
          label="Platform revenue"
          value={money(stats?.revenue?.platformThisMonth ?? 0)}
          icon="rupee"
          tone="brand"
          hint="after commission"
        />
        <StatCard
          label="Rows in this view"
          value={data?.total ?? 0}
          icon="file"
          hint={label(filter === 'all' ? 'everything' : filter)}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['reference', 'title']}
        searchPlaceholder="Search by reference or description…"
        onRowClick={setOpen}
        toolbar={<Chips value={filter} onChange={setFilter} items={FILTERS} />}
        empty={{ icon: 'card', title: 'No payments in this view' }}
      />

      {open && (
        <Drawer
          title="Payment detail"
          subtitle={open.reference}
          onClose={() => setOpen(null)}
          footer={
            canRefund && open.direction === 'debit' && open.status === 'success' ? (
              <Button variant="danger" icon="refresh" onClick={() => setRefunding(open)}>
                Refund
              </Button>
            ) : undefined
          }
        >
          <div className="stack" style={{ gap: 18 }}>
            <div className="amount-hero">
              <p className="eyebrow">Amount</p>
              <p className="amount-hero__value">
                {open.direction === 'credit' ? '+' : '−'} {money(open.amount)}
              </p>
              <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                <StatusBadge status={open.status} />
                <Badge tone="neutral">{label(open.type)}</Badge>
              </div>
            </div>

            <section>
              <h3 className="section-title">Transaction</h3>
              <DetailList
                rows={[
                  { label: 'Reference', value: open.reference },
                  { label: 'Description', value: open.title || label(open.type) },
                  { label: 'Wallet', value: label(open.ownerRole) },
                  { label: 'Balance after', value: money(open.balanceAfter) },
                  { label: 'When', value: dateTime(open.createdAt) },
                  ...(open.description ? [{ label: 'Note', value: open.description }] : []),
                ]}
              />
            </section>

            {open.payment?.orderId && (
              <section>
                <h3 className="section-title">Gateway</h3>
                <DetailList
                  rows={[
                    { label: 'Gateway', value: label(open.payment.gateway) || 'None' },
                    { label: 'Order ID', value: open.payment.orderId },
                    { label: 'Payment ID', value: open.payment.paymentId || '—' },
                    ...(open.payment.failureReason
                      ? [{ label: 'Failure', value: open.payment.failureReason }]
                      : []),
                  ]}
                />
              </section>
            )}

            <section>
              <h3 className="section-title">Trail</h3>
              <Timeline
                items={[
                  { title: 'Row created', meta: dateTime(open.createdAt), state: 'done' },
                  {
                    title: open.status === 'success' ? 'Settled' : label(open.status),
                    meta:
                      open.status === 'success'
                        ? `Balance moved to ${money(open.balanceAfter)}`
                        : 'No money moved',
                    state: open.status === 'success' ? 'done' : 'active',
                  },
                  ...(open.createdByAdmin
                    ? [{ title: 'Made by an admin', meta: 'Manual adjustment', state: 'done' }]
                    : []),
                ]}
              />
            </section>

            {open.payment?.gateway === 'none' && open.type === 'topup' && (
              <Note tone="info" icon="info">
                No payment gateway is connected yet, so this top-up was confirmed without a
                real charge.
              </Note>
            )}
          </div>
        </Drawer>
      )}

      {refunding && (
        <Modal
          title="Issue a refund?"
          subtitle={`${refunding.reference} · ${money(refunding.amount)}`}
          onClose={() => {
            setRefunding(null);
            setReason('');
          }}
          footer={
            <>
              <Button
                onClick={() => {
                  setRefunding(null);
                  setReason('');
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" icon="refresh" disabled={busy} onClick={submitRefund}>
                Refund {money(refunding.amount)}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <Note tone="danger" icon="alert">
              The refund is posted as a new credit to the wallet — the original charge is
              left exactly as it is. A charge can only be refunded once.
            </Note>
            <DetailList
              rows={[
                { label: 'Refund amount', value: money(refunding.amount) },
                { label: 'Goes to', value: `${label(refunding.ownerRole)} wallet` },
                { label: 'Original charge', value: refunding.title || label(refunding.type) },
              ]}
            />
            <label className="field__label" htmlFor="refund-reason">
              Reason
            </label>
            <Textarea
              id="refund-reason"
              placeholder="e.g. The astrologer did not respond during the session."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PaymentsPage;
