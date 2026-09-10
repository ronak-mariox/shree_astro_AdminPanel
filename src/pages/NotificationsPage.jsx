/**
 * Notifications — what needs this admin's attention: a new application, a
 * price-change or withdrawal request, a support ticket. The row's owner is
 * this signed-in admin's own account; every admin sees their own list, the
 * same way an astrologer or a seeker does in their app.
 */

import { useState } from 'react';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/Shell';
import { Badge, Button, Chips } from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { listNotifications, markNotificationsRead } from '../services/admin';
import { relative } from '../utils/format';

const TYPE_TONE = {
  application: 'brand',
  withdrawal: 'success',
  wallet_credit: 'success',
  wallet_debit: 'warning',
  review: 'lilac',
  consultation_request: 'info',
  consultation_started: 'info',
  consultation_ended: 'neutral',
  message: 'info',
  promotion: 'lilac',
  system: 'neutral',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

const PAGE_LIMIT = 100;

export function NotificationsPage({ notify }) {
  const [view, setView] = useState('all');
  const [run] = useAction(notify);

  const { data, loading, error, reload } = useApi(
    () => listNotifications({ limit: PAGE_LIMIT }),
    [],
  );

  const items = data?.items ?? [];
  const rows = view === 'unread' ? items.filter((row) => !row.readAt) : items;

  const markOne = (row) => {
    if (row.readAt) return;
    run(() => markNotificationsRead(row._id), { onDone: reload });
  };

  const markAll = () =>
    run(() => markNotificationsRead(), { success: 'Everything marked read', onDone: reload });

  const columns = [
    {
      key: 'title',
      label: 'Notification',
      render: (row) => (
        <div style={{ maxWidth: 480 }}>
          <p className={row.readAt ? 'truncate' : 'strong truncate'}>{row.title}</p>
          {row.body && (
            <p className="faint truncate" style={{ fontSize: 11.5 }}>
              {row.body}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => <Badge tone={TYPE_TONE[row.type] || 'neutral'}>{row.type}</Badge>,
    },
    {
      key: 'createdAt',
      label: 'When',
      align: 'right',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => <span className="nowrap faint">{relative(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) =>
        row.readAt ? (
          <span className="faint" style={{ fontSize: 11.5 }}>
            Read
          </span>
        ) : (
          <Button size="sm" onClick={() => markOne(row)}>
            Mark read
          </Button>
        ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        subtitle="What needs your attention, newest first"
        actions={
          <>
            <Button variant="ghost" onClick={markAll} disabled={!items.some((row) => !row.readAt)}>
              Mark all read
            </Button>
            <Button icon="refresh" onClick={reload}>
              Refresh
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        onRowClick={markOne}
        searchKeys={['title', 'body', 'type']}
        searchPlaceholder="Search notifications…"
        toolbar={<Chips value={view} onChange={setView} items={FILTERS} />}
        empty={{ icon: 'bell', title: 'Nothing here yet' }}
      />
    </div>
  );
}

export default NotificationsPage;
