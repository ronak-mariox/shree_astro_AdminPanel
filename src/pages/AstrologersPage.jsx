/**
 * Astrologer Management — the marketplace listing, the approval queue with its
 * document checks, and the per-astrologer rates, availability and earnings the
 * astrologer app reads back.
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
  Drawer,
  Field,
  Identity,
  Input,
  Modal,
  Note,
  Progress,
  StatCard,
  Select,
  StatusBadge,
  Textarea,
  Toggle,
} from '../components/ui';
import { astrologerDocuments, astrologers as seed } from '../data/people';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Applications' },
  { key: 'blocked', label: 'Blocked' },
];

const DOC_TONE = { verified: 'success', pending: 'warning', rejected: 'danger' };

/** A listed astrologer is either approved or blocked — nothing in between. */
const LISTING_STATUS = [
  { value: 'approved', label: 'Approved · listed on the marketplace' },
  { value: 'blocked', label: 'Blocked · hidden from the apps' },
];

const BLANK_DRAFT = {
  name: '',
  email: '',
  phone: '',
  skills: '',
  languages: '',
  experience: '',
  chatRate: '',
  callRate: '',
  commission: '70',
  availability: '',
  status: 'approved',
};

const today = () =>
  new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function AstrologersPage({ notify }) {
  const [rows, setRows] = useState(seed);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState(null);

  const counts = useMemo(
    () =>
      FILTERS.reduce(
        (acc, item) => ({
          ...acc,
          [item.key]:
            item.key === 'all' ? rows.length : rows.filter((row) => row.status === item.key).length,
        }),
        {},
      ),
    [rows],
  );

  const filtered = filter === 'all' ? rows : rows.filter((row) => row.status === filter);

  const setStatus = (id, status, message) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              status,
              online: status === 'approved' ? row.online : false,
              documents: status === 'approved' ? 'verified' : row.documents,
            }
          : row,
      ),
    );
    setOpen((current) =>
      current?.id === id
        ? { ...current, status, online: status === 'approved' ? current.online : false }
        : current,
    );
    notify(message, { tone: status === 'approved' ? 'success' : undefined });
  };

  const toggleOnline = (id) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, online: !row.online } : row)),
    );
    setOpen((current) => (current?.id === id ? { ...current, online: !current.online } : current));
  };

  const setDraftField = (key) => (event) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const draftValid =
    draft &&
    draft.name.trim().length > 2 &&
    /^\S+@\S+\.\S+$/.test(draft.email.trim()) &&
    draft.phone.trim().length >= 10 &&
    draft.skills.trim().length > 1 &&
    Number(draft.chatRate) > 0 &&
    Number(draft.callRate) > 0;

  const createAstrologer = () => {
    const nextNumber =
      Math.max(0, ...rows.map((row) => Number(String(row.id).split('-')[1]) || 0)) + 1;
    const created = {
      id: `a-${nextNumber}`,
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      skills: draft.skills.trim(),
      languages: draft.languages.trim() || 'Hindi, English',
      experience: Number(draft.experience) || 0,
      chatRate: Number(draft.chatRate),
      callRate: Number(draft.callRate),
      rating: 0,
      reviews: 0,
      consults: 0,
      earnings: 0,
      payable: 0,
      status: draft.status,
      online: false,
      availability: draft.availability.trim() || 'Not set',
      joined: today(),
      documents: draft.status === 'approved' ? 'verified' : 'pending',
      commission: Number(draft.commission) || 70,
    };
    setRows((current) => [created, ...current]);
    setDraft(null);
    notify(
      draft.status === 'approved'
        ? `${created.name} created and listed`
        : `${created.name} created as blocked`,
      { tone: draft.status === 'approved' ? 'success' : undefined },
    );
  };

  const columns = [
    {
      key: 'name',
      label: 'Astrologer',
      sortable: true,
      render: (row) => (
        <Identity name={row.name} meta={row.skills} online={row.status === 'approved' ? row.online : undefined} />
      ),
    },
    {
      key: 'experience',
      label: 'Experience',
      sortable: true,
      render: (row) => `${row.experience} yrs`,
    },
    {
      key: 'chatRate',
      label: 'Rates',
      sortable: true,
      render: (row) => (
        <span className="rate-cell">
          <span>
            <Icon name="chat" size={12} /> ₹{row.chatRate}
          </span>
          <span>
            <Icon name="phone" size={12} /> ₹{row.callRate}
          </span>
        </span>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (row) =>
        row.rating ? (
          <span className="row" style={{ gap: 4 }}>
            <span style={{ color: '#FFBF00' }}>
              <Icon name="star" size={13} strokeWidth={2} />
            </span>
            <span className="mono strong">{row.rating}</span>
            <span className="faint" style={{ fontSize: 11 }}>
              ({row.reviews})
            </span>
          </span>
        ) : (
          <span className="faint">—</span>
        ),
    },
    {
      key: 'consults',
      label: 'Consults',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{row.consults.toLocaleString('en-IN')}</span>,
    },
    {
      key: 'earnings',
      label: 'Earnings',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">₹{row.earnings.toLocaleString('en-IN')}</span>,
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
      render: (row) => (
        <RowActions
          actions={
            row.status === 'pending'
              ? [
                  { label: 'Review', icon: 'eye', onClick: () => setOpen(row) },
                  {
                    label: 'Approve',
                    icon: 'check',
                    variant: 'success',
                    onClick: () => setStatus(row.id, 'approved', `${row.name} approved`),
                  },
                  {
                    label: 'Reject',
                    icon: 'x',
                    variant: 'danger',
                    onClick: () => setRejecting(row),
                  },
                ]
              : [
                  { label: 'View', icon: 'eye', onClick: () => setOpen(row) },
                  row.status === 'blocked'
                    ? {
                        label: 'Unblock',
                        icon: 'checkCircle',
                        variant: 'success',
                        onClick: () => setStatus(row.id, 'approved', `${row.name} unblocked`),
                      }
                    : {
                        label: 'Block',
                        icon: 'ban',
                        variant: 'danger',
                        onClick: () => setStatus(row.id, 'blocked', `${row.name} blocked`),
                      },
                ]
          }
        />
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Astrologer Management"
        subtitle="Approve applications, verify documents and manage the marketplace listing"
        actions={
          <>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="plus" onClick={() => setDraft(BLANK_DRAFT)}>
              Create astrologer
            </Button>
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard label="Approved astrologers" value="212" icon="sparkle" tone="yellow" delta="+6" hint="this month" />
        <StatCard label="Online right now" value={rows.filter((r) => r.online).length} icon="activity" tone="success" delta="Peak 84" deltaTone="flat" hint="today" />
        <StatCard label="Applications pending" value={counts.pending || 0} icon="inbox" tone="brand" delta="2 new" hint="awaiting verification" />
        <StatCard label="Payable this cycle" value="₹1.24L" icon="wallet" delta="+18%" hint="after commission" />
      </div>

      {counts.pending > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Note tone="info" icon="alert">
            <strong>{counts.pending} applications</strong> are waiting on document
            verification. Approving publishes the astrologer to the marketplace immediately.
          </Note>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        searchKeys={['name', 'email', 'skills', 'languages']}
        searchPlaceholder="Search by name, skill or language…"
        onRowClick={setOpen}
        toolbar={
          <Chips
            value={filter}
            onChange={setFilter}
            items={FILTERS.map((item) => ({ ...item, count: counts[item.key] }))}
          />
        }
        empty={{ icon: 'sparkle', title: 'No astrologers in this view' }}
      />

      {open && (
        <Drawer
          wide
          title={open.name}
          subtitle={`${open.id} · applied ${open.joined}`}
          onClose={() => setOpen(null)}
          footer={
            open.status === 'pending' ? (
              <>
                <Button variant="danger" icon="x" onClick={() => setRejecting(open)}>
                  Reject
                </Button>
                <Button
                  variant="primary"
                  icon="check"
                  onClick={() => setStatus(open.id, 'approved', `${open.name} approved`)}
                >
                  Approve &amp; publish
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => notify('Profile edit opened')}>Edit profile</Button>
                {open.status === 'blocked' ? (
                  <Button
                    variant="success"
                    icon="checkCircle"
                    onClick={() => setStatus(open.id, 'approved', `${open.name} unblocked`)}
                  >
                    Unblock
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    icon="ban"
                    onClick={() => setStatus(open.id, 'blocked', `${open.name} blocked`)}
                  >
                    Block
                  </Button>
                )}
              </>
            )
          }
        >
          <div className="stack" style={{ gap: 18 }}>
            <div className="profile-head">
              <Identity name={open.name} meta={open.skills} size="lg" online={open.online} />
              <div className="row" style={{ gap: 6 }}>
                <StatusBadge status={open.status} />
                <Badge tone={DOC_TONE[open.documents] || 'neutral'}>
                  Documents · {open.documents}
                </Badge>
              </div>
            </div>

            <div className="mini-stats">
              <div>
                <p className="eyebrow">Consults</p>
                <p className="mini-stats__value">{open.consults.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="eyebrow">Rating</p>
                <p className="mini-stats__value">{open.rating || '—'}</p>
              </div>
              <div>
                <p className="eyebrow">Earnings</p>
                <p className="mini-stats__value">₹{(open.earnings / 1000).toFixed(0)}k</p>
              </div>
              <div>
                <p className="eyebrow">Payable</p>
                <p className="mini-stats__value">₹{open.payable.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {open.status === 'approved' && (
              <div className="availability-row">
                <div>
                  <p className="toggle-row__title">Marketplace availability</p>
                  <p className="toggle-row__desc">
                    {open.online
                      ? 'Listed as online — accepting chat and voice requests.'
                      : 'Hidden from the online filter until they switch back on.'}
                  </p>
                </div>
                <Toggle on={open.online} onChange={() => toggleOnline(open.id)} label="Availability" />
              </div>
            )}

            <section>
              <h3 className="section-title">Profile</h3>
              <DetailList
                rows={[
                  { label: 'Email', value: open.email },
                  { label: 'Mobile', value: open.phone },
                  { label: 'Expertise', value: open.skills },
                  { label: 'Languages', value: open.languages },
                  { label: 'Experience', value: `${open.experience} years` },
                  { label: 'Availability', value: open.availability },
                ]}
              />
            </section>

            <section>
              <h3 className="section-title">Rates &amp; commission</h3>
              <DetailList
                rows={[
                  { label: 'Chat', value: `₹${open.chatRate} / min` },
                  { label: 'Voice call', value: `₹${open.callRate} / min` },
                  { label: 'Platform commission', value: `${open.commission}%` },
                  {
                    label: 'Astrologer share',
                    value: `${100 - open.commission}% · ₹${Math.round(
                      (open.chatRate * (100 - open.commission)) / 100,
                    )}/min chat`,
                  },
                ]}
              />
            </section>

            <section>
              <h3 className="section-title">Verification documents</h3>
              <div className="stack" style={{ gap: 8 }}>
                {astrologerDocuments.map((doc) => {
                  const state = open.status === 'approved' ? 'verified' : doc.state;
                  return (
                    <div className="doc-row" key={doc.label}>
                      <span className="doc-row__icon">
                        <Icon name="document" size={16} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="strong truncate">{doc.label}</p>
                        <p className="faint" style={{ fontSize: 11.5 }}>
                          Uploaded {doc.uploaded}
                        </p>
                      </div>
                      <Badge tone={DOC_TONE[state]}>
                        {state[0].toUpperCase() + state.slice(1)}
                      </Badge>
                      <Button size="sm" icon="eye" aria-label="Open document" onClick={() => notify('Opening document')} />
                    </div>
                  );
                })}
              </div>
            </section>

            {open.rating > 0 && (
              <section>
                <h3 className="section-title">Rating breakdown</h3>
                <div className="stack" style={{ gap: 8 }}>
                  {[
                    { stars: 5, share: 78 },
                    { stars: 4, share: 15 },
                    { stars: 3, share: 5 },
                    { stars: 2, share: 1 },
                    { stars: 1, share: 1 },
                  ].map((bucket) => (
                    <div className="row" key={bucket.stars} style={{ gap: 10 }}>
                      <span className="faint" style={{ width: 30, fontSize: 12 }}>
                        {bucket.stars} ★
                      </span>
                      <span style={{ flex: 1 }}>
                        <Progress value={bucket.share} tone="yellow" />
                      </span>
                      <span className="mono faint" style={{ width: 34, fontSize: 12 }}>
                        {bucket.share}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </Drawer>
      )}

      {rejecting && (
        <Modal
          title={`Reject ${rejecting.name}?`}
          subtitle="The applicant is notified by email and the profile is kept as blocked."
          onClose={() => {
            setRejecting(null);
            setReason('');
          }}
          footer={
            <>
              <Button
                onClick={() => {
                  setRejecting(null);
                  setReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                icon="x"
                disabled={reason.trim().length < 5}
                onClick={() => {
                  setStatus(rejecting.id, 'blocked', `${rejecting.name} rejected and blocked`);
                  setRejecting(null);
                  setReason('');
                  setOpen(null);
                }}
              >
                Reject application
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <Note tone="danger" icon="alert">
              Rejection moves the application out of the queue and blocks the profile.
              Uploaded documents are retained for 90 days as the verification policy requires.
            </Note>
            <label className="field__label" htmlFor="reject-reason">
              Reason for rejection
            </label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. Certification could not be verified with the issuing body."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </Modal>
      )}

      {draft && (
        <Modal
          wide
          title="Create astrologer"
          subtitle="Adds the profile directly — no application or invite step"
          onClose={() => setDraft(null)}
          footer={
            <>
              <Button onClick={() => setDraft(null)}>Cancel</Button>
              <Button
                variant="primary"
                icon="check"
                disabled={!draftValid}
                onClick={createAstrologer}
              >
                Create astrologer
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Note tone="info" icon="info">
              A profile created here skips document verification. Upload the verification
              pack from the profile drawer once the astrologer sends it across.
            </Note>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Full name">
                <Input
                  placeholder="e.g. Pt. Rajesh Sharma"
                  value={draft.name}
                  onChange={setDraftField('name')}
                />
              </Field>
              <Field label="Mobile number">
                <Input
                  placeholder="+91 98765 43210"
                  value={draft.phone}
                  onChange={setDraftField('phone')}
                />
              </Field>
            </div>

            <Field label="Email address" hint="Used for the astrologer app sign-in">
              <Input
                type="email"
                placeholder="name@shreeastro.com"
                value={draft.email}
                onChange={setDraftField('email')}
              />
            </Field>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Expertise" hint="Comma separated — shown under the name">
                <Input
                  placeholder="Vedic Astrology, KP System"
                  value={draft.skills}
                  onChange={setDraftField('skills')}
                />
              </Field>
              <Field label="Languages">
                <Input
                  placeholder="Hindi, English"
                  value={draft.languages}
                  onChange={setDraftField('languages')}
                />
              </Field>
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Experience (years)">
                <Input
                  type="number"
                  min="0"
                  placeholder="12"
                  value={draft.experience}
                  onChange={setDraftField('experience')}
                />
              </Field>
              <Field label="Chat rate (₹ / min)">
                <Input
                  type="number"
                  min="1"
                  placeholder="20"
                  value={draft.chatRate}
                  onChange={setDraftField('chatRate')}
                />
              </Field>
              <Field label="Call rate (₹ / min)">
                <Input
                  type="number"
                  min="1"
                  placeholder="28"
                  value={draft.callRate}
                  onChange={setDraftField('callRate')}
                />
              </Field>
            </div>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field
                label="Platform commission (%)"
                hint={`Astrologer keeps ${100 - (Number(draft.commission) || 0)}%`}
              >
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.commission}
                  onChange={setDraftField('commission')}
                />
              </Field>
              <Field label="Availability">
                <Input
                  placeholder="Mon–Sat · 9 AM – 9 PM"
                  value={draft.availability}
                  onChange={setDraftField('availability')}
                />
              </Field>
            </div>

            <Field
              label="Status"
              hint="Approved profiles appear in the apps straight away; blocked ones stay hidden"
            >
              <Select
                value={draft.status}
                onChange={setDraftField('status')}
                options={LISTING_STATUS}
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AstrologersPage;
