/** Platform overview — the first screen an admin lands on. */

import { BarChart, ChartLegend } from '../components/Charts';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Card,
  ErrorBlock,
  Identity,
  LoadingBlock,
  Progress,
  StatCard,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import {
  getDashboard,
  getReports,
  listAstrologers,
  listConsultations,
  listWithdrawals,
} from '../services/admin';
import { count, duration, label, money, shortMoney } from '../utils/format';

/** Today, as the subtitle prints it. */
const today = () =>
  new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export function DashboardPage({ onNavigate }) {
  const summary = useApi(() => getDashboard(7), []);
  const reports = useApi(() => getReports(30), []);
  const live = useApi(() => listConsultations({ status: 'active', limit: 5 }), []);
  const pending = useApi(
    () => listAstrologers({ applicationStatus: 'under_review', limit: 5 }),
    [],
  );
  const payouts = useApi(() => listWithdrawals({ status: 'pending', limit: 20 }), []);

  const data = summary.data;
  const liveRows = live.data?.items ?? [];
  const pendingRows = pending.data?.items ?? [];
  const payoutRows = payouts.data?.items ?? [];
  const payable = payoutRows.reduce((sum, row) => sum + row.amount, 0);

  /**
   * The API answers with one row per day per channel; the chart wants one row
   * per day with both channels on it.
   */
  const mix = (() => {
    const byDay = new Map();
    for (const row of data?.consultationMix ?? []) {
      const day = row._id.day;
      const entry = byDay.get(day) || { label: day.slice(5), chat: 0, call: 0 };
      entry[row._id.channel === 'call' ? 'call' : 'chat'] += row.count;
      byDay.set(day, entry);
    }
    return [...byDay.values()];
  })();

  const kpis = data
    ? [
        {
          key: 'users',
          label: 'Total Users',
          value: count(data.users.total),
          icon: 'users',
          tone: 'brand',
          delta: `+${count(data.users.newThisMonth)}`,
          deltaTone: 'up',
          hint: 'new this month',
        },
        {
          key: 'astrologers',
          label: 'Active Astrologers',
          value: count(data.astrologers.active),
          icon: 'sparkle',
          tone: 'yellow',
          delta: `${data.astrologers.pendingApplications} pending`,
          deltaTone: 'flat',
          hint: 'awaiting approval',
        },
        {
          key: 'consultations',
          label: 'Consultations Today',
          value: count(data.consultations.today),
          icon: 'chat',
          tone: 'lilac',
          delta: `${data.consultations.ongoing} live`,
          deltaTone: 'flat',
          hint: 'running now',
        },
        {
          key: 'revenue',
          label: 'Revenue (MTD)',
          value: shortMoney(data.revenue.platformThisMonth),
          icon: 'rupee',
          tone: 'success',
          delta: shortMoney(data.revenue.chargedThisMonth),
          deltaTone: 'up',
          hint: 'collected this month',
        },
      ]
    : [];

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle={`${today()} · everything running on the platform today`}
        actions={
          <>
            <Button icon="refresh" onClick={summary.reload}>
              Refresh
            </Button>
            <Button variant="primary" icon="shield" onClick={() => onNavigate('audit')}>
              Audit logs
            </Button>
          </>
        }
      />

      {summary.error ? (
        <Card>
          <ErrorBlock error={summary.error} onRetry={summary.reload} />
        </Card>
      ) : (
        <>
          <div className="grid grid--stats" style={{ marginBottom: 16 }}>
            {summary.loading && !data
              ? Array.from({ length: 4 }, (_, index) => (
                  <StatCard key={index} label="Loading…" value="—" icon="activity" />
                ))
              : kpis.map((kpi) => <StatCard key={kpi.key} {...kpi} />)}
          </div>

          <div className="grid grid--sidebar" style={{ marginBottom: 16 }}>
            <Card
              title="Consultations this week"
              subtitle="Chat and voice sessions per day"
              action={<ChartLegend items={[{ label: 'Chat' }, { label: 'Voice' }]} />}
            >
              {summary.loading && !data ? (
                <LoadingBlock />
              ) : mix.length === 0 ? (
                <p className="faint" style={{ fontSize: 12.5 }}>
                  No consultations in the last seven days yet.
                </p>
              ) : (
                <BarChart data={mix} stacked={['chat', 'call']} height={224} />
              )}
            </Card>

            <div className="stack">
              <Card
                title="Needs your attention"
                action={
                  <Button
                    size="sm"
                    variant="quiet"
                    iconRight="chevronRight"
                    onClick={() => onNavigate('astrologers')}
                  >
                    Review
                  </Button>
                }
              >
                <ul className="attention">
                  <li>
                    <span className="attention__count">
                      {data?.astrologers.pendingApplications ?? 0}
                    </span>
                    <span>
                      <strong>Astrologer applications</strong>
                      <span>Documents uploaded, awaiting verification</span>
                    </span>
                  </li>
                  <li>
                    <span className="attention__count">{payoutRows.length}</span>
                    <span>
                      <strong>Payout requests</strong>
                      <span>
                        {payable ? `${money(payable)} payable` : 'Nothing waiting right now'}
                      </span>
                    </span>
                  </li>
                </ul>
              </Card>

              <Card
                title="Live now"
                subtitle={`${liveRows.length} consultation${
                  liveRows.length === 1 ? '' : 's'
                } in progress`}
                action={
                  <Button
                    size="sm"
                    variant="quiet"
                    iconRight="chevronRight"
                    onClick={() => onNavigate('consultations')}
                  >
                    All
                  </Button>
                }
              >
                <div className="stack" style={{ gap: 12 }}>
                  {liveRows.length === 0 && (
                    <p className="faint" style={{ fontSize: 12.5 }}>
                      Nothing running at the moment.
                    </p>
                  )}
                  {liveRows.map((item) => (
                    <div className="live-row" key={item.id}>
                      <span className="live-row__pulse" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="strong truncate">
                          {item.user} → {item.astrologer}
                        </p>
                        <p className="faint" style={{ fontSize: 11.5 }}>
                          {label(item.topic) || 'General'} · {duration(item.durationSeconds)}
                        </p>
                      </div>
                      <Badge tone={item.channel === 'call' ? 'lilac' : 'info'}>
                        {item.channel === 'call' ? 'Voice' : 'Chat'}
                      </Badge>
                    </div>
                  ))}

                  {reports.data && (
                    <div className="live-summary">
                      <div>
                        <p className="eyebrow">Consultations</p>
                        <p className="strong">{count(reports.data.summary.consultations)}</p>
                      </div>
                      <div>
                        <p className="eyebrow">Minutes</p>
                        <p className="strong">
                          {count(reports.data.summary.consultationMinutes)}
                        </p>
                      </div>
                      <div>
                        <p className="eyebrow">Collected</p>
                        <p className="strong">
                          {shortMoney(reports.data.summary.grossCollections)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          <div className="grid grid--sidebar">
            <Card
              title="Applications waiting"
              subtitle="Newest first"
              action={
                <Button
                  size="sm"
                  variant="quiet"
                  iconRight="chevronRight"
                  onClick={() => onNavigate('astrologers')}
                >
                  All
                </Button>
              }
            >
              <div className="stack" style={{ gap: 12 }}>
                {pending.loading && <LoadingBlock />}
                {!pending.loading && pendingRows.length === 0 && (
                  <p className="faint" style={{ fontSize: 12.5 }}>
                    Nothing waiting on you right now.
                  </p>
                )}
                {pendingRows.map((row) => (
                  <div className="row row--between" key={row.id}>
                    <Identity
                      name={row.name}
                      meta={label(row.expertise) || row.email}
                      size="sm"
                    />
                    <Badge tone="warning">Under review</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <div className="stack">
              <Card
                title="Top astrologers"
                subtitle="By earnings this month"
                action={
                  <Button
                    size="sm"
                    variant="quiet"
                    iconRight="chevronRight"
                    onClick={() => onNavigate('astrologers')}
                  >
                    All
                  </Button>
                }
              >
                <div className="stack" style={{ gap: 14 }}>
                  {reports.loading && <LoadingBlock />}
                  {!reports.loading && (reports.data?.topAstrologers ?? []).length === 0 && (
                    <p className="faint" style={{ fontSize: 12.5 }}>
                      No earnings recorded this month.
                    </p>
                  )}
                  {(reports.data?.topAstrologers ?? []).slice(0, 5).map((item, index, list) => (
                    <div key={item.id}>
                      <div className="row row--between" style={{ marginBottom: 6 }}>
                        <Identity
                          name={item.name}
                          meta={`${count(item.consultations)} consults`}
                          size="sm"
                        />
                        <span className="strong mono">{shortMoney(item.earned)}</span>
                      </div>
                      <Progress
                        value={
                          list[0].earned ? Math.round((item.earned / list[0].earned) * 100) : 0
                        }
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="How people signed up" subtitle="Last 30 days">
                <div className="stack" style={{ gap: 10 }}>
                  {(reports.data?.signupSplit ?? []).length === 0 && (
                    <p className="faint" style={{ fontSize: 12.5 }}>
                      No new accounts in this window.
                    </p>
                  )}
                  {(reports.data?.signupSplit ?? []).map((row) => (
                    <div className="row row--between" key={row.provider}>
                      <p style={{ fontSize: 12.5, fontWeight: 500 }}>
                        {label(row.provider === 'otp' ? 'Mobile OTP' : row.provider)}
                      </p>
                      <span className="mono strong">{count(row.count)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;
