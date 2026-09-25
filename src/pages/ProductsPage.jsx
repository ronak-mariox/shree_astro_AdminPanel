/**
 * Products — the store catalogue the website and app sell from.
 *
 * A hidden product stays in the catalogue but off the shelf; archiving is the
 * soft delete, kept so old orders can still point at what was bought.
 */

import { useEffect, useMemo, useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
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
  createProduct,
  deleteProduct,
  listProducts,
  setProductStatus,
  updateProduct,
} from '../services/admin';
import { can } from '../services/session';
import { count, label, money } from '../utils/format';
import { mediaUrl } from '../utils/media';

const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'archived', label: 'Archived' },
];

/** The category keys the storefront groups by; anything else is typed in. */
const CATEGORIES = [
  { value: 'rudraksha', label: 'Rudraksha' },
  { value: 'crystals-pyrite', label: 'Crystals & Pyrite' },
  { value: 'yantra', label: 'Yantra' },
  { value: 'gemstones', label: 'Gemstones' },
  { value: 'bracelets', label: 'Bracelets' },
  { value: 'puja-kits', label: 'Puja Kits' },
  { value: 'incense', label: 'Incense' },
  { value: 'malas', label: 'Malas' },
  { value: 'frames', label: 'Frames' },
  { value: 'spiritual-gifts', label: 'Spiritual Gifts' },
];
const OTHER = 'other';
/** The gallery cap the API enforces, and how many new files one save may carry. */
const MAX_GALLERY = 8;
const MAX_NEW_FILES = 6;
const categoryLabel = (key) => CATEGORIES.find((item) => item.value === key)?.label || label(key);

/** Free text → the lowercase-kebab key the API stores. */
const toKey = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const BLANK = {
  name: '',
  categoryChoice: CATEGORIES[0].value,
  categoryOther: '',
  badge: '',
  price: '',
  oldPrice: '',
  stock: '0',
  sku: '',
  isFeatured: false,
  description: '',
  highlightsText: '',
  imageUrl: '',
  originalImageUrl: '',
  images: [],
};

/** A row from the API, laid out the way the form holds it. */
const toForm = (row) => {
  const known = CATEGORIES.some((item) => item.value === row.category);
  return {
    id: row.id,
    name: row.name || '',
    categoryChoice: known ? row.category : OTHER,
    categoryOther: known ? '' : row.category || '',
    badge: row.badge || '',
    price: row.price ?? '',
    oldPrice: row.oldPrice ?? '',
    stock: row.stock ?? 0,
    sku: row.sku || '',
    isFeatured: Boolean(row.isFeatured),
    description: row.description || '',
    highlightsText: (row.highlights || []).join('\n'),
    imageUrl: row.imageUrl || '',
    /** What the cover was when the editor opened — `imageUrl` differing means a gallery image was promoted. */
    originalImageUrl: row.imageUrl || '',
    images: (row.images ?? []).filter(Boolean),
    rating: row.rating ?? 0,
    ratingCount: row.ratingCount ?? 0,
    status: row.status,
  };
};

/** Gallery images beyond the cover — what the table's "+N" badge counts. */
const extraImages = (row) => (row.images ?? []).filter((url) => url && url !== row.imageUrl).length;

/** Object URLs for freshly picked files, revoked when the list changes. */
function usePreviews(files) {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  return urls;
}

/** One gallery image: the picture, a remove button, and its role (cover / new / promotable). */
function GalleryTile({ src, cover, pending, onRemove, onSetCover }) {
  return (
    <div className="stack gallery-tile" style={{ gap: 6, width: 96, alignItems: 'center' }}>
      <span style={{ position: 'relative', display: 'block', width: 96, height: 96 }}>
        <img
          src={src}
          alt=""
          width={96}
          height={96}
          style={{
            width: 96,
            height: 96,
            borderRadius: 10,
            objectFit: 'cover',
            border: `1px solid ${cover ? 'var(--grad-from)' : 'var(--border-card)'}`,
            display: 'block',
          }}
        />
        <Button
          size="sm"
          variant="quiet"
          icon="x"
          aria-label="Remove image"
          title="Remove image"
          onClick={onRemove}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: 'rgba(255,255,255,0.92)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </span>
      {cover ? (
        <Badge tone="brand">Cover</Badge>
      ) : pending ? (
        <Badge tone="neutral">New</Badge>
      ) : (
        <Button size="sm" onClick={onSetCover} title="Use this image as the cover">
          Set as cover
        </Button>
      )}
    </div>
  );
}

