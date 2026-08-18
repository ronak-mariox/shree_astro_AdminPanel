/**
 * Content Management — the astrology article library, with the create /
 * publish / categorise / visibility controls the FRD calls for.
 */

import { useMemo, useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/Shell';
import {
  Badge,
  Button,
  Card,
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
import { articles as seed, contentCategories } from '../data/content';

const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'review', label: 'In review' },
  { key: 'archived', label: 'Archived' },
];

const emptyDraft = {
  title: '',
  category: 'Astrology Basics',
  author: 'Pt. Rajesh Sharma',
  visibility: 'Everyone',
  excerpt: '',
  body: '',
};

export function ContentPage({ notify }) {
  const [rows, setRows] = useState(seed);
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('All');
  const [editing, setEditing] = useState(null);

  const counts = useMemo(
    () =>
      STATUSES.reduce(
        (acc, item) => ({
          ...acc,
          [item.key]:
            item.key === 'all' ? rows.length : rows.filter((row) => row.status === item.key).length,
        }),
        {},
      ),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === 'all' || row.status === status) &&
          (category === 'All' || row.category === category),
      ),
    [rows, status, category],
  );

  const setRowStatus = (id, next, message) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, status: next } : row)),
    );
    notify(message, { tone: next === 'published' ? 'success' : undefined });
  };

  const save = (publish) => {
    const draft = editing;
    if (draft.id) {
      setRows((current) =>
        current.map((row) =>
          row.id === draft.id
            ? { ...row, ...draft, status: publish ? 'published' : row.status, updated: '17 Aug 2026' }
            : row,
        ),
      );
    } else {
      setRows((current) => [
        {
          ...draft,
          id: `ct-${32 + current.length}`,
          status: publish ? 'published' : 'draft',
          views: 0,
          updated: '17 Aug 2026',
        },
        ...current,
      ]);
    }
    setEditing(null);
    notify(publish ? 'Article published' : 'Draft saved', { tone: publish ? 'success' : undefined });
  };

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
      render: (row) => <Badge tone="neutral">{row.category}</Badge>,
    },
    {
      key: 'author',
      label: 'Author',
      sortable: true,
      render: (row) => <span className="nowrap">{row.author}</span>,
    },
    {
      key: 'visibility',
      label: 'Visibility',
      sortable: true,
      render: (row) => (
        <span className="row" style={{ gap: 6, fontSize: 12.5 }}>
          <Icon name={row.visibility === 'Hidden' ? 'eyeOff' : 'eye'} size={14} />
          {row.visibility}
        </span>
      ),
    },
    {
      key: 'views',
      label: 'Views',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{row.views.toLocaleString('en-IN')}</span>,
    },
    {
      key: 'updated',
      label: 'Updated',
      sortable: true,
      render: (row) => <span className="nowrap">{row.updated}</span>,
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
          actions={[
            { label: 'Edit', icon: 'edit', onClick: () => setEditing(row) },
            row.status === 'published'
              ? {
                  label: 'Unpublish',
                  icon: 'eyeOff',
                  onClick: () => setRowStatus(row.id, 'archived', 'Article archived'),
                }
              : {
                  label: 'Publish',
                  icon: 'check',
                  variant: 'success',
                  onClick: () => setRowStatus(row.id, 'published', 'Article published'),
                },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Content Management"
        subtitle="Articles and guides published into the customer app's content library"
        actions={
          <>
            <Button icon="upload">Import</Button>
            <Button variant="primary" icon="plus" onClick={() => setEditing({ ...emptyDraft })}>
              New article
            </Button>
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <StatCard label="Published articles" value={counts.published} icon="file" tone="brand" delta="+3" hint="this month" />
        <StatCard label="Total reads" value="82.8k" icon="eye" tone="success" delta="+11.4%" hint="last 30 days" />
        <StatCard label="Awaiting review" value={counts.review} icon="inbox" tone="yellow" delta="1 new" deltaTone="flat" hint="submitted by astrologers" />
        <StatCard label="Avg. read time" value="3m 12s" icon="clock" delta="+18s" hint="per article" />
      </div>

      <div className="row row--wrap" style={{ marginBottom: 14, gap: 10 }}>
        <Chips
          value={status}
          onChange={setStatus}
          items={STATUSES.map((item) => ({ ...item, count: counts[item.key] }))}
        />
        <div style={{ marginLeft: 'auto', minWidth: 200 }}>
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={contentCategories}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        searchKeys={['title', 'author', 'category']}
        searchPlaceholder="Search the content library…"
        onRowClick={setEditing}
        empty={{
          icon: 'file',
          title: 'Nothing here yet',
          desc: 'Publish an article and it appears in the app’s content library within a minute.',
        }}
      />

      {editing && (
        <Modal
          wide
          title={editing.id ? 'Edit article' : 'New article'}
          subtitle={
            editing.id
              ? `${editing.id} · last updated ${editing.updated}`
              : 'Published content reaches every user of the customer app'
          }
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => save(false)} disabled={!editing.title.trim()}>
                Save draft
              </Button>
              <Button
                variant="primary"
                icon="check"
                disabled={!editing.title.trim() || !editing.excerpt.trim()}
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

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Category">
                <Select
                  value={editing.category}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, category: event.target.value }))
                  }
                  options={contentCategories.filter((item) => item !== 'All')}
                />
              </Field>
              <Field label="Author">
                <Select
                  value={editing.author}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, author: event.target.value }))
                  }
                  options={[
                    'Pt. Rajesh Sharma',
                    'Kavita Joshi',
                    'Dr. Suresh Menon',
                    'Guru Prasad Shastri',
                    'Anita Deshpande',
                    'Editorial team',
                  ]}
                />
              </Field>
              <Field label="Visibility">
                <Select
                  value={editing.visibility}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, visibility: event.target.value }))
                  }
                  options={['Everyone', 'Premium', 'Hidden']}
                />
              </Field>
            </div>

            <Field label="Summary" hint="Shown on the card in the app's content list">
              <Textarea
                placeholder="One or two sentences describing what the reader will learn."
                value={editing.excerpt}
                onChange={(event) =>
                  setEditing((current) => ({ ...current, excerpt: event.target.value }))
                }
              />
            </Field>

            <Field label="Body">
              <Textarea
                style={{ minHeight: 160 }}
                placeholder="Write the article. Markdown is supported."
                value={editing.body || ''}
                onChange={(event) =>
                  setEditing((current) => ({ ...current, body: event.target.value }))
                }
              />
            </Field>

            <Card title="Cover image" subtitle="Optional · 16:9, at least 1200 × 675">
              <div className="dropzone">
                <span className="dropzone__icon">
                  <Icon name="image" size={20} />
                </span>
                <p className="strong">Drop an image or browse</p>
                <p className="faint" style={{ fontSize: 11.5 }}>
                  JPG or PNG up to 2 MB
                </p>
              </div>
            </Card>

            {editing.status === 'review' && (
              <Note tone="info" icon="info">
                Submitted by <strong>{editing.author}</strong> for editorial review.
                Publishing makes it visible in the app immediately.
              </Note>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ContentPage;
