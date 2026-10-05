/**
 * Puja Bookings — every slot a seeker has paid for, and the stream link the
 * pandit's session goes out on.
 *
 * A booking is confirmed the moment it is paid. Marking it completed lets the
 * seeker rate it; cancelling refunds the wallet, so it sits behind a
 * confirmation.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { PageHeader } from '../components/Shell';
import {
  Button,
  Chips,
  DetailList,
  Drawer,
  Field,
  Identity,
  Input,
  LoadingBlock,
  Modal,
  Note,
  StatCard,
  StatusBadge,
  Textarea,
  Thumb,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { getPujaBooking, listPujaBookings, updatePujaBooking } from '../services/admin';
import { can } from '../services/session';
import { count, dateTime, label, money, phone as formatPhone } from '../utils/format';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

/** "2026-09-24" → "24 Sep 2026", without a timezone shift. */
function bookingDate(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const todayKey = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const PAGE_LIMIT = 100;

export function PujaBookingsPage({ notify }) {
  const [filter, setFilter] = useState('all');
  const [date, setDate] = useState('');
  const [openId, setOpenId] = useState(null);
  const [edits, setEdits] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [run, busy] = useAction(notify);

  const { data, loading, error, reload } = useApi(
    () =>
      listPujaBookings({
        status: filter === 'all' ? undefined : filter,
        date: date || undefined,
        limit: PAGE_LIMIT,
      }),
    [filter, date],
  );
  const { data: detail, loading: loadingDetail, reload: reloadDetail } = useApi(
    () => getPujaBooking(openId),
    [openId],
    { skip: !openId },
  );

  const rows = data?.items ?? [];
  const canManage = can('pujas.manage');
  const open = detail?.booking;

  /** The stream URL and admin note as typed, or as saved when nothing is typed. */
  const form = edits ?? { streamUrl: open?.streamUrl || '', adminNote: open?.adminNote || '' };

  const today = todayKey();
  const todayRows = rows.filter((row) => row.date === today && row.status === 'confirmed');
  const upcomingRows = rows.filter((row) => row.status === 'confirmed');
  const revenue = rows
    .filter((row) => row.status !== 'cancelled')
    .reduce((sum, row) => sum + (row.amount || 0), 0);

  const openBooking = (id) => {
    setEdits(null);
    setOpenId(id);
  };

  const after = async () => {
    await reload();
    if (openId) await reloadDetail();
  };

  const saveDetails = () =>
    run(
      () =>
        updatePujaBooking(open.id, {
          streamUrl: form.streamUrl.trim(),
          adminNote: form.adminNote.trim(),
        }),
      {
        success: 'Booking details saved',
        onDone: async () => {
          setEdits(null);
          await after();
        },
      },
    );

  const submitStatus = () =>
    run(() => updatePujaBooking(confirming.booking.id, { status: confirming.status }), {
      success:
        confirming.status === 'completed'
          ? `${confirming.booking.reference} marked completed`
          : `${confirming.booking.reference} cancelled and refunded`,
      onDone: async () => {
        setConfirming(null);
        await after();
      },
    });

  const columns = [
    {
      key: 'reference',
      label: 'Booking',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong mono">{row.reference}</p>
          <p className="faint nowrap" style={{ fontSize: 11.5 }}>
            Booked {dateTime(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'pujaName',
      label: 'Puja',
      sortable: true,
      render: (row) => (
        <div className="identity">
          <Thumb src={row.puja?.imageUrl || row.pujaSnapshot?.imageUrl} />
          <div className="truncate">
            <div className="identity__name truncate">
              {row.puja?.name || row.pujaSnapshot?.name}
            </div>
            <div className="identity__meta truncate">
              {row.puja?.panditName || row.pujaSnapshot?.panditName || '—'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortable: true,
      render: (row) => (
        <Identity
          name={row.user?.name || row.contact?.fullName || 'Seeker'}
          meta={formatPhone(row.user?.phone || row.contact?.phone)}
          size="sm"
        />
      ),
    },
    {
      key: 'date',
      label: 'Date & time',
      sortable: true,
      sortValue: (row) => `${row.date} ${row.time}`,
      render: (row) => (
        <div>
          <p className="strong nowrap">{bookingDate(row.date)}</p>
          <p className="faint nowrap" style={{ fontSize: 11.5 }}>
            {row.time}
          </p>
        </div>
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
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) => (
        <RowActions
          actions={[
            { label: 'View', icon: 'eye', onClick: () => openBooking(row.id) },
            ...(canManage && row.status === 'confirmed'
              ? [
                  {
                    label: 'Mark completed',
                    icon: 'check',
                    variant: 'success',
                    onClick: () => setConfirming({ booking: row, status: 'completed' }),
                  },
                  {
                    label: 'Cancel booking',
                    icon: 'x',
                    variant: 'danger',
                    onClick: () => setConfirming({ booking: row, status: 'cancelled' }),
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
        title="Puja Bookings"
        subtitle="Paid slots, the stream link for each, and who is performing them"
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="Today"
          value={count(todayRows.length)}
          icon="flame"
          tone="brand"
          hint="confirmed for today"
        />
        <StatCard
          label="Upcoming"
          value={count(upcomingRows.length)}
          icon="calendar"
          tone="yellow"
          hint="confirmed, not yet performed"
        />
        <StatCard
          label="Completed"
          value={count(rows.filter((row) => row.status === 'completed').length)}
          icon="checkCircle"
          tone="success"
          hint="in this view"
        />
        <StatCard
          label="Collected"
          value={money(revenue)}
          icon="rupee"
          hint="in this view, excluding cancellations"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows.map((row) => ({
          ...row,
          pujaName: row.puja?.name || row.pujaSnapshot?.name || '',
          customer: row.user?.name || row.contact?.fullName || '',
          customerPhone: row.user?.phone || row.contact?.phone || '',
        }))}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['reference', 'pujaName', 'customer', 'customerPhone', 'time']}
        searchPlaceholder="Search by booking, puja or customer…"
        onRowClick={(row) => openBooking(row.id)}
        toolbar={<Chips value={filter} onChange={setFilter} items={FILTERS} />}
        toolbarEnd={
          <div className="row" style={{ gap: 8 }}>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Filter by date"
              style={{ width: 170 }}
            />
            {date && (
              <Button size="sm" icon="x" aria-label="Clear date" onClick={() => setDate('')} />
            )}
          </div>
        }
        empty={{ icon: 'calendar', title: 'No bookings in this view' }}
      />

      {openId && (
        <Drawer
          wide
          title={open?.reference || 'Loading…'}
          subtitle={open ? `${open.puja?.name || open.pujaSnapshot?.name} · ${bookingDate(open.date)} at ${open.time}` : ''}
          onClose={() => setOpenId(null)}
          footer={
            open && canManage && open.status === 'confirmed' ? (
              <>
                <Button
                  variant="danger"
                  icon="x"
                  disabled={busy}
                  onClick={() => setConfirming({ booking: open, status: 'cancelled' })}
                >
                  Cancel booking (refund)
                </Button>
                <Button
                  variant="success"
                  icon="check"
                  disabled={busy}
                  onClick={() => setConfirming({ booking: open, status: 'completed' })}
                >
                  Mark completed
                </Button>
              </>
            ) : undefined
          }
        >
          {loadingDetail || !open ? (
            <LoadingBlock />
          ) : (
            <div className="stack" style={{ gap: 18 }}>
              <div className="profile-head">
                <div className="identity">
                  <Thumb src={open.puja?.imageUrl || open.pujaSnapshot?.imageUrl} size={56} />
                  <div className="truncate">
                    <div className="identity__name truncate">
                      {open.puja?.name || open.pujaSnapshot?.name}
                    </div>
                    <div className="identity__meta truncate">
                      {open.puja?.panditName || open.pujaSnapshot?.panditName || 'No pandit named'}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <StatusBadge status={open.status} />
                  <StatusBadge status={open.payment?.status || 'paid'} />
                </div>
              </div>

              <div className="mini-stats">
                <div>
                  <p className="eyebrow">Date</p>
                  <p className="mini-stats__value">{bookingDate(open.date)}</p>
                </div>
                <div>
                  <p className="eyebrow">Time</p>
                  <p className="mini-stats__value">{open.time}</p>
                </div>
                <div>
                  <p className="eyebrow">Paid</p>
                  <p className="mini-stats__value">{money(open.amount)}</p>
                </div>
                <div>
                  <p className="eyebrow">Rating</p>
                  <p className="mini-stats__value">{open.rating ? `${open.rating} ★` : '—'}</p>
                </div>
              </div>

              <section>
                <h3 className="section-title">Contact</h3>
                <DetailList
                  rows={[
                    { label: 'Name', value: open.contact?.fullName || open.user?.name || '—' },
                    { label: 'Phone', value: formatPhone(open.contact?.phone || open.user?.phone) },
                    { label: 'Email', value: open.contact?.email || '—' },
                    { label: 'Gotra', value: open.contact?.gotra || '—' },
                    { label: 'Address', value: open.contact?.address || '—' },
                  ]}
                />
              </section>

              <section>
                <h3 className="section-title">Seeker&apos;s notes</h3>
                <p style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>
                  {open.notes || <span className="faint">Nothing added at booking.</span>}
                </p>
              </section>

              {open.review && (
                <section>
                  <h3 className="section-title">Review</h3>
                  <Note tone="success" icon="star">
                    <strong>{open.rating} ★</strong> — {open.review}
                  </Note>
                </section>
              )}

              <section>
                <h3 className="section-title">Stream &amp; admin note</h3>
                <div className="stack" style={{ gap: 12 }}>
                  <Field label="Stream URL" hint="The seeker opens this link to watch the puja live">
                    <Input
                      placeholder="https://…"
                      value={form.streamUrl}
                      disabled={!canManage}
                      onChange={(event) =>
                        setEdits({ ...form, streamUrl: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Admin note" hint="Internal — not shown to the seeker">
                    <Textarea
                      placeholder="e.g. Pandit confirmed; samagri arranged."
                      value={form.adminNote}
                      disabled={!canManage}
                      onChange={(event) =>
                        setEdits({ ...form, adminNote: event.target.value })
                      }
                    />
                  </Field>
                  {canManage && (
                    <div>
                      <Button
                        variant="primary"
                        icon="check"
                        disabled={busy || !edits}
                        onClick={saveDetails}
                      >
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="section-title">Record</h3>
                <DetailList
                  rows={[
                    { label: 'Booked', value: dateTime(open.createdAt) },
                    { label: 'Payment', value: `${label(open.payment?.method || 'wallet')} · ${label(open.payment?.status || 'paid')}` },
                    ...(open.completedAt ? [{ label: 'Completed', value: dateTime(open.completedAt) }] : []),
                    ...(open.cancelledAt ? [{ label: 'Cancelled', value: dateTime(open.cancelledAt) }] : []),
                  ]}
                />
              </section>
            </div>
          )}
        </Drawer>
      )}

      {confirming && (
        <Modal
          title={
            confirming.status === 'completed'
              ? `Mark ${confirming.booking.reference} completed?`
              : `Cancel ${confirming.booking.reference}?`
          }
          subtitle={
            confirming.status === 'completed'
              ? 'The seeker is told the puja was performed and can rate it'
              : `${money(confirming.booking.amount)} goes back to the seeker's wallet`
          }
          onClose={() => setConfirming(null)}
          footer={
            <>
              <Button onClick={() => setConfirming(null)}>Go back</Button>
              <Button
                variant={confirming.status === 'completed' ? 'primary' : 'danger'}
                icon={confirming.status === 'completed' ? 'check' : 'x'}
                disabled={busy}
                onClick={submitStatus}
              >
                {confirming.status === 'completed' ? 'Mark completed' : 'Cancel & refund'}
              </Button>
            </>
          }
        >
          {confirming.status === 'completed' ? (
            <Note tone="info" icon="info">
              Do this once the pandit has finished. It cannot be moved back to confirmed.
            </Note>
          ) : (
            <Note tone="danger" icon="alert">
              The slot is released and the full amount refunded to the wallet. The seeker is
              notified. This cannot be undone.
            </Note>
          )}
        </Modal>
      )}
    </div>
  );
}

export default PujaBookingsPage;
