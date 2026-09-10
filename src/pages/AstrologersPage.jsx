/**
 * Astrologer Management — the marketplace listing, the approval queue with its
 * document checks, and the per-astrologer rates, commission and earnings the
 * astrologer app reads back.
 *
 * Every row here applied through the astrologer app's own registration
 * wizard and arrives as an application to review — there is no admin-side
 * "create an astrologer" shortcut.
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
  Drawer,
  Field,
  Identity,
  Input,
  LoadingBlock,
  Modal,
  Note,
  Progress,
  StatCard,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  approveAstrologer,
  getAstrologer,
  getDashboard,
  listAstrologers,
  rejectAstrologer,
  reviewBankAccount,
  reviewDocument,
  reviewPriceChange,
  setAstrologerStatus,
} from '../services/admin';
import { can } from '../services/session';
import { count, date, label, money, orDash, phone as formatPhone } from '../utils/format';

/**
 * The tabs, and what each asks the API for.
 *
 * "Applications" is everything short of a decision — the wizard states an
 * astrologer walks through before an admin sees them.
 */
/**
 * Every stage short of a decision — the wizard states an astrologer walks
 * through before an admin approves or rejects them. Document/bank-account
 * review never moves `applicationStatus` on its own (that's a fully separate
 * action — see `submitApproval`), so an astrologer can sit in any of these
 * for a while; the Approve/Reject actions below need to reach all of them,
 * not just the last one, or an admin reviewing documents on an
 * earlier-stage application would have no way to actually approve it.
 */
const PENDING_STATUSES = [
  'registered',
  'personal_submitted',
  'professional_submitted',
  'documents_submitted',
  'bank_submitted',
  'under_review',
];
const isPendingReview = (applicationStatus) => PENDING_STATUSES.includes(applicationStatus);

const FILTERS = [
  { key: 'all', label: 'All', query: {} },
  { key: 'approved', label: 'Approved', query: { applicationStatus: 'approved', status: 'active' } },
  { key: 'pending', label: 'Pending', query: { applicationStatus: PENDING_STATUSES.join(',') } },
  { key: 'blocked', label: 'Blocked', query: { status: 'blocked' } },
];

const REVIEW_TONE = { approved: 'success', pending: 'warning', rejected: 'danger' };

/** Opening rates, offered when approving an application. */
const BLANK_APPROVAL = { chatRate: '20', callRate: '30', commission: '25' };

/** Both rates must be real money and the commission a real percentage — an astrologer cannot take work priced at ₹0/negative, or split earnings outside 0–100%. */
const isApprovalValid = (approval) =>
  Number(approval.chatRate) > 0 &&
  Number(approval.callRate) > 0 &&
  Number(approval.commission) >= 0 &&
  Number(approval.commission) <= 100;

const PAGE_LIMIT = 100;

