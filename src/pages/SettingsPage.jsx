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
  getSettings,
  listTickets,
  resolveTicket,
  updateSettings,
} from '../services/admin';
import { can } from '../services/session';
import { dateTime, label, money } from '../utils/format';

const TABS = [
  { key: 'platform', label: 'Platform' },
  { key: 'thirdParty', label: 'Third parties' },
  { key: 'support', label: 'Support' },
];

/** The integrations with a dedicated credentials form. Each field left blank on save keeps its current value. */
const THIRD_PARTY_PROVIDERS = [
  {
    key: 'apple',
    name: 'Apple Sign-In',
    icon: 'lock',
    subtitle: 'Sign in with Apple for the customer and astrologer apps',
    fields: [
      { key: 'serviceId', label: 'Service ID (Client ID)', placeholder: 'com.shreeastro.app.service' },
      { key: 'teamId', label: 'Team ID', placeholder: 'e.g., ABCDE12345' },
      { key: 'keyId', label: 'Key ID', placeholder: 'e.g., XYZ987WQ12' },
      {
        key: 'privateKey',
        label: 'Private Key (.p8)',
        placeholder: 'Paste the contents of the AuthKey_XXXX.p8 file',
        secret: true,
        multiline: true,
      },
    ],
  },
  {
    key: 'email',
    name: 'Email (SMTP)',
    icon: 'mail',
    subtitle: 'Configure SMTP for transactional emails',
    fields: [
      { key: 'host', label: 'SMTP Host', placeholder: 'e.g., smtp.gmail.com' },
      { key: 'port', label: 'Port', placeholder: 'e.g., 587' },
      { key: 'username', label: 'Username / Email', placeholder: 'e.g., noreply@shreeastro.com' },
      { key: 'password', label: 'Password / App Password', placeholder: 'Enter email password or app password', secret: true },
    ],
  },
  {
    key: 'sms',
    name: 'SMS (MSG91)',
    icon: 'phone',
    subtitle: 'Configure MSG91 for OTP and transactional SMS',
    fields: [
      { key: 'authKey', label: 'Auth Key', placeholder: 'Enter MSG91 Auth Key', secret: true },
      { key: 'templateId', label: 'OTP Template ID', placeholder: 'Enter approved MSG91 OTP Template ID' },
      { key: 'senderId', label: 'Sender ID', placeholder: 'Enter 6-letter Sender ID (e.g., SHRAST)' },
    ],
  },
  {
    key: 'awsS3',
    name: 'AWS S3',
    icon: 'file',
    subtitle: 'Storage for uploaded documents, avatars and article images',
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', placeholder: 'e.g., AKIAxxxxxxxxxxxx' },
      { key: 'secretAccessKey', label: 'Secret Access Key', placeholder: 'Enter secret access key', secret: true },
      { key: 'bucket', label: 'Bucket Name', placeholder: 'e.g., shree-astro-uploads' },
      { key: 'region', label: 'Region', placeholder: 'e.g., ap-south-1' },
    ],
  },
  {
    key: 'firebase',
    name: 'Firebase',
    icon: 'zap',
    subtitle: 'Push notifications and analytics for both apps',
    fields: [
      { key: 'projectId', label: 'Project ID', placeholder: 'e.g., shree-astro-12345' },
      { key: 'serverKey', label: 'Cloud Messaging Server Key', placeholder: 'Enter FCM server key', secret: true },
      { key: 'senderId', label: 'Sender ID', placeholder: 'e.g., 1234567890' },
    ],
  },
];

/** First 4 and last 2 characters, so a saved credential can be recognised without being readable. */
function maskValue(value) {
  if (!value) return '—';
  if (value.length > 6) return `${value.slice(0, 4)}${'*'.repeat(4)}${value.slice(-2)}`;
  return '*'.repeat(Math.max(value.length, 4));
}

/** What kind of service a custom (not pre-listed) third party plugs into. */
const THIRD_PARTY_CATEGORIES = [
  { value: 'payment_gateway', label: 'Payment Gateway' },
  { value: 'sms_otp', label: 'SMS / OTP Provider' },
  { value: 'push_notifications', label: 'Push Notifications' },
  { value: 'email', label: 'Email Provider' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'other', label: 'Other' },
];

const PAYOUT_CYCLES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

const BLANK_THIRD_PARTY = {
  name: '',
  category: THIRD_PARTY_CATEGORIES[0].value,
  identifier: '',
  enabled: true,
  notes: '',
};

