/**
 * User Management — the customer directory, their birth details and kundlis,
 * and the block / unblock controls the FRD puts under "Admin controls user
 * activities".
 */

import { useMemo, useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Chips,
  DetailList,
  Identity,
  Modal,
  Note,
  StatCard,
  StatusBadge,
} from '../components/ui';
import { users as seedUsers } from '../data/people';

const FILTERS = [
  { key: 'all', label: 'All users' },
  { key: 'active', label: 'Active' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'unverified', label: 'Unverified' },
];

export function UsersPage({ notify }) {
  const [rows, setRows] = useState(seedUsers);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((row) => row.status === 'active').length,
      blocked: rows.filter((row) => row.status === 'blocked').length,
      unverified: rows.filter((row) => !row.verified).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'unverified') return rows.filter((row) => !row.verified);
    return rows.filter((row) => row.status === filter);
  }, [rows, filter]);

  const setStatus = (id, status) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)));
    setOpen((current) => (current?.id === id ? { ...current, status } : current));
    notify(status === 'blocked' ? 'User blocked' : 'User restored', {
      tone: status === 'blocked' ? undefined : 'success',
    });
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
          {row.phone}
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
            name={
              row.signup === 'Google' ? 'globe' : row.signup === 'Email' ? 'mail' : 'phone'
            }
            size={14}
          />
          {row.signup}
        </span>
      ),
    },
    { key: 'joined', label: 'Joined', sortable: true },
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
      render: (row) => <span className="mono">₹{row.wallet.toLocaleString('en-IN')}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <div className="row" style={{ gap: 6 }}>
          <StatusBadge status={row.status} />
          {!row.verified && <Badge tone="warning">Unverified</Badge>}
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
            { label: 'View profile', icon: 'eye', onClick: () => setOpen(row) },
            row.status === 'blocked'
              ? {
                  label: 'Unblock',
                  icon: 'checkCircle',
                  variant: 'success',
                  onClick: () => setStatus(row.id, 'active'),
                }
              : {
                  label: 'Block',
                  icon: 'ban',
                  variant: 'danger',
                  onClick: () => setStatus(row.id, 'blocked'),
                },
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
        actions={
          <>
            <Button icon="download">Export CSV</Button>
            <Button variant="primary" icon="send" onClick={() => notify('Broadcast composer opened')}>
              Message users
            </Button>
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard label="Total users" value="48,210" icon="users" tone="brand" delta="+184 today" hint="all time" />
        <StatCard label="Active this week" value="21,440" icon="activity" tone="success" delta="+6.2%" hint="vs. last week" />
        <StatCard label="Blocked accounts" value={counts.blocked} icon="ban" delta="1 this month" deltaTone="flat" hint="policy violations" />
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        searchKeys={['name', 'email', 'phone', 'id']}
        searchPlaceholder="Search by name, email or mobile…"
        onRowClick={setOpen}
        toolbar={
          <Chips
            value={filter}
            onChange={setFilter}
            items={FILTERS.map((item) => ({ ...item, count: counts[item.key] }))}
          />
        }
        toolbarEnd={<Button size="sm" icon="filter">More filters</Button>}
        empty={{ icon: 'users', title: 'No users match this filter' }}
      />

      {open && (
        <Modal
          wide
          title={open.name}
          subtitle={`${open.id} · joined ${open.joined}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <Button onClick={() => notify('Password reset link sent')}>Send reset link</Button>
              {open.status === 'blocked' ? (
                <Button variant="success" icon="checkCircle" onClick={() => setStatus(open.id, 'active')}>
                  Unblock user
                </Button>
              ) : (
                <Button variant="danger" icon="ban" onClick={() => setStatus(open.id, 'blocked')}>
                  Block user
                </Button>
              )}
            </>
          }
        >
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
                <Badge tone={open.verified ? 'success' : 'warning'}>
                  {open.verified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
            </div>

            {open.status === 'blocked' && (
              <Note tone="danger" icon="alert">
                This account is blocked. The user cannot sign in, start consultations or
                spend their remaining <strong>₹{open.wallet}</strong> wallet balance.
              </Note>
            )}

            <div className="mini-stats">
              <div>
                <p className="eyebrow">Consultations</p>
                <p className="mini-stats__value">{open.consults}</p>
              </div>
              <div>
                <p className="eyebrow">Total spent</p>
                <p className="mini-stats__value">₹{open.spent.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="eyebrow">Wallet</p>
                <p className="mini-stats__value">₹{open.wallet.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="eyebrow">Kundlis</p>
                <p className="mini-stats__value">{open.kundli}</p>
              </div>
            </div>

            <section>
              <h3 className="section-title">Account</h3>
              <DetailList
                rows={[
                  { label: 'User ID', value: open.id },
                  { label: 'Mobile', value: open.phone },
                  { label: 'Email', value: open.email },
                  { label: 'Signed up via', value: open.signup },
                  { label: 'Last active', value: open.lastActive },
                ]}
              />
            </section>

            <section>
              <h3 className="section-title">Birth details</h3>
              <DetailList
                rows={[
                  { label: 'Date, time & place', value: open.birth },
                  { label: 'Moon sign', value: open.zodiac },
                  { label: 'Kundlis generated', value: `${open.kundli} charts` },
                ]}
              />
            </section>

            <section>
              <h3 className="section-title">Recent consultations</h3>
              <div className="stack" style={{ gap: 8 }}>
                {[
                  { with: 'Pt. Rajesh Sharma', channel: 'Chat', when: '17 Aug · 22m', amount: 440 },
                  { with: 'Dr. Suresh Menon', channel: 'Voice', when: '14 Aug · 24m', amount: 840 },
                  { with: 'Kavita Joshi', channel: 'Chat', when: '09 Aug · 15m', amount: 225 },
                ].map((item) => (
                  <div className="mini-row" key={item.when}>
                    <div>
                      <p className="strong">{item.with}</p>
                      <p className="faint" style={{ fontSize: 11.5 }}>
                        {item.channel} · {item.when}
                      </p>
                    </div>
                    <span className="mono strong">₹{item.amount}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default UsersPage;
