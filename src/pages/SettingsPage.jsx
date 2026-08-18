/**
 * Platform Administration — commission and pricing rules, the admin team and
 * their roles, integration keys, and the platform-wide switches.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Card,
  DetailList,
  Field,
  Identity,
  Input,
  Modal,
  Note,
  Select,
  StatusBadge,
  Tabs,
  ToggleRow,
} from '../components/ui';
import { adminTeam, rolePermissions } from '../data/analytics';

const TABS = [
  { key: 'platform', label: 'Platform' },
  { key: 'team', label: 'Admin team' },
  { key: 'integrations', label: 'Integrations' },
];

export function SettingsPage({ notify }) {
  const [tab, setTab] = useState('platform');
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'Content Manager' });
  const [switches, setSwitches] = useState({
    registrations: true,
    appleLogin: true,
    aiAssistant: true,
    voiceConsult: true,
    maintenance: false,
    autoApprove: false,
  });
  const [rates, setRates] = useState({
    commission: 70,
    minRecharge: 100,
    maxRecharge: 50000,
    minPayout: 1000,
    freeMinutes: 2,
  });

  const teamColumns = [
    {
      key: 'name',
      label: 'Member',
      sortable: true,
      render: (row) => <Identity name={row.name} meta={row.email} />,
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (row) => (
        <Badge tone={row.role === 'Super Admin' ? 'brand' : 'neutral'}>{row.role}</Badge>
      ),
    },
    { key: 'lastActive', label: 'Last active', sortable: true },
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
            { label: 'Edit', icon: 'edit', onClick: () => notify(`Editing ${row.name}`) },
            {
              label: 'Revoke access',
              icon: 'ban',
              variant: 'danger',
              onClick: () => notify(`Access revoked for ${row.name}`),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Platform Administration"
        subtitle="Commission, access control and the integrations the apps depend on"
        actions={
          <>
            <Tabs value={tab} onChange={setTab} items={TABS} />
            <Button variant="primary" icon="check" onClick={() => notify('Settings saved', { tone: 'success' })}>
              Save changes
            </Button>
          </>
        }
      />

      {tab === 'platform' && (
        <div className="grid grid--sidebar">
          <div className="stack">
            <Card title="Commission & pricing" subtitle="Applied to every new consultation">
              <div className="grid grid--3" style={{ gap: 14 }}>
                <Field label="Platform commission (%)" hint="Astrologer keeps the remainder">
                  <Input
                    type="number"
                    value={rates.commission}
                    onChange={(event) =>
                      setRates((current) => ({ ...current, commission: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Minimum recharge (₹)">
                  <Input
                    type="number"
                    value={rates.minRecharge}
                    onChange={(event) =>
                      setRates((current) => ({ ...current, minRecharge: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Maximum recharge (₹)">
                  <Input
                    type="number"
                    value={rates.maxRecharge}
                    onChange={(event) =>
                      setRates((current) => ({ ...current, maxRecharge: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Minimum payout (₹)">
                  <Input
                    type="number"
                    value={rates.minPayout}
                    onChange={(event) =>
                      setRates((current) => ({ ...current, minPayout: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Free trial minutes" hint="First consultation only">
                  <Input
                    type="number"
                    value={rates.freeMinutes}
                    onChange={(event) =>
                      setRates((current) => ({ ...current, freeMinutes: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Payout cycle">
                  <Select
                    options={['Weekly · Friday', 'Fortnightly', 'Monthly · 1st']}
                    defaultValue="Weekly · Friday"
                  />
                </Field>
              </div>

              <div style={{ marginTop: 16 }}>
                <Note tone="info" icon="info">
                  A change to commission applies to consultations started after saving.
                  Sessions already running keep the rate they began on.
                </Note>
              </div>
            </Card>

            <Card title="Feature switches" subtitle="Turn parts of the product on or off platform-wide">
              <ToggleRow
                title="New registrations"
                desc="Allow new users to create accounts on either app"
                on={switches.registrations}
                onChange={(value) => setSwitches((c) => ({ ...c, registrations: value }))}
              />
              <ToggleRow
                title="Apple sign-in"
                desc="Required by App Store review while other social logins are offered"
                on={switches.appleLogin}
                onChange={(value) => setSwitches((c) => ({ ...c, appleLogin: value }))}
              />
              <ToggleRow
                title="AI astrology assistant"
                desc="Third-party chat and voice guidance inside the customer app"
                on={switches.aiAssistant}
                onChange={(value) => setSwitches((c) => ({ ...c, aiAssistant: value }))}
              />
              <ToggleRow
                title="Voice consultations"
                desc="Paid voice calls between seekers and astrologers"
                on={switches.voiceConsult}
                onChange={(value) => setSwitches((c) => ({ ...c, voiceConsult: value }))}
              />
              <ToggleRow
                title="Auto-approve astrologers"
                desc="Skip manual document verification — not recommended"
                on={switches.autoApprove}
                onChange={(value) => setSwitches((c) => ({ ...c, autoApprove: value }))}
              />
              <ToggleRow
                title="Maintenance mode"
                desc="Show a maintenance screen in both apps and pause new sessions"
                on={switches.maintenance}
                onChange={(value) => setSwitches((c) => ({ ...c, maintenance: value }))}
              />
            </Card>
          </div>

          <div className="stack">
            <Card title="Current split" subtitle="On a ₹20/min chat consultation">
              <div className="split-preview">
                <div>
                  <p className="eyebrow">Astrologer</p>
                  <p className="split-preview__value">
                    ₹{((20 * (100 - rates.commission)) / 100).toFixed(2)}
                  </p>
                  <p className="faint" style={{ fontSize: 11.5 }}>
                    {100 - rates.commission}% per minute
                  </p>
                </div>
                <div className="split-preview__divider" />
                <div>
                  <p className="eyebrow">Platform</p>
                  <p className="split-preview__value">
                    ₹{((20 * rates.commission) / 100).toFixed(2)}
                  </p>
                  <p className="faint" style={{ fontSize: 11.5 }}>
                    {rates.commission}% per minute
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Role permissions" subtitle="What each role can reach">
              <div className="stack" style={{ gap: 12 }}>
                {rolePermissions.map((row) => (
                  <div key={row.role}>
                    <p className="strong">{row.role}</p>
                    <p className="faint" style={{ fontSize: 11.5 }}>
                      {row.scope}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="App versions" subtitle="Live in the stores">
              <DetailList
                rows={[
                  { label: 'Customer app (Android)', value: '2.4.1' },
                  { label: 'Customer app (iOS)', value: '2.4.0' },
                  { label: 'Astrologer app (Android)', value: '1.8.3' },
                  { label: 'Astrologer app (iOS)', value: '1.8.3' },
                  { label: 'Minimum supported', value: '2.0.0' },
                ]}
              />
            </Card>
          </div>
        </div>
      )}

      {tab === 'team' && (
        <div className="grid grid--sidebar">
          <DataTable
            columns={teamColumns}
            rows={adminTeam}
            searchKeys={['name', 'email', 'role']}
            searchPlaceholder="Search the admin team…"
            toolbarEnd={
              <Button size="sm" variant="primary" icon="plus" onClick={() => setInviting(true)}>
                Invite admin
              </Button>
            }
            empty={{ icon: 'users', title: 'No admin accounts' }}
          />

          <div className="stack">
            <Card title="Access policy" subtitle="Applies to every admin account">
              <ToggleRow title="Two-factor verification" desc="OTP on every sign-in" on onChange={() => {}} />
              <ToggleRow title="Session timeout" desc="Sign out after 30 minutes idle" on onChange={() => {}} />
              <ToggleRow title="IP allowlist" desc="Office and VPN ranges only" on={false} onChange={() => {}} />
            </Card>

            <Card title="Recent admin activity" subtitle="Audit trail">
              <div className="stack" style={{ gap: 12 }}>
                {[
                  { who: 'Vaibhav Mehra', what: 'Approved astrologer a-204', when: '2 hours ago' },
                  { who: 'Karan Doshi', what: 'Issued refund on pay_R7sE55fPtYg4', when: 'Yesterday' },
                  { who: 'Ritu Malhotra', what: 'Published 12 horoscopes', when: 'Yesterday' },
                  { who: 'Sara Pinto', what: 'Blocked user u-1030', when: '3 days ago' },
                ].map((row) => (
                  <div className="row" key={row.what} style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span className="feed__icon" style={{ width: 28, height: 28 }}>
                      <Icon name="shield" size={14} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5 }}>
                        <strong>{row.who}</strong> · {row.what}
                      </p>
                      <p className="faint" style={{ fontSize: 11 }}>
                        {row.when}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'integrations' && (
        <div className="grid grid--2">
          {[
            {
              name: 'Razorpay',
              desc: 'Payment gateway — orders, captures, refunds and settlements',
              status: 'active',
              icon: 'card',
              rows: [
                { label: 'Mode', value: 'Live' },
                { label: 'Key ID', value: 'rzp_live_••••8F2a' },
                { label: 'Webhook', value: 'Degraded · 1.8s' },
                { label: 'Settlement', value: 'T+2 days' },
              ],
            },
            {
              name: 'Firebase Cloud Messaging',
              desc: 'Push notifications to both applications',
              status: 'active',
              icon: 'bell',
              rows: [
                { label: 'Project', value: 'shree-astro-prod' },
                { label: 'Android devices', value: '31,240' },
                { label: 'iOS devices', value: '16,410' },
                { label: 'Delivery rate', value: '96.2%' },
              ],
            },
            {
              name: 'AI Astrology Assistant',
              desc: 'Third-party chat and voice guidance in the customer app',
              status: 'active',
              icon: 'sparkle',
              rows: [
                { label: 'Provider', value: 'Vertex partner API' },
                { label: 'Queries today', value: '8,412' },
                { label: 'Avg. latency', value: '1.2 s' },
                { label: 'Monthly quota', value: '68% used' },
              ],
            },
            {
              name: 'Kundli engine',
              desc: 'Chart generation, dashas, yogas and doshas',
              status: 'active',
              icon: 'horoscope',
              rows: [
                { label: 'Charts generated', value: '1,24,800' },
                { label: 'Ayanamsa', value: 'Lahiri' },
                { label: 'Avg. latency', value: '410 ms' },
                { label: 'Cache hit rate', value: '74%' },
              ],
            },
            {
              name: 'Google Sign-In',
              desc: 'Social authentication for the customer app',
              status: 'active',
              icon: 'globe',
              rows: [
                { label: 'Client ID', value: '••••.apps.googleusercontent.com' },
                { label: 'Sign-ins this month', value: '1,302' },
                { label: 'Share of registrations', value: '27%' },
              ],
            },
            {
              name: 'Apple Sign-In',
              desc: 'Social authentication required for iOS review',
              status: 'active',
              icon: 'user',
              rows: [
                { label: 'Service ID', value: 'com.shreeastro.signin' },
                { label: 'Sign-ins this month', value: '628' },
                { label: 'Share of registrations', value: '13%' },
              ],
            },
          ].map((integration) => (
            <Card
              key={integration.name}
              title={integration.name}
              subtitle={integration.desc}
              action={<StatusBadge status={integration.status} />}
              footer={
                <>
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    Last checked 2 minutes ago
                  </span>
                  <Button size="sm" icon="settings" onClick={() => notify(`${integration.name} settings`)}>
                    Configure
                  </Button>
                </>
              }
            >
              <DetailList rows={integration.rows} />
            </Card>
          ))}
        </div>
      )}

      {inviting && (
        <Modal
          title="Invite an admin"
          subtitle="They receive an email with a sign-in link and must set up two-factor verification"
          onClose={() => setInviting(false)}
          footer={
            <>
              <Button onClick={() => setInviting(false)}>Cancel</Button>
              <Button
                variant="primary"
                icon="send"
                disabled={!invite.name.trim() || !invite.email.includes('@')}
                onClick={() => {
                  notify(`Invitation sent to ${invite.email}`, { tone: 'success' });
                  setInviting(false);
                  setInvite({ name: '', email: '', role: 'Content Manager' });
                }}
              >
                Send invitation
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Field label="Full name">
              <Input
                placeholder="e.g. Ritu Malhotra"
                value={invite.name}
                onChange={(event) => setInvite((c) => ({ ...c, name: event.target.value }))}
              />
            </Field>
            <Field label="Work email">
              <Input
                icon="mail"
                type="email"
                placeholder="name@shreeastro.com"
                value={invite.email}
                onChange={(event) => setInvite((c) => ({ ...c, email: event.target.value }))}
              />
            </Field>
            <Field
              label="Role"
              hint={rolePermissions.find((row) => row.role === invite.role)?.scope}
            >
              <Select
                value={invite.role}
                onChange={(event) => setInvite((c) => ({ ...c, role: event.target.value }))}
                options={rolePermissions.map((row) => row.role)}
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SettingsPage;
