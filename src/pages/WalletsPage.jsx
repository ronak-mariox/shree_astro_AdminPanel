/**
 * Wallet Management — balances, movement and astrologer payouts.
 *
 * Three tabs over the same money: who holds what, every movement, and the
 * payout queue waiting on an admin.
 *
 * A manual adjustment goes through the same ledger as everything else and
 * carries the name of the admin who made it, so there is no such thing as an
 * untraceable change to a balance.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Card,
  Chips,
  DetailList,
  Field,
  Identity,
  Input,
  Modal,
  Note,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  adjustWallet,
  getSettings,
  listTransactions,
  listWallets,
  listWithdrawals,
  reviewWithdrawal,
} from '../services/admin';
import { can } from '../services/session';
import { date, dateTime, label, money, relative } from '../utils/format';

const BLANK_ADJUSTMENT = { direction: 'credit', amount: '', note: '' };
const PAGE_LIMIT = 100;

export function WalletsPage({ notify }) {
  const [tab, setTab] = useState('balances');
  const [type, setType] = useState('all');
  const [adjusting, setAdjusting] = useState(null);
  const [adjustment, setAdjustment] = useState(BLANK_ADJUSTMENT);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [run, busy] = useAction(notify);

  const wallets = useApi(
    () => listWallets({ ownerRole: type === 'all' ? undefined : type, limit: PAGE_LIMIT }),
    [type],
    { skip: tab !== 'balances' },
  );
  const ledger = useApi(() => listTransactions({ limit: PAGE_LIMIT }), [], {
    skip: tab !== 'ledger',
  });
  const payouts = useApi(() => listWithdrawals({ limit: PAGE_LIMIT }), [], {
    skip: tab !== 'payouts',
  });
  const { data: settings } = useApi(() => getSettings(), []);

  const rows = wallets.data?.items ?? [];
  const userFloat = rows
    .filter((row) => row.ownerRole === 'user')
    .reduce((sum, row) => sum + row.balance, 0);
  const astrologerPayable = rows
    .filter((row) => row.ownerRole === 'astrologer')
    .reduce((sum, row) => sum + row.balance, 0);

  const pendingPayouts = (payouts.data?.items ?? []).filter((row) => row.status === 'pending');

  const canAdjust = can('wallets.adjust');
  const canApprovePayouts = can('payouts.approve');

  const applyAdjustment = () =>
    run(
      () =>
        adjustWallet({
          ownerRole: adjusting.ownerRole,
          ownerId: adjusting.id,
          direction: adjustment.direction,
          amount: Number(adjustment.amount),
          reason: adjustment.note.trim(),
        }),
      {
        success: `${adjustment.direction === 'credit' ? 'Credited' : 'Debited'} ${money(
          adjustment.amount,
        )} · ${adjusting.holder}`,
        onDone: async () => {
          setAdjusting(null);
          setAdjustment(BLANK_ADJUSTMENT);
          await wallets.reload();
        },
      },
    );

  const decidePayout = (withdrawal, status) =>
    run(
      () =>
        reviewWithdrawal(withdrawal._id, {
          status,
          reason: status === 'rejected' ? reason.trim() || 'Not approved' : undefined,
          payoutReference: status === 'approved' ? `MANUAL-${Date.now()}` : undefined,
        }),
      {
        success:
          status === 'approved'
            ? `Payout of ${money(withdrawal.amount)} marked paid`
            : 'Payout rejected and the money returned',
        onDone: async () => {
          setRejecting(null);
          setReason('');
          await payouts.reload();
        },
      },
    );

  const balanceColumns = [
    {
      key: 'holder',
      label: 'Account holder',
      sortable: true,
      render: (row) => (
        <Identity
          name={row.holder}
          meta={row.ownerRole === 'user' ? 'Seeker wallet' : 'Astrologer earnings wallet'}
          tone={row.ownerRole === 'astrologer' ? 'muted' : undefined}
        />
      ),
    },
    {
      key: 'ownerRole',
      label: 'Type',
      sortable: true,
      render: (row) => (
        <Badge tone={row.ownerRole === 'user' ? 'info' : 'lilac'}>{label(row.ownerRole)}</Badge>
      ),
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono strong">{money(row.balance)}</span>,
    },
    {
      key: 'added',
      label: 'Lifetime in',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono faint">{money(row.added)}</span>,
    },
    {
      key: 'spent',
      label: 'Lifetime out',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono faint">{money(row.spent)}</span>,
    },
    {
      key: 'updatedAt',
      label: 'Last movement',
      sortable: true,
      render: (row) => (row.updatedAt ? relative(row.updatedAt) : '—'),
    },
    {
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) =>
        canAdjust ? (
          <RowActions
            actions={[
              {
                label: 'Adjust balance',
                icon: 'edit',
                onClick: () => {
                  setAdjusting(row);
                  setAdjustment(BLANK_ADJUSTMENT);
                },
              },
            ]}
          />
        ) : null,
    },
  ];

  const ledgerColumns = [
    {
      key: 'title',
      label: 'Movement',
      render: (row) => (
        <div>
          <p className="strong truncate">{row.title || label(row.type)}</p>
          <p className="faint" style={{ fontSize: 11.5 }}>
            {label(row.ownerRole)} · {row.reference}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span
          className={`mono strong ${row.direction === 'credit' ? 'amount-credit' : 'amount-debit'}`}
        >
          {row.direction === 'credit' ? '+' : '−'} {money(row.amount)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'When',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => dateTime(row.createdAt),
    },
  ];

  const payoutColumns = [
    {
      key: 'astrologer',
      label: 'Astrologer',
      sortable: true,
      render: (row) => (
        <Identity name={row.astrologer?.name || 'Unknown'} meta={row.astrologer?.astroCode} />
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono strong">{money(row.amount)}</span>,
    },
    {
      key: 'bank',
      label: 'To',
      render: (row) => (
        <span className="faint" style={{ fontSize: 12 }}>
          {row.bankAccount?.bankName} ••••{String(row.bankAccount?.accountNumber || '').slice(-4)}
        </span>
      ),
    },
    {
      key: 'requestedAt',
      label: 'Requested',
      sortable: true,
      sortValue: (row) => new Date(row.requestedAt).getTime(),
      render: (row) => date(row.requestedAt),
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
      render: (row) =>
        row.status === 'pending' && canApprovePayouts ? (
          <RowActions
            actions={[
              {
                label: 'Mark paid',
                icon: 'check',
                variant: 'success',
                onClick: () => decidePayout(row, 'approved'),
              },
              {
                label: 'Reject',
                icon: 'ban',
                variant: 'danger',
                onClick: () => setRejecting(row),
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Wallet Management"
        subtitle="Balances, movement and astrologer payouts"
        actions={
          <Button
            icon="refresh"
            onClick={() => {
              wallets.reload();
              ledger.reload();
              payouts.reload();
            }}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="User wallet float"
          value={money(userFloat)}
          icon="wallet"
          tone="brand"
          hint="held on the platform"
        />
        <StatCard
          label="Astrologer payable"
          value={money(astrologerPayable)}
          icon="rupee"
          tone="yellow"
          hint="withdrawable now"
        />
        <StatCard
          label="Payout requests"
          value={pendingPayouts.length}
          icon="inbox"
          tone="success"
          hint="awaiting approval"
        />
        <StatCard
          label="Minimum payout"
          value={money(settings?.settings?.minPayout ?? 0)}
          icon="shield"
          hint={label(settings?.settings?.payoutCycle) || 'cycle'}
        />
      </div>

      <div className="row row--between" style={{ marginBottom: 14 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'balances', label: 'Balances' },
            { key: 'ledger', label: 'Movement ledger' },
            { key: 'payouts', label: `Payout queue (${pendingPayouts.length})` },
          ]}
        />
        {tab === 'balances' && (
          <Chips
            value={type}
            onChange={setType}
            items={[
              { key: 'all', label: 'All wallets' },
              { key: 'user', label: 'Users' },
              { key: 'astrologer', label: 'Astrologers' },
            ]}
          />
        )}
      </div>

      {tab === 'balances' && (
        <DataTable
          columns={balanceColumns}
          rows={rows}
          loading={wallets.loading}
          error={wallets.error}
          onRetry={wallets.reload}
          searchKeys={['holder', 'email']}
          searchPlaceholder="Search wallets by holder…"
          empty={{ icon: 'wallet', title: 'No wallets in this view' }}
        />
      )}

      {tab === 'ledger' && (
        <div className="grid grid--sidebar">
          <DataTable
            columns={ledgerColumns}
            rows={ledger.data?.items ?? []}
            loading={ledger.loading}
            error={ledger.error}
            onRetry={ledger.reload}
            searchKeys={['title', 'reference']}
            searchPlaceholder="Search movement…"
            pageSize={10}
            empty={{ icon: 'inbox', title: 'No movement recorded' }}
          />
          <Card title="Wallet rules" subtitle="Read live from platform settings">
            <div className="stack" style={{ gap: 14 }}>
              <DetailList
                rows={[
                  { label: 'Minimum recharge', value: money(settings?.settings?.minRecharge) },
                  { label: 'Maximum recharge', value: money(settings?.settings?.maxRecharge) },
                  { label: 'Minimum payout', value: money(settings?.settings?.minPayout) },
                  { label: 'Payout cycle', value: label(settings?.settings?.payoutCycle) },
                  {
                    label: 'Platform commission',
                    value: `${settings?.settings?.commissionPercent ?? 0}%`,
                  },
                ]}
              />
              <Note tone="info" icon="info">
                Every movement is a row in this ledger, and a balance is only ever changed by
                posting one. Manual adjustments carry the name of the admin who made them.
              </Note>
            </div>
          </Card>
        </div>
      )}

      {tab === 'payouts' && (
        <div className="grid grid--sidebar">
          <DataTable
            columns={payoutColumns}
            rows={payouts.data?.items ?? []}
            loading={payouts.loading}
            error={payouts.error}
            onRetry={payouts.reload}
            searchKeys={['reference']}
            searchPlaceholder="Search payout requests…"
            empty={{ icon: 'wallet', title: 'No payout requests' }}
          />
          <Card title="Payout policy" subtitle="Applied to every approval">
            <div className="stack" style={{ gap: 14 }}>
              <DetailList
                rows={[
                  { label: 'Minimum payout', value: money(settings?.settings?.minPayout) },
                  { label: 'Cycle', value: label(settings?.settings?.payoutCycle) },
                  { label: 'Pending requests', value: `${pendingPayouts.length}` },
                ]}
              />
              <Note tone="info" icon="info">
                The money already left the astrologer&rsquo;s balance when they asked, so
                approving only records the transfer. <strong>Make the bank transfer first</strong>,
                then mark it paid. Rejecting puts the money back.
              </Note>
            </div>
          </Card>
        </div>
      )}

      {adjusting && (
        <Modal
          title="Manual wallet adjustment"
          subtitle={`${adjusting.holder} · current balance ${money(adjusting.balance)}`}
          onClose={() => setAdjusting(null)}
          footer={
            <>
              <Button onClick={() => setAdjusting(null)}>Cancel</Button>
              <Button
                variant="primary"
                icon="check"
                disabled={busy || !adjustment.amount || adjustment.note.trim().length < 4}
                onClick={applyAdjustment}
              >
                Apply adjustment
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Note tone="info" icon="info">
              Adjustments are recorded in the ledger with your name and are visible to the
              account holder in their transaction history.
            </Note>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Direction">
                <Select
                  value={adjustment.direction}
                  onChange={(event) =>
                    setAdjustment((current) => ({ ...current, direction: event.target.value }))
                  }
                  options={[
                    { value: 'credit', label: 'Credit — add to wallet' },
                    { value: 'debit', label: 'Debit — remove from wallet' },
                  ]}
                />
              </Field>
              <Field label="Amount (₹)">
                <Input
                  type="number"
                  min="1"
                  placeholder="500"
                  value={adjustment.amount}
                  onChange={(event) =>
                    setAdjustment((current) => ({ ...current, amount: event.target.value }))
                  }
                />
              </Field>
            </div>

            <Field label="Reason" hint="Shown in the ledger and the holder's transaction history">
              <Textarea
                placeholder="e.g. Goodwill credit for a consultation that ended early."
                value={adjustment.note}
                onChange={(event) =>
                  setAdjustment((current) => ({ ...current, note: event.target.value }))
                }
              />
            </Field>

            <div className="adjust-preview">
              <span>
                <Icon name="wallet" size={16} /> New balance
              </span>
              <strong className="mono">
                {money(
                  adjustment.direction === 'credit'
                    ? adjusting.balance + Number(adjustment.amount || 0)
                    : adjusting.balance - Number(adjustment.amount || 0),
                )}
              </strong>
            </div>
          </div>
        </Modal>
      )}

      {rejecting && (
        <Modal
          title="Reject this payout?"
          subtitle={`${rejecting.astrologer?.name} · ${money(rejecting.amount)}`}
          onClose={() => {
            setRejecting(null);
            setReason('');
          }}
          footer={
            <>
              <Button
                onClick={() => {
                  setRejecting(null);
                  setReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                icon="ban"
                disabled={busy}
                onClick={() => decidePayout(rejecting, 'rejected')}
              >
                Reject payout
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <Note tone="info" icon="info">
              The money goes straight back into the astrologer&rsquo;s withdrawable balance,
              and they are told why.
            </Note>
            <Field label="Reason">
              <Textarea
                placeholder="e.g. The bank details did not match the uploaded proof."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default WalletsPage;
