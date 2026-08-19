/**
 * Reporting & Monitoring — how the platform did over a window of days.
 *
 * Every number here is counted from the data rather than stored, so a figure on
 * this page and the record behind it cannot drift apart.
 */

import { useState } from 'react';
import { AreaChart, BarChart, DonutChart } from '../components/Charts';
import { PageHeader } from '../components/Shell';
import {
  Button,
  Card,
  DetailList,
  ErrorBlock,
  LoadingBlock,
  Note,
  StatCard,
  Tabs,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import { getDashboard, getReports } from '../services/admin';
import { count, label, money, shortMoney } from '../utils/format';

const RANGES = [
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: 'Quarter' },
];

/** The donut needs a colour per slice; sign-up providers get a fixed one. */
const PROVIDER_COLOUR = {
  otp: '#F55102',
  google: '#FFBC01',
  apple: '#1F2937',
  email: '#9CA3AF',
  facebook: '#4267B2',
};

export function ReportsPage() {
  const [range, setRange] = useState('30');

  const { data, loading, error, reload } = useApi(() => getReports(Number(range)), [range]);
  const { data: summary } = useApi(() => getDashboard(7), []);

  const totals = data?.summary;

  /** The chart wants `{ label, value }`; the API answers `{ date, sessions }`. */
  const activity = (data?.activityTrend ?? []).map((row) => ({
    label: row.date.slice(5),
    value: row.sessions,
  }));

  /** One row per day with both channels on it, from the dashboard's mix. */
  const mix = (() => {
    const byDay = new Map();
    for (const row of summary?.consultationMix ?? []) {
      const day = row._id.day;
      const entry = byDay.get(day) || { label: day.slice(5), chat: 0, call: 0 };
      entry[row._id.channel === 'call' ? 'call' : 'chat'] += row.count;
      byDay.set(day, entry);
    }
    return [...byDay.values()];
  })();

  const signups = (data?.signupSplit ?? []).map((row) => ({
    label: label(row.provider === 'otp' ? 'Mobile OTP' : row.provider),
    value: row.count,
    color: PROVIDER_COLOUR[row.provider] || '#9CA3AF',
  }));
  const signupTotal = signups.reduce((sum, slice) => sum + slice.value, 0);

  const topics = (data?.topicSplit ?? []).map((row) => ({
    label: label(row.topic),
    chat: row.count,
  }));

  return (
    <div className="page">
      <PageHeader
        title="Reporting & Monitoring"
        subtitle="Platform performance and business activity, counted from the data"
        actions={
          <>
            <Tabs value={range} onChange={setRange} items={RANGES} />
            <Button icon="refresh" onClick={reload}>
              Refresh
            </Button>
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorBlock error={error} onRetry={reload} />
        </Card>
      ) : (
        <>
          <div className="grid grid--stats" style={{ marginBottom: 16 }}>
            <StatCard
              label="New users"
              value={count(data?.newUsers ?? 0)}
              icon="users"
              tone="brand"
              hint={`last ${range} days`}
            />
            <StatCard
              label="Consultations"
              value={count(totals?.consultations ?? 0)}
              icon="chat"
              tone="lilac"
              hint={`${count(totals?.consultationMinutes ?? 0)} minutes`}
            />
            <StatCard
              label="Gross collections"
              value={shortMoney(totals?.grossCollections ?? 0)}
              icon="rupee"
              tone="success"
              hint="charged to wallets"
            />
            <StatCard
              label="Platform revenue"
              value={shortMoney(totals?.platformRevenue ?? 0)}
              icon="wallet"
              tone="yellow"
              hint="after astrologer payouts"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Card title="Consultation activity" subtitle="Sessions started per day">
              {loading && !data ? (
                <LoadingBlock />
              ) : activity.length === 0 ? (
                <p className="faint" style={{ fontSize: 12.5 }}>
                  No sessions in this window yet.
                </p>
              ) : (
                <AreaChart
                  data={activity}
                  height={216}
                  color="#1F2937"
                  fillFrom="rgba(31, 41, 55, 0.16)"
                />
              )}
            </Card>
          </div>

          <div className="grid grid--2" style={{ marginBottom: 16 }}>
            <Card title="Consultation volume" subtitle="Chat vs. voice, this week">
              {mix.length === 0 ? (
                <p className="faint" style={{ fontSize: 12.5 }}>
                  Nothing in the last seven days.
                </p>
              ) : (
                <BarChart data={mix} stacked={['chat', 'call']} height={170} />
              )}
            </Card>

            <Card title="Acquisition" subtitle="How users registered">
              {signups.length === 0 ? (
                <p className="faint" style={{ fontSize: 12.5 }}>
                  No new accounts in this window.
                </p>
              ) : (
                <div className="row" style={{ gap: 14 }}>
                  <DonutChart
                    data={signups}
                    size={128}
                    thickness={18}
                    centreValue={count(signupTotal)}
                    centreLabel="users"
                  />
                  <div className="donut-legend" style={{ flex: 1 }}>
                    {signups.map((slice) => (
                      <div
                        className="donut-legend__row"
                        key={slice.label}
                        style={{ fontSize: 11.5 }}
                      >
                        <span
                          className="chart-legend__swatch"
                          style={{ background: slice.color }}
                        />
                        {slice.label}
                        <span className="value">{slice.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid--sidebar">
            <Card title="What people ask about" subtitle={`Top topics, last ${range} days`}>
              {topics.length === 0 ? (
                <p className="faint" style={{ fontSize: 12.5 }}>
                  No topics recorded in this window.
                </p>
              ) : (
                <BarChart data={topics} stacked={['chat']} height={220} />
              )}
            </Card>

            <div className="stack">
              <Card title={`Last ${range} days`} subtitle="Business summary">
                {loading && !data ? (
                  <LoadingBlock />
                ) : (
                  <DetailList
                    rows={[
                      { label: 'New users', value: count(data?.newUsers ?? 0) },
                      { label: 'New astrologers', value: count(data?.newAstrologers ?? 0) },
                      { label: 'Consultations', value: count(totals?.consultations ?? 0) },
                      {
                        label: 'Consultation minutes',
                        value: count(totals?.consultationMinutes ?? 0),
                      },
                      { label: 'Gross collections', value: money(totals?.grossCollections ?? 0) },
                      { label: 'Astrologer payouts', value: money(totals?.astrologerPayouts ?? 0) },
                      { label: 'Platform revenue', value: money(totals?.platformRevenue ?? 0) },
                    ]}
                  />
                )}
              </Card>

              <Card title="Top astrologers" subtitle="By earnings in this window">
                <div className="stack" style={{ gap: 10 }}>
                  {(data?.topAstrologers ?? []).length === 0 && (
                    <p className="faint" style={{ fontSize: 12.5 }}>
                      No earnings recorded.
                    </p>
                  )}
                  {(data?.topAstrologers ?? []).map((row) => (
                    <div className="row row--between" key={row.id}>
                      <div>
                        <p style={{ fontSize: 12.5, fontWeight: 500 }}>{row.name}</p>
                        <p className="faint" style={{ fontSize: 11 }}>
                          {count(row.consultations)} consultations
                        </p>
                      </div>
                      <span className="mono strong">{money(row.earned)}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Note tone="info" icon="info">
                Every figure here is counted from the records themselves rather than kept as a
                running total, so a number on this page always matches what actually happened.
              </Note>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ReportsPage;