export function AstrologersPage({ notify }) {
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [approval, setApproval] = useState(null);
  const [run, busy] = useAction(notify);

  const query = FILTERS.find((item) => item.key === filter)?.query ?? {};

  const { data, loading, error, reload } = useApi(
    () => listAstrologers({ ...query, limit: PAGE_LIMIT }),
    [filter],
  );
  const { data: stats } = useApi(() => getDashboard(7), []);
  const { data: detail, loading: loadingDetail, reload: reloadDetail } = useApi(
    () => getAstrologer(openId),
    [openId],
    { skip: !openId },
  );

  const rows = data?.items ?? [];
  const canApprove = can('astrologers.approve');
  const canManage = can('astrologers.manage');

  const after = async () => {
    await reload();
    if (openId) await reloadDetail();
  };

  const changeStatus = (id, status, name) =>
    run(() => setAstrologerStatus(id, status, status === 'blocked' ? 'Blocked from the admin panel' : undefined), {
      success: `${name} ${status === 'blocked' ? 'blocked' : 'unblocked'}`,
      onDone: after,
    });

  const submitApproval = () =>
    run(
      () =>
        approveAstrologer(approval.id, {
          commissionPercent: Number(approval.commission),
          services: [
            {
              type: 'chat',
              ratePerMinute: Number(approval.chatRate),
              isEnabled: true,
            },
            { type: 'call', ratePerMinute: Number(approval.callRate), isEnabled: true },
          ],
        }),
      {
        success: `${approval.name} approved and published`,
        onDone: async () => {
          setApproval(null);
          await after();
        },
      },
    );

  const submitRejection = () =>
    run(() => rejectAstrologer(rejecting.id, reason.trim()), {
      success: `${rejecting.name} rejected`,
      onDone: async () => {
        setRejecting(null);
        setReason('');
        setOpenId(null);
        await reload();
      },
    });

  const columns = [
    {
      key: 'name',
      label: 'Astrologer',
      sortable: true,
      render: (row) => (
        <Identity
          name={row.name}
          src={row.photoUrl}
          meta={[row.astroCode, label(row.expertise) || row.phone || row.email]
            .filter(Boolean)
            .join(' · ')}
          online={row.applicationStatus === 'approved' ? row.online : undefined}
        />
      ),
    },
    {
      key: 'experienceYears',
      label: 'Experience',
      sortable: true,
      render: (row) => (row.experienceYears ? `${row.experienceYears} yrs` : '—'),
    },
    {
      key: 'rates',
      label: 'Rates',
      /** No rate yet means they have not finished setting themselves up. */
      render: (row) =>
        row.rates?.chat || row.rates?.call ? (
          <span className="rate-cell">
            <span>
              <Icon name="chat" size={12} /> {row.rates.chat ? money(row.rates.chat.now) : '—'}
            </span>
            <span>
              <Icon name="phone" size={12} /> {row.rates.call ? money(row.rates.call.now) : '—'}
            </span>
          </span>
        ) : (
          <span className="faint">Not set</span>
        ),
    },
    {
      key: 'consultations',
      label: 'Consults',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{count(row.consultations)}</span>,
    },
    {
      key: 'earnings',
      label: 'Earnings',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{money(row.earnings)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <div className="row" style={{ gap: 6 }}>
          <StatusBadge status={row.status === 'blocked' ? 'blocked' : row.applicationStatus} />
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) => (
        <RowActions
          actions={
            isPendingReview(row.applicationStatus)
              ? [
                  { label: 'Review', icon: 'eye', onClick: () => setOpenId(row.id) },
                  ...(canApprove
                    ? [
                        {
                          label: 'Approve',
                          icon: 'check',
                          variant: 'success',
                          onClick: () => setApproval({ ...BLANK_APPROVAL, id: row.id, name: row.name }),
                        },
                        { label: 'Reject', icon: 'x', variant: 'danger', onClick: () => setRejecting(row) },
                      ]
                    : []),
                ]
              : [
                  { label: 'View', icon: 'eye', onClick: () => setOpenId(row.id) },
                  ...(canManage
                    ? [
                        row.status === 'blocked'
                          ? {
                              label: 'Unblock',
                              icon: 'checkCircle',
                              variant: 'success',
                              onClick: () => changeStatus(row.id, 'active', row.name),
                            }
                          : {
                              label: 'Block',
                              icon: 'ban',
                              variant: 'danger',
                              onClick: () => changeStatus(row.id, 'blocked', row.name),
                            },
                      ]
                    : []),
                ]
          }
        />
      ),
    },
  ];

  const open = detail?.astrologer;
  const profile = detail?.profile;
  const documents = detail?.documents ?? [];
  const bankAccounts = detail?.bankAccounts ?? [];
  const priceChanges = (detail?.priceChangeRequests ?? []).filter((r) => r.status === 'pending');

  return (
    <div className="page">
      <PageHeader
        title="Astrologer Management"
        subtitle="Approve applications, verify documents and manage the marketplace listing"
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="Approved astrologers"
          value={count(stats?.astrologers?.active ?? 0)}
          icon="sparkle"
          tone="yellow"
          hint="listed on the marketplace"
        />
        <StatCard
          label="Online right now"
          value={count(rows.filter((row) => row.online).length)}
          icon="activity"
          tone="success"
          hint="in this view"
        />
        <StatCard
          label="Applications pending"
          value={count(stats?.astrologers?.pendingApplications ?? 0)}
          icon="inbox"
          tone="brand"
          hint="awaiting verification"
        />
        <StatCard
          label="Live consultations"
          value={count(stats?.consultations?.ongoing ?? 0)}
          icon="chat"
          hint="running now"
        />
      </div>

      {stats?.astrologers?.pendingApplications > 0 && filter !== 'pending' && (
        <div style={{ marginBottom: 16 }}>
          <Note tone="info" icon="alert">
            <strong>{stats.astrologers.pendingApplications} applications</strong> are waiting on
            document verification. Approving publishes the astrologer to the marketplace
            immediately.
          </Note>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['name', 'email', 'astroCode']}
        searchPlaceholder="Search by name or email…"
        onRowClick={(row) => setOpenId(row.id)}
        toolbar={<Chips value={filter} onChange={setFilter} items={FILTERS} />}
        empty={{ icon: 'sparkle', title: 'No astrologers in this view' }}
      />

      {openId && (
        <Drawer
          wide
          title={open?.name || 'Loading…'}
          subtitle={open ? `${open.astroCode || ''} · joined ${date(open.createdAt)}` : ''}
          onClose={() => setOpenId(null)}
          footer={
            open && isPendingReview(open.applicationStatus) ? (
              canApprove && (
                <>
                  <Button variant="danger" icon="x" onClick={() => setRejecting(open)}>
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    icon="check"
                    onClick={() => setApproval({ ...BLANK_APPROVAL, id: open._id, name: open.name })}
                  >
                    Approve &amp; publish
                  </Button>
                </>
              )
            ) : open && canManage ? (
              open.status === 'blocked' ? (
                <Button
                  variant="success"
                  icon="checkCircle"
                  disabled={busy}
                  onClick={() => changeStatus(open._id, 'active', open.name)}
                >
                  Unblock
                </Button>
              ) : (
                <Button
                  variant="danger"
                  icon="ban"
                  disabled={busy}
                  onClick={() => changeStatus(open._id, 'blocked', open.name)}
                >
                  Block
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
                  meta={label(open.expertise) || open.email}
                  size="lg"
                  online={open.presence?.isOnline}
                />
                <div className="row" style={{ gap: 6 }}>
                  <StatusBadge
                    status={open.status === 'blocked' ? 'blocked' : open.applicationStatus}
                  />
                  <Badge tone={REVIEW_TONE[profile?.verification?.documentsStatus] || 'neutral'}>
                    Documents · {profile?.verification?.documentsStatus || 'pending'}
                  </Badge>
                </div>
              </div>

              {open.createdVia === 'admin' && !open.profileCompletedAt && (
                <Note tone="info" icon="info">
                  This account was created from the panel. They complete their own profile —
                  mobile number, expertise, languages and rates — after signing in with{' '}
                  <strong>{open.email}</strong>. They are not listed to seekers until they
                  have set a rate.
                </Note>
              )}

              <div className="mini-stats">
                <div>
                  <p className="eyebrow">Consults</p>
                  <p className="mini-stats__value">{count(open.metrics?.totalConsultations)}</p>
                </div>
                <div>
                  <p className="eyebrow">Rating</p>
                  <p className="mini-stats__value">{open.metrics?.rating || '—'}</p>
                </div>
                <div>
                  <p className="eyebrow">Earnings</p>
                  <p className="mini-stats__value">{money(open.earnings?.lifetime)}</p>
                </div>
                <div>
                  <p className="eyebrow">Payable</p>
                  <p className="mini-stats__value">{money(open.earnings?.balance)}</p>
                </div>
              </div>

              <section>
                <h3 className="section-title">Profile</h3>
                <DetailList
                  rows={[
                    { label: 'Email', value: orDash(open.email) },
                    { label: 'Mobile', value: open.phone?.number ? formatPhone(open.phone.number) : '—' },
                    { label: 'Expertise', value: orDash(label(open.expertise)) },
                    { label: 'Languages', value: orDash(label(open.languages)) },
                    {
                      label: 'Experience',
                      value: open.experienceYears ? `${open.experienceYears} years` : '—',
                    },
                    { label: 'Availability', value: orDash(open.availabilityNote) },
                  ]}
                />
              </section>

              <section>
                <h3 className="section-title">Rates &amp; commission</h3>
                <DetailList
                  rows={[
                    ...(open.services || []).map((service) => ({
                      label: label(service.type),
                      value: service.isEnabled
                        ? `${money(service.effectiveRate ?? service.ratePerMinute)} / min`
                        : 'Switched off',
                    })),
                    ...(open.services?.length ? [] : [{ label: 'Rates', value: 'Not set yet' }]),
                    { label: 'Platform commission', value: `${open.commissionPercent}%` },
                    { label: 'Astrologer share', value: `${100 - open.commissionPercent}%` },
                  ]}
                />
              </section>

              {priceChanges.length > 0 && (
                <section>
                  <h3 className="section-title">Pending price changes</h3>
                  <div className="stack" style={{ gap: 8 }}>
                    {priceChanges.map((request) => (
                      <div className="doc-row" key={request._id}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="strong truncate">
                            {label(request.service)} · {money(request.oldRate)} →{' '}
                            {money(request.requestedRate)}
                          </p>
                          <p className="faint" style={{ fontSize: 11.5 }}>
                            {request.reason || 'No reason given'}
                          </p>
                        </div>
                        {canApprove && (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              icon="check"
                              onClick={() =>
                                run(
                                  () => reviewPriceChange(open._id, request._id, 'approved'),
                                  { success: 'Price change approved', onDone: after },
                                )
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              icon="x"
                              onClick={() =>
                                run(
                                  () =>
                                    reviewPriceChange(
                                      open._id,
                                      request._id,
                                      'rejected',
                                      'Not approved at this time.',
                                    ),
                                  { success: 'Price change rejected', onDone: after },
                                )
                              }
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="section-title">Verification documents</h3>
                {documents.length === 0 ? (
                  <p className="faint" style={{ fontSize: 12.5 }}>
                    Nothing filed yet.
                  </p>
                ) : (
                  <div className="stack" style={{ gap: 8 }}>
                    {documents.map((doc) => (
                      <div className="doc-row" key={doc._id}>
                        <span className="doc-row__icon">
                          <Icon name="document" size={16} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="strong truncate">{label(doc.type)}</p>
                          <p className="faint" style={{ fontSize: 11.5 }}>
                            {doc.idNumber ? `${doc.idNumber} · ` : ''}
                            {doc.file?.fileName || 'Uploaded'}
                          </p>
                        </div>
                        <Badge tone={REVIEW_TONE[doc.status]}>{label(doc.status)}</Badge>
                        {doc.file?.url && (
                          <Button
                            size="sm"
                            icon="eye"
                            aria-label="Open document"
                            onClick={() => window.open(doc.file.url, '_blank', 'noopener')}
                          />
                        )}
                        {canApprove && doc.status !== 'approved' && (
                          <Button
                            size="sm"
                            variant="success"
                            icon="check"
                            onClick={() =>
                              run(() => reviewDocument(open._id, doc._id, 'approved'), {
                                success: 'Document approved',
                                onDone: after,
                              })
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="section-title">Bank accounts</h3>
                {bankAccounts.length === 0 ? (
                  <p className="faint" style={{ fontSize: 12.5 }}>
                    No payout account on file yet.
                  </p>
                ) : (
                  <div className="stack" style={{ gap: 8 }}>
                    {bankAccounts.map((account) => (
                      <div className="doc-row" key={account._id}>
                        <span className="doc-row__icon">
                          <Icon name="wallet" size={16} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="strong truncate">{account.bankName}</p>
                          <p className="faint" style={{ fontSize: 11.5 }}>
                            {account.holderName} · ••••{String(account.accountNumber).slice(-4)} ·{' '}
                            {account.ifsc}
                          </p>
                        </div>
                        <Badge tone={REVIEW_TONE[account.status]}>{label(account.status)}</Badge>
                        {canApprove && account.status !== 'approved' && (
                          <Button
                            size="sm"
                            variant="success"
                            icon="check"
                            onClick={() =>
                              run(() => reviewBankAccount(open._id, account._id, 'approved'), {
                                success: 'Bank account approved',
                                onDone: after,
                              })
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {open.metrics?.ratingCount > 0 && (
                <section>
                  <h3 className="section-title">Rating breakdown</h3>
                  <div className="stack" style={{ gap: 8 }}>
                    {[
                      { stars: 5, value: open.metrics.ratingBreakdown?.five },
                      { stars: 4, value: open.metrics.ratingBreakdown?.four },
                      { stars: 3, value: open.metrics.ratingBreakdown?.three },
                      { stars: 2, value: open.metrics.ratingBreakdown?.two },
                      { stars: 1, value: open.metrics.ratingBreakdown?.one },
                    ].map((bucket) => {
                      const share = Math.round(
                        ((bucket.value || 0) / open.metrics.ratingCount) * 100,
                      );
                      return (
                        <div className="row" key={bucket.stars} style={{ gap: 10 }}>
                          <span className="faint" style={{ width: 30, fontSize: 12 }}>
                            {bucket.stars} ★
                          </span>
                          <span style={{ flex: 1 }}>
                            <Progress value={share} tone="yellow" />
                          </span>
                          <span className="mono faint" style={{ width: 34, fontSize: 12 }}>
                            {share}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </Drawer>
      )}

      {approval && (
        <Modal
          title={`Approve ${approval.name}?`}
          subtitle="Approving mints their astro code and publishes them to the marketplace"
          onClose={() => setApproval(null)}
          footer={
            <>
              <Button onClick={() => setApproval(null)}>Cancel</Button>
              <Button
                variant="primary"
                icon="check"
                disabled={busy || !isApprovalValid(approval)}
                onClick={submitApproval}
              >
                Approve &amp; publish
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Note tone="info" icon="info">
              An astrologer cannot take work without a rate, so their opening rates are set
              here. Any change after this has to be requested by them and approved by you.
            </Note>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Chat rate (₹ / min)">
                <Input
                  type="number"
                  min="1"
                  value={approval.chatRate}
                  onChange={(event) =>
                    setApproval((current) => ({ ...current, chatRate: event.target.value }))
                  }
                />
              </Field>
              <Field label="Call rate (₹ / min)">
                <Input
                  type="number"
                  min="1"
                  value={approval.callRate}
                  onChange={(event) =>
                    setApproval((current) => ({ ...current, callRate: event.target.value }))
                  }
                />
              </Field>
            </div>

            <Field
              label="Platform commission (%)"
              hint={`Astrologer keeps ${100 - (Number(approval.commission) || 0)}%`}
            >
              <Input
                type="number"
                min="0"
                max="100"
                value={approval.commission}
                onChange={(event) =>
                  setApproval((current) => ({ ...current, commission: event.target.value }))
                }
              />
            </Field>
          </div>
        </Modal>
      )}

      {rejecting && (
        <Modal
          title={`Reject ${rejecting.name}?`}
          subtitle="The applicant is notified and can no longer sign in."
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
                disabled={reason.trim().length < 5 || busy}
                onClick={submitRejection}
              >
                Reject application
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <Note tone="danger" icon="alert">
              Rejection moves the application out of the queue and stops them signing in. The
              reason below is shown to them in the app.
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

    </div>
  );
}

export default AstrologersPage;
