/**
 * Wallet Management — who holds what, on the platform.
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
  Chips,
  Field,
  Identity,
  Input,
  Modal,
  Note,
  Select,
  StatCard,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  adjustWallet,
  getSettings,
  listWallets,
  listWithdrawals,
  reviewWithdrawal,
} from '../services/admin';
import { can } from '../services/session';
import { label, money, relative } from '../utils/format';

const BLANK_ADJUSTMENT = { direction: 'credit', amount: '', note: '' };
const PAGE_LIMIT = 100;

export function WalletsPage({ notify }) {
  const [type, setType] = useState('all');
  const [adjusting, setAdjusting] = useState(null);
  const [adjustment, setAdjustment] = useState(BLANK_ADJUSTMENT);
  const [run, busy] = useAction(notify);

  /* Payout requests: nothing leaves an astrologer's balance until one of these is approved here. */
  const [payoutStatus, setPayoutStatus] = useState('pending');
  const [reviewing, setReviewing] = useState(null);
  const [review, setReview] = useState({ decision: 'approved', payoutReference: '', reason: '' });
  const payouts = useApi(
    () => listWithdrawals({ status: payoutStatus === 'all' ? undefined : payoutStatus, limit: PAGE_LIMIT }),
    [payoutStatus],
  );

  const wallets = useApi(
    () => listWallets({ ownerRole: type === 'all' ? undefined : type, limit: PAGE_LIMIT }),
    [type],
  );
  const { data: settings } = useApi(() => getSettings(), []);

  const rows = wallets.data?.items ?? [];
  const userFloat = rows
    .filter((row) => row.ownerRole === 'user')
    .reduce((sum, row) => sum + row.balance, 0);
  const astrologerPayable = rows
    .filter((row) => row.ownerRole === 'astrologer')
    .reduce((sum, row) => sum + row.balance, 0);

  const canAdjust = can('wallets.adjust');
  const canApprove = can('payouts.approve');

  const openReview = (row, decision) => {
    setReviewing(row);
    setReview({ decision, payoutReference: '', reason: '' });
  };

  const applyReview = () =>
    run(
      () =>
        reviewWithdrawal(reviewing.id ?? reviewing._id, {
          status: review.decision,
          ...(review.decision === 'approved'
            ? { payoutReference: review.payoutReference.trim() || undefined }
            : { reason: review.reason.trim() }),
        }),
      {
        success:
          review.decision === 'approved'
            ? `Approved and paid ${money(reviewing.amount)} · ${reviewing.astrologer?.name ?? 'astrologer'}`
            : `Rejected ${money(reviewing.amount)} · ${reviewing.astrologer?.name ?? 'astrologer'}`,
        onDone: async () => {
          setReviewing(null);
          await Promise.all([payouts.reload(), wallets.reload()]);
        },
      },
    );

  const payoutRows = (payouts.data?.items ?? []).map((row) => ({
    ...row,
    id: row.id ?? row._id,
    astrologerName: row.astrologer?.name ?? '—',
    bank: row.bankAccount?.upiId
      ? row.bankAccount.upiId
      : [row.bankAccount?.bankName, row.bankAccount?.accountNumber ? `····${String(row.bankAccount.accountNumber).slice(-4)}` : null]
          .filter(Boolean)
          .join(' · '),
  }));

  const payoutColumns = [
    {
      key: 'astrologerName',
      label: 'Astrologer',
      sortable: true,
      render: (row) => <Identity name={row.astrologerName} meta={row.astrologer?.astroCode || row.reference} tone="muted" />,
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
      label: 'Pay to',
      render: (row) => (
        <span className="faint" style={{ fontSize: 12.5 }}>
          {row.bankAccount?.holderName ? `${row.bankAccount.holderName} · ` : ''}
          {row.bank || '—'}
        </span>
      ),
    },
    {
      key: 'requestedAt',
      label: 'Requested',
      sortable: true,
      render: (row) => (row.requestedAt ? relative(row.requestedAt) : '—'),
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
        canApprove && row.status === 'pending' ? (
          <RowActions
            actions={[
              { label: 'Approve & pay', icon: 'check', variant: 'primary', showLabel: true, onClick: () => openReview(row, 'approved') },
              { label: 'Reject', icon: 'x', showLabel: true, onClick: () => openReview(row, 'rejected') },
            ]}
          />
        ) : row.payoutReference || row.rejectionReason ? (
          <span className="faint" style={{ fontSize: 12 }}>
            {row.payoutReference || row.rejectionReason}
          </span>
        ) : null,
    },
  ];

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

  return (
    <div className="page">
      <PageHeader
        title="Wallet Management"
        subtitle="Wallet balances by holder"
        actions={
          <Button icon="refresh" onClick={() => wallets.reload()}>
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
          label="Minimum payout"
          value={money(settings?.settings?.minPayout ?? 0)}
          icon="shield"
          hint={label(settings?.settings?.payoutCycle) || 'cycle'}
        />
      </div>

      <div className="row row--between" style={{ marginBottom: 14 }}>
        <Chips
          value={type}
          onChange={setType}
          items={[
            { key: 'all', label: 'All wallets' },
            { key: 'user', label: 'Users' },
            { key: 'astrologer', label: 'Astrologers' },
          ]}
        />
      </div>

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

      <div className="row row--between" style={{ margin: '28px 0 14px' }}>
        <div>
          <p className="strong" style={{ fontSize: 15 }}>
            Payout requests
          </p>
          <p className="faint" style={{ fontSize: 12.5 }}>
            An astrologer's balance is deducted only when a request is approved here; until then the amount is
            just reserved. Astrologers are told to allow up to 24 hours.
          </p>
        </div>
        <Chips
          value={payoutStatus}
          onChange={setPayoutStatus}
          items={[
            { key: 'pending', label: 'Pending' },
            { key: 'paid', label: 'Paid' },
            { key: 'rejected', label: 'Rejected' },
            { key: 'all', label: 'All' },
          ]}
        />
      </div>

      <DataTable
        columns={payoutColumns}
        rows={payoutRows}
        loading={payouts.loading}
        error={payouts.error}
        onRetry={payouts.reload}
        searchKeys={['astrologerName', 'reference', 'bank']}
        searchPlaceholder="Search payouts by astrologer or reference…"
        empty={{ icon: 'rupee', title: payoutStatus === 'pending' ? 'No payout requests waiting' : 'No payouts in this view' }}
      />

      {reviewing && (
        <Modal
          title={review.decision === 'approved' ? 'Approve & pay out' : 'Reject payout request'}
          subtitle={`${reviewing.astrologerName} · ${money(reviewing.amount)} · ${reviewing.reference}`}
          onClose={() => setReviewing(null)}
          footer={
            <>
              <Button onClick={() => setReviewing(null)}>Cancel</Button>
              <Button
                variant={review.decision === 'approved' ? 'primary' : 'danger'}
                icon={review.decision === 'approved' ? 'check' : 'x'}
                disabled={busy || (review.decision === 'rejected' && review.reason.trim().length < 4)}
                onClick={applyReview}
              >
                {review.decision === 'approved' ? `Approve · deduct ${money(reviewing.amount)}` : 'Reject request'}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            {review.decision === 'approved' ? (
              <>
                <Note tone="info" icon="info">
                  {reviewing.deduction === 'on_approval'
                    ? `Approving deducts ${money(reviewing.amount)} from the astrologer's earnings balance now and marks the request paid.`
                    : `This request was made before payouts switched to deduct-on-approval: ${money(reviewing.amount)} already left the astrologer's balance when it was requested, so approving only records the payout.`}{' '}
                  Transfer the money to the account below first, then record the reference.
                </Note>
                <div className="adjust-preview">
                  <span>Pay to</span>
                  <strong>
                    {reviewing.bankAccount?.holderName || '—'} · {reviewing.bank || '—'}
                    {reviewing.bankAccount?.ifsc ? ` · ${reviewing.bankAccount.ifsc}` : ''}
                  </strong>
                </div>
                <Field label="Payout reference" hint="UTR / transaction id of the bank transfer (optional)">
                  <Input
                    placeholder="e.g. NEFT-8821…"
                    value={review.payoutReference}
                    onChange={(event) => setReview((current) => ({ ...current, payoutReference: event.target.value }))}
                  />
                </Field>
              </>
            ) : (
              <>
                <Note tone="warning" icon="info">
                  {reviewing.deduction === 'on_approval'
                    ? 'Nothing was deducted for this request, so rejecting just releases the reserved amount back to what the astrologer can withdraw.'
                    : `This request was made before payouts switched to deduct-on-approval, so rejecting refunds ${money(reviewing.amount)} to the astrologer's balance.`}
                </Note>
                <Field label="Reason" hint="Sent to the astrologer with the rejection">
                  <Textarea
                    placeholder="e.g. Bank account name does not match the profile."
                    value={review.reason}
                    onChange={(event) => setReview((current) => ({ ...current, reason: event.target.value }))}
                  />
                </Field>
              </>
            )}
          </div>
        </Modal>
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
    </div>
  );
}

export default WalletsPage;
