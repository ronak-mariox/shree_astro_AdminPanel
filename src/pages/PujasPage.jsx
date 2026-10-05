/**
 * Pujas — the rituals seekers book a slot for, performed by a pandit and
 * streamed to them.
 *
 * Same shape as the product catalogue: hidden keeps a puja off the listing,
 * archived retires it while past bookings keep their snapshot.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Chips,
  Field,
  ImagePicker,
  Input,
  Modal,
  Note,
  Select,
  StatCard,
  StatusBadge,
  Textarea,
  Thumb,
  Toggle,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  createPuja,
  deletePuja,
  listPujas,
  setPujaStatus,
  updatePuja,
} from '../services/admin';
import { can } from '../services/session';
import { count, label, money } from '../utils/format';

const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'archived', label: 'Archived' },
];

/** The category keys the puja listing filters by; anything else is typed in. */
const CATEGORIES = [
  { value: 'shiva', label: 'Shiva' },
  { value: 'health', label: 'Health' },
  { value: 'prosperity', label: 'Prosperity' },
  { value: 'home-vastu', label: 'Home & Vastu' },
  { value: 'planetary', label: 'Planetary' },
  { value: 'custom', label: 'Custom' },
];
const OTHER = 'other';

/** The slots a new puja offers until they are edited. */
const DEFAULT_SLOTS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM',
];

const toKey = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const BLANK = {
  name: '',
  tagline: '',
  categoryChoice: CATEGORIES[0].value,
  categoryOther: '',
  categoryLabel: '',
  badge: '',
  deity: '',
  price: '',
  oldPrice: '',
  durationText: '',
  panditName: '',
  isFeatured: false,
  description: '',
  benefitsText: '',
  timeSlotsText: DEFAULT_SLOTS.join(', '),
  maxPerSlot: '3',
  imageUrl: '',
};

const toForm = (row) => {
  const known = CATEGORIES.some((item) => item.value === row.category);
  return {
    id: row.id,
    name: row.name || '',
    tagline: row.tagline || '',
    categoryChoice: known ? row.category : OTHER,
    categoryOther: known ? '' : row.category || '',
    categoryLabel: row.categoryLabel || '',
    badge: row.badge || '',
    deity: row.deity || '',
    price: row.price ?? '',
    oldPrice: row.oldPrice ?? '',
    durationText: row.durationText || '',
    panditName: row.panditName || '',
    isFeatured: Boolean(row.isFeatured),
    description: row.description || '',
    benefitsText: (row.benefits || []).join('\n'),
    timeSlotsText: (row.timeSlots?.length ? row.timeSlots : DEFAULT_SLOTS).join(', '),
    maxPerSlot: row.maxPerSlot ?? 3,
    imageUrl: row.imageUrl || '',
    status: row.status,
  };
};

const parseSlots = (text) =>
  text
    .split(',')
    .map((slot) => slot.trim())
    .filter(Boolean);

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Give the puja a name';
  if (form.categoryChoice === OTHER && !toKey(form.categoryOther)) {
    errors.category = 'Type a category';
  }
  const price = Number(form.price);
  if (form.price === '' || !Number.isFinite(price) || price < 0) {
    errors.price = 'A price of ₹0 or more';
  }
  if (form.oldPrice !== '' && form.oldPrice !== null) {
    const oldPrice = Number(form.oldPrice);
    if (!Number.isFinite(oldPrice) || oldPrice <= price) {
      errors.oldPrice = 'The old price must be higher than the price';
    }
  }
  if (parseSlots(form.timeSlotsText).length === 0) {
    errors.timeSlots = 'At least one time slot';
  }
  const max = Number(form.maxPerSlot);
  if (form.maxPerSlot === '' || !Number.isInteger(max) || max < 1) {
    errors.maxPerSlot = 'A whole number, 1 or more';
  }
  return errors;
}

const PAGE_LIMIT = 100;

