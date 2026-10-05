/**
 * Testimonials — the curated "Video Testimonials" and "Success Stories" the
 * website shows, as opposed to the reviews seekers write themselves.
 *
 * Each one is written here by hand: a video with a thumbnail, or a story with
 * an outcome line. Draft keeps it off the site until it is ready.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Field,
  ImagePicker,
  Input,
  Modal,
  Note,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  Thumb,
  Toggle,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  createTestimonial,
  deleteTestimonial,
  listTestimonials,
  setTestimonialStatus,
  updateTestimonial,
} from '../services/admin';
import { can } from '../services/session';
import { count } from '../utils/format';

const TABS = [
  { key: 'video', label: 'Video' },
  { key: 'story', label: 'Stories' },
];

const KINDS = [
  { value: 'video', label: 'Video testimonial' },
  { value: 'story', label: 'Success story' },
];

const PAGE_LIMIT = 100;

const BLANK = {
  kind: 'video',
  title: '',
  quote: '',
  name: '',
  city: '',
  tag: '',
  outcome: '',
  duration: '',
  videoUrl: '',
  avatarUrl: '',
  thumbnailUrl: '',
  published: true,
  sortOrder: '0',
};

const toForm = (row) => ({
  id: row.id,
  kind: row.kind || 'video',
  title: row.title || '',
  quote: row.quote || '',
  name: row.name || '',
  city: row.city || '',
  tag: row.tag || '',
  outcome: row.outcome || '',
  duration: row.duration || '',
  videoUrl: row.videoUrl || '',
  avatarUrl: row.avatarUrl || '',
  thumbnailUrl: row.thumbnailUrl || '',
  published: row.status !== 'draft',
  sortOrder: row.sortOrder ?? 0,
});

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Whose testimonial is this?';
  if (!form.quote.trim() && !form.title.trim()) errors.quote = 'A quote or a title, at least';
  if (form.kind === 'video' && form.videoUrl.trim() && !/^https?:\/\//i.test(form.videoUrl.trim())) {
    errors.videoUrl = 'A full URL, starting with http(s)://';
  }
  const order = Number(form.sortOrder);
  if (form.sortOrder === '' || !Number.isInteger(order)) errors.sortOrder = 'A whole number';
  return errors;
}

export function TestimonialsPage({ notify }) {
  const [tab, setTab] = useState('video');
  const [editing, setEditing] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [run, busy] = useAction(notify);

  const canManage = can('reviews.manage');

  const { data, loading, error, reload } = useApi(
    () => listTestimonials({ kind: tab, limit: PAGE_LIMIT }),
    [tab],
  );

  const rows = data?.items ?? [];

  const errors = editing ? validate(editing) : {};
  const invalid = Object.keys(errors).length > 0;

  const openEditor = (form) => {
    setAvatar(null);
    setThumbnail(null);
    setEditing(form);
  };

  const save = () => {
    const body = {
      kind: editing.kind,
      title: editing.title.trim(),
      quote: editing.quote.trim(),
      name: editing.name.trim(),
      city: editing.city.trim(),
      tag: editing.tag.trim(),
      outcome: editing.kind === 'story' ? editing.outcome.trim() : '',
      duration: editing.kind === 'story' ? editing.duration.trim() : '',
      videoUrl: editing.kind === 'video' ? editing.videoUrl.trim() : '',
      status: editing.published ? 'published' : 'draft',
      sortOrder: Number(editing.sortOrder),
    };
    const files = { avatar, thumbnail };
    return run(
      () => (editing.id ? updateTestimonial(editing.id, body, files) : createTestimonial(body, files)),
      {
        success: editing.id ? 'Testimonial updated' : 'Testimonial added',
        onDone: async () => {
          setEditing(null);
          setAvatar(null);
          setThumbnail(null);
          if (body.kind !== tab) setTab(body.kind);
          else await reload();
        },
      },
    );
  };

  const changeStatus = (row, next) =>
    run(() => setTestimonialStatus(row.id, next), {
      success: next === 'published' ? `${row.name}'s testimonial is live` : `${row.name}'s testimonial unpublished`,
      onDone: reload,
    });

  const remove = () =>
    run(() => deleteTestimonial(deleting.id), {
      success: 'Testimonial deleted',
      onDone: async () => {
        setDeleting(null);
        await reload();
      },
    });

  const columns = [
    {
      key: 'title',
      label: tab === 'video' ? 'Video' : 'Story',
      sortable: true,
      render: (row) => (
        <div className="identity">
          <Thumb src={row.thumbnailUrl || row.avatarUrl} />
          <div className="truncate" style={{ maxWidth: 320 }}>
            <div className="identity__name truncate">{row.title || row.quote}</div>
            <div className="identity__meta truncate">
              {row.title ? row.quote : row.kind === 'story' ? row.outcome : row.videoUrl}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Who',
      sortable: true,
      render: (row) => (
        <span className="nowrap">
          <span className="strong">{row.name}</span>
          {row.city && <span className="faint"> · {row.city}</span>}
        </span>
      ),
    },
    {
      key: 'tag',
      label: 'Tag',
      sortable: true,
      render: (row) => (row.tag ? <Badge tone="lilac">{row.tag}</Badge> : <span className="faint">—</span>),
    },
    ...(tab === 'story'
      ? [
          {
            key: 'duration',
            label: 'Outcome',
            render: (row) => (
              <div>
                <p className="strong truncate" style={{ maxWidth: 200 }}>
                  {row.outcome || '—'}
                </p>
                <p className="faint nowrap" style={{ fontSize: 11.5 }}>
                  {row.duration || ''}
                </p>
              </div>
            ),
          },
        ]
      : [
          {
            key: 'views',
            label: 'Views',
            align: 'right',
            sortable: true,
            render: (row) => <span className="mono">{count(row.views)}</span>,
          },
        ]),
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
              { label: 'Edit', icon: 'edit', onClick: () => openEditor(toForm(row)) },
              row.status === 'published'
                ? { label: 'Unpublish', icon: 'eyeOff', onClick: () => changeStatus(row, 'draft') }
                : {
                    label: 'Publish',
                    icon: 'check',
                    variant: 'success',
                    onClick: () => changeStatus(row, 'published'),
                  },
              { label: 'Delete', icon: 'trash', variant: 'danger', onClick: () => setDeleting(row) },
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
        title="Testimonials"
        subtitle="Hand-picked video testimonials and success stories for the website"
        actions={
          <>
            <Tabs value={tab} onChange={setTab} items={TABS} />
            <Button icon="refresh" onClick={reload}>Refresh</Button>
            {canManage && (
              <Button variant="primary" icon="plus" onClick={() => openEditor({ ...BLANK, kind: tab })}>
                {tab === 'video' ? 'New video' : 'New story'}
              </Button>
            )}
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['title', 'quote', 'name', 'city', 'tag']}
        searchPlaceholder="Search testimonials…"
        empty={{
          icon: 'messageSquare',
          title: tab === 'video' ? 'No video testimonials yet' : 'No success stories yet',
        }}
      />

      {editing && (
        <Modal
          wide
          title={editing.id ? `Edit ${editing.name}'s testimonial` : editing.kind === 'video' ? 'New video testimonial' : 'New success story'}
          subtitle="Published testimonials appear on the website's reviews page and the homepage"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={busy || invalid} onClick={save}>
                {editing.id ? 'Save changes' : 'Add testimonial'}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Kind">
                <Select value={editing.kind} onChange={set('kind')} options={KINDS} />
              </Field>
              <Field label="Title" hint="Optional headline">
                <Input placeholder="e.g. From debt to a thriving business" value={editing.title} onChange={set('title')} />
              </Field>
            </div>

            <Field label="Quote" error={editing.quote !== '' ? errors.quote : undefined}>
              <Textarea rows={3} placeholder="In their own words…" value={editing.quote} onChange={set('quote')} />
            </Field>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Name" error={editing.name !== '' ? errors.name : undefined}>
                <Input placeholder="e.g. Priya Sharma" value={editing.name} onChange={set('name')} />
              </Field>
              <Field label="City">
                <Input placeholder="e.g. Jaipur" value={editing.city} onChange={set('city')} />
              </Field>
              <Field label="Tag" hint="e.g. Career & Finance">
                <Input placeholder="e.g. Career & Finance" value={editing.tag} onChange={set('tag')} />
              </Field>
            </div>

            {editing.kind === 'story' ? (
              <div className="grid grid--2" style={{ gap: 14 }}>
                <Field label="Outcome" hint="The before → after line">
                  <Input placeholder="e.g. ₹12L debt → Business owner" value={editing.outcome} onChange={set('outcome')} />
                </Field>
                <Field label="Over" hint="How long it took">
                  <Input placeholder="e.g. in 18 months" value={editing.duration} onChange={set('duration')} />
                </Field>
              </div>
            ) : (
              <Field label="Video URL" hint="YouTube, Vimeo or a direct file link" error={errors.videoUrl}>
                <Input placeholder="https://youtu.be/…" value={editing.videoUrl} onChange={set('videoUrl')} />
              </Field>
            )}

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Avatar" hint="The person's photo">
                <ImagePicker src={editing.avatarUrl} file={avatar} onPick={setAvatar} size={56} label="Choose photo" />
              </Field>
              <Field label="Thumbnail" hint={editing.kind === 'video' ? "The video's poster frame" : 'Optional card image'}>
                <ImagePicker src={editing.thumbnailUrl} file={thumbnail} onPick={setThumbnail} size={56} />
              </Field>
            </div>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Sort order" hint="Lower shows first" error={errors.sortOrder}>
                <Input type="number" step="1" value={editing.sortOrder} onChange={set('sortOrder')} />
              </Field>
              <Field label="Published" hint="Off keeps it as a draft">
                <div className="row" style={{ height: 40 }}>
                  <Toggle
                    on={editing.published}
                    onChange={(value) => setEditing((current) => ({ ...current, published: value }))}
                    label="Published"
                  />
                </div>
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal
          title={`Delete ${deleting.name}'s testimonial?`}
          subtitle="It leaves the website straight away"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" icon="trash" disabled={busy} onClick={remove}>
                Delete testimonial
              </Button>
            </>
          }
        >
          <Note tone="danger" icon="alert">
            This cannot be undone. To take it down for a while, unpublish it instead.
          </Note>
        </Modal>
      )}
    </div>
  );
}

export default TestimonialsPage;
