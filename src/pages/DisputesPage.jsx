/**
 * Disputes & Support — every dispute and support request raised from either
 * app, and the admin's answer to it.
 *
 * astro_app's Help & Support screen files these (POST /support/tickets), the
 * customer app uses the same shape, and whoever raised one is notified the
 * moment it is answered here — so the reply below is what they read back in
 * their own app.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Chips,
  Field,
  Identity,
  Modal,
  Note,
  Select,
  StatCard,
  Textarea,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { listTickets, resolveTicket } from '../services/admin';
import { can } from '../services/session';
import { dateTime, label } from '../utils/format';

/** models/SupportTicket.js's own statuses, in the order a ticket moves through them. */
const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const FILTERS = [
  { key: 'all', label: 'All disputes' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const RAISED_BY = [
  { key: 'all', label: 'Everyone' },
  { key: 'astrologer', label: 'Astrologers' },
  { key: 'user', label: 'Customers' },
];

/** How each status reads on a row. */
const STATUS_TONE = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',
};

const ISSUE_TONE = {
  astrologer: 'brand',
  payment: 'success',
  puja: 'lilac',
  product: 'info',
  donation: 'warning',
  other: 'neutral',
};

/** Enough rows that the table's own paging does the work, not the server's. */
const PAGE_LIMIT = 200;

export function DisputesPage({ notify }) {
  const [status, setStatus] = useState('all');
  const [ownerRole, setOwnerRole] = useState('all');
  /** The ticket being answered, if any. */
  const [answering, setAnswering] = useState(null);
  const [form, setForm] = useState({ status: 'resolved', resolution: '' });

  const tickets = useApi(
    () =>
      listTickets({
        status: status === 'all' ? undefined : status,
        ownerRole: ownerRole === 'all' ? undefined : ownerRole,
        limit: PAGE_LIMIT,
      }),
    [status, ownerRole],
  );
  const [run, busy] = useAction(notify);

  const rows = tickets.data?.items ?? [];
  const canManage = can('consultations.manage');

  const openAnswer = (ticket) => {
    setForm({ status: ticket.status === 'open' ? 'in_progress' : 'resolved', resolution: ticket.resolution || '' });
    setAnswering(ticket);
  };

  const save = () =>
    run(() => resolveTicket(answering._id, { status: form.status, resolution: form.resolution.trim() || undefined }), {
      success: 'Dispute updated — they have been notified',
      onDone: async () => {
        setAnswering(null);
        await tickets.reload();
      },
    });

  const countOf = (value) => rows.filter((row) => row.status === value).length;

  const columns = [
    {
      key: 'reference',
      label: 'Dispute',
      render: (row) => (
        <div style={{ maxWidth: 420 }}>
          <p className="strong">{row.description}</p>
          <p className="faint" style={{ fontSize: 11.5 }}>
            {row.reference} · <Badge tone={ISSUE_TONE[row.issueType] || 'neutral'}>{label(row.issueType)}</Badge>
            {row.chatSession ? ' · from a consultation' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'ownerName',
      label: 'Raised by',
      sortable: true,
      render: (row) => <Identity name={row.ownerName || 'Unknown'} meta={label(row.ownerRole)} size="sm" />,
    },
    {
      key: 'createdAt',
      label: 'When',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => <span className="nowrap">{dateTime(row.createdAt)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <div>
          <Badge tone={STATUS_TONE[row.status] || 'neutral'}>{label(row.status)}</Badge>
          {row.resolution && (
            <p className="faint truncate" style={{ fontSize: 11.5, maxWidth: 220 }}>
              “{row.resolution}”
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <RowActions
          actions={[
            {
              label: row.status === 'resolved' || row.status === 'closed' ? 'Reopen or edit' : 'Answer',
              icon: 'edit',
              showLabel: true,
              variant: row.status === 'open' ? 'primary' : 'ghost',
              onClick: () => openAnswer(row),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Disputes & Support"
        subtitle="Everything raised from the astrologer and customer apps"
        actions={<Button icon="refresh" onClick={tickets.reload}>Refresh</Button>}
      />

      <div className="grid grid--stats">
        <StatCard label="Open" value={countOf('open')} icon="inbox" tone="warning" hint="Waiting on a first reply" />
        <StatCard label="In progress" value={countOf('in_progress')} icon="refresh" tone="info" />
        <StatCard label="Resolved" value={countOf('resolved')} icon="check" tone="success" />
        <StatCard label="Closed" value={countOf('closed')} icon="ban" tone="plain" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={tickets.loading}
        error={tickets.error}
        onRetry={tickets.reload}
        searchKeys={['reference', 'description', 'ownerName', 'issueType']}
        searchPlaceholder="Search by reference, description or who raised it…"
        toolbar={<Chips value={status} onChange={setStatus} items={FILTERS} />}
        toolbarEnd={<Chips value={ownerRole} onChange={setOwnerRole} items={RAISED_BY} />}
        empty={{ icon: 'inbox', title: 'No disputes in this view' }}
      />

      {answering && (
        <Modal
          title={`Answer ${answering.reference}`}
          subtitle={`${answering.ownerName || 'Unknown'} · ${label(answering.issueType)}`}
          onClose={() => setAnswering(null)}
          footer={
            <>
              <Button onClick={() => setAnswering(null)}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={busy || !canManage} onClick={save}>
                Save and notify
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Note tone="info" icon="info">
              What you write here is sent to {answering.ownerName || 'them'} as a notification, and shows on their
              ticket in the app.
            </Note>

            <div className="note">
              <p className="faint" style={{ fontSize: 11.5 }}>
                {dateTime(answering.createdAt)}
              </p>
              <p>{answering.description}</p>
            </div>

            <Field label="Status">
              <Select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                options={STATUSES}
              />
            </Field>

            <Field label="Reply" hint="Optional — left blank, only the status changes">
              <Textarea
                rows={4}
                placeholder="What was done about it…"
                value={form.resolution}
                onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value }))}
              />
            </Field>

            {!canManage && (
              <Note tone="warning" icon="alert">
                Your role can view disputes but not answer them.
              </Note>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default DisputesPage;
