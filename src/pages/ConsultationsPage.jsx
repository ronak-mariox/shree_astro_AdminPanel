/**
 * Consultation Monitoring — paid chat and voice sessions, their status, and the
 * transcript an admin needs when a session is disputed.
 *
 * The transcript is fetched only when a session is opened, never with the
 * listing: reading somebody's conversation is an intrusion, and the server
 * records that read in the audit log.
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
  Identity,
  LoadingBlock,
  StatCard,
  StatusBadge,
  Timeline,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  endConsultation,
  getConsultation,
  getDashboard,
  listConsultations,
} from '../services/admin';
import { can } from '../services/session';
import { count, dateTime, duration, label, minutes, money } from '../utils/format';

/** The tabs. The API's own words for a session's state. */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Live', dot: true },
  { key: 'ended', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const CHANNELS = [
  { key: 'all', label: 'Both' },
  { key: 'chat', label: 'Chat' },
  { key: 'call', label: 'Voice' },
];

const PAGE_LIMIT = 100;

export function ConsultationsPage({ notify }) {
  const [filter, setFilter] = useState('all');
  const [channel, setChannel] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [run, busy] = useAction(notify);

  const { data, loading, error, reload } = useApi(
    () =>
      listConsultations({
        status: filter === 'all' ? undefined : filter,
        channel: channel === 'all' ? undefined : channel,
        limit: PAGE_LIMIT,
      }),
    [filter, channel],
  );
  const { data: stats } = useApi(() => getDashboard(7), []);
  const { data: detail, loading: loadingDetail } = useApi(
    () => getConsultation(openId),
    [openId],
    { skip: !openId },
  );

  const rows = data?.items ?? [];
  const open = detail?.consultation;
  const canManage = can('consultations.manage');

  const forceEnd = (chatId) =>
    run(() => endConsultation(chatId, 'Ended by an admin'), {
      success: 'Session ended',
      onDone: async () => {
        setOpenId(null);
        await reload();
      },
    });

  const columns = [
    {
      key: 'id',
      label: 'Session',
      render: (row) => (
        <span className="mono" style={{ fontSize: 12 }}>
          {row.id.slice(-8)}
        </span>
      ),
    },
    {
      key: 'user',
      label: 'Seeker',
      sortable: true,
      render: (row) => <Identity name={row.user || 'Unknown'} />,
    },
    {
      key: 'astrologer',
      label: 'Astrologer',
      sortable: true,
      render: (row) => <Identity name={row.astrologer || '—'} tone="muted" />,
    },
    {
      key: 'channel',
      label: 'Channel',
      sortable: true,
      render: (row) => (
        <span className="row" style={{ gap: 6, fontSize: 12.5 }}>
          <Icon name={row.channel === 'call' ? 'phone' : 'chat'} size={14} />
          {row.channel === 'call' ? 'Voice' : 'Chat'}
        </span>
      ),
    },
    {
      key: 'durationSeconds',
      label: 'Duration',
      align: 'right',
      sortable: true,
      render: (row) => duration(row.durationSeconds),
    },
    {
      key: 'amount',
      label: 'Charged',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{row.amount ? money(row.amount) : '—'}</span>,
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
            { label: 'Open session', icon: 'eye', onClick: () => setOpenId(row.id) },
            ...(row.status === 'active' && canManage
              ? [
                  {
                    label: 'End session',
                    icon: 'ban',
                    variant: 'danger',
                    onClick: () => forceEnd(row.id),
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
        title="Consultation Monitoring"
        subtitle="Paid chat and voice sessions across the platform, live and historical"
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="Consultations today"
          value={count(stats?.consultations?.today ?? 0)}
          icon="chat"
          tone="lilac"
          hint="all channels"
        />
        <StatCard
          label="Running now"
          value={count(stats?.consultations?.ongoing ?? 0)}
          icon="activity"
          tone="success"
          hint="live sessions"
        />
        <StatCard
          label="Collected this month"
          value={money(stats?.revenue?.chargedThisMonth ?? 0)}
          icon="rupee"
          hint="charged to wallets"
        />
        <StatCard
          label="Platform revenue"
          value={money(stats?.revenue?.platformThisMonth ?? 0)}
          icon="wallet"
          tone="brand"
          hint="after astrologer payouts"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['user', 'astrologer', 'id']}
        searchPlaceholder="Search by seeker or astrologer…"
        onRowClick={(row) => setOpenId(row.id)}
        toolbar={
          <>
            <Chips value={filter} onChange={setFilter} items={FILTERS} />
            <Chips value={channel} onChange={setChannel} items={CHANNELS} />
          </>
        }
        empty={{ icon: 'chat', title: 'No consultations in this view' }}
      />

      {openId && (
        <Drawer
          wide
          title={open ? `Session ${open.id.slice(-8)}` : 'Loading…'}
          subtitle={open ? `${label(open.topic) || 'General'} · ${dateTime(open.requestedAt)}` : ''}
          onClose={() => setOpenId(null)}
          footer={
            open && open.status === 'active' && canManage ? (
              <Button variant="danger" icon="ban" disabled={busy} onClick={() => forceEnd(open.id)}>
                End session
              </Button>
            ) : undefined
          }
        >
          {loadingDetail || !open ? (
            <LoadingBlock />
          ) : (
            <div className="stack" style={{ gap: 18 }}>
              <div className="row row--between">
                <div className="row" style={{ gap: 8 }}>
                  <StatusBadge status={open.status} />
                  <Badge tone={open.channel === 'call' ? 'lilac' : 'info'}>
                    {open.channel === 'call' ? 'Voice consultation' : 'Chat consultation'}
                  </Badge>
                </div>
                {open.review?.rating && (
                  <span className="row" style={{ gap: 4, color: '#FFBF00' }}>
                    <Icon name="star" size={14} strokeWidth={2} />
                    <span className="strong">{open.review.rating}.0</span>
                  </span>
                )}
              </div>

              <div className="party-grid">
                <div className="party-card">
                  <p className="eyebrow">Seeker</p>
                  <Identity
                    name={open.user?.name || 'Unknown'}
                    meta={`Wallet ${money(open.user?.walletBalance)}`}
                  />
                </div>
                <div className="party-card">
                  <p className="eyebrow">Astrologer</p>
                  <Identity
                    name={open.astrologer?.name || '—'}
                    meta={`${money(open.billing.ratePerMinute)}/min`}
                    tone="muted"
                  />
                </div>
              </div>

              {open.question && (
                <section>
                  <h3 className="section-title">What was asked</h3>
                  <p style={{ fontSize: 13 }}>{open.question}</p>
                </section>
              )}

              <section>
                <h3 className="section-title">Billing</h3>
                <DetailList
                  rows={[
                    { label: 'Rate', value: `${money(open.billing.ratePerMinute)} / min` },
                    {
                      label: 'Billable minutes',
                      value: open.durationSeconds ? `${minutes(open.durationSeconds)} min` : '—',
                    },
                    {
                      label: 'Free minutes',
                      value: open.billing.freeMinutes ? `${open.billing.freeMinutes} min` : 'None',
                    },
                    { label: 'Charged to wallet', value: money(open.billing.amountCharged) },
                    {
                      label: 'Astrologer earning',
                      value: `${money(open.billing.astrologerEarning)} (${
                        100 - open.billing.commissionPercent
                      }%)`,
                    },
                    {
                      label: 'Platform commission',
                      value: `${money(open.billing.platformEarning)} (${
                        open.billing.commissionPercent
                      }%)`,
                    },
                  ]}
                />
              </section>

              <section>
                <h3 className="section-title">Session timeline</h3>
                <Timeline
                  items={[
                    {
                      title: 'Request sent',
                      meta: `${dateTime(open.requestedAt)} · by ${open.user?.name || 'seeker'}`,
                      state: 'done',
                    },
                    {
                      title: open.startedAt ? 'Astrologer accepted' : 'Never accepted',
                      meta: open.startedAt ? dateTime(open.startedAt) : label(open.status),
                      state: open.startedAt ? 'done' : '',
                    },
                    {
                      title: open.status === 'active' ? 'Session in progress' : 'Session ended',
                      meta: open.durationSeconds
                        ? `Duration ${duration(open.durationSeconds)}${
                            open.endedBy ? ` · ended by ${open.endedBy}` : ''
                          }`
                        : 'Not started',
                      state: open.status === 'active' ? 'active' : open.endedAt ? 'done' : '',
                    },
                    {
                      title: 'Wallet settled',
                      meta: open.billing.amountCharged
                        ? `${money(open.billing.amountCharged)} debited`
                        : 'Nothing charged',
                      state: open.billing.amountCharged ? 'done' : '',
                    },
                  ]}
                />
              </section>

              {open.review?.rating && (
                <section>
                  <h3 className="section-title">Review</h3>
                  <p style={{ fontSize: 13 }}>{open.review.comment || 'No comment left.'}</p>
                  {open.review.reply && (
                    <p className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>
                      Astrologer replied: {open.review.reply}
                    </p>
                  )}
                </section>
              )}

              {open.messages.length > 0 && (
                <section>
                  <h3 className="section-title">Transcript</h3>
                  <div className="transcript">
                    {open.messages.map((line) => (
                      <div
                        key={line.id}
                        className={`transcript__line transcript__line--${
                          line.from === 'user' ? 'user' : 'astrologer'
                        }`}
                      >
                        <p>{line.text}</p>
                        <span>{dateTime(line.at)}</span>
                      </div>
                    ))}
                    {open.messageCount > open.messages.length && (
                      <p className="faint" style={{ fontSize: 11.5, textAlign: 'center' }}>
                        Showing the first {open.messages.length} of {open.messageCount} messages
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}

export default ConsultationsPage;
