import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFitExhibitionsPage } from './fit-exhibitions.mjs';

const html = `
  <section class="section excard-long current">
    <div class="excard-long__wrapper">
      <div class="excard-long__left">
        <div class="excard-long__details">
          <span class="label">Current</span>
          <span class="location"> All Galleries</span>
          <span class="date">May 25 –&nbsp;September 15, 2026</span>
          <h2>Galleries Closed</h2>
        </div>
      </div>
      <div class="excard-long__right">
        <div class="excard-long__img">
          <img src="/museum/images/galleries-closed-mfit-dolls-ig.jpg" alt="">
        </div>
      </div>
      <div class="excard-long__description">
        The Museum Galleries are closed until <em>Doll Dressing</em> opens on September 16, 2026.
      </div>
    </div>
  </section>
  <section class="section excard-long current">
    <div class="excard-long__wrapper">
      <div class="excard-long__left">
        <div class="excard-long__details">
          <span class="label">Current</span>
          <span class="location"> Museum Lobby</span>
          <span class="date">June 12 – July 12, 2026</span>
          <h2>Pick Up the Pieces</h2>
        </div>
      </div>
      <div class="excard-long__right">
        <div class="excard-long__img">
          <img src="/museum/images/illustration-mfa-2026-mfit.jpg" alt="">
        </div>
      </div>
      <div class="excard-long__description">
        <span>The 2026 MFA Illustration Visual Thesis Exhibition,&nbsp;</span><i>Pick Up the Pieces</i><span>, represents the culmination of three years of graduate study.</span>
      </div>
    </div>
  </section>
  <section class="section excard-long upcoming">
    <div class="excard-long__wrapper">
      <div class="excard-long__left">
        <div class="excard-long__details">
          <span class="label">Upcoming</span>
          <span class="location"> Special Exhibitions Gallery</span>
          <span class="date">September 16, 2026 –&nbsp;January 3, 2027</span>
          <h2>Doll Dressing</h2>
          <a href="/museum/exhibitions/doll-dressing/index.php" class="cta cta--button cta--museum">Learn more on Doll Dressing Exhibition Page</a>
        </div>
      </div>
      <div class="excard-long__right">
        <div class="excard-long__img">
          <img src="/museum/images/dolls-dressing-mfit-moschino.jpg" alt="">
        </div>
      </div>
      <div class="excard-long__description">
        <em>Doll Dressing</em> centers on the longstanding connections between dolls and high fashion.
      </div>
    </div>
  </section>
  <section class="section ontheroad">
    <div class="ontheroad__wrapper"></div>
  </section>
`;

test('parseFitExhibitionsPage keeps linked exhibition cards only', () => {
  const records = parseFitExhibitionsPage({
    html,
    url: 'https://www.fitnyc.edu/museum/exhibitions/index.php'
  });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    id: 'exhibition:fit:doll-dressing',
    type: 'exhibition',
    source: 'fit',
    title: 'Doll Dressing',
    venue: 'The Museum at FIT',
    startDate: '2026-09-16',
    endDate: '2027-01-03',
    dateText: 'September 16, 2026 – January 3, 2027',
    description: 'Doll Dressing centers on the longstanding connections between dolls and high fashion.',
    artists: [],
    curators: [],
    venueAddress: '227 West 27th Street, New York, NY 10001-5992',
    neighborhood: 'Chelsea',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://www.fitnyc.edu/museum/images/dolls-dressing-mfit-moschino.jpg',
    exhibitionUrl: 'https://www.fitnyc.edu/museum/exhibitions/doll-dressing/index.php',
    sourceUrl: 'https://www.fitnyc.edu/museum/exhibitions/doll-dressing/index.php',
    openingReceptionDate: null,
    tags: ['upcoming'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Museum at FIT official current and upcoming long-card sections, but only for cards that expose an official exhibition detail link. Closure notices, lobby-only cards without official exhibition pages, past exhibitions, MFIT on the Road, and any detail-page enrichment remain out of scope for this first staging-only slice.'
  });
});

test('parseFitExhibitionsPage de-duplicates repeated sections', () => {
  const records = parseFitExhibitionsPage({
    html: `${html}${html}`,
    url: 'https://www.fitnyc.edu/museum/exhibitions/index.php'
  });

  assert.equal(records.length, 1);
});
