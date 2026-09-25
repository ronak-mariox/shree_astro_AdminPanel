/**
 * Content Management — the article library the apps read.
 *
 * A draft is invisible to the apps until it is published, which is what makes
 * the status column the important one on this page.
 */

import { useState } from 'react';
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
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  createArticle,
  deleteArticle,
  listArticles,
  updateArticle,
} from '../services/admin';
import { can } from '../services/session';
import { count, date, label } from '../utils/format';

const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
];

/** Suggested categories — the field itself is free text, so a new one can be typed. */
const CATEGORIES = [
  'Astrology Basics',
  'Kundli & Charts',
  'Doshas & Remedies',
  'Festivals & Muhurat',
  'Gemstones',
  'Daily Horoscope',
  'Astrology Tips',
  'Vastu Tips',
  'Numerology',
  'Dream Interpretation',
  'Gemstone Guide',
  'Festival Articles',
  'Spiritual Lifestyle',
  'Relationship Advice',
  'Career Guidance',
];

const BLANK = {
  title: '',
  category: CATEGORIES[0],
  author: '',
  visibility: 'everyone',
  excerpt: '',
  body: '',
  tagsText: '',
  coverImageUrl: '',
};

/** Articles come back as raw documents, so the id is `_id`; `id` is accepted too. */
const idOf = (row) => row?._id ?? row?.id;

const toForm = (row) => ({
  ...row,
  tagsText: (row.tags || []).join(', '),
});

const PAGE_LIMIT = 100;

