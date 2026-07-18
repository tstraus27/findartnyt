import {
  exhibitions as localExhibitions,
  formatDateRange,
  formatListDateRange,
  normalizeExhibitionRecords,
  type Exhibition
} from '../exhibitions';
import {
  countStatuses,
  formatStagedDates,
  itemUrl,
  normalizeReviewStatus,
  reviewSources,
  type ReviewDecision,
  type ReviewStatus,
  type StagedItem
} from '../stagingReview';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export type AppRole = 'visitor' | 'reviewer' | 'admin' | 'owner';
export type ReviewDecisionType = 'looks_good' | 'reject' | 'needs_revision' | 'comment';
export type StagingStatus =
  | 'pending'
  | 'reviewer_approved'
  | 'rejected'
  | 'needs_revision'
  | 'admin_approved'
  | 'promoted';

export type AuthState = {
  configured: boolean;
  signedIn: boolean;
  role: AppRole | null;
  displayName: string | null;
  email: string | null;
};

export type FeaturedContent = {
  id: string;
  status: 'draft' | 'published' | 'archived';
  exhibitionId: string | null;
  title: string;
  dek: string | null;
  bodyMarkdown: string | null;
  imageUrl: string | null;
  ctaUrl: string | null;
  publishedAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type StagingQueueSource = {
  id: string;
  label: string;
  counts: Partial<Record<ReviewStatus | StagingStatus, number>>;
  items: StagedItem[];
};

const localDecisionStorageKey = 'find-art-nyc-review-decisions';
const localProposalStorageKey = 'find-art-nyc-proposal-edits';
const sourcePreviewBaseUrl = import.meta.env.VITE_SOURCE_PREVIEW_URL || '';

const toCamelExhibition = (row: Record<string, unknown>): Exhibition | null => {
  const id = String(row.id || '');
  const title = String(row.title || '');
  const venue = String(row.venue_name || row.venue || '');
  const sourceUrl = String(row.source_url || row.sourceUrl || '');
  if (!id || !title || !venue || !sourceUrl) return null;

  const neighborhood = stringOrNull(row.neighborhood);
  const borough = stringOrNull(row.borough);
  const city = stringOrNull(row.city);
  const description = stringOrNull(row.description);
  const venueAddress = stringOrNull(row.venue_address);
  const startDate = stringOrNull(row.start_date);
  const endDate = stringOrNull(row.end_date);
  const dateText = formatDateRange({ startDate, endDate, dateText: stringOrNull(row.date_text) });
  const listDateText = formatListDateRange({ startDate, endDate, dateText });
  const source = stringOrNull(row.source) || venue;
  const searchText = [title, venue, source, neighborhood, borough, city, description, venueAddress, dateText]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    id,
    title,
    venue,
    source,
    startDate,
    endDate,
    dateText,
    listDateText,
    description,
    venueAddress,
    neighborhood,
    borough,
    city,
    area: neighborhood ?? borough,
    imageUrl: stringOrNull(row.image_url),
    sourceUrl,
    searchText
  };
};

const stringOrNull = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

const featuredContentFromRow = (row: Record<string, unknown>): FeaturedContent => ({
  id: String(row.id),
  status: row.status as FeaturedContent['status'],
  exhibitionId: stringOrNull(row.exhibition_id),
  title: String(row.title || ''),
  dek: stringOrNull(row.dek),
  bodyMarkdown: stringOrNull(row.body_markdown),
  imageUrl: stringOrNull(row.image_url),
  ctaUrl: stringOrNull(row.cta_url),
  publishedAt: stringOrNull(row.published_at),
  createdAt: stringOrNull(row.created_at),
  updatedAt: stringOrNull(row.updated_at)
});

const readLocalDecisions = (): Record<string, ReviewDecision> => {
  try {
    return JSON.parse(localStorage.getItem(localDecisionStorageKey) || '{}');
  } catch {
    return {};
  }
};

const writeLocalDecision = (itemId: string, status: ReviewStatus, notes: string) => {
  const decisions = readLocalDecisions();
  decisions[itemId] = { status, notes, decidedAt: new Date().toISOString() };
  localStorage.setItem(localDecisionStorageKey, JSON.stringify(decisions));
};

