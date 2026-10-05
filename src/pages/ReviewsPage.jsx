/**
 * Reviews — what seekers wrote after a consultation, a puja or a delivered
 * product, and the moderation controls the public pages respect.
 *
 * Nothing here edits a review. Hiding takes it off the public page, flagging
 * does the same with a reason on file, pinning lifts it to the top, and a
 * reply is printed under it. The seeker's words stay as they were.
 */

import { useState } from 'react';
import { DataTable } from '../components/DataTable';
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
  Note,
  StatCard,
  Textarea,
  ToggleRow,
  Thumb,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import { listReviews, moderateReview } from '../services/admin';
import { can } from '../services/session';
import { count, dateTime, duration, label } from '../utils/format';
import { mediaUrl } from '../utils/media';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: '5', label: '5 ★' },
  { key: '4', label: '4 ★' },
  { key: 'low', label: '≤ 3 ★' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'hidden', label: 'Hidden' },
];

const KINDS = [
  { key: 'all', label: 'All kinds' },
  { key: 'consultation', label: 'Consultation' },
  { key: 'puja', label: 'Puja' },
  { key: 'product', label: 'Products' },
];

/** The listing query each filter chip asks for; ratings ≤ 3 are narrowed client-side. */
const FILTER_QUERY = {
  all: {},
  5: { rating: 5 },
  4: { rating: 4 },
  low: {},
  flagged: { flagged: true },
  hidden: { hidden: true },
};

const PAGE_LIMIT = 200;

/** Five stars, the filled ones in the brand colour. */
export function Stars({ value, size = 13 }) {
  const rating = Math.round(Number(value) || 0);
  return (
    <span className="row nowrap" style={{ gap: 1 }} aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon
          key={star}
          name="star"
          size={size}
          strokeWidth={1.6}
          style={{
            color: star <= rating ? '#F59E0B' : 'var(--border-card)',
            fill: star <= rating ? '#F59E0B' : 'none',
          }}
        />
      ))}
    </span>
  );
}

/** The review's subject — the astrologer consulted, the puja performed or the product bought. */
const about = (row) =>
  row.kind === 'puja'
    ? row.puja?.name || 'Puja'
    : row.kind === 'product'
      ? row.product?.name || 'Product'
      : row.astrologer?.name || 'Astrologer';

/** "Puja review", "Product review" or "Chat review". */
const kindLabel = (row) =>
  row.kind === 'puja' ? 'Puja' : row.kind === 'product' ? 'Product' : label(row.channel || 'consultation');

/** Product reviews link back to the catalogue; the rest have no page of their own. */
const SubjectLink = ({ row, children }) =>
  row.kind === 'product' ? (
    <a
      href="#/products"
      onClick={(event) => event.stopPropagation()}
      title="Open Products"
      style={{ textDecoration: 'underline', textDecorationColor: 'var(--border-strong)' }}
    >
      {children}
    </a>
  ) : (
    children
  );

const reviewer = (row) => row.reviewer || row.user || {};