/** What stops the form being saved, per field. `newFiles` is how many gallery files are waiting to upload. */
function validate(form, newFiles = 0) {
  const errors = {};
  if (form.images.length + newFiles > MAX_GALLERY) errors.images = `Up to ${MAX_GALLERY} images`;
  if (!form.name.trim()) errors.name = 'Give the product a name';
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
  const stock = Number(form.stock);
  if (form.stock === '' || !Number.isInteger(stock) || stock < 0) {
    errors.stock = 'A whole number, 0 or more';
  }
  return errors;
}

const PAGE_LIMIT = 100;

export function ProductsPage({ notify }) {
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  /** The cover File picked in the browser, and the gallery Files waiting to upload. */
  const [image, setImage] = useState(null);
  const [newImages, setNewImages] = useState([]);
  const previews = usePreviews(newImages);
  const [archiving, setArchiving] = useState(null);
  const [run, busy] = useAction(notify);

  const { data, loading, error, reload } = useApi(
    () => listProducts({ status: status === 'all' ? undefined : status, limit: PAGE_LIMIT }),
    [status],
  );

  const rows = data?.items ?? [];
  const canManage = can('shop.manage');

  const errors = editing ? validate(editing, newImages.length) : {};
  const invalid = Object.keys(errors).length > 0;

  const openEditor = (form) => {
    setImage(null);
    setNewImages([]);
    setEditing(form);
  };

  const closeEditor = () => {
    setEditing(null);
    setImage(null);
    setNewImages([]);
  };

  /** Files from the multi-select input — capped so the API's per-request and gallery limits are never hit by surprise. */
  const addImages = (event) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!picked.length) return;
    const room = Math.min(MAX_NEW_FILES - newImages.length, MAX_GALLERY - editing.images.length - newImages.length);
    const accepted = picked.slice(0, Math.max(0, room));
    if (accepted.length < picked.length) {
      notify(
        room <= 0
          ? `The gallery is full — remove an image first (up to ${MAX_GALLERY})`
          : `Only ${accepted.length} more image${accepted.length === 1 ? '' : 's'} can be added right now`,
        { tone: 'warning', icon: 'alert' },
      );
    }
    if (accepted.length) setNewImages((current) => [...current, ...accepted]);
  };

  const removeExisting = (url) =>
    setEditing((current) => ({ ...current, images: current.images.filter((item) => item !== url) }));

  const removeNew = (index) =>
    setNewImages((current) => current.filter((_, position) => position !== index));

  /** A gallery image becomes the cover; any file picked for the cover is dropped so the two cannot fight. */
  const promote = (url) => {
    setImage(null);
    setEditing((current) => ({ ...current, imageUrl: url }));
  };

  const save = () => {
    const body = {
      name: editing.name.trim(),
      category:
        editing.categoryChoice === OTHER ? toKey(editing.categoryOther) : editing.categoryChoice,
      badge: editing.badge.trim() || null,
      price: Number(editing.price),
      oldPrice: editing.oldPrice === '' ? null : Number(editing.oldPrice),
      stock: Number(editing.stock),
      sku: editing.sku.trim(),
      isFeatured: editing.isFeatured,
      description: editing.description.trim(),
      highlights: editing.highlightsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      /** The existing gallery URLs still wanted, in order — anything removed here is dropped by the API. */
      keepImages: editing.images,
    };
    /** A gallery image promoted to cover — only when no cover file was picked, which would win anyway. */
    if (!image && editing.imageUrl && editing.imageUrl !== editing.originalImageUrl) {
      body.imageUrl = editing.imageUrl;
    }
    const files = { image, images: newImages };

    return run(
      () =>
        editing.id ? updateProduct(editing.id, body, files) : createProduct(body, files),
      {
        success: editing.id ? 'Product updated' : 'Product added',
        onDone: async () => {
          closeEditor();
          await reload();
        },
      },
    );
  };

  const changeStatus = (row, next) =>
    run(() => setProductStatus(row.id, next), {
      success: next === 'active' ? `${row.name} is back on the shelf` : `${row.name} hidden`,
      onDone: reload,
    });

  const archive = () =>
    run(() => deleteProduct(archiving.id), {
      success: `${archiving.name} archived`,
      onDone: async () => {
        setArchiving(null);
        await reload();
      },
    });

  const columns = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      render: (row) => (
        <div className="identity">
          <span style={{ position: 'relative', flex: 'none', display: 'inline-flex' }}>
            <Thumb src={row.imageUrl} />
            {extraImages(row) > 0 && (
              <span
                className="badge badge--neutral product-gallery-count"
                title={`${extraImages(row)} more image${extraImages(row) === 1 ? '' : 's'} in the gallery`}
                style={{
                  position: 'absolute',
                  right: -8,
                  bottom: -6,
                  padding: '0 5px',
                  fontSize: 10,
                  lineHeight: '15px',
                  background: 'var(--surface)',
                }}
              >
                +{extraImages(row)}
              </span>
            )}
          </span>
          <div className="truncate">
            <div className="identity__name truncate">{row.name}</div>
            <div className="identity__meta truncate">{row.sku || 'No SKU'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (row) => <Badge tone="neutral">{categoryLabel(row.category)}</Badge>,
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
      key: 'stock',
      label: 'Stock',
      align: 'right',
      sortable: true,
      render: (row) =>
        row.stock > 0 ? (
          <span className="mono">{count(row.stock)}</span>
        ) : (
          <Badge tone="danger">Out of stock</Badge>
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
        title="Products"
        subtitle="The store catalogue — hidden products stay off the shelf, archived ones are retired"
        actions={
          <>
            <Button icon="refresh" onClick={reload}>Refresh</Button>
            {canManage && (
              <Button variant="primary" icon="plus" onClick={() => openEditor({ ...BLANK })}>
                New product
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="Active products"
          value={count(rows.filter((row) => row.status === 'active').length)}
          icon="bag"
          tone="brand"
          hint="on the shelf"
        />
        <StatCard
          label="Out of stock"
          value={count(
            rows.filter((row) => row.status !== 'archived' && !(row.stock > 0)).length,
          )}
          icon="alert"
          tone="yellow"
          hint="cannot be ordered"
        />
        <StatCard
          label="Hidden"
          value={count(rows.filter((row) => row.status === 'hidden').length)}
          icon="eyeOff"
          hint="not shown to shoppers"
        />
        <StatCard
          label="Featured"
          value={count(rows.filter((row) => row.isFeatured && row.status === 'active').length)}
          icon="star"
          tone="success"
          hint="pinned on the storefront"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['name', 'sku', 'category', 'badge']}
        searchPlaceholder="Search by name, SKU or category…"
        onRowClick={canManage ? (row) => openEditor(toForm(row)) : undefined}
        toolbar={<Chips value={status} onChange={setStatus} items={STATUSES} />}
        empty={{ icon: 'bag', title: 'No products in this view' }}
      />

      {editing && (
        <Modal
          wide
          title={editing.id ? 'Edit product' : 'New product'}
          subtitle={
            editing.id
              ? `${label(editing.status)} · ${editing.sku || 'no SKU'}`
              : 'Goes on sale as soon as it is saved with stock'
          }
          onClose={closeEditor}
          footer={
            <>
              <Button onClick={closeEditor}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={busy || invalid} onClick={save}>
                {editing.id ? 'Save changes' : 'Add product'}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Field label="Name" error={editing.name !== '' ? errors.name : undefined}>
              <Input
                placeholder="e.g. 5 Mukhi Rudraksha Mala"
                value={editing.name}
                onChange={set('name')}
              />
            </Field>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Category" error={errors.category}>
                <div className="stack" style={{ gap: 8 }}>
                  <Select
                    value={editing.categoryChoice}
                    onChange={set('categoryChoice')}
                    options={[...CATEGORIES, { value: OTHER, label: 'Other…' }]}
                  />
                  {editing.categoryChoice === OTHER && (
                    <Input
                      placeholder="e.g. Copper Vessels"
                      value={editing.categoryOther}
                      onChange={set('categoryOther')}
                    />
                  )}
                </div>
              </Field>
              <Field label="Badge" hint="Optional — e.g. Bestseller, New, Limited">
                <Input placeholder="e.g. Bestseller" value={editing.badge} onChange={set('badge')} />
              </Field>
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
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
              <Field label="Stock" error={errors.stock}>
                <Input type="number" min="0" step="1" value={editing.stock} onChange={set('stock')} />
              </Field>
            </div>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="SKU" hint="Your own stock code">
                <Input placeholder="e.g. RUD-5M-108" value={editing.sku} onChange={set('sku')} />
              </Field>
              <Field label="Featured" hint="Pinned to the storefront's featured strip">
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
                placeholder="What it is, what it is for, how it was made."
                value={editing.description}
                onChange={set('description')}
              />
            </Field>

            <Field label="Highlights" hint="One per line — printed as bullet points">
              <Textarea
                rows={4}
                placeholder={'Energised by our pandits\nCertified lab-tested beads'}
                value={editing.highlightsText}
                onChange={set('highlightsText')}
              />
            </Field>

            <Field
              label="Images"
              hint={`JPEG, PNG or WebP — the cover goes on the card, the gallery on the product page. Up to ${MAX_GALLERY} images.`}
              error={errors.images}
            >
              <div className="stack product-images" style={{ gap: 16 }}>
                <div className="stack" style={{ gap: 6 }}>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Cover
                  </span>
                  <ImagePicker src={editing.imageUrl} file={image} onPick={setImage} label="Choose cover" />
                </div>

                <div className="stack product-gallery" style={{ gap: 10 }}>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Gallery · {editing.images.length + newImages.length} of {MAX_GALLERY}
                  </span>
                  {(editing.images.length > 0 || newImages.length > 0) && (
                    <div className="row row--wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
                      {editing.images.map((url) => (
                        <GalleryTile
                          key={url}
                          src={mediaUrl(url)}
                          cover={!image && url === editing.imageUrl}
                          onRemove={() => removeExisting(url)}
                          onSetCover={() => promote(url)}
                        />
                      ))}
                      {newImages.map((file, index) => (
                        <GalleryTile
                          key={`${file.name}-${file.size}-${index}`}
                          src={previews[index]}
                          pending
                          onRemove={() => removeNew(index)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    <label
                      className="btn btn--ghost btn--sm"
                      style={{ cursor: 'pointer', width: 'fit-content' }}
                    >
                      <Icon name="plus" size={14} />
                      Add images
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={addImages}
                        disabled={editing.images.length + newImages.length >= MAX_GALLERY}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <span className="faint" style={{ fontSize: 11.5 }}>
                      Up to {MAX_GALLERY} images · {MAX_NEW_FILES} new per save
                    </span>
                  </div>
                </div>
              </div>
            </Field>

            {editing.id && (
              <div
                className="row product-rating-line"
                style={{ gap: 6, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-secondary)' }}
              >
                <Icon name="star" size={14} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                <span className="strong" style={{ color: 'var(--text)' }}>
                  {editing.ratingCount
                    ? `${Number(editing.rating).toFixed(1)} · ${count(editing.ratingCount)} ${
                        editing.ratingCount === 1 ? 'review' : 'reviews'
                      }`
                    : 'No customer reviews yet'}
                </span>
                <span>— moderate in</span>
                <a
                  href={`#/reviews?kind=product&search=${encodeURIComponent(editing.name)}`}
                  style={{ color: 'var(--info)', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Growth → Reviews
                </a>
              </div>
            )}

            {editing.id && editing.status === 'active' && (
              <Note tone="info" icon="info">
                This product is on sale. Saving updates it in place; set stock to 0 to stop
                orders without hiding it.
              </Note>
            )}
          </div>
        </Modal>
      )}

      {archiving && (
        <Modal
          title={`Archive ${archiving.name}?`}
          subtitle="It leaves the catalogue; past orders keep their copy of it"
          onClose={() => setArchiving(null)}
          footer={
            <>
              <Button onClick={() => setArchiving(null)}>Cancel</Button>
              <Button variant="danger" icon="trash" disabled={busy} onClick={archive}>
                Archive product
              </Button>
            </>
          }
        >
          <Note tone="danger" icon="alert">
            Archiving takes the product off the storefront and out of the active list. It is
            not deleted — it can be reactivated from the Archived filter.
          </Note>
        </Modal>
      )}
    </div>
  );
}

export default ProductsPage;
