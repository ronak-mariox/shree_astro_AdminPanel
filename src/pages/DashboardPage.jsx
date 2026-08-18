/** Platform overview — the first screen an admin lands on. */

import { BarChart, ChartLegend } from '../components/Charts';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import { Badge, Button, Card, Identity, Progress, StatCard, StatusBadge } from '../components/ui';
import {
  consultationMix,
  kpis,
  liveActivity,
  systemHealth,
  topAstrologers,
} from '../data/analytics';
import { astrologers } from '../data/people';
import { consultations } from '../data/operations';

const TONE_CLASS = {
  success: 'feed__icon--success',
  warning: 'feed__icon--warning',
  danger: 'feed__icon--danger',
  info: 'feed__icon--info',
  neutral: '',
};

export function DashboardPage({ onNavigate }) {
  const pending = astrologers.filter((item) => item.status === 'pending');
  const live = consultations.filter((item) => item.status === 'ongoing');

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle="Sunday, 17 August 2026 · everything running on the platform today"
        actions={
          <>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="shield" onClick={() => onNavigate('audit')}>
              Audit logs
            </Button>
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        {kpis.map((kpi) => (
          <StatCard key={kpi.key} {...kpi} />
        ))}
      </div>

      <div className="grid grid--sidebar" style={{ marginBottom: 16 }}>
        <Card
          title="Consultations this week"
          subtitle="Chat and voice sessions per day"
          action={<ChartLegend items={[{ label: 'Chat' }, { label: 'Voice' }]} />}
        >
          <BarChart data={consultationMix} stacked={['chat', 'call']} height={224} />
        </Card>

        <div className="stack">
          <Card
            title="Needs your attention"
            action={
              <Button size="sm" variant="quiet" iconRight="chevronRight" onClick={() => onNavigate('astrologers')}>
                Review
              </Button>
            }
          >
            <ul className="attention">
              <li>
                <span className="attention__count">{pending.length}</span>
                <span>
                  <strong>Astrologer applications</strong>
                  <span>Documents uploaded, awaiting verification</span>
                </span>
              </li>
              <li>
                <span className="attention__count">2</span>
                <span>
                  <strong>Payout requests</strong>
                  <span>₹81,800 payable across two astrologers</span>
                </span>
              </li>
            </ul>
          </Card>

          <Card
            title="Live now"
            subtitle={`${live.length} consultation in progress`}
            action={
              <Button size="sm" variant="quiet" iconRight="chevronRight" onClick={() => onNavigate('consultations')}>
                All
              </Button>
            }
          >
            <div className="stack" style={{ gap: 12 }}>
              {live.map((item) => (
                <div className="live-row" key={item.id}>
                  <span className="live-row__pulse" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="strong truncate">
                      {item.user} → {item.astrologer}
                    </p>
                    <p className="faint" style={{ fontSize: 11.5 }}>
                      {item.topic} · {item.duration}
                    </p>
                  </div>
                  <Badge tone={item.channel === 'call' ? 'lilac' : 'info'}>
                    {item.channel === 'call' ? 'Voice' : 'Chat'}
                  </Badge>
                </div>
              ))}
              <div className="live-summary">
                <div>
                  <p className="eyebrow">Avg. duration</p>
                  <p className="strong">17m 42s</p>
                </div>
                <div>
                  <p className="eyebrow">Answer rate</p>
                  <p className="strong">92%</p>
                </div>
                <div>
                  <p className="eyebrow">Avg. rating</p>
                  <p className="strong">4.7 ★</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid--sidebar">
        <Card title="Recent activity" subtitle="Across every module, newest first" flush>
          <ul className="feed">
            {liveActivity.map((item) => (
              <li key={item.id}>
                <button type="button" className="feed__row" onClick={() => onNavigate(item.action)}>
                  <span className={`feed__icon ${TONE_CLASS[item.tone] || ''}`}>
                    <Icon name={item.icon} size={16} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="feed__title">{item.title}</span>
                    <span className="feed__meta">{item.meta}</span>
                  </span>
                  <Icon name="chevronRight" size={15} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="stack">
          <Card
            title="Top astrologers"
            subtitle="By earnings this month"
            action={
              <Button size="sm" variant="quiet" iconRight="chevronRight" onClick={() => onNavigate('astrologers')}>
                All
              </Button>
            }
          >
            <div className="stack" style={{ gap: 14 }}>
              {topAstrologers.map((item) => (
                <div key={item.name}>
                  <div className="row row--between" style={{ marginBottom: 6 }}>
                    <Identity
                      name={item.name}
                      meta={`${item.consults.toLocaleString('en-IN')} consults · ${item.rating} ★`}
                      size="sm"
                    />
                    <span className="strong mono">₹{(item.earnings / 1000).toFixed(0)}k</span>
                  </div>
                  <Progress value={item.share} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="System health" subtitle="Backend APIs and integrations">
            <div className="stack" style={{ gap: 10 }}>
              {systemHealth.map((service) => (
                <div className="row row--between" key={service.label}>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500 }}>{service.label}</p>
                    <p className="faint" style={{ fontSize: 11 }}>
                      {service.latency} · {service.uptime} uptime
                    </p>
                  </div>
                  <StatusBadge status={service.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
