/**
 * Audit Logs — a read-only record of every change an admin has made from this
 * console.
 *
 * Read-only is the whole point: rows are written by the server after a change
 * succeeds, and there is no endpoint that edits or deletes one. A log you can
 * change is not a log.
 */

import { useState } from 'react';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/Shell';
import { Badge, Button, Chips, Identity } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { listAuditLogs } from '../services/admin';
import { dateTime, label } from '../utils/format';

/** The areas the server tags a row with (models/AuditLog.js). */
const AREAS = [
  'Users',
  'Astrologers',
  'Consultations',
  'Payments',
  'Wallets',
  'Content',
  'Settings',
];

const AREA_TONE = {
  Users: 'info',
  Astrologers: 'brand',
  Consultations: 'lilac',
  Payments: 'success',
  Wallets: 'success',
  Content: 'neutral',
  Settings: 'warning',
};

const FILTERS = [
  { key: 'all', label: 'All activity' },
  ...AREAS.map((area) => ({ key: area, label: area })),
];

const PAGE_LIMIT = 200;

export function AuditLogsPage() {
  const [area, setArea] = useState('all');

  const { data, loading, error, reload } = useApi(
    () => listAuditLogs({ area: area === 'all' ? undefined : area, limit: PAGE_LIMIT }),
    [area],
  );

  const rows = data?.items ?? [];

  const columns = [
    {
      key: 'createdAt',
      label: 'When',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => <span className="nowrap">{dateTime(row.createdAt)}</span>,
    },
    {
      key: 'adminName',
      label: 'Admin',
      sortable: true,
      render: (row) => (
        <Identity name={row.adminName || 'Unknown'} meta={label(row.adminRole)} size="sm" />
      ),
    },
    {
      key: 'action',
      label: 'Action',
      sortable: true,
      render: (row) => (
        <div style={{ maxWidth: 380 }}>
          <p className="strong truncate">{row.action}</p>
          <p className="faint truncate" style={{ fontSize: 11.5 }}>
            {row.target}
          </p>
        </div>
      ),
    },
    {
      key: 'area',
      label: 'Area',
      sortable: true,
      render: (row) => <Badge tone={AREA_TONE[row.area] || 'neutral'}>{row.area}</Badge>,
    },
    {
      key: 'ip',
      label: 'IP address',
      align: 'right',
      render: (row) => (
        <span className="mono" style={{ fontSize: 12.5 }}>
          {row.ip || '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Audit Logs"
        subtitle="Every change made from this console, newest first"
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['adminName', 'action', 'target', 'area', 'ip']}
        searchPlaceholder="Search by admin, action or record…"
        toolbar={<Chips value={area} onChange={setArea} items={FILTERS} />}
        empty={{ icon: 'shield', title: 'No admin activity in this view' }}
      />
    </div>
  );
}

export default AuditLogsPage;