const readLocalProposalEdits = (): Record<string, StagedItem['proposed']> => {
  try {
    return JSON.parse(localStorage.getItem(localProposalStorageKey) || '{}');
  } catch {
    return {};
  }
};

const writeLocalProposalEdit = (itemId: string, proposed: StagedItem['proposed']) => {
  const edits = readLocalProposalEdits();
  edits[itemId] = proposed;
  localStorage.setItem(localProposalStorageKey, JSON.stringify(edits));
};

const dbDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const sanitizePromotionProposal = (proposed: StagedItem['proposed']) => {
  if (!proposed) return { proposed, changed: false };

  let changed = false;
  const next = { ...proposed };

  (['startDate', 'endDate'] as const).forEach((field) => {
    const value = next[field];
    if (typeof value === 'string' && value && !dbDatePattern.test(value)) {
      next[field] = null;
      changed = true;
    }
  });

  return { proposed: next, changed };
};

const exhibitionUpdateFromProposal = (proposed: StagedItem['proposed']) => ({
  title: proposed?.title,
  venue_name: proposed?.venue,
  start_date: proposed?.startDate || null,
  end_date: proposed?.endDate || null,
  date_text: proposed?.dateText || null,
  description: proposed?.description || null,
  image_url: proposed?.imageUrl || null,
  source_url: proposed?.sourceUrl,
  exhibition_url: proposed?.exhibitionUrl || null,
  raw: proposed ?? {}
});

const localSources = (): StagingQueueSource[] => {
  const decisions = readLocalDecisions();
  const proposalEdits = readLocalProposalEdits();
  return reviewSources.map((source) => ({
    id: source.id,
    label: source.label,
    counts: countStatuses(source.report.items ?? [], decisions),
    items: (source.report.items ?? []).map((item) => ({
      ...item,
      reviewStatus: decisions[item.id]?.status ?? item.reviewStatus,
      proposed: proposalEdits[item.id] ?? item.proposed
    }))
  }));
};

const dbItemToStagedItem = (row: Record<string, unknown>): StagedItem => ({
  id: String(row.id),
  proposalType: stringOrNull(row.proposal_type),
  reviewStatus: normalizeReviewStatus(String(row.review_status || 'pending')),
  source: (row.source as StagedItem['source']) ?? null,
  canonicalId: stringOrNull(row.canonical_id),
  proposed: (row.proposed as StagedItem['proposed']) ?? {},
  changedFields: Array.isArray(row.changed_fields) ? (row.changed_fields as string[]) : [],
  dedupe: (row.dedupe as StagedItem['dedupe']) ?? null,
  conflict: row.conflict,
  reviewerNotes: null
});

