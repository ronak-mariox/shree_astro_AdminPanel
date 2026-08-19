/**
 * Platform Administration — the numbers and switches that govern the product,
 * and who is allowed into this console.
 *
 * The settings on this page are live: the recharge limits govern the very next
 * top-up, and the free trial minutes the very next consultation. Nothing here
 * needs a deploy.
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
  LoadingBlock,
  Modal,
  Note,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  ToggleRow,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  createAdmin,
  getSettings,
  listAdmins,
  listAuditLogs,
  listTickets,
  resolveTicket,
  revokeAdmin,
  updateAdmin,
  updateSettings,
} from '../services/admin';
import { can, getAdmin } from '../services/session';
import { dateTime, label, money, relative } from '../utils/format';

const TABS = [
  { key: 'platform', label: 'Platform' },
  { key: 'team', label: 'Admin team' },
  { key: 'support', label: 'Support' },
];

/** The roles the API accepts, with what each one is for. */
const ROLES = [
  { value: 'super_admin', label: 'Super Admin — everything, including the team' },
  { value: 'admin', label: 'Admin — everything except managing admins' },
  { value: 'finance', label: 'Finance — payments, wallets and payouts' },
  { value: 'support_lead', label: 'Support Lead — users and consultations' },
  { value: 'content_manager', label: 'Content Manager — the article library' },
  { value: 'consultation_manager', label: 'Consultation Manager — sessions and reports' },
  { value: 'user_manager', label: 'User Manager — user accounts only' },
];

const PAYOUT_CYCLES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

const BLANK_INVITE = { name: '', email: '', role: 'content_manager' };