export function ContentPage({ notify }) {
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [cover, setCover] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [run, busy] = useAction(notify);

  const { data, loading, error, reload } = useApi(
    () => listArticles({ status: status === 'all' ? undefined : status, limit: PAGE_LIMIT }),
    [status],
  );

  const rows = data?.items ?? [];
  const canManage = can('content.manage');

  const openEditor = (form) => {
    setCover(null);
    setEditing(form);
  };

  const save = (publish) => {
    const body = {
      title: editing.title.trim(),
      category: editing.category.trim(),
      author: editing.author.trim(),
      visibility: editing.visibility,
      excerpt: editing.excerpt.trim(),
      body: editing.body,
      tags: (editing.tagsText || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      ...(publish ? { status: 'published' } : {}),
    };

    return run(
      () => (idOf(editing) ? updateArticle(idOf(editing), body, cover) : createArticle(body, cover)),
      {
        success: publish ? 'Article published' : 'Draft saved',
        onDone: async () => {
          setEditing(null);
          setCover(null);
          await reload();
        },
      },
    );
  };

  const remove = () =>
    run(() => deleteArticle(idOf(deleting)), {
      success: 'Article deleted',
      onDone: async () => {
        setDeleting(null);
        await reload();
      },
    });

  const setStatusOf = (article, next) =>
    run(() => updateArticle(idOf(article), { status: next }), {
      success: next === 'published' ? 'Article published' : 'Article archived',
      onDone: reload,
    });

  const columns = [
    {
      key: 'title',
      label: 'Article',
      sortable: true,
      render: (row) => (
        <div className="identity" style={{ maxWidth: 420 }}>
          <Thumb src={row.coverImageUrl} />
          <div className="truncate">
            <p className="strong truncate">{row.title}</p>
            <p className="faint truncate" style={{ fontSize: 11.5 }}>
              {row.excerpt}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (row) => <Badge tone="neutral">{row.category || 'Uncategorised'}</Badge>,
    },
    {
      key: 'author',
      label: 'Author',
      sortable: true,
      render: (row) => <span className="nowrap">{row.author || '—'}</span>,
    },
    {
      key: 'visibility',
      label: 'Visibility',
      sortable: true,
      render: (row) => (
        <span className="row" style={{ gap: 6, fontSize: 12.5 }}>
          <Icon name={row.visibility === 'users' ? 'eyeOff' : 'eye'} size={14} />
          {row.visibility === 'users' ? 'Signed-in users' : 'Everyone'}
        </span>
      ),
    },
    {
      key: 'readMinutes',
      label: 'Read',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="mono nowrap">{row.readMinutes ? `${row.readMinutes} min` : '—'}</span>
      ),
    },
    {
      key: 'views',
      label: 'Views',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{count(row.views)}</span>,
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      sortValue: (row) => new Date(row.updatedAt).getTime(),
      render: (row) => <span className="nowrap">{date(row.updatedAt)}</span>,
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
                ? {
                    label: 'Archive',
                    icon: 'eyeOff',
                    onClick: () => setStatusOf(row, 'archived'),
                  }
                : {
                    label: 'Publish',
                    icon: 'check',
                    variant: 'success',
                    onClick: () => setStatusOf(row, 'published'),
                  },
              { label: 'Delete', icon: 'trash', variant: 'danger', onClick: () => setDeleting(row) },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Content Management"
        subtitle="Articles the apps read — drafts stay invisible until published"
        actions={
          <>
            <Button icon="refresh" onClick={reload}>Refresh</Button>
            {canManage && (
              <Button variant="primary" icon="plus" onClick={() => openEditor({ ...BLANK })}>
                New article
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard
          label="Articles"
          value={count(data?.total ?? 0)}
          icon="file"
          tone="brand"
          hint="in this view"
        />
        <StatCard
          label="Published"
          value={count(rows.filter((row) => row.status === 'published').length)}
          icon="check"
          tone="success"
          hint="live in the apps"
        />
        <StatCard
          label="Drafts"
          value={count(rows.filter((row) => row.status === 'draft').length)}
          icon="edit"
          tone="yellow"
          hint="not visible yet"
        />
        <StatCard
          label="Total views"
          value={count(rows.reduce((sum, row) => sum + (row.views || 0), 0))}
          icon="eye"
          hint="all time"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={reload}
        searchKeys={['title', 'category', 'author', 'excerpt']}
        searchPlaceholder="Search by title, author or category…"
        onRowClick={canManage ? (row) => openEditor(toForm(row)) : undefined}
        toolbar={<Chips value={status} onChange={setStatus} items={STATUSES} />}
        empty={{ icon: 'file', title: 'No articles in this view' }}
      />

      {editing && (
        <Modal
          wide
          title={idOf(editing) ? 'Edit article' : 'New article'}
          subtitle={
            idOf(editing)
              ? [
                  label(editing.status),
                  `updated ${date(editing.updatedAt)}`,
                  editing.readMinutes ? `${editing.readMinutes} min read` : null,
                  editing.views ? `${count(editing.views)} views` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Saved as a draft until you publish it'
          }
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={busy || !editing.title.trim()} onClick={() => save(false)}>
                Save draft
              </Button>
              <Button
                variant="primary"
                icon="check"
                disabled={busy || !editing.title.trim()}
                onClick={() => save(true)}
              >
                Publish
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Field label="Title">
              <Input
                placeholder="e.g. Understanding Your Mahadasha Cycle"
                value={editing.title}
                onChange={(event) =>
                  setEditing((current) => ({ ...current, title: event.target.value }))
                }
              />
            </Field>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Category" hint="Pick a suggestion or type a new one">
                <Input
                  list="article-categories"
                  placeholder="e.g. Vastu Tips"
                  value={editing.category || ''}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, category: event.target.value }))
                  }
                />
                <datalist id="article-categories">
                  {CATEGORIES.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>
              <Field label="Author">
                <Input
                  placeholder="e.g. Pt. Rajesh Sharma"
                  value={editing.author || ''}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, author: event.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Visibility">
                <Select
                  value={editing.visibility}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, visibility: event.target.value }))
                  }
                  options={[
                    { value: 'everyone', label: 'Everyone — including signed-out visitors' },
                    { value: 'users', label: 'Signed-in users only' },
                  ]}
                />
              </Field>
              <Field label="Tags" hint="Comma-separated">
                <Input
                  placeholder="e.g. rahu, remedies, gemstones"
                  value={editing.tagsText || ''}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, tagsText: event.target.value }))
                  }
                />
              </Field>
            </div>

            <Field label="Cover image" hint="Shown on the card and at the top of the article">
              <ImagePicker src={editing.coverImageUrl} file={cover} onPick={setCover} />
            </Field>

            <Field label="Summary" hint="Shown on the card in the app's content list">
              <Textarea
                placeholder="One or two sentences."
                value={editing.excerpt || ''}
                onChange={(event) =>
                  setEditing((current) => ({ ...current, excerpt: event.target.value }))
                }
              />
            </Field>

            <Field label="Body">
              <Textarea
                rows={10}
                placeholder="The full article."
                value={editing.body || ''}
                onChange={(event) =>
                  setEditing((current) => ({ ...current, body: event.target.value }))
                }
              />
            </Field>

            {idOf(editing) && editing.status === 'published' && (
              <Note tone="info" icon="info">
                This article is live in the apps. Saving keeps it published.
              </Note>
            )}
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Delete this article?"
          subtitle={deleting.title}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" icon="trash" disabled={busy} onClick={remove}>
                Delete article
              </Button>
            </>
          }
        >
          <Note tone="danger" icon="alert">
            This removes the article for good, including from the apps if it is published.
            Archive it instead if you may want it back.
          </Note>
        </Modal>
      )}
    </div>
  );
}

export default ContentPage;
