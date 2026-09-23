/**
 * Platform Administration — the numbers and switches that govern the product,
 * and who is allowed into this console.
 *
 * The settings on this page are live: the recharge limits govern the very
 * next top-up. Nothing here needs a deploy.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import {
  Avatar,
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
  createThirdParty,
  deleteThirdParty,
  getSettings,
  listIntegrations,
  listThirdParties,
  saveIntegration,
  setIntegrationEnabled,
  updateOwnProfile,
  updateSettings,
  updateThirdParty,
} from '../services/admin';
import { can, updateCachedAdmin } from '../services/session';
import { dateTime, money } from '../utils/format';

const TABS = [
  { key: 'account', label: 'My Account' },
  { key: 'platform', label: 'Platform' },
  { key: 'thirdParty', label: 'Third parties' },
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
    key: 'google',
    name: 'Google Sign-In',
    icon: 'lock',
    subtitle: 'Sign in with Google for the customer app',
    fields: [
      {
        key: 'clientIds',
        label: 'Client ID(s)',
        placeholder: 'Comma-separated OAuth client IDs, e.g. the Android and iOS client from Google Cloud Console',
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
    subtitle: 'Push notifications for both apps',
    fields: [
      { key: 'projectId', label: 'Project ID', placeholder: 'e.g., shree-astro-12345' },
      { key: 'clientEmail', label: 'Client Email', placeholder: 'firebase-adminsdk-xxxxx@shree-astro-12345.iam.gserviceaccount.com' },
      {
        key: 'privateKey',
        label: 'Private Key',
        placeholder: 'Paste the "private_key" value from the service account JSON',
        secret: true,
        multiline: true,
      },
    ],
  },
];

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

export function SettingsPage({ notify, admin }) {
  const [tab, setTab] = useState('account');
  const [configuring, setConfiguring] = useState(null);
  const [providerForm, setProviderForm] = useState({});
  const [revealed, setRevealed] = useState({});
  const [thirdPartyModal, setThirdPartyModal] = useState(null);
  const [thirdPartyForm, setThirdPartyForm] = useState(BLANK_THIRD_PARTY);
  const [run, busy] = useAction(notify);

  /** My Account: the name field starts from the signed-in admin's own record. */
  const [accountName, setAccountName] = useState(admin?.name || '');
  const [accountPhoto, setAccountPhoto] = useState(null);
  const [accountPhotoPreview, setAccountPhotoPreview] = useState(null);

  const pickAccountPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAccountPhoto(file);
    setAccountPhotoPreview(URL.createObjectURL(file));
  };

  const saveAccount = () =>
    run(() => updateOwnProfile({ name: accountName.trim(), photo: accountPhoto }), {
      success: 'Your account was updated',
      onDone: ({ admin: updated }) => {
        updateCachedAdmin(updated);
        setAccountPhoto(null);
        setAccountPhotoPreview(null);
      },
    });

  /**
   * Unsaved edits, if any.
   *
   * The form is *derived* from what the API returned rather than copied into
   * state by an effect: `edits` is null until something is typed, and from then
   * on it is the whole form. No syncing, so the two can never disagree.
   */
  const [edits, setEdits] = useState(null);

  const settings = useApi(() => getSettings(), []);
  const integrations = useApi(() => listIntegrations(), [], { skip: tab !== 'thirdParty' });
  const thirdParties = useApi(() => listThirdParties(), [], { skip: tab !== 'thirdParty' });

  const integrationByProvider = Object.fromEntries(
    (integrations.data?.integrations ?? []).map((row) => [row.provider, row]),
  );

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

  /**
   * Consultation package discounts — one row per package the server offers
   * (GET /admin/settings' `consultationPackages`), held with the rest of the
   * unsaved edits and sent by the same "Save changes".
   */
  const maxDiscount = settings.data?.maxPackageDiscountPercent ?? 90;
  const discountRows = form?.packageDiscountRows ?? settings.data?.consultationPackages ?? [];
  const discountError = (value) => {
    const percent = Number(value);
    if (value === '' || !Number.isInteger(percent) || percent < 0 || percent > maxDiscount) {
      return `A whole number from 0 to ${maxDiscount}`;
    }
    return undefined;
  };
  const discountsInvalid = discountRows.some((row) => discountError(row.discountPercent));
  const setDiscount = (minutes) => (event) =>
    setForm((current) => ({
      ...current,
      packageDiscountRows: (current.packageDiscountRows ?? settings.data?.consultationPackages ?? []).map((row) =>
        row.minutes === minutes ? { ...row, discountPercent: event.target.value } : row,
      ),
    }));

  const save = () =>
    run(
      () =>
        updateSettings({
          commissionPercent: Number(form.commissionPercent),
          minRecharge: Number(form.minRecharge),
          maxRecharge: Number(form.maxRecharge),
          minPayout: Number(form.minPayout),
          payoutCycle: form.payoutCycle,
          features: form.features,
          packageDiscounts: discountRows.map((row) => ({
            minutes: row.minutes,
            discountPercent: Number(row.discountPercent),
          })),
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

  const saveProviderConfig = () =>
    run(() => saveIntegration(configuring, providerForm), {
      success: `${THIRD_PARTY_PROVIDERS.find((item) => item.key === configuring)?.name} configuration saved`,
      onDone: async () => {
        setConfiguring(null);
        await integrations.reload();
      },
    });

  const toggleIntegration = (provider, enabled) =>
    run(() => setIntegrationEnabled(provider, enabled), {
      success: enabled ? 'Integration enabled' : 'Integration disabled',
      onDone: integrations.reload,
    });

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
    setThirdPartyModal(row._id);
  };

  const saveThirdParty = () => {
    const body = { ...thirdPartyForm, name: thirdPartyForm.name.trim() };
    return run(
      () => (thirdPartyModal === 'add' ? createThirdParty(body) : updateThirdParty(thirdPartyModal, body)),
      {
        success: thirdPartyModal === 'add' ? 'Third party added' : 'Third party updated',
        onDone: async () => {
          setThirdPartyModal(null);
          await thirdParties.reload();
        },
      },
    );
  };

  const removeThirdParty = (row) =>
    run(() => deleteThirdParty(row._id), {
      success: `${row.name} removed`,
      onDone: thirdParties.reload,
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

  return (
    <div className="page">
      <PageHeader
        title={tab === 'account' ? 'My Account' : 'Platform Administration'}
        subtitle={
          tab === 'account'
            ? 'Your name and photo, as they show up across this console'
            : 'Commission, access control and the switches the apps read'
        }
        actions={
          <>
            <Tabs value={tab} onChange={setTab} items={TABS} />
            {tab === 'platform' && canManage && (
              <Button variant="primary" icon="check" disabled={busy || !form || discountsInvalid} onClick={save}>
                Save changes
              </Button>
            )}
          </>
        }
      />

      {tab === 'account' && (
        <Card title="Profile" subtitle="Shown in the topbar and on anything you review or approve">
          <div className="row" style={{ gap: 20, alignItems: 'center', marginBottom: 20 }}>
            <Avatar name={accountName || admin?.name} src={accountPhotoPreview || admin?.avatarUrl} size="lg" round />
            <div className="stack" style={{ gap: 6 }}>
              <label className="btn btn--ghost btn--sm" style={{ cursor: 'pointer', width: 'fit-content' }}>
                Change photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={pickAccountPhoto}
                  style={{ display: 'none' }}
                />
              </label>
              {accountPhoto && (
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {accountPhoto.name}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid--2" style={{ gap: 14, maxWidth: 480 }}>
            <Field label="Name">
              <Input value={accountName} onChange={(event) => setAccountName(event.target.value)} />
            </Field>
            <Field label="Email" hint="Contact a super admin to change your sign-in email">
              <Input value={admin?.email || ''} disabled />
            </Field>
          </div>

          <div style={{ marginTop: 18 }}>
            <Button
              variant="primary"
              icon="check"
              disabled={busy || !accountName.trim()}
              onClick={saveAccount}
            >
              Save changes
            </Button>
          </div>
        </Card>
      )}

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

              <Card
                title="Consultation package discounts"
                subtitle="Percent off each fixed-length package, for chat and call"
              >
                <div className="grid grid--2" style={{ gap: 14 }}>
                  {discountRows.map((row) => {
                    const percent = Number(row.discountPercent) || 0;
                    const original = 20 * row.minutes;
                    const discounted = original - Math.round((original * percent) / 100);
                    return (
                      <Field
                        key={row.minutes}
                        label={`${row.minutes}-minute package (% off)`}
                        error={discountError(row.discountPercent)}
                        hint={
                          percent > 0
                            ? `At ₹20/min: ${money(original)} → ${money(discounted)}`
                            : `At ₹20/min: ${money(original)} (no discount)`
                        }
                      >
                        <Input
                          type="number"
                          min="0"
                          max={maxDiscount}
                          step="1"
                          value={row.discountPercent}
                          disabled={!canManage}
                          invalid={Boolean(discountError(row.discountPercent))}
                          onChange={setDiscount(row.minutes)}
                        />
                      </Field>
                    );
                  })}
                </div>

                <div style={{ marginTop: 16 }}>
                  <Note tone="info" icon="info">
                    Seekers see the full price struck through and pay the discounted one. A price is
                    locked when the seeker books, so a change here applies to new bookings and
                    extensions from then on. The astrologer&apos;s share is taken from the
                    discounted amount.
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
          {integrations.loading && !integrations.data ? (
            <Card>
              <LoadingBlock />
            </Card>
          ) : (
            <div className="grid grid--3" style={{ gap: 14 }}>
              {THIRD_PARTY_PROVIDERS.map((provider) => {
                const state = integrationByProvider[provider.key] ?? { enabled: false, values: {}, updatedAt: null };
                const configured = provider.fields.some((field) => state.values?.[field.key]);
                return (
                  <Card key={provider.key} title={provider.name} subtitle={provider.subtitle}>
                    <div className="row row--between" style={{ marginBottom: 12 }}>
                      <StatusBadge status={state.enabled && configured ? 'active' : 'inactive'} />
                      <div className="row" style={{ gap: 8 }}>
                        {canManage && configured && (
                          <Button
                            size="sm"
                            onClick={() => toggleIntegration(provider.key, !state.enabled)}
                          >
                            {state.enabled ? 'Disable' : 'Enable'}
                          </Button>
                        )}
                        {canManage && (
                          <Button size="sm" icon="edit" onClick={() => openConfigure(provider.key)}>
                            {configured ? 'Update' : 'Configure'}
                          </Button>
                        )}
                      </div>
                    </div>
                    {configured ? (
                      <DetailList
                        rows={[
                          ...provider.fields.map((field) => ({
                            label: field.label,
                            value: state.values?.[field.key] || '—',
                          })),
                          { label: 'Last updated', value: state.updatedAt ? dateTime(state.updatedAt) : '—' },
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
          )}

          <Card title="Other third parties" subtitle="Anything not listed above">
            <DataTable
              columns={thirdPartyColumns}
              rows={thirdParties.data?.items ?? []}
              loading={thirdParties.loading}
              error={thirdParties.error}
              onRetry={thirdParties.reload}
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

      {configuring && (() => {
        const provider = THIRD_PARTY_PROVIDERS.find((item) => item.key === configuring);
        const configured = provider.fields.some(
          (field) => integrationByProvider[configuring]?.values?.[field.key],
        );
        return (
          <Modal
            title={`${configured ? 'Update' : 'Configure'} ${provider.name}`}
            subtitle="Credentials are stored securely and are not shown again after saving"
            onClose={() => setConfiguring(null)}
            footer={
              <>
                <Button onClick={() => setConfiguring(null)}>Cancel</Button>
                <Button variant="primary" icon="check" disabled={busy} onClick={saveProviderConfig}>
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
          subtitle="Kept for reference only — this record is not used to call any live service"
          onClose={() => setThirdPartyModal(null)}
          footer={
            <>
              <Button onClick={() => setThirdPartyModal(null)}>Cancel</Button>
              <Button
                variant="primary"
                icon="check"
                disabled={busy || !thirdPartyForm.name.trim()}
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

    </div>
  );
}

export default SettingsPage;
