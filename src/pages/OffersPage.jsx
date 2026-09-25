/**
 * Offers & Coupons — the discount codes seekers type at checkout, and the
 * curated "Festival Discounts" cards the website's offers page shows.
 *
 * A coupon that has been redeemed cannot be deleted (the redemptions point at
 * it); pausing it is the way to stop it. Festival cards are purely editorial —
 * they link somewhere and may name a coupon, but carry no discount of their own.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Checkbox,
  Chips,
  DetailList,
  Drawer,
  Field,
  ImagePicker,
  Input,
  LoadingBlock,
  Modal,
  Note,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  Thumb,
  Toggle,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  createCoupon,
  createFestivalOffer,
  deleteCoupon,
  deleteFestivalOffer,
  listCouponRedemptions,
  listCoupons,
  listFestivalOffers,
  setCouponStatus,
  setFestivalOfferStatus,
  updateCoupon,
  updateFestivalOffer,
} from '../services/admin';
import { can } from '../services/session';
import { count, date, dateTime, label, money } from '../utils/format';

const TABS = [
  { key: 'coupons', label: 'Coupons' },
  { key: 'festivals', label: 'Festival offers' },
];

const COUPON_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'expired', label: 'Expired' },
];

const KINDS = [
  { value: 'percent', label: 'Percent off' },
  { value: 'flat', label: 'Flat ₹ off' },
];

/** What a coupon can be applied to — the contexts the API validates against. */
const CONTEXTS = [
  { value: 'order', label: 'Store orders' },
  { value: 'puja', label: 'Puja bookings' },
  { value: 'topup', label: 'Wallet top-ups' },
];

const TONES = [
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
];

/** Where a festival card can send the seeker; anything else is typed in. */
const LINKS = [
  { value: '/astrologers', label: 'Astrologers' },
  { value: '/puja', label: 'Pujas' },
  { value: '/store', label: 'Store' },
  { value: '/kundli', label: 'Kundli' },
  { value: '/offers', label: 'Offers page' },
];
const OTHER = 'other';

const BADGES = ['Limited Time', 'Festive', 'Mega Sale', 'Bundle'];

const DAY = 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 100;

/** An ISO date → the `YYYY-MM-DD` a date input holds. */
function dateInput(value) {
  if (!value) return '';
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** `YYYY-MM-DD` → an ISO instant at the start (or end) of that local day. */
function fromDateInput(value, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const at = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
  return at.toISOString();
}

/** "50% OFF" / "₹200 OFF" — the API sends `label`; this covers a row without one. */
const discountLabel = (row) =>
  row.label || (row.kind === 'percent' ? `${row.value}% OFF` : `${money(row.value)} OFF`);

const validity = (row) => {
  if (!row.validFrom && !row.validTo) return 'Always';
  return `${row.validFrom ? date(row.validFrom) : '…'} → ${row.validTo ? date(row.validTo) : 'no end'}`;
};

/* ————————————————————————————————— Coupons */

const BLANK_COUPON = {
  code: '',
  title: '',
  description: '',
  kind: 'percent',
  value: '',
  maxDiscount: '',
  minAmount: '0',
  appliesTo: ['order'],
  validFrom: '',
  validTo: '',
  usageLimit: '',
  perUserLimit: '1',
  isPublic: true,
  tag: '',
  tone: 'orange',
};

const couponToForm = (row) => ({
  id: row.id,
  code: row.code || '',
  title: row.title || '',
  description: row.description || '',
  kind: row.kind || 'percent',
  value: row.value ?? '',
  maxDiscount: row.maxDiscount ?? '',
  minAmount: row.minAmount ?? 0,
  appliesTo: row.appliesTo?.length ? row.appliesTo : [],
  validFrom: dateInput(row.validFrom),
  validTo: dateInput(row.validTo),
  usageLimit: row.usageLimit ?? '',
  perUserLimit: row.perUserLimit ?? 1,
  isPublic: row.isPublic !== false,
  tag: row.tag || '',
  tone: row.tone || 'orange',
  status: row.status,
  usedCount: row.usedCount ?? 0,
});

function validateCoupon(form) {
  const errors = {};
  const code = form.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) errors.code = '3–20 letters or digits, no spaces';
  if (!form.title.trim()) errors.title = 'Give the coupon a title';
  const value = Number(form.value);
  if (form.value === '' || !Number.isInteger(value) || value <= 0) {
    errors.value = 'A whole number above 0';
  } else if (form.kind === 'percent' && value > 100) {
    errors.value = 'A percentage cannot exceed 100';
  }
  if (form.maxDiscount !== '') {
    const max = Number(form.maxDiscount);
    if (!Number.isInteger(max) || max <= 0) errors.maxDiscount = 'A whole number above 0, or blank';
  }
  const min = Number(form.minAmount);
  if (form.minAmount === '' || !Number.isInteger(min) || min < 0) {
    errors.minAmount = 'A whole number, 0 or more';
  }
  if (!form.appliesTo.length) errors.appliesTo = 'Pick at least one';
  if (form.validFrom && form.validTo && form.validTo < form.validFrom) {
    errors.validTo = 'Ends before it starts';
  }
  if (form.usageLimit !== '') {
    const limit = Number(form.usageLimit);
    if (!Number.isInteger(limit) || limit < 1) errors.usageLimit = 'A whole number of 1 or more, or blank';
  }
  const perUser = Number(form.perUserLimit);
  if (form.perUserLimit === '' || !Number.isInteger(perUser) || perUser < 1) {
    errors.perUserLimit = 'A whole number, 1 or more';
  }
  return errors;
}