export function SettingsPage({ notify }) {
  const [tab, setTab] = useState('platform');
  const [providerData, setProviderData] = useState(() =>
    Object.fromEntries(
      THIRD_PARTY_PROVIDERS.map((provider) => [provider.key, { enabled: false, values: {}, updatedAt: null }]),
    ),
  );
  const [configuring, setConfiguring] = useState(null);
  const [providerForm, setProviderForm] = useState({});
  const [revealed, setRevealed] = useState({});
  const [thirdParties, setThirdParties] = useState([]);
  const [thirdPartyModal, setThirdPartyModal] = useState(null);
  const [thirdPartyForm, setThirdPartyForm] = useState(BLANK_THIRD_PARTY);
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
  const tickets = useApi(() => listTickets({ limit: 100 }), [], { skip: tab !== 'support' });

  const form = edits ?? settings.data?.settings ?? null;

  /** Every change starts from whatever is on screen right now. */
  const setForm = (change) =>
    setEdits((current) => {
      const base = current ?? settings.data?.settings;
      return typeof change === 'function' ? change(base) : change;
    });

  const canManage = can('settings.manage');

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

  const openConfigure = (providerKey) => {
    setProviderForm({});
    setRevealed({});
    setConfiguring(providerKey);
  };

  const saveProviderConfig = () => {
    const provider = THIRD_PARTY_PROVIDERS.find((item) => item.key === configuring);
    setProviderData((current) => ({
      ...current,
      [configuring]: {
        enabled: true,
        values: { ...current[configuring].values, ...providerForm },
        updatedAt: new Date().toISOString(),
      },
    }));
    notify(`${provider.name} configuration saved`);
    setConfiguring(null);
  };

  const openAddThirdParty = () => {
    setThirdPartyForm(BLANK_THIRD_PARTY);
    setThirdPartyModal('add');
  };

  const openEditThirdParty = (row) => {
    setThirdPartyForm({
      name: row.name,
      category: row.category,
      identifier: row.identifier,
      enabled: row.enabled,
      notes: row.notes,
    });
    setThirdPartyModal(row.id);
  };

  const saveThirdParty = () => {
    if (thirdPartyModal === 'add') {
      setThirdParties((current) => [
        ...current,
        { id: crypto.randomUUID(), ...thirdPartyForm, name: thirdPartyForm.name.trim() },
      ]);
      notify('Third party added');
    } else {
      setThirdParties((current) =>
        current.map((item) =>
          item.id === thirdPartyModal
            ? { ...item, ...thirdPartyForm, name: thirdPartyForm.name.trim() }
            : item,
        ),
      );
      notify('Third party updated');
    }
    setThirdPartyModal(null);
  };

  const removeThirdParty = (row) => {
    setThirdParties((current) => current.filter((item) => item.id !== row.id));
    notify(`${row.name} removed`);
  };

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

  const thirdPartyColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <Identity
          name={row.name}
          meta={THIRD_PARTY_CATEGORIES.find((c) => c.value === row.category)?.label}
        />
      ),
    },
    {
      key: 'identifier',
      label: 'Identifier',
      render: (row) => <span className="mono faint">{row.identifier || '—'}</span>,
    },
    {
      key: 'enabled',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.enabled ? 'active' : 'inactive'} />,
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (row) => <span className="faint truncate">{row.notes || '—'}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) =>
        canManage ? (
          <RowActions
            actions={[
              { label: 'Edit', icon: 'edit', onClick: () => openEditThirdParty(row) },
              {
                label: 'Remove',
                icon: 'ban',
                variant: 'danger',
                onClick: () => removeThirdParty(row),
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

      {tab === 'thirdParty' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid--3" style={{ gap: 14 }}>
            {THIRD_PARTY_PROVIDERS.map((provider) => {
              const state = providerData[provider.key];
              return (
                <Card key={provider.key} title={provider.name} subtitle={provider.subtitle}>
                  <div className="row row--between" style={{ marginBottom: 12 }}>
                    <StatusBadge status={state.enabled ? 'active' : 'inactive'} />
                    {canManage && (
                      <Button size="sm" icon="edit" onClick={() => openConfigure(provider.key)}>
                        {state.enabled ? 'Update' : 'Configure'}
                      </Button>
                    )}
                  </div>
                  {state.enabled ? (
                    <DetailList
                      rows={[
                        ...provider.fields.map((field) => ({
                          label: field.label,
                          value: maskValue(state.values[field.key]),
                        })),
                        { label: 'Last updated', value: dateTime(state.updatedAt) },
                      ]}
                    />
                  ) : (
                    <Note tone="info" icon="info">
                      Not configured yet.
                    </Note>
                  )}
                </Card>
              );
            })}
          </div>

          <Card title="Other third parties" subtitle="Anything not listed above">
            <DataTable
              columns={thirdPartyColumns}
              rows={thirdParties}
              searchKeys={['name', 'identifier']}
              searchPlaceholder="Search third parties…"
              toolbarEnd={
                canManage ? (
                  <Button size="sm" variant="primary" icon="plus" onClick={openAddThirdParty}>
                    Add third party
                  </Button>
                ) : undefined
              }
              empty={{ icon: 'api', title: 'No other third parties added yet' }}
            />
          </Card>
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

      {configuring && (() => {
        const provider = THIRD_PARTY_PROVIDERS.find((item) => item.key === configuring);
        return (
          <Modal
            title={`${providerData[configuring].enabled ? 'Update' : 'Configure'} ${provider.name}`}
            subtitle="Credentials are stored securely and are not shown again after saving"
            onClose={() => setConfiguring(null)}
            footer={
              <>
                <Button onClick={() => setConfiguring(null)}>Cancel</Button>
                <Button variant="primary" icon="check" onClick={saveProviderConfig}>
                  Save configuration
                </Button>
              </>
            }
          >
            <div className="stack" style={{ gap: 16 }}>
              <Note tone="info" icon="info">
                Fields left blank keep their current saved value.
              </Note>
              {provider.fields.map((field) => (
                <Field key={field.key} label={field.label}>
                  {field.multiline ? (
                    <Textarea
                      placeholder={field.placeholder}
                      value={providerForm[field.key] || ''}
                      onChange={(event) =>
                        setProviderForm((c) => ({ ...c, [field.key]: event.target.value }))
                      }
                    />
                  ) : (
                    <Input
                      type={field.secret && !revealed[field.key] ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={providerForm[field.key] || ''}
                      onChange={(event) =>
                        setProviderForm((c) => ({ ...c, [field.key]: event.target.value }))
                      }
                      action={
                        field.secret ? (
                          <button
                            type="button"
                            className="input-group__action"
                            onClick={() =>
                              setRevealed((c) => ({ ...c, [field.key]: !c[field.key] }))
                            }
                            aria-label={revealed[field.key] ? 'Hide value' : 'Show value'}
                          >
                            <Icon name={revealed[field.key] ? 'eyeOff' : 'eye'} size={16} />
                          </button>
                        ) : undefined
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
          </Modal>
        );
      })()}

      {thirdPartyModal && (
        <Modal
          title={thirdPartyModal === 'add' ? 'Add a third party' : 'Edit third party'}
          subtitle="Shown here for reference — not yet wired to a live integration"
          onClose={() => setThirdPartyModal(null)}
          footer={
            <>
              <Button onClick={() => setThirdPartyModal(null)}>Cancel</Button>
              <Button
                variant="primary"
                icon="check"
                disabled={!thirdPartyForm.name.trim()}
                onClick={saveThirdParty}
              >
                {thirdPartyModal === 'add' ? 'Add third party' : 'Save changes'}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Field label="Name">
              <Input
                placeholder="e.g. Razorpay"
                value={thirdPartyForm.name}
                onChange={(event) =>
                  setThirdPartyForm((c) => ({ ...c, name: event.target.value }))
                }
              />
            </Field>
            <Field label="Category">
              <Select
                value={thirdPartyForm.category}
                onChange={(event) =>
                  setThirdPartyForm((c) => ({ ...c, category: event.target.value }))
                }
                options={THIRD_PARTY_CATEGORIES}
              />
            </Field>
            <Field
              label="Identifier"
              hint="API key, merchant ID or account name — for reference only"
            >
              <Input
                placeholder="e.g. rzp_live_••••"
                value={thirdPartyForm.identifier}
                onChange={(event) =>
                  setThirdPartyForm((c) => ({ ...c, identifier: event.target.value }))
                }
              />
            </Field>
            <ToggleRow
              title="Enabled"
              desc="Whether this integration is currently in use"
              on={thirdPartyForm.enabled}
              onChange={(value) => setThirdPartyForm((c) => ({ ...c, enabled: value }))}
            />
            <Field label="Notes" hint="Optional">
              <Textarea
                placeholder="Anything the next admin should know"
                value={thirdPartyForm.notes}
                onChange={(event) =>
                  setThirdPartyForm((c) => ({ ...c, notes: event.target.value }))
                }
              />
            </Field>
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
