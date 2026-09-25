/**
 * User Management — the customer directory, their birth details and kundlis,
 * and the block / unblock controls.
 *
 * The table asks the API for one page of rows and lets DataTable handle search,
 * sorting and paging over them. Opening a row fetches that user's full record,
 * because the listing deliberately does not carry birth details or history.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Chips,
  DetailList,
  Field,
  Identity,
  Input,
  LoadingBlock,
  Modal,
  Note,
  Select,
  StatCard,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { adjustLoyalty, getDashboard, getUser, listUsers, setUserStatus } from '../services/admin';
import { can } from '../services/session';
import {
  birthLine,
  count,
  date,
  duration,
  label,
  money,
  phone as formatPhone,
  relative,
  signupLabel,
} from '../utils/format';

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'blocked', label: 'Blocked' },
];

/** How many rows to pull; DataTable pages through them client-side. */
const PAGE_LIMIT = 100;

const TIER_TONE = { silver: 'neutral', gold: 'warning', platinum: 'info', diamond: 'lilac' };
const BLANK_POINTS = { direction: 'add', points: '', reason: '' };

export function UsersPage({ notify }) {
  const [filter, setFilter] = useState('active');
  const [openId, setOpenId] = useState(null);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustment, setAdjustment] = useState(BLANK_POINTS);
  const [run, busy] = useAction(notify);

  const status = filter;

  const { data, loading, error, reload } = useApi(
    () => listUsers({ status, limit: PAGE_LIMIT }),
    [status],
  );
  const { data: stats } = useApi(() => getDashboard(7), []);

  /** The drawer's record is fetched on open — the listing does not carry it. */
  const { data: detail, loading: loadingDetail, reload: reloadDetail } = useApi(
    () => getUser(openId),
    [openId],
    { skip: !openId },
  );

  const rows = data?.items ?? [];

  const counts = {
    active: filter === 'active' ? rows.length : undefined,
    blocked: filter === 'blocked' ? rows.length : undefined,
  };

  const changeStatus = (id, next) =>
    run(() => setUserStatus(id, next, next === 'blocked' ? 'Blocked from the admin panel' : undefined), {
      success: next === 'blocked' ? 'User blocked' : 'User restored',
      onDone: async () => {
        await reload();
        if (openId === id) await reloadDetail();
      },
    });

  const canManage = can('users.manage');
  const canAdjustPoints = can('wallets.adjust');
  const open = detail?.user;

  const pointsInvalid =
    !Number.isInteger(Number(adjustment.points)) ||
    Number(adjustment.points) < 1 ||
    !adjustment.reason.trim();

  const submitPoints = () => {
    const signed = Number(adjustment.points) * (adjustment.direction === 'add' ? 1 : -1);
    return run(
      () => adjustLoyalty({ userId: open.id, points: signed, reason: adjustment.reason.trim() }),
      {
        success: `${signed > 0 ? 'Added' : 'Removed'} ${count(Math.abs(signed))} points · ${open.name}`,
        onDone: async () => {
          setAdjusting(false);
          setAdjustment(BLANK_POINTS);
          await reloadDetail();
        },
      },
    );
  };

  const columns = [
    {
      key: 'name',
      label: 'User',
      sortable: true,
      render: (row) => <Identity name={row.name} meta={row.email} />,
    },
    {
      key: 'phone',
      label: 'Mobile',
      render: (row) => (
        <span className="mono" style={{ fontSize: 12.5 }}>
          {formatPhone(row.phone)}
        </span>
      ),
    },
    {
      key: 'signup',
      label: 'Signed up via',
      sortable: true,
      render: (row) => (
        <span className="row" style={{ gap: 6, fontSize: 12.5 }}>
          <Icon
            name={row.signup === 'google' ? 'globe' : row.signup === 'email' ? 'mail' : 'phone'}
            size={14}
          />
          {signupLabel(row.signup)}
        </span>
      ),
    },
    {
      key: 'joined',
      label: 'Joined',
      sortable: true,
      sortValue: (row) => new Date(row.joined).getTime(),
      render: (row) => date(row.joined),
    },
    {
      key: 'consults',
      label: 'Consults',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{row.consults}</span>,
    },
    {
      key: 'wallet',
      label: 'Wallet',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{money(row.wallet)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <div className="row" style={{ gap: 6 }}>
          <StatusBadge status={row.status} />
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) => (
        <RowActions
          actions={[
            { label: 'View profile', icon: 'eye', onClick: () => setOpenId(row.id) },
            ...(canManage
              ? [
                  row.status === 'blocked'
                    ? {
                        label: 'Unblock',
                        icon: 'checkCircle',
                        variant: 'success',
                        onClick: () => changeStatus(row.id, 'active'),
                      }
                    : {
                        label: 'Block',
                        icon: 'ban',
                        variant: 'danger',
                        onClick: () => changeStatus(row.id, 'blocked'),
                      },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="User Management"
        subtitle="Every registered seeker, their birth details and their account state"
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="Total users"
          value={count(stats?.users?.total ?? 0)}
          icon="users"
          tone="brand"
          delta={stats ? `+${count(stats.users.newThisMonth)}` : undefined}
          hint="this month"
        />
        <StatCard
          label="Consultations today"
          value={count(stats?.consultations?.today ?? 0)}
          icon="activity"
          tone="success"
          delta={stats ? `${stats.consultations.ongoing} live` : undefined}
          deltaTone="flat"
          hint="right now"
        />
        <StatCard
          label="Blocked accounts"
          value={count(rows.filter((row) => row.status === 'blocked').length)}
          icon="ban"
          hint="in this view"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['name', 'email', 'phone', 'userCode']}
        searchPlaceholder="Search by name, email or mobile…"
        onRowClick={(row) => setOpenId(row.id)}
        toolbar={
          <Chips
            value={filter}
            onChange={setFilter}
            items={FILTERS.map((item) => ({ ...item, count: counts[item.key] }))}
          />
        }
        empty={{ icon: 'users', title: 'No users match this filter' }}
      />

      {openId && (
        <Modal
          wide
          title={open?.name || 'Loading…'}
          subtitle={open ? `${open.userCode || open.id} · joined ${date(open.joined)}` : ''}
          onClose={() => setOpenId(null)}
          footer={
            open && canManage ? (
              open.status === 'blocked' ? (
                <Button
                  variant="success"
                  icon="checkCircle"
                  disabled={busy}
                  onClick={() => changeStatus(open.id, 'active')}
                >
                  Unblock user
                </Button>
              ) : (
                <Button
                  variant="danger"
                  icon="ban"
                  disabled={busy}
                  onClick={() => changeStatus(open.id, 'blocked')}
                >
                  Block user
                </Button>
              )
            ) : undefined
          }
        >
          {loadingDetail || !open ? (
            <LoadingBlock />
          ) : (
            <div className="stack" style={{ gap: 18 }}>
              <div className="profile-head">
                <Identity
                  name={open.name}
                  meta={open.email}
                  size="lg"
                  online={open.status === 'active'}
                />
                <div className="row" style={{ gap: 6 }}>
                  <StatusBadge status={open.status} />
                </div>
              </div>

              {open.status === 'blocked' && (
                <Note tone="danger" icon="alert">
                  This account is blocked. The user cannot sign in, start consultations or
                  spend their remaining <strong>{money(open.wallet?.balance)}</strong> wallet
                  balance.
                  {open.blocked?.reason ? ` Reason: ${open.blocked.reason}` : ''}
                </Note>
              )}

              <div className="mini-stats">
                <div>
                  <p className="eyebrow">Consultations</p>
                  <p className="mini-stats__value">{open.stats?.consultations ?? 0}</p>
                </div>
                <div>
                  <p className="eyebrow">Total spent</p>
                  <p className="mini-stats__value">{money(open.wallet?.totalSpent)}</p>
                </div>
                <div>
                  <p className="eyebrow">Wallet</p>
                  <p className="mini-stats__value">{money(open.wallet?.balance)}</p>
                </div>
                <div>
                  <p className="eyebrow">Kundlis</p>
                  <p className="mini-stats__value">{open.kundlis}</p>
                </div>
              </div>

              <section>
                <div className="row row--between" style={{ marginBottom: 8 }}>
                  <h3 className="section-title" style={{ margin: 0 }}>
                    Loyalty
                  </h3>
                  {canAdjustPoints && (
                    <Button
                      size="sm"
                      icon="plus"
                      onClick={() => {
                        setAdjustment(BLANK_POINTS);
                        setAdjusting(true);
                      }}
                    >
                      Adjust points
                    </Button>
                  )}
                </div>
                <DetailList
                  rows={[
                    { label: 'Points', value: <span className="mono">{count(open.loyalty?.points)}</span> },
                    {
                      label: 'Tier',
                      value: open.loyalty?.tier ? (
                        <Badge tone={TIER_TONE[open.loyalty.tier] || 'neutral'}>{label(open.loyalty.tier)}</Badge>
                      ) : (
                        '—'
                      ),
                    },
                    { label: 'Lifetime points', value: count(open.loyalty?.lifetimePoints) },
                    ...(open.referralCode
                      ? [{ label: 'Referral code', value: <span className="mono">{open.referralCode}</span> }]
                      : []),
                  ]}
                />
              </section>

              <section>
                <h3 className="section-title">Account</h3>
                <DetailList
                  rows={[
                    { label: 'User ID', value: open.userCode || open.id },
                    { label: 'Mobile', value: formatPhone(open.phone, open.countryCode) },
                    { label: 'Email', value: open.email || '—' },
                    { label: 'Signed up via', value: signupLabel(open.signup) },
                    { label: 'Last active', value: relative(open.lastActive) },
                  ]}
                />
              </section>

              <section>
                <h3 className="section-title">Birth details</h3>
                <DetailList
                  rows={[
                    { label: 'Date, time & place', value: birthLine(open.birthDetails) },
                    { label: 'Gender', value: label(open.gender) || '—' },
                    { label: 'Moon sign', value: open.zodiac?.moonSign || '—' },
                    { label: 'Sun sign', value: open.zodiac?.sunSign || '—' },
                    { label: 'Kundlis generated', value: `${open.kundlis} charts` },
                  ]}
                />
              </section>

              <section>
                <h3 className="section-title">Recent consultations</h3>
                {open.consultations.length === 0 ? (
                  <p className="faint" style={{ fontSize: 12.5 }}>
                    This user has not consulted anyone yet.
                  </p>
                ) : (
                  <div className="stack" style={{ gap: 8 }}>
                    {open.consultations.map((item) => (
                      <div className="mini-row" key={item.id}>
                        <div>
                          <p className="strong">{item.astrologer || 'Astrologer'}</p>
                          <p className="faint" style={{ fontSize: 11.5 }}>
                            {label(item.channel)} · {date(item.at)} · {duration(item.durationSeconds)}
                          </p>
                        </div>
                        <span className="mono strong">{money(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </Modal>
      )}

      {adjusting && open && (
        <Modal
          title={`Adjust points · ${open.name}`}
          subtitle={`Currently ${count(open.loyalty?.points)} points · ${label(open.loyalty?.tier || 'silver')}`}
          onClose={() => setAdjusting(false)}
          footer={
            <>
              <Button onClick={() => setAdjusting(false)}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={busy || pointsInvalid} onClick={submitPoints}>
                {adjustment.direction === 'add' ? 'Add points' : 'Remove points'}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Direction">
                <Select
                  value={adjustment.direction}
                  onChange={(event) =>
                    setAdjustment((current) => ({ ...current, direction: event.target.value }))
                  }
                  options={[
                    { value: 'add', label: 'Add points' },
                    { value: 'remove', label: 'Remove points' },
                  ]}
                />
              </Field>
              <Field label="Points">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={adjustment.points}
                  onChange={(event) =>
                    setAdjustment((current) => ({ ...current, points: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Reason" hint="Recorded on the user's points history and in the audit log">
              <Textarea
                placeholder="e.g. Goodwill for a dropped call"
                value={adjustment.reason}
                onChange={(event) =>
                  setAdjustment((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default UsersPage;
