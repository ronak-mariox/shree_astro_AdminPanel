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
  Input,
  Modal,
  Note,
  Select,
  StatCard,
  StatusBadge,
  Textarea,
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
  { key: 'archived', label: 'Archived' },
];

/** The categories the app's content list groups by. */
const CATEGORIES = [
  'Astrology Basics',
  'Kundli & Charts',
  'Doshas & Remedies',
  'Festivals & Muhurat',
  'Gemstones',
];

const BLANK = {
  title: '',
  category: CATEGORIES[0],
  author: '',
  visibility: 'everyone',
  excerpt: '',
  body: '',
};

const PAGE_LIMIT = 100;

export function ContentPage({ notify }) {
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [run, busy] = useAction(notify);

  const { data, loading, error, reload } = useApi(
    () => listArticles({ status: status === 'all' ? undefined : status, limit: PAGE_LIMIT }),
    [status],
  );

  const rows = data?.items ?? [];
  const canManage = can('content.manage');

  const save = (publish) => {
    const body = {
      title: editing.title.trim(),
      category: editing.category,
      author: editing.author.trim(),
      visibility: editing.visibility,
      excerpt: editing.excerpt.trim(),
      body: editing.body,
      ...(publish ? { status: 'published' } : {}),
    };

    return run(() => (editing._id ? updateArticle(editing._id, body) : createArticle(body)), {
      success: publish ? 'Article published' : 'Draft saved',
      onDone: async () => {
        setEditing(null);
        await reload();
      },
    });
  };

  const remove = (article) =>
    run(() => deleteArticle(article._id), {
      success: 'Article deleted',
      onDone: reload,
    });

  const setStatusOf = (article, next) =>
    run(() => updateArticle(article._id, { status: next }), {
      success: next === 'published' ? 'Article published' : 'Article archived',
      onDone: reload,
    });

  const columns = [
    {
      key: 'title',
      label: 'Article',
      sortable: true,
      render: (row) => (
        <div style={{ maxWidth: 380 }}>
          <p className="strong truncate">{row.title}</p>
          <p className="faint truncate" style={{ fontSize: 11.5 }}>
            {row.excerpt}
          </p>
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
              { label: 'Edit', icon: 'edit', onClick: () => setEditing(row) },
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
              { label: 'Delete', icon: 'trash', variant: 'danger', onClick: () => remove(row) },
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
              <Button variant="primary" icon="plus" onClick={() => setEditing({ ...BLANK })}>
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
        onRowClick={canManage ? setEditing : undefined}
        toolbar={<Chips value={status} onChange={setStatus} items={STATUSES} />}
        empty={{ icon: 'file', title: 'No articles in this view' }}
      />

      {editing && (
        <Modal
          wide
          title={editing._id ? 'Edit article' : 'New article'}
          subtitle={
            editing._id
              ? `${label(editing.status)} · updated ${date(editing.updatedAt)}`
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
              <Field label="Category">
                <Select
                  value={editing.category}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, category: event.target.value }))
                  }
                  options={CATEGORIES.map((name) => ({ value: name, label: name }))}
                />
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

            {editing._id && editing.status === 'published' && (
              <Note tone="info" icon="info">
                This article is live in the apps. Saving keeps it published.
              </Note>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ContentPage;
