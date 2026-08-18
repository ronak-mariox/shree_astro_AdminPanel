/**
 * Audit Logs — a read-only record of every action an admin has taken in this
 * console. The page lists the trail and nothing else: no editing, no export,
 * no settings hanging off it.
 */

import { useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/Shell';
import { Badge, Chips, Identity } from '../components/ui';
import { auditAreas, auditLogs } from '../data/audit';

const AREA_TONE = {
  Users: 'info',
  Astrologers: 'brand',
  Consultations: 'lilac',
  Payments: 'success',
  Wallets: 'success',
  Content: 'neutral',
  Settings: 'warning',
};

const FILTERS = [{ key: 'all', label: 'All activity' }, ...auditAreas.map((area) => ({ key: area, label: area }))];

export function AuditLogsPage() {
  const [area, setArea] = useState('all');

  const counts = useMemo(
    () =>
      FILTERS.reduce(
        (acc, item) => ({
          ...acc,
          [item.key]:
            item.key === 'all'
              ? auditLogs.length
              : auditLogs.filter((row) => row.area === item.key).length,
        }),
        {},
      ),
    [],
  );

  const filtered = useMemo(
    () => (area === 'all' ? auditLogs : auditLogs.filter((row) => row.area === area)),
    [area],
  );

  const columns = [
    {
      key: 'at',
      label: 'When',
      sortable: true,
      sortValue: (row) => row.ts,
      render: (row) => <span className="nowrap">{row.at}</span>,
    },
    {
      key: 'admin',
      label: 'Admin',
      sortable: true,
      render: (row) => <Identity name={row.admin} meta={row.role} size="sm" />,
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
          {row.ip}
        </span>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Audit Logs"
        subtitle="Every action taken from this console, newest first"
      />

      <DataTable
        columns={columns}
        rows={filtered}
        searchKeys={['admin', 'action', 'target', 'area', 'ip', 'id']}
        searchPlaceholder="Search by admin, action or record…"
        toolbar={
          <Chips
            value={area}
            onChange={setArea}
            items={FILTERS.map((item) => ({ ...item, count: counts[item.key] }))}
          />
        }
        empty={{ icon: 'shield', title: 'No admin activity in this view' }}
      />
    </div>
  );
}

export default AuditLogsPage;
