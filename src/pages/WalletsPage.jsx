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
  Textarea,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { adjustWallet, getSettings, listWallets } from '../services/admin';
import { can } from '../services/session';
import { label, money, relative } from '../utils/format';

const BLANK_ADJUSTMENT = { direction: 'credit', amount: '', note: '' };
const PAGE_LIMIT = 100;

export function WalletsPage({ notify }) {
  const [type, setType] = useState('all');
  const [adjusting, setAdjusting] = useState(null);
  const [adjustment, setAdjustment] = useState(BLANK_ADJUSTMENT);
  const [run, busy] = useAction(notify);

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
