/**
 * Consultation Monitoring — paid chat and voice sessions, their status, and the
 * transcript an admin needs when a session is reviewed.
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
  StatCard,
  StatusBadge,
  Timeline,
} from '../components/ui';
import { consultationTranscript, consultations as seed } from '../data/operations';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'ongoing', label: 'Live', dot: true },
  { key: 'completed', label: 'Completed' },
  { key: 'missed', label: 'Missed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function ConsultationsPage({ notify }) {
  const [filter, setFilter] = useState('all');
  const [channel, setChannel] = useState('all');
  const [open, setOpen] = useState(null);

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

  const filtered = useMemo(
    () =>
      seed.filter(
        (row) =>
          (filter === 'all' || row.status === filter) &&
          (channel === 'all' || row.channel === channel),
      ),
    [filter, channel],
  );

  const columns = [
    {
      key: 'id',
      label: 'Session',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong mono">{row.id}</p>
          <p className="faint" style={{ fontSize: 11.5 }}>
            {row.started}
          </p>
        </div>
      ),
    },
    {
      key: 'user',
      label: 'Seeker',
      sortable: true,
      render: (row) => <Identity name={row.user} meta={row.topic} size="sm" />,
    },
    {
      key: 'astrologer',
      label: 'Astrologer',
      sortable: true,
      render: (row) => <Identity name={row.astrologer} size="sm" tone="muted" />,
    },
    {
      key: 'channel',
      label: 'Channel',
      sortable: true,
      render: (row) => (
        <Badge tone={row.channel === 'call' ? 'lilac' : 'info'}>
          <Icon name={row.channel === 'call' ? 'phone' : 'chat'} size={11} />
          {row.channel === 'call' ? 'Voice' : 'Chat'}
        </Badge>
      ),
    },
    { key: 'duration', label: 'Duration', align: 'right', sortable: true },
    {
      key: 'amount',
      label: 'Charged',
      align: 'right',
      sortable: true,
      render: (row) =>
        row.amount ? (
          <span className="mono strong">₹{row.amount}</span>
        ) : (
          <span className="faint">—</span>
        ),
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
            { label: 'Open session', icon: 'eye', onClick: () => setOpen(row) },
            ...(row.status === 'ongoing'
              ? [
                  {
                    label: 'End session',
                    icon: 'ban',
                    variant: 'danger',
                    onClick: () => notify('Session ended by admin'),
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
        actions={
          <>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="activity" onClick={() => notify('Live monitor opened')}>
              Live monitor
            </Button>
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard label="Consultations today" value="1,384" icon="chat" tone="brand" delta="+12.1%" hint="vs. yesterday" />
        <StatCard label="Running now" value={counts.ongoing} icon="activity" tone="success" delta="18 platform-wide" deltaTone="flat" hint="chat & voice" />
        <StatCard label="Avg. duration" value="17m 42s" icon="clock" tone="yellow" delta="+1m 10s" hint="this week" />
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        searchKeys={['id', 'user', 'astrologer', 'topic']}
        searchPlaceholder="Search by session, seeker or astrologer…"
        onRowClick={setOpen}
        toolbar={
          <Chips
            value={filter}
            onChange={setFilter}
            items={FILTERS.map((item) => ({ ...item, count: counts[item.key] }))}
          />
        }
        toolbarEnd={
          <Chips
            value={channel}
            onChange={setChannel}
            items={[
              { key: 'all', label: 'Both' },
              { key: 'chat', label: 'Chat' },
              { key: 'call', label: 'Voice' },
            ]}
          />
        }
        empty={{ icon: 'chat', title: 'No sessions match this view' }}
      />

      {open && (
        <Drawer
          wide
          title={`Session ${open.id}`}
          subtitle={`${open.topic} · ${open.started}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <Button onClick={() => notify('Transcript exported')} icon="download">
                Export transcript
              </Button>
              {open.status === 'ongoing' ? (
                <Button variant="danger" icon="ban" onClick={() => notify('Session ended by admin')}>
                  End session
                </Button>
              ) : (
                <Button variant="danger" icon="rupee" onClick={() => notify('Refund issued')}>
                  Issue refund
                </Button>
              )}
            </>
          }
        >
          <div className="stack" style={{ gap: 18 }}>
            <div className="row row--between">
              <div className="row" style={{ gap: 8 }}>
                <StatusBadge status={open.status} />
                <Badge tone={open.channel === 'call' ? 'lilac' : 'info'}>
                  {open.channel === 'call' ? 'Voice consultation' : 'Chat consultation'}
                </Badge>
              </div>
              {open.rating && (
                <span className="row" style={{ gap: 4, color: '#FFBF00' }}>
                  <Icon name="star" size={14} strokeWidth={2} />
                  <span className="strong">{open.rating}.0</span>
                </span>
              )}
            </div>

            <div className="party-grid">
              <div className="party-card">
                <p className="eyebrow">Seeker</p>
                <Identity name={open.user} meta="Wallet balance ₹4,520" />
              </div>
              <div className="party-card">
                <p className="eyebrow">Astrologer</p>
                <Identity name={open.astrologer} meta={`₹${open.rate}/min`} tone="muted" />
              </div>
            </div>

            <section>
              <h3 className="section-title">Billing</h3>
              <DetailList
                rows={[
                  { label: 'Rate', value: `₹${open.rate} / min` },
                  { label: 'Billable minutes', value: open.minutes ? `${open.minutes} min` : '—' },
                  { label: 'Charged to wallet', value: open.amount ? `₹${open.amount}` : '₹0' },
                  {
                    label: 'Astrologer earning',
                    value: `₹${Math.round(open.amount * 0.3)} (30%)`,
                  },
                  { label: 'Platform commission', value: `₹${Math.round(open.amount * 0.7)} (70%)` },
                ]}
              />
            </section>

            <section>
              <h3 className="section-title">Session timeline</h3>
              <Timeline
                items={[
                  { title: 'Request sent', meta: `${open.started} · by ${open.user}`, state: 'done' },
                  {
                    title: 'Astrologer accepted',
                    meta: open.status === 'missed' ? 'No response within 60s' : 'Within 12s',
                    state: open.status === 'missed' ? '' : 'done',
                  },
                  {
                    title: open.status === 'ongoing' ? 'Session in progress' : 'Session ended',
                    meta: open.duration === '—' ? 'Not started' : `Duration ${open.duration}`,
                    state: open.status === 'ongoing' ? 'active' : open.minutes ? 'done' : '',
                  },
                  {
                    title: 'Wallet settled',
                    meta: open.amount ? `₹${open.amount} debited` : 'Nothing charged',
                    state: open.amount ? 'done' : '',
                  },
                ]}
              />
            </section>

            {open.channel === 'chat' && open.minutes > 0 && (
              <section>
                <h3 className="section-title">Transcript excerpt</h3>
                <div className="transcript">
                  {consultationTranscript.map((line, index) => (
                    <div
                      key={index}
                      className={`transcript__line transcript__line--${line.from}`}
                    >
                      <p>{line.text}</p>
                      <span>{line.at}</span>
                    </div>
                  ))}
                  <p className="faint" style={{ fontSize: 11.5, textAlign: 'center' }}>
                    Showing the first 5 of 34 messages
                  </p>
                </div>
              </section>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}

export default ConsultationsPage;