/* ————————————————————————————————— Festival offers */

const BLANK_FESTIVAL = {
  title: '',
  subtitle: '',
  badge: BADGES[0],
  imageUrl: '',
  startsAt: '',
  endsAt: '',
  linkChoice: LINKS[0].value,
  linkOther: '',
  couponCode: '',
  sortOrder: '0',
};

const festivalToForm = (row) => {
  const known = LINKS.some((item) => item.value === row.linkTo);
  return {
    id: row.id,
    title: row.title || '',
    subtitle: row.subtitle || '',
    badge: row.badge || '',
    imageUrl: row.imageUrl || '',
    startsAt: dateInput(row.startsAt),
    endsAt: dateInput(row.endsAt),
    linkChoice: known ? row.linkTo : OTHER,
    linkOther: known ? '' : row.linkTo || '',
    couponCode: row.couponCode || '',
    sortOrder: row.sortOrder ?? 0,
    status: row.status,
  };
};

function validateFestival(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = 'Give the offer a title';
  if (form.linkChoice === OTHER && !form.linkOther.trim().startsWith('/')) {
    errors.link = 'A site path, starting with /';
  }
  if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) {
    errors.endsAt = 'Ends before it starts';
  }
  const order = Number(form.sortOrder);
  if (form.sortOrder === '' || !Number.isInteger(order)) errors.sortOrder = 'A whole number';
  return errors;
}

