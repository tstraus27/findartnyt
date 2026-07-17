import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  backend,
  type AuthState,
  type FeaturedContent,
  type StagingQueueSource
} from '../lib/backend/findArtBackend';
import type { Exhibition } from '../lib/exhibitions';
import { formatStagedDates, itemUrl, normalizeReviewStatus, type StagedItem, type StagedProposal } from '../lib/stagingReview';

type AdminRoute = 'dashboard' | 'review' | 'featured' | 'history';
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
        <h1>{route === 'featured' ? 'Featured content' : route === 'dashboard' ? 'Admin dashboard' : route === 'history' ? 'Review history' : 'Data review'}</h1>
        <p>
          {auth.displayName || auth.email || 'Local development'} {auth.role ? `(${auth.role})` : ''}
        </p>
      </div>
      <nav className="admin-nav" aria-label="Admin navigation">
        <a href="/">Public site</a>
        <button type="button" onClick={() => go('/admin')}>Dashboard</button>
        <button type="button" onClick={() => go('/admin/review')}>Review</button>
        {canPromote(auth) && <button type="button" onClick={() => go('/admin/history')}>History</button>}
        {canPromote(auth) && <button type="button" onClick={() => go('/admin/featured')}>Featured</button>}
        {backend.configured && <button type="button" onClick={signOut}>Sign out</button>}
      </nav>
    </header>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${status}`}>{status.replace(/_/g, ' ')}</span>;
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="review-field">
      <dt>{label}</dt>
      <dd>{value || 'n/a'}</dd>
    </div>
  );
}

const proposalFields: Array<{ key: keyof StagedProposal; label: string; multiline?: boolean }> = [
  { key: 'title', label: 'Title' },
  { key: 'venue', label: 'Venue' },
  { key: 'startDate', label: 'Start date' },
  { key: 'endDate', label: 'End date' },
  { key: 'dateText', label: 'Date text' },
  { key: 'venueAddress', label: 'Address' },
  { key: 'neighborhood', label: 'Neighborhood' },
  { key: 'borough', label: 'Borough' },
  { key: 'city', label: 'City' },
  { key: 'imageUrl', label: 'Image URL' },
  { key: 'sourceUrl', label: 'Source URL' },
  { key: 'exhibitionUrl', label: 'Exhibition URL' },
  { key: 'description', label: 'Description', multiline: true }
];

function ProposalEditor({
  item,
  canEdit,
  onSave
}: {
  item: StagedItem;
  canEdit: boolean;
  onSave: (proposed: StagedProposal) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StagedProposal>(item.proposed ?? {});
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDraft(item.proposed ?? {});
    setEditing(false);
    setMessage('');
  }, [item.id]);

  const setField = (key: keyof StagedProposal, value: string) => {
    setDraft((current) => ({ ...current, [key]: value || null }));
  };

  const save = async () => {
    await onSave(draft);
    setEditing(false);
    setMessage('Manual edits saved.');
  };

  if (!editing) {
    return (
      <>
        <dl className="review-fields">
          <FieldRow label="Venue" value={item.proposed?.venue} />
          <FieldRow label="Dates" value={formatStagedDates(item.proposed ?? {})} />
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
            <input value={String(draft[field.key] ?? '')} onChange={(event) => setField(field.key, event.target.value)} />
          )}
        </label>
      ))}
      <button type="button" onClick={save}>Save staged data edits</button>
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

  return (
    <main className="app admin-app">
      <AdminHeader auth={auth} route="history" />
      {error && <p className="form-error">{error}</p>}
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

  useEffect(() => {
    if (!loading && auth.signedIn && canPromote(auth)) {
      Promise.all([backend.getPublicExhibitions(), backend.getFeaturedContentHistory()])
        .then(([nextExhibitions, nextHistory]) => {
          setExhibitions(nextExhibitions);
          setFeaturedHistory(nextHistory);
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

  const submit = async (event: FormEvent, publish: boolean) => {
    event.preventDefault();
    await backend.saveFeaturedContent({ ...form, publish });
    setFeaturedHistory(await backend.getFeaturedContentHistory());
    setMessage(publish ? 'Featured content published.' : 'Featured content saved as draft.');
  };

  return (
    <main className="app admin-app">
      <AdminHeader auth={auth} route="featured" />
      <section className="admin-login featured-editor">
        <h2>Featured block</h2>
        <form onSubmit={(event) => submit(event, false)}>
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
          <label>
            <span>Title</span>
            <input value={form.title} onChange={(event) => setField('title', event.target.value)} required />
          </label>
          <label>
            <span>Subtitle</span>
            <input value={form.dek || ''} onChange={(event) => setField('dek', event.target.value)} />
          </label>
          <label>
            <span>Body markdown</span>
            <textarea value={form.bodyMarkdown || ''} onChange={(event) => setField('bodyMarkdown', event.target.value)} />
          </label>
          <label>
            <span>Image URL</span>
            <input value={form.imageUrl || ''} onChange={(event) => setField('imageUrl', event.target.value)} />
          </label>
          <label>
            <span>CTA URL</span>
            <input value={form.ctaUrl || ''} onChange={(event) => setField('ctaUrl', event.target.value)} />
          </label>
          <div className="decision-buttons">
            <button type="submit">Save draft</button>
            <button type="button" onClick={(event) => submit(event as unknown as FormEvent, true)}>Publish</button>
          </div>
        </form>
        {message && <p className="decision-saved">{message}</p>}
      </section>
      <section className="featured-history-admin" aria-label="Feature history">
        <h2>Feature history</h2>
        <div className="history-table-wrap">
          <table className="featured-admin-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Published</th>
                <th>Title</th>
                <th>Subtitle</th>
                <th>Exhibition ID</th>
                <th>CTA</th>
              </tr>
            </thead>
            <tbody>
              {featuredHistory.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.status}</td>
                  <td>{entry.publishedAt ? new Date(entry.publishedAt).toLocaleString() : 'n/a'}</td>
                  <td>{entry.title}</td>
                  <td>{entry.dek || 'n/a'}</td>
                  <td>{entry.exhibitionId || 'n/a'}</td>
                  <td>{entry.ctaUrl ? <a href={entry.ctaUrl} target="_blank" rel="noreferrer">source</a> : 'n/a'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!featuredHistory.length && <p className="empty-review">No published or archived feature blocks yet.</p>}
        </div>
      </section>
    </main>
  );
}
