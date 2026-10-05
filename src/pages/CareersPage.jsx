/**
 * Careers — the job postings on the website's careers page, and the
 * applications that come in through it (for a posting, as an astrologer, or
 * for the internship programme).
 *
 * A posting is public only while `open`; closing it keeps the applications.
 * An application moves received → shortlisted → interview → hired / rejected,
 * with an internal note the applicant never sees.
 */

import { useState } from 'react';
import { DataTable, RowActions } from '../components/DataTable';
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
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
} from '../components/ui';
import { useAction, useApi } from '../hooks/useApi';
import {
  createJob,
  deleteJob,
  getApplication,
  listApplications,
  listJobs,
  setJobStatus,
  updateApplication,
  updateJob,
} from '../services/admin';
import { can } from '../services/session';
import { mediaUrl } from '../utils/media';
import { count, date, dateTime, label, phone as formatPhone } from '../utils/format';

const TABS = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'applications', label: 'Applications' },
];

const JOB_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'draft', label: 'Draft' },
];

const DEPARTMENTS = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'design', label: 'Design' },
  { value: 'astrology', label: 'Astrology' },
  { value: 'operations', label: 'Operations' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'internship', label: 'Internship' },
];
const OTHER = 'other';
const departmentLabel = (key) => DEPARTMENTS.find((item) => item.value === key)?.label || label(key);

const JOB_TYPES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

const JOB_STATUSES = [
  { value: 'open', label: 'Open — listed on the site' },
  { value: 'draft', label: 'Draft — not listed yet' },
  { value: 'closed', label: 'Closed — no longer accepting' },
];

const APPLICATION_STATUSES = ['received', 'shortlisted', 'interview', 'rejected', 'hired'];

const APPLICATION_FILTERS = [
  { key: 'all', label: 'All' },
  ...APPLICATION_STATUSES.map((status) => ({ key: status, label: label(status) })),
];

const APPLICATION_KINDS = [
  { key: 'all', label: 'All kinds' },
  { key: 'job', label: 'Job' },
  { key: 'astrologer', label: 'Astrologer' },
  { key: 'internship', label: 'Internship' },
];

const KIND_TONE = { job: 'info', astrologer: 'brand', internship: 'lilac' };
const APPLICATION_TONE = {
  received: 'warning',
  shortlisted: 'info',
  interview: 'lilac',
  rejected: 'danger',
  hired: 'success',
};
const ApplicationStatus = ({ status }) => (
  <Badge tone={APPLICATION_TONE[status] || 'neutral'} dot>
    {label(status)}
  </Badge>
);

const toKey = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const lines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const PAGE_LIMIT = 100;

/* ————————————————————————————————— Jobs */

const BLANK_JOB = {
  title: '',
  departmentChoice: DEPARTMENTS[0].value,
  departmentOther: '',
  location: '',
  type: 'full-time',
  experience: '',
  tagsText: '',
  salary: '',
  openings: '1',
  description: '',
  responsibilitiesText: '',
  requirementsText: '',
  status: 'open',
};

const jobToForm = (row) => {
  const known = DEPARTMENTS.some((item) => item.value === row.department);
  return {
    id: row.id,
    title: row.title || '',
    departmentChoice: known ? row.department : OTHER,
    departmentOther: known ? '' : row.department || '',
    location: row.location || '',
    type: row.type || 'full-time',
    experience: row.experience || '',
    tagsText: (row.tags || []).join(', '),
    salary: row.salary || row.stipend || '',
    openings: row.openings ?? 1,
    description: row.description || '',
    responsibilitiesText: (row.responsibilities || []).join('\n'),
    requirementsText: (row.requirements || []).join('\n'),
    status: row.status || 'open',
  };
};

function validateJob(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = 'Give the role a title';
  if (form.departmentChoice === OTHER && !toKey(form.departmentOther)) {
    errors.department = 'Type a department';
  }
  if (!form.location.trim()) errors.location = 'Where is it based? e.g. Jaipur / Remote';
  const openings = Number(form.openings);
  if (form.openings === '' || !Number.isInteger(openings) || openings < 1) {
    errors.openings = 'A whole number, 1 or more';
  }
  return errors;
}