export function OffersPage({ notify }) {
  const [tab, setTab] = useState('coupons');
  const [couponFilter, setCouponFilter] = useState('all');
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [deletingCoupon, setDeletingCoupon] = useState(null);
  const [openCoupon, setOpenCoupon] = useState(null);
  const [editingFestival, setEditingFestival] = useState(null);
  const [festivalImage, setFestivalImage] = useState(null);
  const [deletingFestival, setDeletingFestival] = useState(null);
  const [run, busy] = useAction(notify);

  const canView = can('offers.view') || can('offers.manage');
  const canManage = can('offers.manage');

  const coupons = useApi(
    () =>
      listCoupons({
        status: couponFilter === 'all' ? undefined : couponFilter,
        limit: PAGE_LIMIT,
      }),
    [couponFilter],
    { skip: !canView },
  );
  const festivals = useApi(() => listFestivalOffers({ limit: PAGE_LIMIT }), [], {
    skip: !canView || tab !== 'festivals',
  });
  const redemptions = useApi(
    () => listCouponRedemptions(openCoupon?.id, { limit: PAGE_LIMIT }),
    [openCoupon?.id],
    { skip: !openCoupon },
  );

  const couponRows = coupons.data?.items ?? [];
  const festivalRows = festivals.data?.items ?? [];

  const now = new Date().getTime();
  const activeCoupons = couponRows.filter((row) => row.status === 'active');
  const redemptionsTotal = couponRows.reduce((sum, row) => sum + (row.usedCount || 0), 0);
  const expiringSoon = activeCoupons.filter((row) => {
    if (!row.validTo) return false;
    const end = new Date(row.validTo).getTime();
    return end >= now && end - now <= 7 * DAY;
  });
  const pausedCoupons = couponRows.filter((row) => row.status === 'paused');

  /* ——— coupon writes */

  const couponErrors = editingCoupon ? validateCoupon(editingCoupon) : {};
  const couponInvalid = Object.keys(couponErrors).length > 0;

  const saveCoupon = () => {
    const form = editingCoupon;
    const body = {
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim(),
      kind: form.kind,
      value: Number(form.value),
      maxDiscount: form.kind === 'percent' && form.maxDiscount !== '' ? Number(form.maxDiscount) : null,
      minAmount: Number(form.minAmount),
      appliesTo: form.appliesTo,
      validFrom: fromDateInput(form.validFrom),
      validTo: fromDateInput(form.validTo, true),
      usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
      perUserLimit: Number(form.perUserLimit),
      isPublic: form.isPublic,
      tag: form.tag.trim() || null,
      tone: form.tone,
    };
    return run(() => (form.id ? updateCoupon(form.id, body) : createCoupon(body)), {
      success: form.id ? `${body.code} updated` : `${body.code} created`,
      onDone: async () => {
        setEditingCoupon(null);
        await coupons.reload();
      },
    });
  };

  const changeCouponStatus = (row, next) =>
    run(() => setCouponStatus(row.id, next), {
      success: next === 'active' ? `${row.code} is live again` : `${row.code} paused`,
      onDone: async () => {
        await coupons.reload();
        if (openCoupon?.id === row.id) setOpenCoupon({ ...openCoupon, status: next });
      },
    });

  const removeCoupon = () =>
    run(() => deleteCoupon(deletingCoupon.id), {
      success: `${deletingCoupon.code} deleted`,
      onDone: async () => {
        setDeletingCoupon(null);
        if (openCoupon?.id === deletingCoupon.id) setOpenCoupon(null);
        await coupons.reload();
      },
    });

  /* ——— festival writes */

  const festivalErrors = editingFestival ? validateFestival(editingFestival) : {};
  const festivalInvalid = Object.keys(festivalErrors).length > 0;

  const openFestivalEditor = (form) => {
    setFestivalImage(null);
    setEditingFestival(form);
  };

  const saveFestival = () => {
    const form = editingFestival;
    const body = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      badge: form.badge.trim(),
      startsAt: fromDateInput(form.startsAt),
      endsAt: fromDateInput(form.endsAt, true),
      linkTo: form.linkChoice === OTHER ? form.linkOther.trim() : form.linkChoice,
      couponCode: form.couponCode.trim().toUpperCase() || null,
      sortOrder: Number(form.sortOrder),
    };
    return run(
      () =>
        form.id
          ? updateFestivalOffer(form.id, body, festivalImage)
          : createFestivalOffer(body, festivalImage),
      {
        success: form.id ? 'Festival offer updated' : 'Festival offer added',
        onDone: async () => {
          setEditingFestival(null);
          setFestivalImage(null);
          await festivals.reload();
        },
      },
    );
  };

  const changeFestivalStatus = (row, next) =>
    run(() => setFestivalOfferStatus(row.id, next), {
      success: next === 'active' ? `${row.title} is showing` : `${row.title} hidden`,
      onDone: festivals.reload,
    });

  const removeFestival = () =>
    run(() => deleteFestivalOffer(deletingFestival.id), {
      success: `${deletingFestival.title} deleted`,
      onDone: async () => {
        setDeletingFestival(null);
        await festivals.reload();
      },
    });

  /* ——— columns */

  const couponColumns = [
    {
      key: 'code',
      label: 'Coupon',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong mono">{row.code}</p>
          <p className="faint truncate" style={{ fontSize: 11.5, maxWidth: 240 }}>
            {row.title}
          </p>
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Discount',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong nowrap">{discountLabel(row)}</p>
          <p className="faint nowrap" style={{ fontSize: 11.5 }}>
            {row.minAmount ? `min ${money(row.minAmount)}` : 'no minimum'}
            {row.kind === 'percent' && row.maxDiscount ? ` · up to ${money(row.maxDiscount)}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'appliesTo',
      label: 'Applies to',
      render: (row) => (
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {(row.appliesTo || []).map((context) => (
            <Badge key={context} tone="neutral">
              {label(context)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'validTo',
      label: 'Validity',
      sortable: true,
      sortValue: (row) => (row.validTo ? new Date(row.validTo).getTime() : Infinity),
      render: (row) => <span className="nowrap">{validity(row)}</span>,
    },
    {
      key: 'usedCount',
      label: 'Used',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="mono nowrap">
          {count(row.usedCount)}
          <span className="faint"> / {row.usageLimit ? count(row.usageLimit) : '∞'}</span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <div className="row" style={{ gap: 6 }}>
          <StatusBadge status={row.status} />
          {row.isPublic === false && <Badge tone="neutral">Unlisted</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) =>
        canManage ? (
          <RowActions
            actions={[
              { label: 'Edit', icon: 'edit', onClick: () => setEditingCoupon(couponToForm(row)) },
              ...(row.status === 'active'
                ? [{ label: 'Pause', icon: 'eyeOff', onClick: () => changeCouponStatus(row, 'paused') }]
                : [
                    {
                      label: 'Activate',
                      icon: 'check',
                      variant: 'success',
                      onClick: () => changeCouponStatus(row, 'active'),
                    },
                  ]),
              ...(!row.usedCount
                ? [
                    {
                      label: 'Delete',
                      icon: 'trash',
                      variant: 'danger',
                      onClick: () => setDeletingCoupon(row),
                    },
                  ]
                : []),
            ]}
          />
        ) : null,
    },
  ];

  const festivalColumns = [
    {
      key: 'title',
      label: 'Offer',
      sortable: true,
      render: (row) => (
        <div className="identity">
          <Thumb src={row.imageUrl} />
          <div className="truncate">
            <div className="identity__name truncate">{row.title}</div>
            <div className="identity__meta truncate">{row.subtitle || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'badge',
      label: 'Badge',
      sortable: true,
      render: (row) => (row.badge ? <Badge tone="brand">{row.badge}</Badge> : <span className="faint">—</span>),
    },
    {
      key: 'startsAt',
      label: 'Window',
      sortable: true,
      sortValue: (row) => (row.startsAt ? new Date(row.startsAt).getTime() : 0),
      render: (row) => (
        <span className="nowrap">
          {!row.startsAt && !row.endsAt
            ? 'Always'
            : `${row.startsAt ? date(row.startsAt) : '…'} → ${row.endsAt ? date(row.endsAt) : 'no end'}`}
        </span>
      ),
    },
    {
      key: 'linkTo',
      label: 'Links to',
      render: (row) => <span className="mono faint">{row.linkTo || '—'}</span>,
    },
    {
      key: 'couponCode',
      label: 'Coupon',
      render: (row) =>
        row.couponCode ? <span className="mono">{row.couponCode}</span> : <span className="faint">—</span>,
    },
    {
      key: 'sortOrder',
      label: 'Order',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{row.sortOrder ?? 0}</span>,
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
        canManage ? (
          <RowActions
            actions={[
              { label: 'Edit', icon: 'edit', onClick: () => openFestivalEditor(festivalToForm(row)) },
              row.status === 'active'
                ? { label: 'Hide', icon: 'eyeOff', onClick: () => changeFestivalStatus(row, 'hidden') }
                : {
                    label: 'Show',
                    icon: 'eye',
                    variant: 'success',
                    onClick: () => changeFestivalStatus(row, 'active'),
                  },
              { label: 'Delete', icon: 'trash', variant: 'danger', onClick: () => setDeletingFestival(row) },
            ]}
          />
        ) : null,
    },
  ];

  const setCoupon = (key) => (event) =>
    setEditingCoupon((current) => ({ ...current, [key]: event.target.value }));
  const setFestival = (key) => (event) =>
    setEditingFestival((current) => ({ ...current, [key]: event.target.value }));

  const toggleContext = (context) => (event) =>
    setEditingCoupon((current) => ({
      ...current,
      appliesTo: event.target.checked
        ? [...current.appliesTo, context]
        : current.appliesTo.filter((item) => item !== context),
    }));

  const redemptionRows = redemptions.data?.items ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Offers & Coupons"
        subtitle="Discount codes for checkout, and the festival cards on the website's offers page"
        actions={
          <>
            <Tabs value={tab} onChange={setTab} items={TABS} />
            <Button
              icon="refresh"
              onClick={tab === 'coupons' ? coupons.reload : festivals.reload}
            >
              Refresh
            </Button>
            {canManage && tab === 'coupons' && (
              <Button variant="primary" icon="plus" onClick={() => setEditingCoupon({ ...BLANK_COUPON })}>
                New coupon
              </Button>
            )}
            {canManage && tab === 'festivals' && (
              <Button variant="primary" icon="plus" onClick={() => openFestivalEditor({ ...BLANK_FESTIVAL })}>
                New festival offer
              </Button>
            )}
          </>
        }
      />

      {!canView && (
        <Note tone="warning" icon="lock">
          Your role does not include <strong>offers.view</strong>. Ask a super admin for access.
        </Note>
      )}

      {canView && tab === 'coupons' && (
        <>
          <div className="grid grid--stats" style={{ marginBottom: 16 }}>
            <StatCard
              label="Active coupons"
              value={count(activeCoupons.length)}
              icon="tag"
              tone="brand"
              hint="live right now"
            />
            <StatCard
              label="Redemptions"
              value={count(redemptionsTotal)}
              icon="checkCircle"
              tone="success"
              hint="across coupons in this view"
            />
            <StatCard
              label="Expiring in 7 days"
              value={count(expiringSoon.length)}
              icon="clock"
              tone="yellow"
              hint="active, ending within a week"
            />
            <StatCard
              label="Paused"
              value={count(pausedCoupons.length)}
              icon="eyeOff"
              hint="not redeemable until reactivated"
            />
          </div>

          <DataTable
            columns={couponColumns}
            rows={couponRows}
            loading={coupons.loading}
            error={coupons.error}
            onRetry={coupons.reload}
            searchKeys={['code', 'title', 'tag']}
            searchPlaceholder="Search by code or title…"
            onRowClick={(row) => setOpenCoupon(row)}
            toolbar={<Chips value={couponFilter} onChange={setCouponFilter} items={COUPON_FILTERS} />}
            empty={{ icon: 'tag', title: 'No coupons in this view' }}
          />
        </>
      )}

      {canView && tab === 'festivals' && (
        <DataTable
          columns={festivalColumns}
          rows={festivalRows}
          loading={festivals.loading}
          error={festivals.error}
          onRetry={festivals.reload}
          searchKeys={['title', 'subtitle', 'badge', 'couponCode']}
          searchPlaceholder="Search festival offers…"
          empty={{ icon: 'gift', title: 'No festival offers yet' }}
        />
      )}

      {openCoupon && (
        <Drawer
          wide
          title={openCoupon.code}
          subtitle={openCoupon.title}
          onClose={() => setOpenCoupon(null)}
          footer={
            canManage ? (
              <>
                {openCoupon.status === 'active' ? (
                  <Button icon="eyeOff" disabled={busy} onClick={() => changeCouponStatus(openCoupon, 'paused')}>
                    Pause
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    icon="check"
                    disabled={busy}
                    onClick={() => changeCouponStatus(openCoupon, 'active')}
                  >
                    Activate
                  </Button>
                )}
                <Button
                  variant="primary"
                  icon="edit"
                  onClick={() => setEditingCoupon(couponToForm(openCoupon))}
                >
                  Edit
                </Button>
              </>
            ) : undefined
          }
        >
          <div className="stack" style={{ gap: 18 }}>
            <div className="profile-head">
              <div>
                <p className="strong" style={{ fontSize: 18 }}>
                  {discountLabel(openCoupon)}
                </p>
                <p className="faint" style={{ fontSize: 12.5 }}>
                  {openCoupon.description || 'No description'}
                </p>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <StatusBadge status={openCoupon.status} />
                {openCoupon.tag && <Badge tone={openCoupon.tone === 'green' ? 'success' : openCoupon.tone === 'blue' ? 'info' : openCoupon.tone === 'purple' ? 'lilac' : 'brand'}>{openCoupon.tag}</Badge>}
              </div>
            </div>

            <div className="mini-stats">
              <div>
                <p className="eyebrow">Redeemed</p>
                <p className="mini-stats__value">{count(openCoupon.usedCount)}</p>
              </div>
              <div>
                <p className="eyebrow">Limit</p>
                <p className="mini-stats__value">{openCoupon.usageLimit ? count(openCoupon.usageLimit) : '∞'}</p>
              </div>
              <div>
                <p className="eyebrow">Per user</p>
                <p className="mini-stats__value">{openCoupon.perUserLimit ?? 1}</p>
              </div>
              <div>
                <p className="eyebrow">Min amount</p>
                <p className="mini-stats__value">{money(openCoupon.minAmount)}</p>
              </div>
            </div>

            <section>
              <h3 className="section-title">Rules</h3>
              <DetailList
                rows={[
                  { label: 'Kind', value: KINDS.find((item) => item.value === openCoupon.kind)?.label || label(openCoupon.kind) },
                  { label: 'Value', value: openCoupon.kind === 'percent' ? `${openCoupon.value}%` : money(openCoupon.value) },
                  ...(openCoupon.kind === 'percent'
                    ? [{ label: 'Max discount', value: openCoupon.maxDiscount ? money(openCoupon.maxDiscount) : 'No cap' }]
                    : []),
                  { label: 'Applies to', value: label(openCoupon.appliesTo) || '—' },
                  { label: 'Validity', value: validity(openCoupon) },
                  { label: 'Listed publicly', value: openCoupon.isPublic === false ? 'No — code must be typed' : 'Yes — on the offers page' },
                  { label: 'Created', value: dateTime(openCoupon.createdAt) },
                ]}
              />
            </section>

            <section>
              <h3 className="section-title">Redemptions</h3>
              {redemptions.loading && !redemptions.data ? (
                <LoadingBlock />
              ) : redemptionRows.length === 0 ? (
                <p className="faint" style={{ fontSize: 12.5 }}>
                  Nobody has used this coupon yet.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="table table--dense">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Context</th>
                        <th className="num">Before</th>
                        <th className="num">Discount</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redemptionRows.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="truncate" style={{ maxWidth: 200 }}>
                              <div className="identity__name truncate">
                                {item.user?.name || item.user?.email || item.user?.phone || 'User'}
                              </div>
                              <div className="identity__meta truncate mono">{item.reference || ''}</div>
                            </div>
                          </td>
                          <td>
                            <Badge tone="neutral">{label(item.context)}</Badge>
                          </td>
                          <td className="num mono">{money(item.amountBefore)}</td>
                          <td className="num mono strong">−{money(item.discount)}</td>
                          <td className="nowrap">{dateTime(item.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </Drawer>
      )}

      {editingCoupon && (
        <Modal
          wide
          title={editingCoupon.id ? `Edit ${editingCoupon.code}` : 'New coupon'}
          subtitle="Validated at checkout; the code is stored in upper case"
          onClose={() => setEditingCoupon(null)}
          footer={
            <>
              <Button onClick={() => setEditingCoupon(null)}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={busy || couponInvalid} onClick={saveCoupon}>
                {editingCoupon.id ? 'Save changes' : 'Create coupon'}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Code" hint="What the seeker types" error={editingCoupon.code !== '' ? couponErrors.code : undefined}>
                <Input
                  className="mono"
                  placeholder="e.g. FESTIVE30"
                  value={editingCoupon.code}
                  onChange={(event) =>
                    setEditingCoupon((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                  }
                  disabled={Boolean(editingCoupon.id && editingCoupon.usedCount)}
                />
              </Field>
              <Field label="Title" error={editingCoupon.title !== '' ? couponErrors.title : undefined}>
                <Input placeholder="e.g. 30% off all pujas" value={editingCoupon.title} onChange={setCoupon('title')} />
              </Field>
            </div>

            <Field label="Description" hint="Shown on the coupon card">
              <Textarea rows={2} placeholder="Terms in a sentence or two." value={editingCoupon.description} onChange={setCoupon('description')} />
            </Field>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Kind">
                <Select value={editingCoupon.kind} onChange={setCoupon('kind')} options={KINDS} />
              </Field>
              <Field
                label={editingCoupon.kind === 'percent' ? 'Percent off' : 'Amount off (₹)'}
                error={editingCoupon.value !== '' ? couponErrors.value : undefined}
              >
                <Input type="number" min="1" step="1" value={editingCoupon.value} onChange={setCoupon('value')} />
              </Field>
              {editingCoupon.kind === 'percent' ? (
                <Field label="Max discount (₹)" hint="Cap on the rupee saving — blank for none" error={couponErrors.maxDiscount}>
                  <Input type="number" min="1" step="1" placeholder="Optional" value={editingCoupon.maxDiscount} onChange={setCoupon('maxDiscount')} />
                </Field>
              ) : (
                <div />
              )}
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Min amount (₹)" hint="Cart / booking / top-up must be at least this" error={couponErrors.minAmount}>
                <Input type="number" min="0" step="1" value={editingCoupon.minAmount} onChange={setCoupon('minAmount')} />
              </Field>
              <Field label="Usage limit" hint="Total redemptions — blank for unlimited" error={couponErrors.usageLimit}>
                <Input type="number" min="1" step="1" placeholder="Unlimited" value={editingCoupon.usageLimit} onChange={setCoupon('usageLimit')} />
              </Field>
              <Field label="Per-user limit" error={couponErrors.perUserLimit}>
                <Input type="number" min="1" step="1" value={editingCoupon.perUserLimit} onChange={setCoupon('perUserLimit')} />
              </Field>
            </div>

            <Field label="Applies to" error={couponErrors.appliesTo}>
              <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
                {CONTEXTS.map((context) => (
                  <Checkbox
                    key={context.value}
                    label={context.label}
                    checked={editingCoupon.appliesTo.includes(context.value)}
                    onChange={toggleContext(context.value)}
                  />
                ))}
              </div>
            </Field>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Valid from" hint="Blank — usable immediately">
                <Input type="date" value={editingCoupon.validFrom} onChange={setCoupon('validFrom')} />
              </Field>
              <Field label="Valid to" hint="Inclusive — expires at the end of this day" error={couponErrors.validTo}>
                <Input type="date" value={editingCoupon.validTo} onChange={setCoupon('validTo')} />
              </Field>
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Tag" hint="Optional — e.g. NEW USER, FESTIVAL">
                <Input placeholder="e.g. FESTIVAL" value={editingCoupon.tag} onChange={setCoupon('tag')} />
              </Field>
              <Field label="Card colour">
                <Select value={editingCoupon.tone} onChange={setCoupon('tone')} options={TONES} />
              </Field>
              <Field label="Public" hint="Listed on the offers page">
                <div className="row" style={{ height: 40 }}>
                  <Toggle
                    on={editingCoupon.isPublic}
                    onChange={(value) => setEditingCoupon((current) => ({ ...current, isPublic: value }))}
                    label="Public"
                  />
                </div>
              </Field>
            </div>

            {editingCoupon.id && editingCoupon.usedCount > 0 && (
              <Note tone="info" icon="info">
                This coupon has been redeemed {count(editingCoupon.usedCount)} time
                {editingCoupon.usedCount === 1 ? '' : 's'}. The code is fixed; the other rules
                apply to redemptions from now on.
              </Note>
            )}
          </div>
        </Modal>
      )}

      {deletingCoupon && (
        <Modal
          title={`Delete ${deletingCoupon.code}?`}
          subtitle="It has never been redeemed, so nothing else refers to it"
          onClose={() => setDeletingCoupon(null)}
          footer={
            <>
              <Button onClick={() => setDeletingCoupon(null)}>Cancel</Button>
              <Button variant="danger" icon="trash" disabled={busy} onClick={removeCoupon}>
                Delete coupon
              </Button>
            </>
          }
        >
          <Note tone="danger" icon="alert">
            This cannot be undone. To stop a coupon temporarily, pause it instead.
          </Note>
        </Modal>
      )}

      {editingFestival && (
        <Modal
          wide
          title={editingFestival.id ? `Edit ${editingFestival.title}` : 'New festival offer'}
          subtitle="A card on the website's offers page — it links somewhere and may name a coupon"
          onClose={() => setEditingFestival(null)}
          footer={
            <>
              <Button onClick={() => setEditingFestival(null)}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={busy || festivalInvalid} onClick={saveFestival}>
                {editingFestival.id ? 'Save changes' : 'Add offer'}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Title" error={editingFestival.title !== '' ? festivalErrors.title : undefined}>
                <Input placeholder="e.g. Diwali Puja Bundle" value={editingFestival.title} onChange={setFestival('title')} />
              </Field>
              <Field label="Subtitle">
                <Input placeholder="e.g. Lakshmi + Ganesh puja at one price" value={editingFestival.subtitle} onChange={setFestival('subtitle')} />
              </Field>
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Badge" hint="Pick one or type your own">
                <Input list="festival-badges" placeholder="e.g. Limited Time" value={editingFestival.badge} onChange={setFestival('badge')} />
                <datalist id="festival-badges">
                  {BADGES.map((badge) => (
                    <option key={badge} value={badge} />
                  ))}
                </datalist>
              </Field>
              <Field label="Starts">
                <Input type="date" value={editingFestival.startsAt} onChange={setFestival('startsAt')} />
              </Field>
              <Field label="Ends" hint="Inclusive" error={festivalErrors.endsAt}>
                <Input type="date" value={editingFestival.endsAt} onChange={setFestival('endsAt')} />
              </Field>
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Links to" error={festivalErrors.link}>
                <div className="stack" style={{ gap: 8 }}>
                  <Select
                    value={editingFestival.linkChoice}
                    onChange={setFestival('linkChoice')}
                    options={[...LINKS, { value: OTHER, label: 'Other path…' }]}
                  />
                  {editingFestival.linkChoice === OTHER && (
                    <Input className="mono" placeholder="/store?category=yantra" value={editingFestival.linkOther} onChange={setFestival('linkOther')} />
                  )}
                </div>
              </Field>
              <Field label="Coupon code" hint="Optional — printed on the card">
                <Input
                  className="mono"
                  list="festival-coupons"
                  placeholder="e.g. FESTIVE30"
                  value={editingFestival.couponCode}
                  onChange={(event) =>
                    setEditingFestival((current) => ({ ...current, couponCode: event.target.value.toUpperCase() }))
                  }
                />
                <datalist id="festival-coupons">
                  {couponRows.map((row) => (
                    <option key={row.id} value={row.code}>
                      {row.title}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="Sort order" hint="Lower shows first" error={festivalErrors.sortOrder}>
                <Input type="number" step="1" value={editingFestival.sortOrder} onChange={setFestival('sortOrder')} />
              </Field>
            </div>

            <Field label="Image" hint="JPEG, PNG or WebP — the card's picture">
              <ImagePicker src={editingFestival.imageUrl} file={festivalImage} onPick={setFestivalImage} />
            </Field>
          </div>
        </Modal>
      )}

      {deletingFestival && (
        <Modal
          title={`Delete ${deletingFestival.title}?`}
          subtitle="The card leaves the offers page"
          onClose={() => setDeletingFestival(null)}
          footer={
            <>
              <Button onClick={() => setDeletingFestival(null)}>Cancel</Button>
              <Button variant="danger" icon="trash" disabled={busy} onClick={removeFestival}>
                Delete offer
              </Button>
            </>
          }
        >
          <Note tone="danger" icon="alert">
            This cannot be undone. To take it down for a while, hide it instead.
          </Note>
        </Modal>
      )}
    </div>
  );
}

export default OffersPage;
