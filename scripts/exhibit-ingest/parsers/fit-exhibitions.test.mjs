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
          <span class="label">Upcoming</span>
          <span class="location"> Museum Lobby</span>
          <span class="date">July 22 – TBD, 2026</span>
          <h2>IHG Hotels &amp; Resorts + Fashion Institute of Technology Tennis Ball Dress Contest 2026</h2>
        </div>
      </div>
      <div class="excard-long__right">
        <div class="excard-long__img">
          <img src="/museum/images/mfit-ihg-tennis-2026.jpg" alt="">
        </div>
      </div>
      <div class="excard-long__description">
        The Museum at FIT presents the winning designs from its tennis ball dress contest.
      </div>
    </div>
  </section>
  <section class="section excard-long upcoming">
    <div class="excard-long__wrapper">
      <div class="excard-long__left"><div class="excard-long__details">
        <span class="label">Upcoming</span>
        <span class="date">February 17 – April 18, 2027</span>
        <h2>Fashioning Desire: Willy Chavarria and Barbara Sanchez-Kane</h2>
      </div></div>
      <div class="excard-long__right"><div class="excard-long__img">
        <img src="/museum/images/fashioning-desire-mfit-listing-image.jpeg" alt="">
      </div></div>
      <div class="excard-long__description">An exhibition exploring fashion and desire.</div>
    </div>
  </section>
  <section class="section excard-long upcoming">
    <div class="excard-long__wrapper">
      <div class="excard-long__left"><div class="excard-long__details">
        <span class="label">Proximamente</span>
        <span class="date">17 de febrero – 18 de abril, 2027</span>
        <h2>Fashioning Desire: Willy Chavarria y Barbara Sanchez-Kane</h2>
      </div></div>
      <div class="excard-long__right"><div class="excard-long__img">
        <img src="/museum/images/fashioning-desire-mfit-listing-image.jpeg" alt="">
      </div></div>
      <div class="excard-long__description">La version en espanol de la misma exposicion.</div>
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

test('parseFitExhibitionsPage keeps linked and listing-only exhibitions', () => {
  const records = parseFitExhibitionsPage({
    html,
    url: 'https://www.fitnyc.edu/museum/exhibitions/index.php'
  });

  assert.equal(records.length, 3);
  const ihg = records.find((record) => record.title.startsWith('IHG Hotels'));
  const dollDressing = records.find((record) => record.title === 'Doll Dressing');
  const fashioningDesire = records.find((record) => record.title.startsWith('Fashioning Desire'));

  assert.deepEqual(dollDressing, {
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
      'Parsed from the Museum at FIT official current and upcoming long-card sections. Listing-only exhibitions use a stable anchor on the official exhibitions page. Closure notices, translated duplicates, past exhibitions, MFIT on the Road, and any detail-page enrichment remain out of scope.'
  });

  assert.equal(ihg.title, 'IHG Hotels & Resorts + Fashion Institute of Technology Tennis Ball Dress Contest 2026');
  assert.equal(ihg.startDate, '2026-07-22');
  assert.equal(ihg.endDate, null);
  assert.equal(
    ihg.exhibitionUrl,
    'https://www.fitnyc.edu/museum/exhibitions/index.php#ihg-hotels-resorts-fashion-institute-of-technology-tennis-ball-dress-contest-2026'
  );
  assert.equal(fashioningDesire.title, 'Fashioning Desire: Willy Chavarria and Barbara Sanchez-Kane');
});

test('parseFitExhibitionsPage de-duplicates repeated sections', () => {
  const records = parseFitExhibitionsPage({
    html: `${html}${html}`,
    url: 'https://www.fitnyc.edu/museum/exhibitions/index.php'
  });

  assert.equal(records.length, 3);
});