export function SettingsPage({ notify }) {
  const [tab, setTab] = useState('platform');
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState(BLANK_INVITE);
  const [created, setCreated] = useState(null);
  const [answering, setAnswering] = useState(null);
  const [resolution, setResolution] = useState('');
  const [run, busy] = useAction(notify);

  /**
   * Unsaved edits, if any.
   *
   * The form is *derived* from what the API returned rather than copied into
   * state by an effect: `edits` is null until something is typed, and from then
   * on it is the whole form. No syncing, so the two can never disagree.
   */
  const [edits, setEdits] = useState(null);

  const settings = useApi(() => getSettings(), []);
  const team = useApi(() => listAdmins({ limit: 100 }), [], { skip: tab !== 'team' });
  const activity = useApi(() => listAuditLogs({ limit: 6 }), [], { skip: tab !== 'team' });
  const tickets = useApi(() => listTickets({ limit: 100 }), [], { skip: tab !== 'support' });

  const form = edits ?? settings.data?.settings ?? null;

  /** Every change starts from whatever is on screen right now. */
  const setForm = (change) =>
    setEdits((current) => {
      const base = current ?? settings.data?.settings;
      return typeof change === 'function' ? change(base) : change;
    });

  const canManage = can('settings.manage');
  const canManageTeam = can('admins.manage');
  const me = getAdmin();

  const setNumber = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const setSwitch = (key) => (value) =>
    setForm((current) => ({ ...current, features: { ...current.features, [key]: value } }));

  const save = () =>
    run(
      () =>
        updateSettings({
          commissionPercent: Number(form.commissionPercent),
          minRecharge: Number(form.minRecharge),
          maxRecharge: Number(form.maxRecharge),
          minPayout: Number(form.minPayout),
          freeTrialMinutes: Number(form.freeTrialMinutes),
          payoutCycle: form.payoutCycle,
          features: form.features,
        }),
      {
        success: 'Settings saved',
        onDone: async (result) => {
          /** Drop the local edits and go back to reading the saved values. */
          setEdits(null);
          if (result?.settings) await settings.reload();
        },
      },
    );

  const sendInvite = () =>
    run(() => createAdmin({ name: invite.name.trim(), email: invite.email.trim(), role: invite.role }), {
      onDone: async (result) => {
        if (!result) return;
        setInviting(false);
        setInvite(BLANK_INVITE);
        /** The password is shown once and never again, so hold it on screen. */
        setCreated(result);
        await team.reload();
      },
    });

  const changeRole = (member, role) =>
    run(() => updateAdmin(member.id, { role }), {
      success: `${member.name} is now ${label(role)}`,
      onDone: team.reload,
    });

  const revoke = (member) =>
    run(() => revokeAdmin(member.id), {
      success: `Access revoked for ${member.name}`,
      onDone: team.reload,
    });

  const answerTicket = () =>
    run(() => resolveTicket(answering._id, { status: 'resolved', resolution: resolution.trim() }), {
      success: 'Ticket resolved',
      onDone: async () => {
        setAnswering(null);
        setResolution('');
        await tickets.reload();
      },
    });

  const commission = Number(form?.commissionPercent ?? 0);

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
        <Badge tone={row.role === 'super_admin' ? 'brand' : 'neutral'}>{label(row.role)}</Badge>
      ),
    },
    {
      key: 'lastActive',
      label: 'Last active',
      sortable: true,
      render: (row) => relative(row.lastActive),
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
      render: (row) =>
        canManageTeam && row.id !== me?.id ? (
          <RowActions
            actions={[
              ...ROLES.filter((role) => role.value !== row.role)
                .slice(0, 3)
                .map((role) => ({
                  label: `Make ${label(role.value)}`,
                  icon: 'edit',
                  onClick: () => changeRole(row, role.value),
                })),
              {
                label: 'Revoke access',
                icon: 'ban',
                variant: 'danger',
                onClick: () => revoke(row),
              },
            ]}
          />
        ) : null,
    },
  ];

  const ticketColumns = [
    {
      key: 'reference',
      label: 'Ticket',
      render: (row) => (
        <div style={{ maxWidth: 360 }}>
          <p className="strong truncate">{row.description}</p>
          <p className="faint" style={{ fontSize: 11.5 }}>
            {row.reference} · {label(row.issueType)} · {label(row.ownerRole)}
          </p>
        </div>
      ),
    },
    {
      key: 'ownerName',
      label: 'Raised by',
      sortable: true,
      render: (row) => <Identity name={row.ownerName || 'Unknown'} size="sm" />,
    },
    {
      key: 'createdAt',
      label: 'When',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => dateTime(row.createdAt),
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
      render: (row) =>
        row.status !== 'resolved' && row.status !== 'closed' ? (
          <RowActions
            actions={[
              {
                label: 'Answer',
                icon: 'check',
                variant: 'success',
                onClick: () => {
                  setAnswering(row);
                  setResolution('');
                },
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Platform Administration"
        subtitle="Commission, access control and the switches the apps read"
        actions={
          <>
            <Tabs value={tab} onChange={setTab} items={TABS} />
            {tab === 'platform' && canManage && (
              <Button variant="primary" icon="check" disabled={busy || !form} onClick={save}>
                Save changes
              </Button>
            )}
          </>
        }
      />

      {tab === 'platform' &&
        (!form ? (
          <Card>
            <LoadingBlock />
          </Card>
        ) : (
          <div className="grid grid--sidebar">
            <div className="stack">
              <Card title="Commission & pricing" subtitle="Read live on every money path">
                <div className="grid grid--3" style={{ gap: 14 }}>
                  <Field label="Platform commission (%)" hint="Astrologer keeps the remainder">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={form.commissionPercent}
                      onChange={setNumber('commissionPercent')}
                    />
                  </Field>
                  <Field label="Minimum recharge (₹)">
                    <Input type="number" min="1" value={form.minRecharge} onChange={setNumber('minRecharge')} />
                  </Field>
                  <Field label="Maximum recharge (₹)">
                    <Input type="number" min="1" value={form.maxRecharge} onChange={setNumber('maxRecharge')} />
                  </Field>
                  <Field label="Minimum payout (₹)">
                    <Input type="number" min="1" value={form.minPayout} onChange={setNumber('minPayout')} />
                  </Field>
                  <Field label="Free trial minutes" hint="First consultation only">
                    <Input
                      type="number"
                      min="0"
                      value={form.freeTrialMinutes}
                      onChange={setNumber('freeTrialMinutes')}
                    />
                  </Field>
                  <Field label="Payout cycle">
                    <Select
                      value={form.payoutCycle}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, payoutCycle: event.target.value }))
                      }
                      options={PAYOUT_CYCLES}
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 16 }}>
                  <Note tone="info" icon="info">
                    Commission is fixed onto a consultation when it is requested, so a change
                    here applies to sessions started after saving. Sessions already running
                    keep the rate they began on.
                  </Note>
                </div>
              </Card>

              <Card title="Feature switches" subtitle="Turn parts of the product on or off platform-wide">
                <ToggleRow
                  title="New registrations"
                  desc="Allow new accounts to be created on either app"
                  on={form.features.registrationsOpen}
                  onChange={setSwitch('registrationsOpen')}
                />
                <ToggleRow
                  title="Apple sign-in"
                  desc="Required by App Store review while other social logins are offered"
                  on={form.features.appleSignIn}
                  onChange={setSwitch('appleSignIn')}
                />
                <ToggleRow
                  title="Google sign-in"
                  desc="Sign in with a Google account on either app"
                  on={form.features.googleSignIn}
                  onChange={setSwitch('googleSignIn')}
                />
                <ToggleRow
                  title="AI astrology assistant"
                  desc="The chat assistant inside the customer app"
                  on={form.features.aiAssistant}
                  onChange={setSwitch('aiAssistant')}
                />
                <ToggleRow
                  title="Voice consultations"
                  desc="Paid voice calls between seekers and astrologers"
                  on={form.features.voiceConsultations}
                  onChange={setSwitch('voiceConsultations')}
                />
                <ToggleRow
                  title="Auto-approve astrologers"
                  desc="Skip manual document verification — not recommended"
                  on={form.features.autoApproveAstrologers}
                  onChange={setSwitch('autoApproveAstrologers')}
                />
                <ToggleRow
                  title="Admin two-factor"
                  desc="A code to the admin's inbox on every sign-in to this console"
                  on={form.features.adminTwoFactor}
                  onChange={setSwitch('adminTwoFactor')}
                />
                <ToggleRow
                  title="Maintenance mode"
                  desc="Show a maintenance screen in both apps and pause new sessions"
                  on={form.features.maintenanceMode}
                  onChange={setSwitch('maintenanceMode')}
                />
              </Card>
            </div>

            <div className="stack">
              <Card title="Current split" subtitle="On a ₹20/min chat consultation">
                <div className="split-preview">
                  <div>
                    <p className="eyebrow">Astrologer</p>
                    <p className="split-preview__value">
                      {money(((20 * (100 - commission)) / 100).toFixed(2))}
                    </p>
                    <p className="faint" style={{ fontSize: 11.5 }}>
                      {100 - commission}% per minute
                    </p>
                  </div>
                  <div className="split-preview__divider" />
                  <div>
                    <p className="eyebrow">Platform</p>
                    <p className="split-preview__value">
                      {money(((20 * commission) / 100).toFixed(2))}
                    </p>
                    <p className="faint" style={{ fontSize: 11.5 }}>
                      {commission}% per minute
                    </p>
                  </div>
                </div>
              </Card>

              <Card title="App versions" subtitle="What the apps check themselves against">
                <DetailList
                  rows={[
                    { label: 'Customer app (Android)', value: form.appVersions.userAndroid },
                    { label: 'Customer app (iOS)', value: form.appVersions.userIos },
                    { label: 'Astrologer app (Android)', value: form.appVersions.astrologerAndroid },
                    { label: 'Astrologer app (iOS)', value: form.appVersions.astrologerIos },
                    { label: 'Minimum supported', value: form.appVersions.minimumSupported },
                  ]}
                />
              </Card>

              <Card title="Support contact" subtitle="Shown in both apps">
                <DetailList
                  rows={[
                    { label: 'Email', value: form.supportEmail || '—' },
                    { label: 'Phone', value: form.supportPhone || '—' },
                  ]}
                />
              </Card>
            </div>
          </div>
        ))}

      {tab === 'team' && (
        <div className="grid grid--sidebar">
          <DataTable
            columns={teamColumns}
            rows={team.data?.items ?? []}
            loading={team.loading}
            error={team.error}
            onRetry={team.reload}
            searchKeys={['name', 'email', 'role']}
            searchPlaceholder="Search the admin team…"
            toolbarEnd={
              canManageTeam ? (
                <Button size="sm" variant="primary" icon="plus" onClick={() => setInviting(true)}>
                  Add admin
                </Button>
              ) : undefined
            }
            empty={{ icon: 'users', title: 'No admin accounts' }}
          />

          <div className="stack">
            <Card title="Access policy" subtitle="Applies to every admin account">
              <ToggleRow
                title="Two-factor verification"
                desc="A code on every sign-in — change it on the Platform tab"
                on={Boolean(settings.data?.settings?.features?.adminTwoFactor)}
                onChange={() => notify('Change this on the Platform tab')}
              />
              <div style={{ padding: '12px 0 2px' }}>
                <Note tone="info" icon="info">
                  Revoking access suspends the account rather than deleting it — audit rows
                  point at it, and a log that names a missing admin is worth less.
                </Note>
              </div>
            </Card>

            <Card title="Recent admin activity" subtitle="Audit trail">
              <div className="stack" style={{ gap: 12 }}>
                {activity.loading && <LoadingBlock />}
                {(activity.data?.items ?? []).map((row) => (
                  <div className="row" key={row._id} style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span className="feed__icon" style={{ width: 28, height: 28 }}>
                      <Icon name="shield" size={14} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5 }}>
                        <strong>{row.adminName}</strong> · {row.action}
                      </p>
                      <p className="faint" style={{ fontSize: 11 }}>
                        {relative(row.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'support' && (
        <DataTable
          columns={ticketColumns}
          rows={tickets.data?.items ?? []}
          loading={tickets.loading}
          error={tickets.error}
          onRetry={tickets.reload}
          searchKeys={['reference', 'description', 'ownerName']}
          searchPlaceholder="Search tickets…"
          empty={{ icon: 'inbox', title: 'No support tickets' }}
        />
      )}

      {inviting && (
        <Modal
          title="Add an admin"
          subtitle="They sign in with a temporary password you hand over"
          onClose={() => setInviting(false)}
          footer={
            <>
              <Button onClick={() => setInviting(false)}>Cancel</Button>
              <Button
                variant="primary"
                icon="check"
                disabled={busy || !/^\S+@\S+\.\S+$/.test(invite.email.trim())}
                onClick={sendInvite}
              >
                Create account
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Field label="Full name">
              <Input
                placeholder="e.g. Karan Doshi"
                value={invite.name}
                onChange={(event) => setInvite((c) => ({ ...c, name: event.target.value }))}
              />
            </Field>
            <Field label="Email address">
              <Input
                type="email"
                placeholder="name@shreeastro.com"
                value={invite.email}
                onChange={(event) => setInvite((c) => ({ ...c, email: event.target.value }))}
              />
            </Field>
            <Field label="Role" hint="What they can reach in this console">
              <Select
                value={invite.role}
                onChange={(event) => setInvite((c) => ({ ...c, role: event.target.value }))}
                options={ROLES}
              />
            </Field>
          </div>
        </Modal>
      )}

      {created && (
        <Modal
          title="Account created"
          subtitle={created.admin.email}
          onClose={() => setCreated(null)}
          footer={<Button variant="primary" onClick={() => setCreated(null)}>Done</Button>}
        >
          <div className="stack" style={{ gap: 14 }}>
            <Note tone="warning" icon="alert">
              This password is stored only as a hash, so this is the one and only time it can
              be read. Hand it over now and let them change it.
            </Note>
            <DetailList
              rows={[
                { label: 'Email', value: created.admin.email },
                { label: 'Temporary password', value: created.temporaryPassword },
                { label: 'Role', value: label(created.admin.role) },
              ]}
            />
          </div>
        </Modal>
      )}

      {answering && (
        <Modal
          title={`Answer ${answering.reference}`}
          subtitle={`${label(answering.issueType)} · raised by ${answering.ownerName || 'a user'}`}
          onClose={() => setAnswering(null)}
          footer={
            <>
              <Button onClick={() => setAnswering(null)}>Cancel</Button>
              <Button
                variant="primary"
                icon="check"
                disabled={busy || resolution.trim().length < 4}
                onClick={answerTicket}
              >
                Mark resolved
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <Note tone="info" icon="info">
              {answering.description}
            </Note>
            <Field label="Your answer" hint="Sent to them as a notification">
              <Textarea
                placeholder="e.g. Your payout was released today and should arrive within 48 hours."
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SettingsPage;