export function PujasPage({ notify }) {
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [image, setImage] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [run, busy] = useAction(notify);

  const { data, loading, error, reload } = useApi(
    () => listPujas({ status: status === 'all' ? undefined : status, limit: PAGE_LIMIT }),
    [status],
  );

  const rows = data?.items ?? [];
  const canManage = can('pujas.manage');

  const errors = editing ? validate(editing) : {};
  const invalid = Object.keys(errors).length > 0;

  const openEditor = (form) => {
    setImage(null);
    setEditing(form);
  };

  const save = () => {
    const category =
      editing.categoryChoice === OTHER ? toKey(editing.categoryOther) : editing.categoryChoice;
    const body = {
      name: editing.name.trim(),
      tagline: editing.tagline.trim(),
      category,
      categoryLabel:
        editing.categoryLabel.trim() ||
        CATEGORIES.find((item) => item.value === category)?.label ||
        label(category),
      badge: editing.badge.trim() || null,
      deity: editing.deity.trim(),
      price: Number(editing.price),
      oldPrice: editing.oldPrice === '' ? null : Number(editing.oldPrice),
      durationText: editing.durationText.trim(),
      panditName: editing.panditName.trim(),
      isFeatured: editing.isFeatured,
      description: editing.description.trim(),
      benefits: editing.benefitsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      timeSlots: parseSlots(editing.timeSlotsText),
      maxPerSlot: Number(editing.maxPerSlot),
    };

    return run(() => (editing.id ? updatePuja(editing.id, body, image) : createPuja(body, image)), {
      success: editing.id ? 'Puja updated' : 'Puja added',
      onDone: async () => {
        setEditing(null);
        setImage(null);
        await reload();
      },
    });
  };

  const changeStatus = (row, next) =>
    run(() => setPujaStatus(row.id, next), {
      success: next === 'active' ? `${row.name} is open for booking` : `${row.name} hidden`,
      onDone: reload,
    });

  const archive = () =>
    run(() => deletePuja(archiving.id), {
      success: `${archiving.name} archived`,
      onDone: async () => {
        setArchiving(null);
        await reload();
      },
    });

  const columns = [
    {
      key: 'name',
      label: 'Puja',
      sortable: true,
      render: (row) => (
        <div className="identity">
          <Thumb src={row.imageUrl} />
          <div className="truncate">
            <div className="identity__name truncate">{row.name}</div>
            <div className="identity__meta truncate">
              {[row.deity, row.durationText].filter(Boolean).join(' · ') || row.tagline}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (row) => (
        <Badge tone="neutral">
          {row.categoryLabel ||
            CATEGORIES.find((item) => item.value === row.category)?.label ||
            label(row.category)}
        </Badge>
      ),
    },
    {
      key: 'panditName',
      label: 'Pandit',
      sortable: true,
      render: (row) => <span className="nowrap">{row.panditName || '—'}</span>,
    },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="mono nowrap">
          {money(row.price)}
          {row.oldPrice ? (
            <span className="faint" style={{ marginLeft: 6, textDecoration: 'line-through' }}>
              {money(row.oldPrice)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'slots',
      label: 'Slots',
      align: 'right',
      render: (row) => (
        <span className="mono nowrap">
          {count(row.timeSlots?.length ?? 0)}
          <span className="faint"> × {row.maxPerSlot ?? 3}</span>
        </span>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      align: 'right',
      sortable: true,
      render: (row) =>
        row.ratingCount ? (
          <span className="mono nowrap">
            {Number(row.rating).toFixed(1)} ★{' '}
            <span className="faint">({count(row.ratingCount)})</span>
          </span>
        ) : (
          <span className="faint">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <div className="row" style={{ gap: 6 }}>
          <StatusBadge status={row.status} />
          {row.isFeatured && <Badge tone="brand">Featured</Badge>}
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
              { label: 'Edit', icon: 'edit', onClick: () => openEditor(toForm(row)) },
              ...(row.status === 'active'
                ? [{ label: 'Hide', icon: 'eyeOff', onClick: () => changeStatus(row, 'hidden') }]
                : [
                    {
                      label: 'Activate',
                      icon: 'check',
                      variant: 'success',
                      onClick: () => changeStatus(row, 'active'),
                    },
                  ]),
              ...(row.status !== 'archived'
                ? [
                    {
                      label: 'Archive',
                      icon: 'trash',
                      variant: 'danger',
                      onClick: () => setArchiving(row),
                    },
                  ]
                : []),
            ]}
          />
        ) : null,
    },
  ];

  const set = (key) => (event) =>
    setEditing((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="page">
      <PageHeader
        title="Pujas"
        subtitle="Rituals seekers book by the slot — hidden pujas stay off the listing"
        actions={
          <>
            <Button icon="refresh" onClick={reload}>Refresh</Button>
            {canManage && (
              <Button variant="primary" icon="plus" onClick={() => openEditor({ ...BLANK })}>
                New puja
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="Active pujas"
          value={count(rows.filter((row) => row.status === 'active').length)}
          icon="flame"
          tone="brand"
          hint="open for booking"
        />
        <StatCard
          label="Featured"
          value={count(rows.filter((row) => row.isFeatured && row.status === 'active').length)}
          icon="star"
          tone="yellow"
          hint="pinned on the listing"
        />
        <StatCard
          label="Hidden"
          value={count(rows.filter((row) => row.status === 'hidden').length)}
          icon="eyeOff"
          hint="not shown to seekers"
        />
        <StatCard
          label="Pandits"
          value={count(new Set(rows.map((row) => row.panditName).filter(Boolean)).size)}
          icon="user"
          tone="success"
          hint="named across this view"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['name', 'deity', 'panditName', 'category', 'categoryLabel', 'tagline']}
        searchPlaceholder="Search by name, deity or pandit…"
        onRowClick={canManage ? (row) => openEditor(toForm(row)) : undefined}
        toolbar={<Chips value={status} onChange={setStatus} items={STATUSES} />}
        empty={{ icon: 'flame', title: 'No pujas in this view' }}
      />

      {editing && (
        <Modal
          wide
          title={editing.id ? 'Edit puja' : 'New puja'}
          subtitle={
            editing.id
              ? `${label(editing.status)} · ${editing.panditName || 'no pandit named'}`
              : 'Bookable as soon as it is saved'
          }
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={busy || invalid} onClick={save}>
                {editing.id ? 'Save changes' : 'Add puja'}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Name" error={editing.name !== '' ? errors.name : undefined}>
                <Input placeholder="e.g. Rudrabhishek" value={editing.name} onChange={set('name')} />
              </Field>
              <Field label="Tagline" hint="One line under the name">
                <Input
                  placeholder="e.g. For peace, protection and prosperity"
                  value={editing.tagline}
                  onChange={set('tagline')}
                />
              </Field>
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Category" error={errors.category}>
                <div className="stack" style={{ gap: 8 }}>
                  <Select
                    value={editing.categoryChoice}
                    onChange={set('categoryChoice')}
                    options={[...CATEGORIES, { value: OTHER, label: 'Other…' }]}
                  />
                  {editing.categoryChoice === OTHER && (
                    <Input
                      placeholder="e.g. Ancestral"
                      value={editing.categoryOther}
                      onChange={set('categoryOther')}
                    />
                  )}
                </div>
              </Field>
              <Field label="Category label" hint="As printed — defaults to the category name">
                <Input
                  placeholder="e.g. Health & Protection"
                  value={editing.categoryLabel}
                  onChange={set('categoryLabel')}
                />
              </Field>
              <Field label="Badge" hint="Optional — e.g. Most Powerful">
                <Input placeholder="e.g. Most Powerful" value={editing.badge} onChange={set('badge')} />
              </Field>
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Deity">
                <Input placeholder="e.g. Lord Shiva" value={editing.deity} onChange={set('deity')} />
              </Field>
              <Field label="Price (₹)" error={editing.price !== '' ? errors.price : undefined}>
                <Input type="number" min="0" step="1" value={editing.price} onChange={set('price')} />
              </Field>
              <Field label="Old price (₹)" hint="Struck through on the card" error={errors.oldPrice}>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Optional"
                  value={editing.oldPrice}
                  onChange={set('oldPrice')}
                />
              </Field>
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Duration" hint="Free text, e.g. 6 hours">
                <Input placeholder="e.g. 6 hours" value={editing.durationText} onChange={set('durationText')} />
              </Field>
              <Field label="Pandit name">
                <Input
                  placeholder="e.g. Pt. Rajesh Sharma"
                  value={editing.panditName}
                  onChange={set('panditName')}
                />
              </Field>
              <Field label="Featured" hint="Pinned to the listing's featured strip">
                <div className="row" style={{ height: 40 }}>
                  <Toggle
                    on={editing.isFeatured}
                    onChange={(value) =>
                      setEditing((current) => ({ ...current, isFeatured: value }))
                    }
                    label="Featured"
                  />
                </div>
              </Field>
            </div>

            <Field label="Description">
              <Textarea
                rows={5}
                placeholder="What is performed, for whom, and what the seeker receives."
                value={editing.description}
                onChange={set('description')}
              />
            </Field>

            <Field label="Benefits" hint="One per line — printed as bullet points">
              <Textarea
                rows={4}
                placeholder={'Removes obstacles\nBrings peace to the home'}
                value={editing.benefitsText}
                onChange={set('benefitsText')}
              />
            </Field>

            <div className="grid grid--sidebar" style={{ gap: 14 }}>
              <Field
                label="Time slots"
                hint="Comma-separated, as the seeker picks them — e.g. 6:00 AM, 7:00 AM"
                error={errors.timeSlots}
              >
                <Textarea rows={2} value={editing.timeSlotsText} onChange={set('timeSlotsText')} />
              </Field>
              <Field label="Max per slot" hint="Bookings before a slot is full" error={errors.maxPerSlot}>
                <Input type="number" min="1" step="1" value={editing.maxPerSlot} onChange={set('maxPerSlot')} />
              </Field>
            </div>

            <Field label="Image" hint="JPEG, PNG or WebP — shown on the card and the puja page">
              <ImagePicker src={editing.imageUrl} file={image} onPick={setImage} />
            </Field>

            {editing.id && editing.status === 'active' && (
              <Note tone="info" icon="info">
                This puja is open for booking. Existing bookings keep the price and pandit
                they were made with.
              </Note>
            )}
          </div>
        </Modal>
      )}

      {archiving && (
        <Modal
          title={`Archive ${archiving.name}?`}
          subtitle="It leaves the listing; existing bookings keep their snapshot of it"
          onClose={() => setArchiving(null)}
          footer={
            <>
              <Button onClick={() => setArchiving(null)}>Cancel</Button>
              <Button variant="danger" icon="trash" disabled={busy} onClick={archive}>
                Archive puja
              </Button>
            </>
          }
        >
          <Note tone="danger" icon="alert">
            Archiving takes the puja off the listing so no new slots can be booked. It is not
            deleted — it can be reactivated from the Archived filter.
          </Note>
        </Modal>
      )}
    </div>
  );
}

export default PujasPage;
