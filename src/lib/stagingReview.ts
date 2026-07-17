import bronxMuseum from '../../data/staging/bronx-museum-exhibitions.json';
import brooklynMuseum from '../../data/staging/brooklyn-museum-exhibitions.json';
import cooperHewitt from '../../data/staging/cooper-hewitt-exhibitions.json';
import davidZwirner from '../../data/staging/david-zwirner-exhibitions.json';
import drawingCenter from '../../data/staging/drawing-center-exhibitions.json';
import fit from '../../data/staging/fit-exhibitions.json';
import frick from '../../data/staging/frick-exhibitions.json';
import guggenheim from '../../data/staging/guggenheim-exhibitions.json';
import icp from '../../data/staging/icp-exhibitions.json';
import jewishMuseum from '../../data/staging/jewish-museum-exhibitions.json';
import mad from '../../data/staging/mad-exhibitions.json';
import mcny from '../../data/staging/mcny-exhibitions.json';
import met from '../../data/staging/met-exhibitions.json';
import moma from '../../data/staging/moma-exhibitions.json';
import morgan from '../../data/staging/morgan-exhibitions.json';
import newMuseum from '../../data/staging/new-museum-exhibitions.json';
import noguchi from '../../data/staging/noguchi-exhibitions.json';
import posterHouse from '../../data/staging/poster-house-exhibitions.json';
import whitney from '../../data/staging/whitney-exhibitions.json';

export type ReviewStatus =
  | 'pending'
  | 'approved'
  | 'reviewer_approved'
  | 'rejected'
  | 'needs_revision'
  | 'admin_approved'
  | 'promoted';

export type StagedProposal = {
  id?: string | null;
  title?: string | null;
  venue?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dateText?: string | null;
  description?: string | null;
  venueAddress?: string | null;
  neighborhood?: string | null;
  borough?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  exhibitionUrl?: string | null;
  sourceUrl?: string | null;
  tags?: string[] | null;
  sourceConfidence?: string | null;
};

export type StagedItem = {
  id: string;
  proposalType?: string | null;
  reviewStatus: ReviewStatus;
  source?: {
    url?: string | null;
    sourceType?: string | null;
    reliability?: string | null;
    notes?: string | null;
  } | null;
  canonicalId?: string | null;
  proposed?: StagedProposal | null;
  changedFields?: string[] | null;
  dedupe?: {
    status?: string | null;
    confidence?: number | null;
    matchedRecordIds?: string[] | null;
    notes?: string | null;
  } | null;
  conflict?: unknown;
  reviewerNotes?: string | null;
};

export type StagingReport = {
  summary?: {
    sourceId?: string | null;
    source?: string | null;
    parser?: string | null;
    generatedAt?: string | null;
    stagingNotes?: string | null;
    verification?: {
      status?: string | null;
      verifiedAt?: string | null;
      notes?: string | null;
    } | null;
  } | null;
  items?: StagedItem[];
};

export type ReviewDecision = {
  status: ReviewStatus;
  notes: string;
  decidedAt: string;
};

export type ReviewSource = {
  id: string;
  label: string;
  report: StagingReport;
};

const reports = [
  bronxMuseum,
  brooklynMuseum,
  cooperHewitt,
  davidZwirner,
  drawingCenter,
  fit,
  frick,
  guggenheim,
  icp,
  jewishMuseum,
  mad,
  mcny,
  met,
  moma,
  morgan,
  newMuseum,
  noguchi,
  posterHouse,
  whitney
] as unknown as StagingReport[];

const reviewStatusValues = new Set<ReviewStatus>([
  'pending',
  'approved',
  'reviewer_approved',
  'rejected',
  'needs_revision',
  'admin_approved',
  'promoted'
]);

export const normalizeReviewStatus = (status: string | null | undefined): ReviewStatus =>
  status && reviewStatusValues.has(status as ReviewStatus) ? (status as ReviewStatus) : 'pending';

const sourceId = (report: StagingReport) =>
  report.summary?.sourceId || report.summary?.source || report.summary?.parser || 'unknown-source';

const titleCase = (value: string) =>
  value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const reviewSources: ReviewSource[] = reports
  .map((report) => {
    const id = sourceId(report);
    return {
      id,
      label: titleCase(report.summary?.source || id.replace(/-exhibitions$/, '')),
      report
    };
  })
  .sort((left, right) => left.label.localeCompare(right.label));

export const decisionStorageKey = 'find-art-nyc-review-decisions';

export const countStatuses = (items: StagedItem[], decisions: Record<string, ReviewDecision> = {}) =>
  items.reduce<Record<ReviewStatus, number>>(
    (counts, item) => {
      const status = decisions[item.id]?.status ?? normalizeReviewStatus(item.reviewStatus);
      counts[status] += 1;
      return counts;
    },
    { pending: 0, approved: 0, reviewer_approved: 0, rejected: 0, needs_revision: 0, admin_approved: 0, promoted: 0 }
  );

export const itemUrl = (item: StagedItem) =>
  item.proposed?.sourceUrl || item.proposed?.exhibitionUrl || item.source?.url || '';

export const formatStagedDates = (proposal: StagedProposal = {}) => {
  if (proposal.dateText) return proposal.dateText;
  if (proposal.startDate && proposal.endDate) return `${proposal.startDate} to ${proposal.endDate}`;
  if (proposal.startDate) return `Starts ${proposal.startDate}`;
  if (proposal.endDate) return `Ends ${proposal.endDate}`;
  return 'Dates need review';
};