export const backend = {
  configured: isSupabaseConfigured,

  async getAuthState(): Promise<AuthState> {
    if (!supabase) {
      return {
        configured: false,
        signedIn: true,
        role: 'admin',
        displayName: 'Local development admin',
        email: null
      };
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      return { configured: true, signedIn: false, role: null, displayName: null, email: null };
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('display_name, role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;

    return {
      configured: true,
      signedIn: true,
      role: (profile?.role as AppRole | undefined) ?? 'visitor',
      displayName: profile?.display_name ?? user.email ?? null,
      email: user.email ?? null
    };
  },

  async signIn(email: string, password: string) {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  async getPublicExhibitions(): Promise<Exhibition[]> {
    if (!supabase) return localExhibitions;

    const { data, error } = await supabase
      .from('exhibitions')
      .select('*')
      .eq('publication_status', 'published')
      .order('end_date', { ascending: true, nullsFirst: false });
    if (error) {
      console.warn('Falling back to local exhibition JSON after Supabase read failed.', error.message);
      return localExhibitions;
    }

    const backendRecords = (data ?? []).map((row) => toCamelExhibition(row)).filter((record): record is Exhibition => Boolean(record));
    const recordsById = new Map(localExhibitions.map((record) => [record.id, record]));
    backendRecords.forEach((record) => recordsById.set(record.id, record));
    return Array.from(recordsById.values());
  },

  async getPublishedFeaturedContent(): Promise<FeaturedContent | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('featured_content')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return featuredContentFromRow(data);
  },

  async getFeaturedContentHistory(): Promise<FeaturedContent[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('featured_content')
      .select('*')
      .in('status', ['published', 'archived'])
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => featuredContentFromRow(row));
  },

  async getStagingQueues(): Promise<StagingQueueSource[]> {
    if (!supabase) return localSources();

    const { data, error } = await supabase
      .from('staging_items')
      .select('*')
      .eq('proposed->>type', 'exhibition')
      .order('source_id')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const grouped = new Map<string, StagedItem[]>();
    for (const row of data ?? []) {
      const item = dbItemToStagedItem(row);
      const sourceId = String(row.source_id || 'unknown-source');
      grouped.set(sourceId, [...(grouped.get(sourceId) ?? []), item]);
    }

    return Array.from(grouped.entries()).map(([id, items]) => ({
      id,
      label: id.replace(/-exhibitions$/, '').replace(/-/g, ' '),
      counts: countStatuses(items),
      items
    }));
  },

  async submitReviewDecision(itemId: string, decision: ReviewDecisionType, notes: string) {
    if (!supabase) {
      const status = decision === 'looks_good' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_revision';
      writeLocalDecision(itemId, status, notes);
      return;
    }
    const { error } = await supabase.rpc('submit_review_decision', {
      staging_item_id: itemId,
      decision,
      notes
    });
    if (error) throw error;
  },

  async promoteStagingItem(itemOrId: StagedItem | string, notes: string) {
    const itemId = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;

    if (!supabase) {
      writeLocalDecision(itemId, 'promoted', notes);
      return;
    }

    if (typeof itemOrId !== 'string') {
      const sanitized = sanitizePromotionProposal(itemOrId.proposed);
      if (sanitized.changed) {
        await this.updateStagingProposal(
          itemId,
          sanitized.proposed,
          'Normalized staged date fields before admin promotion.'
        );
      }
    }

    const { error } = await supabase.rpc('admin_promote_staging_item', {
      staging_item_id: itemId,
      notes
    });
    if (error) throw error;
  },

  async updateStagingStatus(itemId: string, nextStatus: StagingStatus, notes: string) {
    if (!supabase) {
      const localStatus = nextStatus === 'rejected' ? 'rejected' : nextStatus === 'needs_revision' ? 'needs_revision' : 'approved';
      writeLocalDecision(itemId, localStatus, notes);
      return;
    }
    const { error } = await supabase.rpc('admin_update_staging_status', {
      staging_item_id: itemId,
      next_status: nextStatus,
      notes
    });
    if (error) throw error;
  },

  async updateStagingProposal(itemId: string, proposed: StagedItem['proposed'], notes: string) {
    if (!supabase) {
      writeLocalProposalEdit(itemId, proposed);
      return;
    }
    const { error } = await supabase.rpc('admin_update_staging_proposed', {
      staging_item_id: itemId,
      proposed,
      notes
    });
    if (!error) return;

    // Older deployments may not expose the editing RPC yet. Admin RLS still
    // provides a safe path to save the proposal instead of leaving the UI inert.
    const { data: current, error: readError } = await supabase
      .from('staging_items')
      .select('review_status')
      .eq('id', itemId)
      .single();
    if (readError) throw new Error(`Could not save staged edits: ${readError.message}`);

    const { error: updateError } = await supabase
      .from('staging_items')
      .update({
        proposed,
        review_status: current.review_status === 'promoted' ? 'promoted' : 'needs_revision'
      })
      .eq('id', itemId);
    if (updateError) throw new Error(`Could not save staged edits: ${updateError.message}`);
  },

  async updatePromotedStagingProposal(item: StagedItem, proposed: StagedItem['proposed'], notes: string) {
    const exhibitionId = item.canonicalId || proposed?.id || item.proposed?.id;
    if (!exhibitionId) throw new Error('This history row has no published exhibition ID to update.');

    await this.updateStagingProposal(item.id, proposed, notes);
    if (!supabase) return;

    const sanitized = sanitizePromotionProposal(proposed).proposed;
    const { data, error } = await supabase
      .from('exhibitions')
      .update(exhibitionUpdateFromProposal(sanitized))
      .eq('id', exhibitionId)
      .eq('promoted_from_staging_item_id', item.id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Staged edits saved, but the published record could not be updated: ${error.message}`);
    if (!data) throw new Error('Staged edits saved, but the matching published record was not found.');
  },

  async undoStagingPromotion(item: StagedItem, notes: string) {
    if (!supabase) {
      writeLocalDecision(item.id, 'needs_revision', notes);
      return;
    }

    const exhibitionId = item.canonicalId || item.proposed?.id;
    if (!exhibitionId) throw new Error('This history row has no published exhibition ID to remove.');

    const { data: archived, error: archiveError } = await supabase
      .from('exhibitions')
      .update({ publication_status: 'archived', review_status: 'needs_revision' })
      .eq('id', exhibitionId)
      .eq('promoted_from_staging_item_id', item.id)
      .select('id')
      .maybeSingle();
    if (archiveError) throw new Error(`Could not remove the exhibition from the public catalog: ${archiveError.message}`);
    if (!archived) throw new Error('The matching published exhibition was not found, so nothing was changed.');

    const { error: stagingError } = await supabase
      .from('staging_items')
      .update({ review_status: 'needs_revision' })
      .eq('id', item.id);
    if (stagingError) {
      await supabase.from('exhibitions').update({ publication_status: 'published', review_status: 'approved' }).eq('id', exhibitionId);
      throw new Error(`Could not return the item to review: ${stagingError.message}`);
    }
  },

  async saveFeaturedContent(input: Omit<FeaturedContent, 'id' | 'publishedAt'> & { id?: string | null; publish?: boolean }) {
    if (!supabase) throw new Error('Featured content publishing requires Supabase to be configured.');
    const auth = await this.getAuthState();
    if (auth.role !== 'admin' && auth.role !== 'owner') throw new Error('Only admins can save featured content.');

    let exhibitionId: string | null = null;
    if (input.exhibitionId) {
      const { data: exhibition, error: exhibitionError } = await supabase
        .from('exhibitions')
        .select('id')
        .eq('id', input.exhibitionId)
        .maybeSingle();
      if (exhibitionError) throw exhibitionError;
      exhibitionId = exhibition?.id ?? null;
    }

    let editableDraftId: string | null = null;
    if (input.id) {
      const { data: existing, error: existingError } = await supabase
        .from('featured_content')
        .select('id, status')
        .eq('id', input.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing?.status === 'draft') editableDraftId = existing.id;
    }

    const payload = {
      ...(editableDraftId ? { id: editableDraftId } : {}),
      status: 'draft' as const,
      exhibition_id: exhibitionId,
      title: input.title,
      dek: input.dek || null,
      body_markdown: input.bodyMarkdown || null,
      image_url: input.imageUrl || null,
      cta_url: input.ctaUrl || null
    };
    const { data, error } = await supabase.from('featured_content').upsert(payload).select('*').single();
    if (error) throw error;
    let saved = data;
    if (input.publish) {
      const { data: published, error: publishError } = await supabase.rpc('admin_publish_featured_content', {
        content_id: data.id,
        notes: 'Published from admin featured content screen.'
      });
      if (publishError) throw publishError;
      if (published) saved = published;
    }
    return featuredContentFromRow(saved);
  },

  stagingItemSummary(item: StagedItem) {
    return {
      title: item.proposed?.title || item.id,
      venue: item.proposed?.venue || 'Unknown venue',
      dates: formatStagedDates(item.proposed ?? {}),
      url: itemUrl(item)
    };
  },

  sourcePreviewUrl(sourceUrl: string) {
    if (!sourceUrl) return '';
    if (!sourcePreviewBaseUrl) return sourceUrl;
    const preview = new URL(sourcePreviewBaseUrl);
    preview.searchParams.set('url', sourceUrl);
    return preview.toString();
  },

  normalizeExhibitions(records: unknown[]) {
    return normalizeExhibitionRecords(records as Parameters<typeof normalizeExhibitionRecords>[0]);
  }
};
