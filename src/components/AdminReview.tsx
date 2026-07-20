import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  backend,
  type AuthState,
  type FeaturedContent,
  type IntakeHealthSource,
  type IntakeHealthStatus,
  type StagingQueueSource
} from '../lib/backend/findArtBackend';
import { publicListingCutoff, type Exhibition } from '../lib/exhibitions';
import { formatStagedDates, itemUrl, normalizeReviewStatus, type StagedItem, type StagedProposal } from '../lib/stagingReview';
import { FeatureRichText } from './FeatureRichText';

type AdminRoute = 'dashboard' | 'review' | 'featured' | 'history' | 'intake';
type HistoryStatusFilter =
  | 'all'
  | 'reviewer_approved'
  | 'admin_approved'
  | 'rejected'
  | 'needs_revision'
  | 'promoted'
  | 'pending';

const historyValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'n/a';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'n/a';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const emptyAuth: AuthState = {
  configured: backend.configured,
  signedIn: false,
  role: null,
  displayName: null,
  email: null
};

const canPromote = (auth: AuthState) => auth.role === 'admin' || auth.role === 'owner';
const canReview = (auth: AuthState) => auth.role === 'reviewer' || canPromote(auth);
const needsReview = (item: StagedItem, auth: AuthState) => {
  if (canPromote(auth)) return !['approved', 'rejected', 'promoted'].includes(item.reviewStatus);
  return item.reviewStatus === 'pending' || item.reviewStatus === 'needs_revision';
};

function useAuth() {
  const [auth, setAuth] = useState<AuthState>(emptyAuth);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setAuth(await backend.getAuthState());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { auth, loading, refresh };
}

