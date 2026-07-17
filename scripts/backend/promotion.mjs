export const canRoleReview = (role) => ['reviewer', 'admin', 'owner'].includes(role);
export const canRolePromote = (role) => ['admin', 'owner'].includes(role);

export const assertCanReview = (role) => {
  if (!canRoleReview(role)) throw new Error('Only reviewers and admins can review staging items.');
};

export const assertCanPromote = (role) => {
  if (!canRolePromote(role)) throw new Error('Only admins can promote staging items.');
};

export const stagedItemToExhibitionRow = (item) => {
  const proposed = item.proposed || {};
  const id = proposed.id;
  const title = proposed.title;
  const venueName = proposed.venue;
  const sourceUrl = proposed.sourceUrl || proposed.exhibitionUrl || item.source?.url;

  if (!id || !title || !venueName || !sourceUrl) {
    throw new Error('Staging item is missing id, title, venue, or source URL.');
  }

  return {
    id,
    title,
    venue_name: venueName,
    start_date: proposed.startDate || null,
    end_date: proposed.endDate || null,
    date_text: proposed.dateText || null,
    description: proposed.description || null,
    image_url: proposed.imageUrl || null,
    source_url: sourceUrl,
    exhibition_url: proposed.exhibitionUrl || sourceUrl,
    source: proposed.source || null,
    review_status: 'approved',
    publication_status: 'published',
    promoted_from_staging_item_id: item.id,
    raw: proposed
  };
};
