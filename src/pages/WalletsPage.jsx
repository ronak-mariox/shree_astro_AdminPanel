/**
 * Wallet Management — balances held by seekers and astrologers, the movement
 * ledger behind them, manual adjustments, and the astrologer payout queue.
 */

import { useMemo, useState } from 'react';
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
import { payoutRequests, walletAccounts, walletLedger } from '../data/operations';

const money = (value) => `₹${value.toLocaleString('en-IN')}`;

export function WalletsPage({ notify }) {
  const [tab, setTab] = useState('balances');
  const [type, setType] = useState('all');
  const [adjusting, setAdjusting] = useState(null);
  const [adjustment, setAdjustment] = useState({ direction: 'credit', amount: '', note: '' });

  const filtered = useMemo(
    () => (type === 'all' ? walletAccounts : walletAccounts.filter((row) => row.type.toLowerCase() === type)),
    [type],
  );

  const userFloat = walletAccounts
    .filter((row) => row.type === 'User')
    .reduce((sum, row) => sum + row.balance, 0);
  const astrologerPayable = walletAccounts
    .filter((row) => row.type === 'Astrologer')
    .reduce((sum, row) => sum + row.balance, 0);

  const balanceColumns = [
    {
      key: 'holder',
      label: 'Account holder',
      sortable: true,
      render: (row) => (
        <Identity
          name={row.holder}
          meta={row.type === 'User' ? 'Seeker wallet' : 'Astrologer earnings wallet'}
          tone={row.type === 'Astrologer' ? 'muted' : undefined}
        />
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (row) => (
        <Badge tone={row.type === 'User' ? 'info' : 'lilac'}>{row.type}</Badge>
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
    { key: 'updated', label: 'Last movement', sortable: true },
    {
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) => (
        <RowActions
          actions={[
            {
              label: 'Adjust balance',
              icon: 'edit',
              onClick: () => {
                setAdjusting(row);
                setAdjustment({ direction: 'credit', amount: '', note: '' });
              },
            },
            { label: 'Statement', icon: 'download', onClick: () => notify('Statement downloaded') },
          ]}
        />
      ),
    },
  ];

  const ledgerColumns = [
    {
      key: 'account',
      label: 'Account',
      sortable: true,
      render: (row) => <Identity name={row.account} size="sm" />,
    },
    { key: 'note', label: 'Description' },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className={`mono strong ${row.credit ? 'amount-credit' : 'amount-debit'}`}>
          {row.credit ? '+' : '−'} {money(row.amount)}
        </span>
      ),
    },
    { key: 'at', label: 'When', sortable: true },
  ];

  const payoutColumns = [
    {
      key: 'astrologer',
      label: 'Astrologer',
      sortable: true,
      render: (row) => <Identity name={row.astrologer} meta={row.method} />,
    },
    {
      key: 'amount',
      label: 'Payable',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono strong">{money(row.amount)}</span>,
    },
    { key: 'requested', label: 'Requested', sortable: true },
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
        row.status === 'pending' ? (
          <RowActions
            actions={[
              {
                label: 'Approve payout',
                icon: 'check',
                variant: 'success',
                onClick: () => notify(`Payout of ${money(row.amount)} approved`, { tone: 'success' }),
              },
              { label: 'Hold', icon: 'ban', variant: 'danger', onClick: () => notify('Payout held') },
            ]}
          />
        ) : (
          <RowActions actions={[{ label: 'View', icon: 'eye', onClick: () => notify('Payout detail') }]} />
        ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Wallet Management"
        subtitle="Balances, movement and astrologer payouts"
        actions={
          <>
            <Button icon="download">Export ledger</Button>
            <Button variant="primary" icon="plus" onClick={() => setAdjusting(walletAccounts[0])}>
              Manual adjustment
            </Button>
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard label="User wallet float" value={money(userFloat)} icon="wallet" tone="brand" delta="+9.2%" hint="held on platform" />
        <StatCard label="Astrologer payable" value={money(astrologerPayable)} icon="rupee" tone="yellow" delta="2 requests" deltaTone="flat" hint="awaiting payout" />
        <StatCard label="Recharges today" value="₹42,300" icon="trendingUp" tone="success" delta="+18%" hint="112 top-ups" />
        <StatCard label="Spent on consults" value="₹31,880" icon="chat" delta="+6.4%" hint="today" />
      </div>

      <div className="row row--between" style={{ marginBottom: 14 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'balances', label: 'Balances' },
            { key: 'ledger', label: 'Movement ledger' },
            { key: 'payouts', label: `Payout queue (${payoutRequests.filter((p) => p.status === 'pending').length})` },
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
          rows={filtered}
          searchKeys={['holder', 'type']}
          searchPlaceholder="Search wallets by holder…"
          empty={{ icon: 'wallet', title: 'No wallets in this view' }}
        />
      )}

      {tab === 'ledger' && (
        <div className="grid grid--sidebar">
          <DataTable
            columns={ledgerColumns}
            rows={walletLedger}
            searchKeys={['account', 'note']}
            searchPlaceholder="Search movement…"
            pageSize={10}
            empty={{ icon: 'inbox', title: 'No movement recorded' }}
          />
          <Card title="Today at a glance" subtitle="Wallet movement across the platform">
            <div className="stack" style={{ gap: 14 }}>
              <DetailList
                rows={[
                  { label: 'Credits (recharges)', value: '₹42,300' },
                  { label: 'Credits (refunds)', value: '₹1,100' },
                  { label: 'Debits (consultations)', value: '₹31,880' },
                  { label: 'Debits (payouts)', value: '₹25,000' },
                  { label: 'Net movement', value: '− ₹13,480' },
                ]}
              />
              <Note tone="info" icon="info">
                Wallet credits post as soon as the Razorpay webhook confirms capture.
                Manual adjustments are logged against your admin account.
              </Note>
            </div>
          </Card>
        </div>
      )}

      {tab === 'payouts' && (
        <div className="grid grid--sidebar">
          <DataTable
            columns={payoutColumns}
            rows={payoutRequests}
            searchKeys={['astrologer', 'method']}
            searchPlaceholder="Search payout requests…"
            empty={{ icon: 'wallet', title: 'No payout requests' }}
          />
          <Card title="Payout policy" subtitle="Applied to every approval">
            <div className="stack" style={{ gap: 14 }}>
              <DetailList
                rows={[
                  { label: 'Minimum payout', value: '₹1,000' },
                  { label: 'Cycle', value: 'Weekly · Friday' },
                  { label: 'Processing time', value: '1–2 working days' },
                  { label: 'TDS deduction', value: '10% above ₹30,000' },
                ]}
              />
              <Note tone="success" icon="checkCircle">
                Bank details for both pending requests are verified against the
                astrologer&rsquo;s uploaded proof.
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
                disabled={!adjustment.amount || adjustment.note.trim().length < 4}
                onClick={() => {
                  notify(
                    `${adjustment.direction === 'credit' ? 'Credited' : 'Debited'} ₹${adjustment.amount} · ${adjusting.holder}`,
                    { tone: 'success' },
                  );
                  setAdjusting(null);
                }}
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
                placeholder="e.g. Goodwill credit for consultation c-9035 that ended early."
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