export function ReviewsPage({ notify, query = {} }) {
  const [filter, setFilter] = useState('all');
  /** `#/reviews?kind=product&search=Mala` (the Products editor links here) preselects the chip and the search box. */
  const [kind, setKind] = useState(() =>
    KINDS.some((item) => item.key === query.kind) ? query.kind : 'all',
  );
  const initialSearch = typeof query.search === 'string' ? query.search : '';
  const [openKey, setOpenKey] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [reply, setReply] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [run, busy] = useAction(notify);

  const canView = can('reviews.view') || can('reviews.manage');
  const canManage = can('reviews.manage');

  const { data, loading, error, reload } = useApi(
    () =>
      listReviews({
        ...FILTER_QUERY[filter],
        kind: kind === 'all' ? undefined : kind,
        limit: PAGE_LIMIT,
      }),
    [filter, kind],
    { skip: !canView },
  );

  const all = data?.items ?? [];
  const rows = filter === 'low' ? all.filter((row) => Number(row.rating) <= 3) : all;

  const summary = data?.summary;
  const average =
    summary?.average ??
    (rows.length ? rows.reduce((sum, row) => sum + (Number(row.rating) || 0), 0) / rows.length : 0);
  const total = summary?.count ?? data?.total ?? rows.length;
  const flaggedCount = rows.filter((row) => row.flagged).length;
  const pinnedCount = rows.filter((row) => row.pinned).length;

  /** The drawer's row: the fresh copy from the list when it is still there, else the one it opened with. */
  const open = openKey ? rows.find((row) => `${row.kind}:${row.id}` === openKey) ?? snapshot : null;

  const openReview = (row) => {
    setSnapshot(row);
    setReply(null);
    setFlagReason(row.flagReason || '');
    setFlagging(false);
    setOpenKey(`${row.kind}:${row.id}`);
  };

  const closeReview = () => {
    setOpenKey(null);
    setSnapshot(null);
    setReply(null);
    setFlagging(false);
  };

  const moderate = (row, patch, success, after) =>
    run(() => moderateReview(row.kind, row.id, patch), {
      success,
      onDone: async (result) => {
        const updated = result?.review || result?.item;
        if (updated && open && updated.id === open.id) setSnapshot({ ...open, ...updated });
        else if (open) setSnapshot({ ...open, ...patch });
        after?.();
        await reload();
      },
    });

  const saveReply = () =>
    moderate(
      open,
      { reply: (reply ?? '').trim() },
      reply?.trim() ? 'Reply saved' : 'Reply removed',
      () => setReply(null),
    );

  const submitFlag = () =>
    moderate(open, { flagged: true, flagReason: flagReason.trim() }, 'Review flagged', () =>
      setFlagging(false),
    );

  const columns = [
    {
      key: 'reviewerName',
      label: 'Reviewer',
      sortable: true,
      render: (row) => (
        <Identity
          name={reviewer(row).name || 'Seeker'}
          meta={dateTime(row.createdAt)}
          src={reviewer(row).avatarUrl}
          size="sm"
        />
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (row) => <Stars value={row.rating} />,
    },
    {
      key: 'comment',
      label: 'Review',
      render: (row) => (
        <p className="truncate" style={{ maxWidth: 320, fontSize: 12.5 }}>
          {row.title ? <span className="strong">{row.title} — </span> : null}
          {row.comment || <span className="faint">No comment — rating only</span>}
        </p>
      ),
    },
    {
      key: 'aboutName',
      label: 'About',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong truncate" style={{ maxWidth: 180 }}>
            <SubjectLink row={row}>{about(row)}</SubjectLink>
          </p>
          <p className="faint nowrap" style={{ fontSize: 11.5 }}>
            {kindLabel(row)}
            {row.durationSeconds ? ` · ${duration(row.durationSeconds)}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => <span className="nowrap">{dateTime(row.createdAt)}</span>,
    },
    {
      key: 'flags',
      label: 'Flags',
      render: (row) => (
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {row.pinned && <Badge tone="brand">Pinned</Badge>}
          {row.flagged && <Badge tone="danger">Flagged</Badge>}
          {row.hidden && <Badge tone="neutral">Hidden</Badge>}
          {row.reply && <Badge tone="info">Replied</Badge>}
          {!row.pinned && !row.flagged && !row.hidden && !row.reply && (
            <span className="faint">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Reviews"
        subtitle="Consultation, puja and product reviews — pin the best, hide or flag the rest, reply to any"
        actions={<Button icon="refresh" onClick={reload}>Refresh</Button>}
      />

      {!canView ? (
        <Note tone="warning" icon="lock">
          Your role does not include <strong>reviews.view</strong>. Ask a super admin for access.
        </Note>
      ) : (
        <>
          <div className="grid grid--stats" style={{ marginBottom: 16 }}>
            <StatCard
              label="Average rating"
              value={average ? `${Number(average).toFixed(1)} ★` : '—'}
              icon="star"
              tone="yellow"
              hint={summary ? 'across all public reviews' : 'in this view'}
            />
            <StatCard
              label="Total reviews"
              value={count(total)}
              icon="messageSquare"
              tone="brand"
              hint={summary ? 'public' : 'in this view'}
            />
            <StatCard label="Flagged" value={count(flaggedCount)} icon="flag" hint="in this view" />
            <StatCard label="Pinned" value={count(pinnedCount)} icon="pin" tone="success" hint="in this view" />
          </div>

          <DataTable
            columns={columns}
            rows={rows.map((row) => ({
              ...row,
              key: `${row.kind}:${row.id}`,
              reviewerName: reviewer(row).name || '',
              aboutName: about(row),
            }))}
            loading={loading}
            error={error}
            onRetry={reload}
            searchKeys={['reviewerName', 'comment', 'title', 'aboutName']}
            searchPlaceholder="Search by reviewer, words or subject…"
            initialQuery={initialSearch}
            onRowClick={openReview}
            toolbar={
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <Chips value={filter} onChange={setFilter} items={FILTERS} />
                <Chips value={kind} onChange={setKind} items={KINDS} />
              </div>
            }
            empty={{ icon: 'star', title: 'No reviews in this view' }}
          />
        </>
      )}

      {open && (
        <Drawer
          wide
          title={`${reviewer(open).name || 'Seeker'} on ${about(open)}`}
          subtitle={dateTime(open.createdAt)}
          onClose={closeReview}
        >
          <div className="stack" style={{ gap: 18 }}>
            <div className="profile-head">
              <Identity
                name={reviewer(open).name || 'Seeker'}
                meta={`${kindLabel(open)} review`}
                src={reviewer(open).avatarUrl}
                size="lg"
              />
              <div className="row" style={{ gap: 6 }}>
                {open.pinned && <Badge tone="brand">Pinned</Badge>}
                {open.flagged && <Badge tone="danger">Flagged</Badge>}
                {open.hidden && <Badge tone="neutral">Hidden</Badge>}
              </div>
            </div>

            <section>
              <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                <Stars value={open.rating} size={18} />
                <span className="strong">{open.rating} / 5</span>
              </div>
              {open.title && (
                <p className="strong" style={{ fontSize: 14, marginBottom: 4 }}>
                  {open.title}
                </p>
              )}
              <p style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {open.comment || <span className="faint">No comment — rating only.</span>}
              </p>
              {Array.isArray(open.images) && open.images.length > 0 && (
                <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {open.images.map((src) => (
                    <a key={src} href={mediaUrl(src)} target="_blank" rel="noreferrer" title="Open photo">
                      <Thumb src={src} size={64} />
                    </a>
                  ))}
                </div>
              )}
            </section>

            {open.flagged && open.flagReason && (
              <Note tone="danger" icon="flag">
                Flagged: {open.flagReason}
              </Note>
            )}

            <section>
              <h3 className="section-title">About</h3>
              <DetailList
                rows={[
                  {
                    label: open.kind === 'puja' ? 'Puja' : open.kind === 'product' ? 'Product' : 'Astrologer',
                    value: <SubjectLink row={open}>{about(open)}</SubjectLink>,
                  },
                  ...(open.kind === 'product' && open.product?.slug
                    ? [{ label: 'Slug', value: <span className="mono">{open.product.slug}</span> }]
                    : []),
                  ...(open.kind === 'consultation'
                    ? [
                        { label: 'Channel', value: label(open.channel || '—') },
                        { label: 'Duration', value: duration(open.durationSeconds) },
                      ]
                    : []),
                  { label: 'Reviewed', value: dateTime(open.createdAt) },
                  { label: 'Reference', value: <span className="mono">{open.id}</span> },
                ]}
              />
            </section>

            <section>
              <h3 className="section-title">Reply</h3>
              <div className="stack" style={{ gap: 12 }}>
                <Field hint="Printed under the review on the public page, as Shree Astro">
                  <Textarea
                    rows={3}
                    placeholder="Thank you for sharing this…"
                    value={reply ?? open.reply ?? ''}
                    disabled={!canManage}
                    onChange={(event) => setReply(event.target.value)}
                  />
                </Field>
                {canManage && (
                  <div>
                    <Button variant="primary" icon="check" disabled={busy || reply === null} onClick={saveReply}>
                      Save reply
                    </Button>
                  </div>
                )}
              </div>
            </section>

            {canManage && (
              <section>
                <h3 className="section-title">Moderation</h3>
                <ToggleRow
                  title="Pinned"
                  desc="Shown first on the public page"
                  on={Boolean(open.pinned)}
                  onChange={(value) => moderate(open, { pinned: value }, value ? 'Review pinned' : 'Review unpinned')}
                />
                <ToggleRow
                  title="Hidden"
                  desc="Kept on record but not shown publicly"
                  on={Boolean(open.hidden)}
                  onChange={(value) => moderate(open, { hidden: value }, value ? 'Review hidden' : 'Review visible again')}
                />
                <ToggleRow
                  title="Flagged"
                  desc="Hidden from the public page, with a reason on file"
                  on={Boolean(open.flagged) || flagging}
                  onChange={(value) => {
                    if (value) {
                      setFlagging(true);
                    } else if (open.flagged) {
                      moderate(open, { flagged: false, flagReason: '' }, 'Flag cleared');
                    } else {
                      setFlagging(false);
                    }
                  }}
                />
                {flagging && !open.flagged && (
                  <div className="stack" style={{ gap: 10, marginTop: 12 }}>
                    <Field label="Reason" hint="Internal — why this review is being flagged">
                      <Textarea
                        rows={2}
                        placeholder="e.g. Contains a phone number / abusive language"
                        value={flagReason}
                        onChange={(event) => setFlagReason(event.target.value)}
                      />
                    </Field>
                    <div className="row" style={{ gap: 8 }}>
                      <Button onClick={() => setFlagging(false)}>Cancel</Button>
                      <Button
                        variant="danger"
                        icon="flag"
                        disabled={busy || !flagReason.trim()}
                        onClick={submitFlag}
                      >
                        Flag review
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}

export default ReviewsPage;