function go(path: string) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function AdminLogin() {
  const { auth, loading, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && auth.signedIn && canReview(auth)) go('/admin/review');
  }, [auth, loading]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await backend.signIn(email, password);
      await refresh();
      go('/admin/review');
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Could not sign in.');
    }
  };

  return (
    <main className="app admin-app">
      <header className="site-header split-header">
        <div>
          <h1>FindArtNYC</h1>
          <p>Admin sign-on</p>
        </div>
        <a href="/">Public site</a>
      </header>

      <section className="admin-login" aria-label="Admin sign-on">
        <h2>Reviewer/Admin access</h2>
        {!backend.configured ? (
          <>
            <p className="admin-note">
              Supabase is not configured locally, so this workspace is using the JSON fallback. Remote reviewer/admin
              auth will work after `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.
            </p>
            <button type="button" onClick={() => go('/admin/review')}>
              Open local review fallback
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="admin-email">
              <span>Email</span>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label htmlFor="admin-password">
              <span>Password</span>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit">Sign in</button>
          </form>
        )}
      </section>
    </main>
  );
}

function AdminHeader({ auth, route }: { auth: AuthState; route: AdminRoute }) {
  const signOut = async () => {
    await backend.signOut();
    go('/admin/login');
  };

  return (
    <header className="site-header split-header">
      <div>
        <h1>{route === 'featured' ? 'Featured content' : route === 'dashboard' ? 'Admin dashboard' : route === 'history' ? 'Review history' : route === 'intake' ? 'Intake health' : 'Data review'}</h1>
        <p>
          {auth.displayName || auth.email || 'Local development'} {auth.role ? `(${auth.role})` : ''}
        </p>
      </div>
      <nav className="admin-nav" aria-label="Admin navigation">
        <a href="/">Public site</a>
        <button type="button" onClick={() => go('/admin')}>Dashboard</button>
        <button type="button" onClick={() => go('/admin/review')}>Review</button>
        {canPromote(auth) && <button type="button" onClick={() => go('/admin/history')}>History</button>}
        {canPromote(auth) && <button type="button" onClick={() => go('/admin/intake')}>Intake health</button>}
        {canPromote(auth) && <button type="button" onClick={() => go('/admin/featured')}>Featured</button>}
        {backend.configured && <button type="button" onClick={signOut}>Sign out</button>}
      </nav>
    </header>
  );
}

function StatusPill({ status }: { status: string }) {
  const statusClassName = status.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return <span className={`status-pill ${statusClassName}`}>{status.replace(/_/g, ' ')}</span>;
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="review-field">
      <dt>{label}</dt>
      <dd>{value || 'n/a'}</dd>
    </div>
  );
}

const proposalFields: Array<{ key: keyof StagedProposal; label: string; multiline?: boolean; type?: 'date' | 'url' }> = [
  { key: 'title', label: 'Title' },
  { key: 'venue', label: 'Venue' },
  { key: 'startDate', label: 'Start date', type: 'date' },
  { key: 'endDate', label: 'End date', type: 'date' },
  { key: 'dateText', label: 'Date text' },
  { key: 'venueAddress', label: 'Address' },
  { key: 'neighborhood', label: 'Neighborhood' },
  { key: 'borough', label: 'Borough' },
  { key: 'city', label: 'City' },
  { key: 'imageUrl', label: 'Image URL', type: 'url' },
  { key: 'sourceUrl', label: 'Source URL', type: 'url' },
  { key: 'exhibitionUrl', label: 'Exhibition URL', type: 'url' },
  { key: 'description', label: 'Description', multiline: true }
];

function ProposalEditor({
  item,
  canEdit,
  onSave,
  startEditing = false
}: {
  item: StagedItem;
  canEdit: boolean;
  onSave: (proposed: StagedProposal) => Promise<void>;
  startEditing?: boolean;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState<StagedProposal>(item.proposed ?? {});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(item.proposed ?? {});
    setEditing(startEditing);
    setMessage('');
    setSaving(false);
  }, [item.id, startEditing]);

  const setField = (key: keyof StagedProposal, value: string) => {
    setDraft((current) => ({ ...current, [key]: value || null }));
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      if (!draft.title?.trim() || !draft.venue?.trim() || !draft.sourceUrl?.trim()) {
        throw new Error('Title, venue, and source URL are required.');
      }
      for (const field of ['startDate', 'endDate'] as const) {
        const value = draft[field];
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new Error(`${field === 'startDate' ? 'Start' : 'End'} date must use YYYY-MM-DD.`);
        }
      }
      await onSave(draft);
      setEditing(false);
      setMessage('Manual edits saved.');
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : 'Could not save staged edits.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <>
        <dl className="review-fields">
          <FieldRow label="Venue" value={item.proposed?.venue} />
          <FieldRow label="Dates" value={formatStagedDates(item.proposed ?? {})} />
          {!item.proposed?.endDate && item.proposed?.startDate && (
            <FieldRow
              label="Public auto-hide"
              value={`${publicListingCutoff({
                startDate: item.proposed.startDate,
                endDate: null,
                dateText: item.proposed.dateText || ''
              })} unless a closing date is added`}
            />
          )}
          <FieldRow label="Address" value={item.proposed?.venueAddress} />
          <FieldRow
            label="Place"
            value={[item.proposed?.neighborhood, item.proposed?.borough, item.proposed?.city].filter(Boolean).join(', ')}
          />
          <FieldRow label="Confidence" value={item.proposed?.sourceConfidence} />
          <FieldRow label="Dedupe" value={item.dedupe?.notes || item.dedupe?.status} />
        </dl>
        {item.proposed?.imageUrl && <img className="review-image" src={item.proposed.imageUrl} alt="" loading="lazy" />}
        {item.proposed?.description && <p className="review-description">{item.proposed.description}</p>}
        <div className="proposal-edit-row">
          {canEdit && <button type="button" onClick={() => setEditing(true)}>Edit staged data</button>}
          {message && <span>{message}</span>}
        </div>
      </>
    );
  }

  return (
    <section className="proposal-editor" aria-label="Edit staged data">
      <div className="review-section-head">
        <h3>Edit staged data</h3>
        <button type="button" onClick={() => setEditing(false)}>Cancel</button>
      </div>
      {proposalFields.map((field) => (
        <label key={field.key}>
          <span>{field.label}</span>
          {field.multiline ? (
            <textarea value={String(draft[field.key] ?? '')} onChange={(event) => setField(field.key, event.target.value)} />
          ) : (
            <input
              type={field.type || 'text'}
              value={String(draft[field.key] ?? '')}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          )}
        </label>
      ))}
      <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save staged data edits'}</button>
      {message && <p className="form-error" role="alert">{message}</p>}
    </section>
  );
}

function SourcePreview({ item }: { item: StagedItem }) {
  const url = itemUrl(item);
  const previewUrl = backend.sourcePreviewUrl(url);
  const [loading, setLoading] = useState(Boolean(previewUrl));

  useEffect(() => {
    setLoading(Boolean(previewUrl));
  }, [previewUrl]);

  return (
    <section className="source-site-pane" aria-label="Source website">
      <div className="source-site-header">
        <strong>Source website</strong>
        {url ? <a href={url} target="_blank" rel="noreferrer">open source</a> : <span>No source URL</span>}
      </div>
      {previewUrl ? (
        <div className="source-frame-wrap">
          {loading && (
            <div className="source-loading" role="status" aria-live="polite">
              <span>Loading source website...</span>
            </div>
          )}
          <iframe
            key={previewUrl}
            className={loading ? 'source-site-frame loading' : 'source-site-frame'}
            src={previewUrl}
            title="Source website preview"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            onLoad={() => setLoading(false)}
          />
        </div>
      ) : (
        <div className="source-preview-empty">No source URL available for this item.</div>
      )}
    </section>
  );
}

function ReviewActions({
  auth,
  item,
  onRefresh
}: {
  auth: AuthState;
  item: StagedItem;
  onRefresh: () => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNotes('');
    setMessage('');
    setSubmitting(false);
  }, [item.id]);

  const submitApproval = async () => {
    setMessage('');
    setSubmitting(true);
    try {
      if (canPromote(auth)) {
        await backend.promoteStagingItem(item, notes);
        setMessage('Approved and promoted.');
      } else {
        await backend.submitReviewDecision(item.id, 'looks_good', notes);
        setMessage('Approval recommendation saved.');
      }
      await onRefresh();
    } catch (approvalError) {
      setMessage(approvalError instanceof Error ? approvalError.message : 'Approval failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitRejection = async () => {
    setMessage('');
    setSubmitting(true);
    try {
      if (canPromote(auth)) {
        await backend.updateStagingStatus(item.id, 'rejected', notes);
        setMessage('Rejected.');
      } else {
        await backend.submitReviewDecision(item.id, 'reject', notes);
        setMessage('Rejection recommendation saved.');
      }
      await onRefresh();
    } catch (rejectionError) {
      setMessage(rejectionError instanceof Error ? rejectionError.message : 'Rejection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="review-actions" aria-label="Review decision">
      <div className="decision-buttons primary-decisions">
        <button type="button" onClick={submitApproval} disabled={!canReview(auth) || submitting}>
          {submitting ? 'Working...' : 'Approve'}
        </button>
        <button type="button" onClick={submitRejection} disabled={!canReview(auth) || submitting}>
          Reject
        </button>
      </div>
      <label htmlFor="review-notes">
        <span>Notes</span>
        <textarea
          id="review-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional context for this decision"
        />
      </label>
      {message && <p className="decision-saved">{message}</p>}
    </section>
  );
}

export function AdminDashboard() {
  const { auth, loading } = useAuth();
  if (loading) return <main className="app admin-app">Loading...</main>;
  if (!auth.signedIn || !canReview(auth)) return <AdminLogin />;

  return (
    <main className="app admin-app">
      <AdminHeader auth={auth} route="dashboard" />
      <section className="admin-login">
        <h2>Review workflow</h2>
        <p>Reviewers can recommend decisions on staged source data. Admins can promote approved records and publish featured content.</p>
        <button type="button" onClick={() => go('/admin/review')}>Open review queue</button>
        {canPromote(auth) && <button type="button" onClick={() => go('/admin/history')}>Review history</button>}
        {canPromote(auth) && <button type="button" onClick={() => go('/admin/intake')}>Intake health</button>}
        {canPromote(auth) && <button type="button" onClick={() => go('/admin/featured')}>Manage featured content</button>}
      </section>
    </main>
  );
}

function ReviewWorkspace() {
  const { auth, loading } = useAuth();
  const [sources, setSources] = useState<StagingQueueSource[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refreshQueues = async () => {
    try {
      const next = await backend.getStagingQueues();
      setSources(next);
      setError('');
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : 'Could not load staging queue.');
    }
  };

  useEffect(() => {
    if (!loading && auth.signedIn && canReview(auth)) refreshQueues();
  }, [auth.signedIn, auth.role, loading]);

  const activeSources = sources
    .map((source) => ({ ...source, items: source.items.filter((item) => needsReview(item, auth)) }))
    .filter((source) => source.items.length > 0);
  const selectedSource = activeSources.find((source) => source.id === sourceId) ?? activeSources[0];
  const queueItems = selectedSource?.items ?? [];
  const selectedItem = queueItems.find((item) => item.id === selectedItemId) ?? queueItems[0] ?? null;

  if (loading) return <main className="app admin-app">Loading...</main>;
  if (!auth.signedIn || !canReview(auth)) return <AdminLogin />;

  const saveProposal = async (item: StagedItem, proposed: StagedProposal) => {
    await backend.updateStagingProposal(item.id, proposed, 'Manual staged-data edit from admin review screen.');
    await refreshQueues();
  };

  return (
    <main className="app admin-app">
      <AdminHeader auth={auth} route="review" />
      {error && <p className="form-error">{error}</p>}
      <div className="review-shell">
        <aside className="source-review-list" aria-label="Source datasets">
          <h2>Sources</h2>
          {activeSources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={source.id === selectedSource?.id ? 'source-review-card selected' : 'source-review-card'}
              onClick={() => {
                setSourceId(source.id);
                setSelectedItemId(null);
              }}
            >
              <strong>{source.label}</strong>
              <span>{source.items.length} need review</span>
            </button>
          ))}
          {!activeSources.length && <p className="empty-review">No sources need review.</p>}
        </aside>

        <aside className="review-queue" aria-label="Items to review">
          <div className="review-section-head">
            <h2>{selectedSource?.label || 'Queue'}</h2>
            <span>{queueItems.length} need review</span>
          </div>
          <div className="queue-list-panel">
            {queueItems.map((item) => {
              const proposal = item.proposed ?? {};
              return (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === selectedItem?.id ? 'queue-review-card selected' : 'queue-review-card'}
                  onClick={() => setSelectedItemId(item.id)}
                >
                  <strong>{proposal.title || item.id}</strong>
                  <span>{proposal.venue || 'Unknown venue'}</span>
                  <StatusPill status={item.reviewStatus} />
                </button>
              );
            })}
            {!queueItems.length && <p className="empty-review">No unresolved records in this source.</p>}
          </div>
        </aside>

        <section className="review-detail" aria-label="Selected staged record">
          {selectedItem ? (
            <>
              <h2>{selectedItem.proposed?.title || 'Untitled proposal'}</h2>
              <ProposalEditor
                item={selectedItem}
                canEdit={canPromote(auth) && selectedItem.reviewStatus !== 'promoted'}
                onSave={(proposed) => saveProposal(selectedItem, proposed)}
              />
              <p className="official-link">
                <a href={itemUrl(selectedItem)} target="_blank" rel="noreferrer">Open official source</a>
              </p>
              <ReviewActions auth={auth} item={selectedItem} onRefresh={refreshQueues} />
            </>
          ) : (
            <p>{activeSources.length ? 'Select a staged record.' : 'Review queue is complete.'}</p>
          )}
        </section>

        {selectedItem && <SourcePreview item={selectedItem} />}
      </div>
    </main>
  );
}

export function AdminReview() {
  return <ReviewWorkspace />;
}

export function AdminHistory() {
  const { auth, loading } = useAuth();
  const [sources, setSources] = useState<StagingQueueSource[]>([]);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const [editingItem, setEditingItem] = useState<StagedItem | null>(null);
  const [actingItemId, setActingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refreshHistory = async () => {
    try {
      setSources(await backend.getStagingQueues());
      setError('');
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Could not load review history.');
    }
  };

  useEffect(() => {
    if (!loading && auth.signedIn && canPromote(auth)) refreshHistory();
  }, [auth.signedIn, auth.role, loading]);

  const historyRows = useMemo(
    () =>
      sources.flatMap((source) =>
        source.items.map((item) => ({
          sourceId: source.id,
          sourceLabel: source.label,
          item
        }))
      ),
    [sources]
  );

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return historyRows.filter(({ sourceId, sourceLabel, item }) => {
      const proposal = item.proposed ?? {};
      if (sourceFilter !== 'all' && sourceId !== sourceFilter) return false;
      if (statusFilter !== 'all' && item.reviewStatus !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return [
        sourceLabel,
        item.id,
        item.proposalType,
        item.reviewStatus,
        item.canonicalId,
        proposal.id,
        proposal.title,
        proposal.venue,
        proposal.startDate,
        proposal.endDate,
        proposal.dateText,
        proposal.venueAddress,
        proposal.neighborhood,
        proposal.borough,
        proposal.city,
        proposal.description,
        proposal.tags,
        proposal.sourceConfidence,
        proposal.imageUrl,
        proposal.sourceUrl,
        proposal.exhibitionUrl,
        item.source?.sourceType,
        item.source?.reliability,
        item.source?.notes,
        item.changedFields,
        item.dedupe?.status,
        item.dedupe?.confidence,
        item.dedupe?.matchedRecordIds,
        item.dedupe?.notes,
        item.reviewerNotes,
        item.conflict
      ]
        .map(historyValue)
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [historyRows, query, sourceFilter, statusFilter]);

  if (loading) return <main className="app admin-app">Loading...</main>;
  if (!auth.signedIn || !canPromote(auth)) return <AdminLogin />;

  const toggleExpanded = (rowKey: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const longCell = (value: unknown, expanded: boolean, extraClass = '') => (
    <div className={`history-cell-text ${expanded ? 'expanded' : ''} ${extraClass}`.trim()}>{historyValue(value)}</div>
  );

  const saveHistoryProposal = async (item: StagedItem, proposed: StagedProposal) => {
    if (item.reviewStatus === 'promoted') {
      await backend.updatePromotedStagingProposal(item, proposed, 'Manual correction from review history.');
    } else {
      await backend.updateStagingProposal(item.id, proposed, 'Manual correction from review history.');
    }
    setEditingItem(null);
    setMessage(item.reviewStatus === 'promoted' ? 'Published exhibition updated.' : 'Staged record updated.');
    await refreshHistory();
  };

  const undoApproval = async (item: StagedItem) => {
    const title = item.proposed?.title || item.id;
    if (!window.confirm(`Undo approval for “${title}”? This removes it from the public catalog and returns it to review.`)) return;

    setActingItemId(item.id);
    setMessage('');
    try {
      await backend.undoStagingPromotion(item, 'Approval undone from review history.');
      setMessage(`Approval undone for “${title}”. It is back in the review queue.`);
      await refreshHistory();
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : 'Could not undo approval.');
    } finally {
      setActingItemId(null);
    }
  };

  return (
    <main className="app admin-app">
      <AdminHeader auth={auth} route="history" />
      {error && <p className="form-error">{error}</p>}
      {message && <p className="decision-saved">{message}</p>}
      {editingItem && (
        <section className="history-editor-panel" aria-label="Edit history record">
          <div className="review-section-head">
            <h2>Edit {editingItem.proposed?.title || 'history record'}</h2>
            <button type="button" onClick={() => setEditingItem(null)}>Close</button>
          </div>
          <ProposalEditor
            item={editingItem}
            canEdit
            startEditing
            onSave={(proposed) => saveHistoryProposal(editingItem, proposed)}
          />
        </section>
      )}
      <section className="history-panel" aria-label="Review history">
        <div className="history-toolbar">
          <label htmlFor="history-search">
            <span>Search</span>
            <input
              id="history-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="title, venue, source"
            />
          </label>
          <label htmlFor="history-source">
            <span>Source</span>
            <select id="history-source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="history-status">
            <span>Status</span>
            <select
              id="history-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as HistoryStatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewer_approved">Reviewer approved</option>
              <option value="admin_approved">Admin approved</option>
              <option value="needs_revision">Needs revision</option>
              <option value="rejected">Rejected</option>
              <option value="promoted">Promoted</option>
            </select>
          </label>
          <button type="button" onClick={refreshHistory}>
            Refresh
          </button>
          <span className="history-total">{visibleRows.length} rows</span>
        </div>

        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Actions</th>
                <th>Open</th>
                <th>Status</th>
                <th>Staging ID</th>
                <th>Proposed ID</th>
                <th>Canonical ID</th>
                <th>Proposal type</th>
                <th>Source</th>
                <th>Title</th>
                <th>Venue</th>
                <th>Start date</th>
                <th>End date</th>
                <th>Date text</th>
                <th>Address</th>
                <th>Neighborhood</th>
                <th>Borough</th>
                <th>City</th>
                <th>Description</th>
                <th>Tags</th>
                <th>Confidence</th>
                <th>Image URL</th>
                <th>Source URL</th>
                <th>Exhibition URL</th>
                <th>Source type</th>
                <th>Reliability</th>
                <th>Source notes</th>
                <th>Changed fields</th>
                <th>Dedupe status</th>
                <th>Dedupe confidence</th>
                <th>Dedupe matches</th>
                <th>Dedupe notes</th>
                <th>Reviewer notes</th>
                <th>Conflict JSON</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ sourceId, sourceLabel, item }) => {
                const proposal = item.proposed ?? {};
                const rowKey = `${sourceId}:${item.id}`;
                const expanded = expandedRows.has(rowKey);
                return (
                  <tr key={rowKey} className={expanded ? 'expanded' : ''}>
                    <td className="history-actions">
                      <button type="button" onClick={() => setEditingItem(item)}>Edit</button>
                      {item.reviewStatus === 'promoted' && (
                        <button type="button" onClick={() => undoApproval(item)} disabled={actingItemId === item.id}>
                          {actingItemId === item.id ? 'Undoing...' : 'Undo approval'}
                        </button>
                      )}
                    </td>
                    <td>
                      <button type="button" className="history-expand-button" onClick={() => toggleExpanded(rowKey)}>
                        {expanded ? 'Collapse' : 'Expand'}
                      </button>
                    </td>
                    <td>
                      <StatusPill status={item.reviewStatus} />
                    </td>
                    <td>{historyValue(item.id)}</td>
                    <td>{historyValue(proposal.id)}</td>
                    <td>{historyValue(item.canonicalId)}</td>
                    <td>{historyValue(item.proposalType)}</td>
                    <td>{sourceLabel}</td>
                    <td>{historyValue(proposal.title)}</td>
                    <td>{historyValue(proposal.venue)}</td>
                    <td>{historyValue(proposal.startDate)}</td>
                    <td>{historyValue(proposal.endDate)}</td>
                    <td>{historyValue(proposal.dateText || formatStagedDates(proposal))}</td>
                    <td>{historyValue(proposal.venueAddress)}</td>
                    <td>{historyValue(proposal.neighborhood)}</td>
                    <td>{historyValue(proposal.borough)}</td>
                    <td>{historyValue(proposal.city)}</td>
                    <td className="history-long-cell">{longCell(proposal.description, expanded)}</td>
                    <td>{historyValue(proposal.tags)}</td>
                    <td>{historyValue(proposal.sourceConfidence)}</td>
                    <td className="history-url-cell">
                      {proposal.imageUrl ? <a href={proposal.imageUrl} target="_blank" rel="noreferrer">image</a> : 'n/a'}
                    </td>
                    <td className="history-url-cell">
                      {proposal.sourceUrl ? <a href={proposal.sourceUrl} target="_blank" rel="noreferrer">source</a> : 'n/a'}
                    </td>
                    <td className="history-url-cell">
                      {proposal.exhibitionUrl ? <a href={proposal.exhibitionUrl} target="_blank" rel="noreferrer">exhibition</a> : 'n/a'}
                    </td>
                    <td>{historyValue(item.source?.sourceType)}</td>
                    <td>{historyValue(item.source?.reliability)}</td>
                    <td className="history-long-cell">{longCell(item.source?.notes, expanded)}</td>
                    <td>{historyValue(item.changedFields)}</td>
                    <td>{historyValue(item.dedupe?.status)}</td>
                    <td>{historyValue(item.dedupe?.confidence)}</td>
                    <td>{historyValue(item.dedupe?.matchedRecordIds)}</td>
                    <td className="history-long-cell">{longCell(item.dedupe?.notes, expanded)}</td>
                    <td className="history-long-cell">{longCell(item.reviewerNotes, expanded)}</td>
                    <td className="history-json-cell">{longCell(item.conflict, expanded, 'json')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleRows.length && <p className="empty-review">No history rows match the current filters.</p>}
        </div>
      </section>
    </main>
  );
}

const formatDateTime = (value: string | null) => {
  if (!value) return 'n/a';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
};

const healthStatusRank: Record<IntakeHealthStatus, number> = {
  error: 0,
  stale: 1,
  review_backlog: 2,
  verification_pending: 3,
  warning: 4,
  unknown: 5,
  healthy: 6
};

const statusLabels: Record<IntakeHealthStatus, string> = {
  healthy: 'Healthy',
  stale: 'Refresh overdue',
  verification_pending: 'Verification pending',
  review_backlog: 'Review backlog',
  warning: 'Watch',
  error: 'Error',
  unknown: 'Unknown'
};

const statusClass = (status: IntakeHealthStatus) => status;

const operationalStatusFor = (source: IntakeHealthSource): IntakeHealthStatus => {
  if (source.status === 'error') return 'error';
  if (source.status === 'healthy' && source.pendingReview > 0) return 'review_backlog';
  if (source.status !== 'warning') return source.status;
  if (source.lastError) return 'error';
  if (source.conflicts > 0 || source.needsRevision > 0 || source.pendingReview > 0) return 'review_backlog';
  if (source.verificationStatus && !['verified_live', 'verified_fixture'].includes(source.verificationStatus)) return 'verification_pending';
  return 'stale';
};

const isAfter = (left: string | null, right: string | null) => {
  if (!left) return false;
  if (!right) return true;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime)) return false;
  if (!Number.isFinite(rightTime)) return true;
  return leftTime > rightTime;
};

const daysSinceDate = (value: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / 86400000;
};

const diagnosticTagsFor = (source: IntakeHealthSource) => {
  const status = operationalStatusFor(source);
  const tags: string[] = [];

  if (!source.lastRunAt) tags.push('Not refreshed');
  else if (daysSinceDate(source.lastRunAt) > 14) tags.push('Refresh missed');

  if (status === 'error' || isAfter(source.lastErrorAt, source.lastSuccessAt)) tags.push('Last attempt failed');
  else if (status === 'stale') tags.push('No recent attempt');
  else if (source.lastRunAt) tags.push('Automation running');
  if (source.runCount > 0 && source.incomingRecords === 0 && source.status === 'healthy') tags.push('Quiet but OK');
  if (source.pendingReview > 0) tags.push('Needs review');
  if (source.conflicts > 0) tags.push('Conflicts');
  if (source.verificationStatus && !['verified_live', 'verified_fixture'].includes(source.verificationStatus)) {
    tags.push('Verify live source');
  }
  if (source.verificationStatus && ['verified_live', 'verified_fixture'].includes(source.verificationStatus)) {
    tags.push('Verified');
  }

  return tags;
};

const healthValue = (source: IntakeHealthSource) => {
  const status = operationalStatusFor(source);
  if (status === 'error') return source.lastError || 'Last intake run failed.';
  if (status === 'review_backlog') {
    if (source.conflicts > 0) return `${source.conflicts} conflicts need review.`;
    if (source.needsRevision > 0) return `${source.needsRevision} records need revision.`;
    return `${source.pendingReview} records are waiting in review.`;
  }
  if (status === 'verification_pending') return 'Live verification is pending.';
  if (status === 'stale') return 'Automatic refresh is overdue.';
  if (status === 'healthy') return `${source.incomingRecords} records in the last successful run.`;
  return 'No run data yet.';
};

export function AdminIntakeHealth() {
  const { auth, loading } = useAuth();
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof backend.getIntakeHealth>> | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IntakeHealthStatus | 'all'>('all');
  const [error, setError] = useState('');

  const refreshHealth = async () => {
    try {
      setSnapshot(await backend.getIntakeHealth());
      setError('');
    } catch (healthError) {
      setError(healthError instanceof Error ? healthError.message : 'Could not load intake health.');
    }
  };

  useEffect(() => {
    if (!loading && auth.signedIn && canPromote(auth)) refreshHealth();
  }, [auth.signedIn, auth.role, loading]);

  const sources = snapshot?.sources ?? [];
  const visibleSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sources
      .filter((source) => statusFilter === 'all' || operationalStatusFor(source) === statusFilter)
      .filter((source) => {
        if (!normalizedQuery) return true;
        return [
          source.label,
          source.sourceId,
          operationalStatusFor(source),
          diagnosticTagsFor(source).join(' '),
          source.lastError,
          source.verificationStatus,
          source.verificationNotes,
          source.sourceNotes
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => healthStatusRank[operationalStatusFor(left)] - healthStatusRank[operationalStatusFor(right)] || left.label.localeCompare(right.label));
  }, [query, sources, statusFilter]);

  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (snapshot?.logs ?? []).filter((log) => {
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return [log.sourceLabel, log.sourceId, log.status, log.message, JSON.stringify(log.details ?? {})]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, snapshot?.logs, statusFilter]);

  const totals = sources.reduce(
    (counts, source) => {
      counts[operationalStatusFor(source)] += 1;
      counts.pendingReview += source.pendingReview;
      counts.failures += source.failureCount;
      counts.conflicts += source.conflicts;
      return counts;
    },
    { healthy: 0, stale: 0, verification_pending: 0, review_backlog: 0, warning: 0, error: 0, unknown: 0, pendingReview: 0, failures: 0, conflicts: 0 }
  );

  if (loading) return <main className="app admin-app">Loading...</main>;
  if (!auth.signedIn || !canPromote(auth)) return <AdminLogin />;

  return (
    <main className="app admin-app">
      <AdminHeader auth={auth} route="intake" />
      {error && <p className="form-error">{error}</p>}
      <section className="intake-health-summary" aria-label="Intake health summary">
        <article>
          <span>Healthy</span>
          <strong>{totals.healthy}</strong>
        </article>
        <article>
          <span>Refresh overdue</span>
          <strong>{totals.stale}</strong>
        </article>
        <article>
          <span>Verification</span>
          <strong>{totals.verification_pending}</strong>
        </article>
        <article>
          <span>Review backlog</span>
          <strong>{totals.review_backlog}</strong>
        </article>
        <article>
          <span>Errors</span>
          <strong>{totals.error}</strong>
        </article>
        <article>
          <span>Pending review</span>
          <strong>{totals.pendingReview}</strong>
        </article>
        <article>
          <span>Conflicts</span>
          <strong>{totals.conflicts}</strong>
        </article>
      </section>

      <section className="history-panel intake-health-panel" aria-label="Institution intake health">
        <div className="intake-panel-head">
          <h2>Automatic update monitor</h2>
          <p>Refresh overdue and failed attempts are the main automation signals; review and verification labels describe what happened after intake ran.</p>
        </div>
        <div className="history-toolbar intake-toolbar">
          <label htmlFor="intake-search">
            <span>Search</span>
            <input
              id="intake-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="institution, parser, error"
            />
          </label>
          <label htmlFor="intake-status">
            <span>Status</span>
            <select id="intake-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as IntakeHealthStatus | 'all')}>
              <option value="all">All statuses</option>
              <option value="error">Errors</option>
              <option value="review_backlog">Review backlog</option>
              <option value="verification_pending">Verification pending</option>
              <option value="stale">Refresh overdue</option>
              <option value="warning">Watch</option>
              <option value="unknown">Unknown</option>
              <option value="healthy">Healthy</option>
            </select>
          </label>
          <button type="button" onClick={refreshHealth}>Refresh</button>
          <span className="history-total">Updated {formatDateTime(snapshot?.generatedAt ?? null)}</span>
        </div>

        <div className="intake-health-grid">
          {visibleSources.map((source) => {
            const displayStatus = operationalStatusFor(source);
            return (
            <article key={source.sourceId} className={`intake-source-card ${statusClass(displayStatus)}`}>
              <div className="review-section-head">
                <h2>{source.label}</h2>
                <StatusPill status={statusLabels[displayStatus]} />
              </div>
              <p className="intake-health-message">{healthValue(source)}</p>
              <div className="intake-diagnostic-tags" aria-label={`${source.label} diagnostics`}>
                {diagnosticTagsFor(source).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <dl className="intake-source-metrics">
                <div>
                  <dt>Last attempt</dt>
                  <dd>{formatDateTime(source.lastRunAt)}</dd>
                </div>
                <div>
                  <dt>Last success</dt>
                  <dd>{formatDateTime(source.lastSuccessAt)}</dd>
                </div>
                <div>
                  <dt>Runs</dt>
                  <dd>{source.successCount}/{source.runCount} ok</dd>
                </div>
                <div>
                  <dt>Incoming</dt>
                  <dd>{source.incomingRecords}</dd>
                </div>
                <div>
                  <dt>New / updates</dt>
                  <dd>{source.creates} / {source.updates}</dd>
                </div>
                <div>
                  <dt>Needs review</dt>
                  <dd>{source.pendingReview}</dd>
                </div>
                <div>
                  <dt>Pages fetched</dt>
                  <dd>{source.pagesFetched}</dd>
                </div>
                <div>
                  <dt>Verification</dt>
                  <dd>{source.verificationStatus || 'n/a'}</dd>
                </div>
              </dl>
              {(source.lastError || source.verificationNotes || source.sourceNotes) && (
                <p className="intake-source-notes">{source.lastError || source.verificationNotes || source.sourceNotes}</p>
              )}
            </article>
            );
          })}
          {!visibleSources.length && <p className="empty-review">No institutions match the current filters.</p>}
        </div>
      </section>

      <section className="history-panel intake-log-panel" aria-label="Intake update log">
        <div className="review-section-head">
          <h2>Update log</h2>
          <span>{visibleLogs.length} events</span>
        </div>
        <div className="history-table-wrap">
          <table className="intake-log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Status</th>
                <th>Institution</th>
                <th>Message</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td><StatusPill status={log.status} /></td>
                  <td>{log.sourceLabel}</td>
                  <td>{log.message}</td>
                  <td className="history-json-cell">
                    <div className="history-cell-text json expanded">{log.details ? JSON.stringify(log.details) : 'n/a'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleLogs.length && <p className="empty-review">No log events match the current filters.</p>}
        </div>
      </section>
    </main>
  );
}

export function FeaturedContentAdmin() {
  const { auth, loading } = useAuth();
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [featuredHistory, setFeaturedHistory] = useState<FeaturedContent[]>([]);
  const [exhibitionQuery, setExhibitionQuery] = useState('');
  const [exhibitionError, setExhibitionError] = useState('');
  const [form, setForm] = useState<Omit<FeaturedContent, 'id' | 'publishedAt'> & { id?: string | null; publish?: boolean }>({
    status: 'draft',
    exhibitionId: null,
    title: '',
    dek: '',
    bodyMarkdown: '',
    imageUrl: '',
    ctaUrl: ''
  });
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingFrom, setEditingFrom] = useState<FeaturedContent | null>(null);
  const bodyEditorRef = useRef<HTMLTextAreaElement>(null);
  const initializedEditor = useRef(false);

  useEffect(() => {
    if (!loading && auth.signedIn && canPromote(auth)) {
      Promise.all([backend.getPublicExhibitions(), backend.getFeaturedContentHistory()])
        .then(([nextExhibitions, nextHistory]) => {
          setExhibitions(nextExhibitions);
          setFeaturedHistory(nextHistory);
          if (!initializedEditor.current) {
            const currentFeature = nextHistory.find((entry) => entry.status === 'published') ?? nextHistory[0];
            if (currentFeature) {
              setForm({
                id: null,
                status: 'draft',
                exhibitionId: currentFeature.exhibitionId,
                title: currentFeature.title,
                dek: currentFeature.dek || '',
                bodyMarkdown: currentFeature.bodyMarkdown || '',
                imageUrl: currentFeature.imageUrl || '',
                ctaUrl: currentFeature.ctaUrl || ''
              });
              setEditingFrom(currentFeature);
            }
            initializedEditor.current = true;
          }
          setExhibitionError('');
        })
        .catch((error) => setExhibitionError(error instanceof Error ? error.message : 'Could not load featured data.'));
    }
  }, [auth.signedIn, auth.role, loading]);

  const matchingExhibitions = useMemo(() => {
    const normalizedQuery = exhibitionQuery.trim().toLowerCase();
    if (!normalizedQuery) return exhibitions.slice(0, 12);
    return exhibitions
      .filter((exhibition) =>
        [exhibition.title, exhibition.venue, exhibition.dateText, exhibition.neighborhood, exhibition.borough, exhibition.id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      )
      .slice(0, 20);
  }, [exhibitionQuery, exhibitions]);

  const historyEntries = useMemo(() => {
    const counters = new Map<string, number>();
    const revisionById = new Map<string, number>();
    const identity = (entry: FeaturedContent) =>
      entry.exhibitionId || entry.ctaUrl || entry.title.trim().toLowerCase();
    const chronological = [...featuredHistory].sort((left, right) =>
      String(left.publishedAt || left.createdAt || '').localeCompare(String(right.publishedAt || right.createdAt || ''))
    );

    chronological.forEach((entry) => {
      const key = identity(entry);
      const revision = (counters.get(key) || 0) + 1;
      counters.set(key, revision);
      revisionById.set(entry.id, revision);
    });

    return featuredHistory.map((entry) => ({ entry, revision: revisionById.get(entry.id) || 1 }));
  }, [featuredHistory]);

  if (loading) return <main className="app admin-app">Loading...</main>;
  if (!auth.signedIn || !canPromote(auth)) return <AdminLogin />;

  const setField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const selectExhibition = (exhibition: Exhibition) => {
    setForm((current) => ({
      ...current,
      exhibitionId: exhibition.id,
      title: current.title || exhibition.title,
      dek: current.dek || [exhibition.venue, exhibition.dateText].filter(Boolean).join(' · '),
      imageUrl: current.imageUrl || exhibition.imageUrl || '',
      ctaUrl: current.ctaUrl || exhibition.sourceUrl || ''
    }));
  };

  const clearExhibition = () => {
    setForm((current) => ({ ...current, exhibitionId: null }));
  };

  const startNewFeature = () => {
    setForm({
      id: null,
      status: 'draft',
      exhibitionId: null,
      title: '',
      dek: '',
      bodyMarkdown: '',
      imageUrl: '',
      ctaUrl: ''
    });
    setEditingFrom(null);
    setExhibitionQuery('');
    setMessage('Started a new feature draft.');
    setSubmitError('');
  };

  const loadHistoryEntry = (entry: FeaturedContent) => {
    setForm({
      id: null,
      status: 'draft',
      exhibitionId: entry.exhibitionId,
      title: entry.title,
      dek: entry.dek || '',
      bodyMarkdown: entry.bodyMarkdown || '',
      imageUrl: entry.imageUrl || '',
      ctaUrl: entry.ctaUrl || ''
    });
    setEditingFrom(entry);
    setMessage('Editing a copy. Publishing will create a new history entry.');
    setSubmitError('');
  };

  const applyBodyMarkup = (before: string, after: string, placeholder: string) => {
    const editor = bodyEditorRef.current;
    if (!editor) return;
    const current = form.bodyMarkdown || '';
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = current.slice(start, end) || placeholder;
    const next = `${current.slice(0, start)}${before}${selected}${after}${current.slice(end)}`;
    setField('bodyMarkdown', next);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const setBodySize = (size: 'small' | 'normal' | 'large') => {
    const editor = bodyEditorRef.current;
    if (!editor) return;
    const current = form.bodyMarkdown || '';
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = current.slice(start, end) || 'text';
    const unwrapped = selected.replace(/^<(?:small|big)>([\s\S]*)<\/(?:small|big)>$/, '$1');
    const nextSelection = size === 'normal' ? unwrapped : `<${size === 'small' ? 'small' : 'big'}>${unwrapped}</${size === 'small' ? 'small' : 'big'}>`;
    const next = `${current.slice(0, start)}${nextSelection}${current.slice(end)}`;
    setField('bodyMarkdown', next);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start, start + nextSelection.length);
    });
  };

  const submit = async (publish: boolean) => {
    setMessage('');
    setSubmitError('');
    if (!form.title.trim()) {
      setSubmitError('A title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const wasModification = Boolean(editingFrom);
      const saved = await backend.saveFeaturedContent({ ...form, publish });
      setForm((current) => ({
        ...current,
        id: publish ? null : saved.id,
        status: publish ? 'draft' : saved.status
      }));
      if (publish) setEditingFrom(saved);
      setFeaturedHistory(await backend.getFeaturedContentHistory());
      setMessage(
        publish
          ? wasModification
            ? 'Feature modification published as a new history entry.'
            : 'Featured content published.'
          : 'Featured content saved as draft.'
      );
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save featured content.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="app admin-app">
      <AdminHeader auth={auth} route="featured" />
      <div className="featured-admin-workspace">
      <section className="admin-login featured-editor">
        <div className="review-section-head">
          <h2>Featured block</h2>
          <div className="feature-editor-heading-actions">
            {editingFrom && <span className="feature-revision-note">New version of {editingFrom.title}</span>}
            <button type="button" onClick={startNewFeature}>New feature</button>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(false);
          }}
        >
          <section className="featured-picker" aria-label="Choose exhibition">
            <label htmlFor="featured-exhibition-search">
              <span>Find exhibition</span>
              <input
                id="featured-exhibition-search"
                type="search"
                value={exhibitionQuery}
                onChange={(event) => setExhibitionQuery(event.target.value)}
                placeholder="search title, venue, dates"
              />
            </label>
            {form.exhibitionId && (
              <div className="selected-exhibition">
                <span>Selected ID: {form.exhibitionId}</span>
                <button type="button" onClick={clearExhibition}>Clear</button>
              </div>
            )}
            {exhibitionError && <p className="form-error">{exhibitionError}</p>}
            <div className="featured-picker-results">
              {matchingExhibitions.map((exhibition) => (
                <button
                  key={exhibition.id}
                  type="button"
                  className={exhibition.id === form.exhibitionId ? 'featured-picker-row selected' : 'featured-picker-row'}
                  onClick={() => selectExhibition(exhibition)}
                >
                  <strong>{exhibition.title}</strong>
                  <span>{exhibition.venue}</span>
                  <small>{exhibition.dateText || exhibition.id}</small>
                </button>
              ))}
              {!matchingExhibitions.length && <p className="empty-review">No exhibitions match that search.</p>}
            </div>
          </section>
          <label htmlFor="featured-title">
            <span>Title</span>
            <input id="featured-title" type="text" value={form.title} onChange={(event) => setField('title', event.target.value)} required />
          </label>
          <label htmlFor="featured-subtitle">
            <span>Subtitle</span>
            <input id="featured-subtitle" type="text" value={form.dek || ''} onChange={(event) => setField('dek', event.target.value)} />
          </label>
          <div className="feature-body-field">
            <label htmlFor="featured-body">Body markdown</label>
            <div className="feature-format-toolbar" role="toolbar" aria-label="Body formatting">
              <button type="button" className="format-bold" title="Bold" aria-label="Bold" onClick={() => applyBodyMarkup('**', '**', 'bold text')}>B</button>
              <button type="button" className="format-italic" title="Italic" aria-label="Italic" onClick={() => applyBodyMarkup('*', '*', 'italic text')}>I</button>
              <button type="button" className="format-underline" title="Underline" aria-label="Underline" onClick={() => applyBodyMarkup('<u>', '</u>', 'underlined text')}>U</button>
              <span className="format-divider" aria-hidden="true" />
              <button type="button" className="format-small" title="Small text" aria-label="Small text" onClick={() => setBodySize('small')}>A</button>
              <button type="button" title="Normal text" aria-label="Normal text" onClick={() => setBodySize('normal')}>A</button>
              <button type="button" className="format-large" title="Large text" aria-label="Large text" onClick={() => setBodySize('large')}>A</button>
            </div>
            <textarea
              id="featured-body"
              ref={bodyEditorRef}
              value={form.bodyMarkdown || ''}
              onChange={(event) => setField('bodyMarkdown', event.target.value)}
            />
          </div>
          {form.bodyMarkdown && (
            <section className="feature-body-preview" aria-label="Body preview">
              <strong>Preview</strong>
              <FeatureRichText value={form.bodyMarkdown} />
            </section>
          )}
          <label htmlFor="featured-image-url">
            <span>Image URL</span>
            <input id="featured-image-url" type="url" value={form.imageUrl || ''} onChange={(event) => setField('imageUrl', event.target.value)} />
          </label>
          <label htmlFor="featured-cta-url">
            <span>CTA URL</span>
            <input id="featured-cta-url" type="url" value={form.ctaUrl || ''} onChange={(event) => setField('ctaUrl', event.target.value)} />
          </label>
          <div className="decision-buttons">
            <button type="submit" disabled={submitting}>{submitting ? 'Working...' : 'Save draft'}</button>
            <button type="button" onClick={() => submit(true)} disabled={submitting}>Publish</button>
          </div>
        </form>
        {submitError && <p className="form-error">{submitError}</p>}
        {message && <p className="decision-saved">{message}</p>}
      </section>
      <section className="featured-history-admin" aria-label="Feature history">
        <h2>Feature history</h2>
        <div className="featured-history-list-admin">
          {historyEntries.map(({ entry, revision }) => (
            <button
              key={entry.id}
              type="button"
              className={editingFrom?.id === entry.id ? 'featured-history-entry selected' : 'featured-history-entry'}
              onClick={() => loadHistoryEntry(entry)}
            >
              <span className="feature-history-meta">
                <strong>{revision === 1 ? 'Original' : `Modification ${revision - 1}`}</strong>
                <span>{entry.status}</span>
              </span>
              <b>{entry.title}</b>
              {entry.dek && <span>{entry.dek}</span>}
              <small>{entry.publishedAt ? new Date(entry.publishedAt).toLocaleString() : 'Not published'}</small>
            </button>
          ))}
          {!featuredHistory.length && <p className="empty-review">No published or archived feature blocks yet.</p>}
        </div>
      </section>
      </div>
    </main>
  );
}