export function CareersPage({ notify }) {
  const [tab, setTab] = useState('jobs');
  const [jobFilter, setJobFilter] = useState('all');
  const [editingJob, setEditingJob] = useState(null);
  const [deletingJob, setDeletingJob] = useState(null);
  const [appFilter, setAppFilter] = useState('all');
  const [appKind, setAppKind] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [edits, setEdits] = useState(null);
  const [run, busy] = useAction(notify);

  const canView = can('careers.view') || can('careers.manage');
  const canManage = can('careers.manage');

  const jobs = useApi(
    () => listJobs({ status: jobFilter === 'all' ? undefined : jobFilter, limit: PAGE_LIMIT }),
    [jobFilter],
    { skip: !canView },
  );
  const applications = useApi(
    () =>
      listApplications({
        status: appFilter === 'all' ? undefined : appFilter,
        kind: appKind === 'all' ? undefined : appKind,
        limit: PAGE_LIMIT,
      }),
    [appFilter, appKind],
    { skip: !canView || tab !== 'applications' },
  );
  const { data: detail, loading: loadingDetail, reload: reloadDetail } = useApi(
    () => getApplication(openId),
    [openId],
    { skip: !openId },
  );

  const jobRows = jobs.data?.items ?? [];
  const appRows = applications.data?.items ?? [];
  const open = detail?.application;

  /** The status and note as typed, or as saved when nothing is typed. */
  const form = edits ?? { status: open?.status || 'received', adminNote: open?.adminNote || '' };

  /* ——— jobs */

  const jobErrors = editingJob ? validateJob(editingJob) : {};
  const jobInvalid = Object.keys(jobErrors).length > 0;

  const saveJob = () => {
    const form = editingJob;
    const body = {
      title: form.title.trim(),
      department: form.departmentChoice === OTHER ? toKey(form.departmentOther) : form.departmentChoice,
      location: form.location.trim(),
      type: form.type,
      experience: form.experience.trim(),
      tags: form.tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      salary: form.salary.trim(),
      openings: Number(form.openings),
      description: form.description.trim(),
      responsibilities: lines(form.responsibilitiesText),
      requirements: lines(form.requirementsText),
      status: form.status,
    };
    return run(() => (form.id ? updateJob(form.id, body) : createJob(body)), {
      success: form.id ? 'Job updated' : 'Job posted',
      onDone: async () => {
        setEditingJob(null);
        await jobs.reload();
      },
    });
  };

  const changeJobStatus = (row, next) =>
    run(() => setJobStatus(row.id, next), {
      success: next === 'open' ? `${row.title} is open for applications` : `${row.title} closed`,
      onDone: jobs.reload,
    });

  const removeJob = () =>
    run(() => deleteJob(deletingJob.id), {
      success: `${deletingJob.title} deleted`,
      onDone: async () => {
        setDeletingJob(null);
        await jobs.reload();
      },
    });

  /* ——— applications */

  const openApplication = (id) => {
    setEdits(null);
    setOpenId(id);
  };

  const saveApplication = () =>
    run(
      () =>
        updateApplication(open.id, {
          status: form.status,
          adminNote: form.adminNote.trim(),
        }),
      {
        success: `${open.fullName} marked ${label(form.status).toLowerCase()}`,
        onDone: async () => {
          setEdits(null);
          await applications.reload();
          await reloadDetail();
        },
      },
    );

  const stat = (status) => appRows.filter((row) => row.status === status).length;

  /* ——— columns */

  const jobColumns = [
    {
      key: 'title',
      label: 'Role',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong">{row.title}</p>
          <p className="faint nowrap" style={{ fontSize: 11.5 }}>
            {row.experience || 'Any experience'}
            {row.salary || row.stipend ? ` · ${row.salary || row.stipend}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      sortable: true,
      render: (row) => <Badge tone="neutral">{departmentLabel(row.department)}</Badge>,
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true,
      render: (row) => <span className="nowrap">{row.location || '—'}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (row) => label(row.type),
    },
    {
      key: 'openings',
      label: 'Openings',
      align: 'right',
      sortable: true,
      render: (row) => <span className="mono">{count(row.openings)}</span>,
    },
    {
      key: 'applicationsCount',
      label: 'Applied',
      align: 'right',
      sortable: true,
      render: (row) =>
        row.applicationsCount != null ? (
          <span className="mono">{count(row.applicationsCount)}</span>
        ) : (
          <span className="faint">—</span>
        ),
    },
    {
      key: 'postedAt',
      label: 'Posted',
      sortable: true,
      sortValue: (row) => new Date(row.postedAt || row.createdAt).getTime(),
      render: (row) => <span className="nowrap">{date(row.postedAt || row.createdAt)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status === 'open' ? 'active' : row.status} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'actions',
      render: (row) =>
        canManage ? (
          <RowActions
            actions={[
              { label: 'Edit', icon: 'edit', onClick: () => setEditingJob(jobToForm(row)) },
              row.status === 'open'
                ? { label: 'Close', icon: 'eyeOff', onClick: () => changeJobStatus(row, 'closed') }
                : {
                    label: 'Open',
                    icon: 'check',
                    variant: 'success',
                    onClick: () => changeJobStatus(row, 'open'),
                  },
              { label: 'Delete', icon: 'trash', variant: 'danger', onClick: () => setDeletingJob(row) },
            ]}
          />
        ) : null,
    },
  ];

  const appColumns = [
    {
      key: 'fullName',
      label: 'Applicant',
      sortable: true,
      render: (row) => (
        <Identity name={row.fullName} meta={row.email || formatPhone(row.phone)} size="sm" />
      ),
    },
    {
      key: 'roleTitle',
      label: 'Role',
      sortable: true,
      render: (row) => (
        <div>
          <p className="strong truncate" style={{ maxWidth: 220 }}>
            {row.roleTitle || row.job?.title || '—'}
          </p>
          {row.reference && (
            <p className="faint mono" style={{ fontSize: 11.5 }}>
              {row.reference}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'kind',
      label: 'Kind',
      sortable: true,
      render: (row) => <Badge tone={KIND_TONE[row.kind] || 'neutral'}>{label(row.kind)}</Badge>,
    },
    {
      key: 'createdAt',
      label: 'Applied',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => <span className="nowrap">{dateTime(row.createdAt)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <ApplicationStatus status={row.status} />,
    },
  ];

  const setJob = (key) => (event) =>
    setEditingJob((current) => ({ ...current, [key]: event.target.value }));

  const resumeUrl = open?.resume?.url ? mediaUrl(open.resume.url) : undefined;

  return (
    <div className="page">
      <PageHeader
        title="Careers"
        subtitle="Job postings on the website, and everyone who has applied"
        actions={
          <>
            <Tabs value={tab} onChange={setTab} items={TABS} />
            <Button icon="refresh" onClick={tab === 'jobs' ? jobs.reload : applications.reload}>
              Refresh
            </Button>
            {canManage && tab === 'jobs' && (
              <Button variant="primary" icon="plus" onClick={() => setEditingJob({ ...BLANK_JOB })}>
                New job
              </Button>
            )}
          </>
        }
      />

      {!canView && (
        <Note tone="warning" icon="lock">
          Your role does not include <strong>careers.view</strong>. Ask a super admin for access.
        </Note>
      )}

      {canView && tab === 'jobs' && (
        <DataTable
          columns={jobColumns}
          rows={jobRows}
          loading={jobs.loading}
          error={jobs.error}
          onRetry={jobs.reload}
          searchKeys={['title', 'department', 'location', 'type']}
          searchPlaceholder="Search by role, department or location…"
          toolbar={<Chips value={jobFilter} onChange={setJobFilter} items={JOB_FILTERS} />}
          empty={{ icon: 'briefcase', title: 'No job postings in this view' }}
        />
      )}

      {canView && tab === 'applications' && (
        <>
          <div className="grid grid--stats" style={{ marginBottom: 16 }}>
            <StatCard label="Received" value={count(stat('received'))} icon="inbox" tone="brand" hint="not yet looked at" />
            <StatCard label="Shortlisted" value={count(stat('shortlisted'))} icon="userCheck" tone="yellow" hint="in this view" />
            <StatCard label="Interview" value={count(stat('interview'))} icon="calendar" hint="in this view" />
            <StatCard label="Hired" value={count(stat('hired'))} icon="checkCircle" tone="success" hint="in this view" />
          </div>

          <DataTable
            columns={appColumns}
            rows={appRows}
            loading={applications.loading}
            error={applications.error}
            onRetry={applications.reload}
            searchKeys={['fullName', 'email', 'phone', 'roleTitle', 'reference']}
            searchPlaceholder="Search by name, email, phone or role…"
            onRowClick={(row) => openApplication(row.id)}
            toolbar={
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <Chips value={appFilter} onChange={setAppFilter} items={APPLICATION_FILTERS} />
                <Chips value={appKind} onChange={setAppKind} items={APPLICATION_KINDS} />
              </div>
            }
            empty={{ icon: 'inbox', title: 'No applications in this view' }}
          />
        </>
      )}

      {openId && (
        <Drawer
          wide
          title={open?.fullName || 'Loading…'}
          subtitle={open ? `${open.roleTitle || open.job?.title || label(open.kind)} · applied ${dateTime(open.createdAt)}` : ''}
          onClose={() => setOpenId(null)}
          footer={
            resumeUrl ? (
              <a className="btn btn--ghost" href={resumeUrl} target="_blank" rel="noreferrer">
                Open resume
              </a>
            ) : undefined
          }
        >
          {loadingDetail || !open ? (
            <LoadingBlock />
          ) : (
            <div className="stack" style={{ gap: 18 }}>
              <div className="profile-head">
                <Identity name={open.fullName} meta={open.email} size="lg" />
                <div className="row" style={{ gap: 6 }}>
                  <Badge tone={KIND_TONE[open.kind] || 'neutral'}>{label(open.kind)}</Badge>
                  <ApplicationStatus status={open.status} />
                </div>
              </div>

              <section>
                <h3 className="section-title">Applicant</h3>
                <DetailList
                  rows={[
                    { label: 'Reference', value: <span className="mono">{open.reference || open.id}</span> },
                    { label: 'Role', value: open.roleTitle || open.job?.title || '—' },
                    { label: 'Email', value: open.email || '—' },
                    { label: 'Phone', value: formatPhone(open.phone) },
                    { label: 'Experience', value: open.experience || '—' },
                    {
                      label: 'LinkedIn',
                      value: open.linkedin ? (
                        <a href={open.linkedin} target="_blank" rel="noreferrer" style={{ color: 'var(--grad-from)' }}>
                          {open.linkedin}
                        </a>
                      ) : (
                        '—'
                      ),
                    },
                    {
                      label: 'Resume',
                      value: resumeUrl ? (
                        <a href={resumeUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--grad-from)' }}>
                          {open.resume.fileName || 'Download'}
                          {open.resume.sizeBytes ? ` (${Math.round(open.resume.sizeBytes / 1024)} KB)` : ''}
                        </a>
                      ) : (
                        'Not attached'
                      ),
                    },
                    { label: 'Applied', value: dateTime(open.createdAt) },
                  ]}
                />
              </section>

              <section>
                <h3 className="section-title">Message</h3>
                <p style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>
                  {open.message || <span className="faint">No message included.</span>}
                </p>
              </section>

              <section>
                <h3 className="section-title">Status &amp; admin note</h3>
                <div className="stack" style={{ gap: 12 }}>
                  <Field label="Status">
                    <Select
                      value={form.status}
                      disabled={!canManage}
                      onChange={(event) => setEdits({ ...form, status: event.target.value })}
                      options={APPLICATION_STATUSES.map((status) => ({ value: status, label: label(status) }))}
                    />
                  </Field>
                  <Field label="Admin note" hint="Internal — the applicant never sees this">
                    <Textarea
                      placeholder="e.g. Strong portfolio; schedule a call next week."
                      value={form.adminNote}
                      disabled={!canManage}
                      onChange={(event) => setEdits({ ...form, adminNote: event.target.value })}
                    />
                  </Field>
                  {canManage && (
                    <div>
                      <Button variant="primary" icon="check" disabled={busy || !edits} onClick={saveApplication}>
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </Drawer>
      )}

      {editingJob && (
        <Modal
          wide
          title={editingJob.id ? `Edit ${editingJob.title}` : 'New job posting'}
          subtitle="Listed on the website's careers page while open"
          onClose={() => setEditingJob(null)}
          footer={
            <>
              <Button onClick={() => setEditingJob(null)}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={busy || jobInvalid} onClick={saveJob}>
                {editingJob.id ? 'Save changes' : 'Post job'}
              </Button>
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <Field label="Title" error={editingJob.title !== '' ? jobErrors.title : undefined}>
              <Input placeholder="e.g. Senior Vedic Astrologer" value={editingJob.title} onChange={setJob('title')} />
            </Field>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Department" error={jobErrors.department}>
                <div className="stack" style={{ gap: 8 }}>
                  <Select
                    value={editingJob.departmentChoice}
                    onChange={setJob('departmentChoice')}
                    options={[...DEPARTMENTS, { value: OTHER, label: 'Other…' }]}
                  />
                  {editingJob.departmentChoice === OTHER && (
                    <Input placeholder="e.g. Customer Support" value={editingJob.departmentOther} onChange={setJob('departmentOther')} />
                  )}
                </div>
              </Field>
              <Field label="Location" error={editingJob.location !== '' ? jobErrors.location : undefined}>
                <Input placeholder="e.g. Jaipur / Remote" value={editingJob.location} onChange={setJob('location')} />
              </Field>
              <Field label="Type">
                <Select value={editingJob.type} onChange={setJob('type')} options={JOB_TYPES} />
              </Field>
            </div>

            <div className="grid grid--3" style={{ gap: 14 }}>
              <Field label="Experience" hint="Free text">
                <Input placeholder="e.g. 2–4 yrs" value={editingJob.experience} onChange={setJob('experience')} />
              </Field>
              <Field label="Salary / stipend" hint="Optional, as printed">
                <Input placeholder="e.g. ₹6–9 LPA or ₹15k/month" value={editingJob.salary} onChange={setJob('salary')} />
              </Field>
              <Field label="Openings" error={jobErrors.openings}>
                <Input type="number" min="1" step="1" value={editingJob.openings} onChange={setJob('openings')} />
              </Field>
            </div>

            <Field label="Tags" hint="Comma-separated — e.g. React, Node.js, MongoDB">
              <Input placeholder="e.g. Vedic, KP, Remedies" value={editingJob.tagsText} onChange={setJob('tagsText')} />
            </Field>

            <Field label="Description">
              <Textarea rows={4} placeholder="What the role is and who it suits." value={editingJob.description} onChange={setJob('description')} />
            </Field>

            <div className="grid grid--2" style={{ gap: 14 }}>
              <Field label="Responsibilities" hint="One per line">
                <Textarea
                  rows={5}
                  placeholder={'Consult seekers over chat and call\nWrite weekly horoscopes'}
                  value={editingJob.responsibilitiesText}
                  onChange={setJob('responsibilitiesText')}
                />
              </Field>
              <Field label="Requirements" hint="One per line">
                <Textarea
                  rows={5}
                  placeholder={'Jyotish Acharya or equivalent\nFluent Hindi and English'}
                  value={editingJob.requirementsText}
                  onChange={setJob('requirementsText')}
                />
              </Field>
            </div>

            <Field label="Status">
              <Select value={editingJob.status} onChange={setJob('status')} options={JOB_STATUSES} />
            </Field>
          </div>
        </Modal>
      )}

      {deletingJob && (
        <Modal
          title={`Delete ${deletingJob.title}?`}
          subtitle="Applications already received are kept"
          onClose={() => setDeletingJob(null)}
          footer={
            <>
              <Button onClick={() => setDeletingJob(null)}>Cancel</Button>
              <Button variant="danger" icon="trash" disabled={busy} onClick={removeJob}>
                Delete job
              </Button>
            </>
          }
        >
          <Note tone="danger" icon="alert">
            This cannot be undone. To stop applications for a while, close the posting instead.
          </Note>
        </Modal>
      )}
    </div>
  );
}

export default CareersPage;
