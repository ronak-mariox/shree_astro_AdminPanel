/**
 * Reporting & Monitoring — activity trends, the operational reports an admin
 * schedules or runs on demand, and the health of the backend APIs.
 */

import { useState } from 'react';
import { AreaChart, BarChart, DonutChart } from '../components/Charts';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Card,
  DetailList,
  Note,
  StatCard,
  StatusBadge,
  Tabs,
} from '../components/ui';
import {
  activityTrend,
  consultationMix,
  savedReports,
  signupSplit,
  systemHealth,
} from '../data/analytics';

export function ReportsPage({ notify }) {
  const [range, setRange] = useState('7d');

  const columns = [
    {
      key: 'name',
      label: 'Report',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong">{row.name}</p>
          <p className="faint" style={{ fontSize: 11.5 }}>
            {row.scope}
          </p>
        </div>
      ),
    },
    {
      key: 'frequency',
      label: 'Schedule',
      sortable: true,
      render: (row) => (
        <span className="row" style={{ gap: 6, fontSize: 12.5 }}>
          <Icon name="clock" size={14} />
          {row.frequency}
        </span>
      ),
    },
    {
      key: 'format',
      label: 'Format',
      sortable: true,
      render: (row) => <Badge tone="neutral">{row.format}</Badge>,
    },
    { key: 'lastRun', label: 'Last run', sortable: true },
    {
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) => (
        <RowActions
          actions={[
            {
              label: 'Run now',
              icon: 'refresh',
              onClick: () => notify(`${row.name} queued`),
            },
            {
              label: 'Download',
              icon: 'download',
              variant: 'ghost',
              onClick: () => notify(`${row.name} downloaded`),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Reporting & Monitoring"
        subtitle="Platform performance, business activity and operational reports"
        actions={
          <>
            <Tabs
              value={range}
              onChange={setRange}
              items={[
                { key: '7d', label: '7 days' },
                { key: '30d', label: '30 days' },
                { key: 'qtr', label: 'Quarter' },
              ]}
            />
            <Button variant="primary" icon="download" onClick={() => notify('Full export queued')}>
              Export all
            </Button>
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard label="Daily active users" value="11,380" icon="activity" tone="brand" delta="+12.4%" hint="peak Saturday" />
        <StatCard label="Sessions per user" value="3.2" icon="users" tone="yellow" delta="+0.4" hint="weekly average" />
        <StatCard label="Conversion to paid" value="18.6%" icon="rupee" tone="success" delta="+1.8 pts" hint="of active users" />
        <StatCard label="Crash-free sessions" value="99.7%" icon="shield" delta="+0.1 pts" hint="both apps" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Card title="User activity" subtitle="Sessions per day across both apps">
          <AreaChart
            data={activityTrend}
            height={216}
            color="#1F2937"
            fillFrom="rgba(31, 41, 55, 0.16)"
            valueFormat={(value) => `${(value / 1000).toFixed(0)}k`}
          />
        </Card>
      </div>

      <div className="grid grid--2" style={{ marginBottom: 16 }}>
        <Card title="Consultation volume" subtitle="Chat vs. voice, this week">
          <BarChart data={consultationMix} stacked={['chat', 'call']} height={170} />
        </Card>
        <Card title="Acquisition" subtitle="How users registered">
          <div className="row" style={{ gap: 14 }}>
            <DonutChart data={signupSplit} size={128} thickness={18} centreValue="48k" centreLabel="users" />
            <div className="donut-legend" style={{ flex: 1 }}>
              {signupSplit.map((slice) => (
                <div className="donut-legend__row" key={slice.label} style={{ fontSize: 11.5 }}>
                  <span className="chart-legend__swatch" style={{ background: slice.color }} />
                  {slice.label}
                  <span className="value">{slice.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid--sidebar">
        <DataTable
          columns={columns}
          rows={savedReports}
          searchKeys={['name', 'scope']}
          searchPlaceholder="Search saved reports…"
          toolbarEnd={
            <Button size="sm" variant="primary" icon="plus" onClick={() => notify('Report builder opened')}>
              New report
            </Button>
          }
          empty={{ icon: 'chart', title: 'No saved reports' }}
        />

        <div className="stack">
          <Card title="Backend API monitoring" subtitle="Latency and uptime, last 24 hours">
            <div className="stack" style={{ gap: 12 }}>
              {systemHealth.map((service) => (
                <div className="row row--between" key={service.label}>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500 }}>{service.label}</p>
                    <p className="faint" style={{ fontSize: 11 }}>
                      {service.latency} avg · {service.uptime}
                    </p>
                  </div>
                  <StatusBadge status={service.status} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="This month" subtitle="Business summary">
            <DetailList
              rows={[
                { label: 'New users', value: '4,820' },
                { label: 'Consultations', value: '31,940' },
                { label: 'Consultation minutes', value: '5,64,200' },
                { label: 'Gross collections', value: '₹24.6L' },
                { label: 'Astrologer payouts', value: '₹17.8L' },
                { label: 'Platform revenue', value: '₹18.4L' },
              ]}
            />
          </Card>

          <Note tone="info" icon="alert">
            The Razorpay webhook has been degraded since 09:40. Reconciliation reports run
            after 23:30 may show a two-minute lag against the gateway.
          </Note>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
