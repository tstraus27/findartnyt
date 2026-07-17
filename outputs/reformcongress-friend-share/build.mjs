import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const stagingDir = path.join(projectRoot, "data", "staging");
const outFile = path.join(__dirname, "index.html");

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, "utf8"));

const stagingFiles = (await fs.readdir(stagingDir)).filter((file) => file.endsWith(".json")).sort();
const rows = [];

for (const file of stagingFiles) {
  const report = await readJson(path.join(stagingDir, file));
  const summary = report.summary || {};

  for (const item of report.items || []) {
    const record = item.proposed || item.after || item.before || {};
    if (record.type !== "exhibition") continue;

    rows.push({
      id: record.id || item.id || "",
      title: record.title || "",
      venue: record.venue || "",
      startDate: record.startDate || "",
      endDate: record.endDate || "",
      dateText: record.dateText || "",
      artists: record.artists || [],
      curators: record.curators || [],
      neighborhood: record.neighborhood || "",
      borough: record.borough || "",
      city: record.city || "",
      address: record.venueAddress || "",
      description: record.description || "",
      tags: record.tags || [],
      confidence: record.sourceConfidence || "",
      reviewStatus: item.reviewStatus === "approved" ? "reviewed" : "unreviewed",
      stagingStatus: item.reviewStatus || "",
      url: record.exhibitionUrl || record.sourceUrl || item.source?.url || "",
      sourceUrl: record.sourceUrl || item.source?.url || "",
      imageUrl: record.imageUrl || "",
      generatedAt: summary.generatedAt || item.extractedAt || "",
      sourceFile: `data/staging/${file}`,
    });
  }
}

const deduped = new Map();
for (const row of rows) {
  const key = [row.id, row.sourceUrl || row.url, row.title, row.venue].join("|");
  const existing = deduped.get(key);
  if (!existing || String(row.generatedAt) > String(existing.generatedAt)) deduped.set(key, row);
}

const data = [...deduped.values()].sort((a, b) => {
  const av = `${a.venue}|${a.startDate || "9999"}|${a.title}`;
  const bv = `${b.venue}|${b.startDate || "9999"}|${b.title}`;
  return av.localeCompare(bv);
});

const supplementalRows = [
  {
    id: "exhibition:met:orientalism-between-fact-and-fantasy",
    title: "Orientalism: Between Fact and Fantasy",
    venue: "The Metropolitan Museum of Art",
    startDate: "",
    endDate: "2027-02-28",
    dateText: "Through February 28, 2027",
    artists: [],
    curators: [],
    neighborhood: "Upper East Side",
    borough: "Manhattan",
    city: "New York",
    address: "1000 Fifth Avenue, New York, NY 10028",
    description:
      "A Met exhibition on 19th-century Orientalism, artistic exchange between Europe and the Middle East, and the role of Islamic art in shaping architecture, design, and painting.",
    tags: ["manual-supplement", "current"],
    confidence: "medium",
    reviewStatus: "unreviewed",
    stagingStatus: "manual_supplement",
    url: "https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy",
    sourceUrl: "https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy",
    imageUrl: "",
    generatedAt: new Date().toISOString(),
    sourceFile: "manual supplement after Met listing snapshot gap",
  },
];

for (const row of supplementalRows) {
  if (!data.some((existing) => existing.id === row.id || existing.sourceUrl === row.sourceUrl)) {
    data.push(row);
  }
}

data.sort((a, b) => {
  const av = `${a.venue}|${a.startDate || "9999"}|${a.title}`;
  const bv = `${b.venue}|${b.startDate || "9999"}|${b.title}`;
  return av.localeCompare(bv);
});

const venues = [...new Set(data.map((row) => row.venue).filter(Boolean))].sort();
const boroughs = [...new Set(data.map((row) => row.borough).filter(Boolean))].sort();
const statuses = [...new Set(data.map((row) => row.reviewStatus).filter(Boolean))].sort();

const json = JSON.stringify({ data, venues, boroughs, statuses })
  .replaceAll("</", "<\\/")
  .replaceAll("\u2028", "\\u2028")
  .replaceAll("\u2029", "\\u2029");

const html = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reform Congress - Site on the Way</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #fffef9;
        --ink: #0b0b0b;
        --muted: #5d5d57;
        --line: #d9d4c8;
        --panel: #f4f1e9;
        --accent: #0000ee;
        --accent-ink: #ffffff;
        --reviewed: #276749;
        --unreviewed: #8a4b10;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--paper);
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
      }

      button,
      input,
      select {
        font: inherit;
      }

      .landing {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 56px 22px;
        text-align: center;
      }

      .landing-inner {
        width: min(1040px, 100%);
      }

      h1 {
        margin: 0;
        font-size: clamp(3rem, 8vw, 6.6rem);
        line-height: 0.96;
        letter-spacing: 0;
        font-weight: 700;
        text-transform: uppercase;
      }

      .site-note {
        margin: 56px 0 24px;
        color: var(--accent);
        font-size: clamp(2rem, 4vw, 3.1rem);
        font-weight: 700;
      }

      .gate {
        width: min(440px, 100%);
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: center;
      }

      .gate input,
      .controls input,
      .controls select {
        width: 100%;
        border: 1px solid var(--line);
        background: #ffffff;
        border-radius: 4px;
        padding: 10px 11px;
      }

      .gate button,
      .toolbar button,
      .clear-button {
        border: 1px solid var(--ink);
        background: var(--ink);
        color: var(--accent-ink);
        border-radius: 4px;
        padding: 10px 14px;
        cursor: pointer;
      }

      .gate-error {
        min-height: 20px;
        margin-top: 8px;
        color: #9f1239;
        font-family: Arial, sans-serif;
        font-size: 0.9rem;
      }

      .app {
        display: none;
        min-height: 100vh;
        padding: 24px;
        font-family: Arial, Helvetica, sans-serif;
      }

      .app.is-open {
        display: block;
      }

      .app-header {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: end;
        border-bottom: 1px solid var(--line);
        padding-bottom: 18px;
      }

      .app-title {
        margin: 0;
        font-size: clamp(1.8rem, 4vw, 3.4rem);
        line-height: 1;
        font-family: Georgia, "Times New Roman", serif;
      }

      .app-subtitle {
        margin: 8px 0 0;
        color: var(--muted);
      }

      .disclaimer {
        max-width: 520px;
        margin: 10px 0 0;
        color: #777168;
        font-size: 0.78rem;
        line-height: 1.35;
      }

      .stats {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .stat {
        min-width: 98px;
        border: 1px solid var(--line);
        background: var(--panel);
        border-radius: 4px;
        padding: 9px 10px;
        text-align: right;
      }

      .stat strong {
        display: block;
        font-size: 1.25rem;
      }

      .stat span {
        color: var(--muted);
        font-size: 0.75rem;
        text-transform: uppercase;
      }

      .controls {
        display: grid;
        grid-template-columns: minmax(240px, 2fr) repeat(5, minmax(140px, 1fr));
        gap: 10px;
        margin: 18px 0;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
        color: var(--muted);
      }

      .table-wrap {
        border: 1px solid var(--line);
        overflow: auto;
        background: #ffffff;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1180px;
      }

      th,
      td {
        border-bottom: 1px solid #e8e2d7;
        padding: 10px 12px;
        vertical-align: top;
        text-align: left;
      }

      th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #161616;
        color: #ffffff;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        white-space: nowrap;
        cursor: pointer;
      }

      td {
        font-size: 0.92rem;
      }

      .title-cell {
        width: 300px;
      }

      .desc-cell {
        width: 380px;
        color: #333333;
      }

      .pill {
        display: inline-block;
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .pill.reviewed {
        background: #dff3e9;
        color: var(--reviewed);
      }

      .pill.unreviewed {
        background: #fff1d8;
        color: var(--unreviewed);
      }

      a {
        color: var(--accent);
      }

      .empty {
        padding: 36px;
        text-align: center;
        color: var(--muted);
      }

      body.unlocked .landing {
        display: none;
      }

      @media (max-width: 980px) {
        .app {
          padding: 16px;
        }

        .app-header {
          display: block;
        }

        .stats {
          justify-content: flex-start;
          margin-top: 14px;
        }

        .controls {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 640px) {
        .gate {
          grid-template-columns: 1fr;
        }

        .controls {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="landing">
      <div class="landing-inner">
        <h1>Congress is no longer a co-equal branch of government. We must make major reforms now.</h1>
        <p class="site-note">Site on the way.</p>
        <form class="gate" id="gate">
          <input id="password" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password" />
          <button type="submit">Open data</button>
        </form>
        <div class="gate-error" id="gateError" aria-live="polite"></div>
      </div>
    </main>

    <section class="app" id="app" aria-label="Collected exhibition data">
      <header class="app-header">
        <div>
          <h2 class="app-title">Collected Exhibition Data</h2>
          <p class="app-subtitle">Temporary searchable view for the staged New York exhibition list.</p>
          <p class="disclaimer">Working draft: this dataset is unfinished, and some entries, dates, source details, and review statuses have not yet been independently confirmed.</p>
        </div>
        <div class="stats">
          <div class="stat"><strong id="visibleCount">0</strong><span>Showing</span></div>
          <div class="stat"><strong id="totalCount">0</strong><span>Total</span></div>
          <div class="stat"><strong id="venueCount">0</strong><span>Venues</span></div>
        </div>
      </header>

      <div class="controls">
        <input id="search" type="search" placeholder="Search title, venue, neighborhood, artists, tags..." />
        <select id="venue"></select>
        <select id="borough"></select>
        <select id="status"></select>
        <select id="sort"></select>
        <select id="dateMode">
          <option value="all">All dates</option>
          <option value="current">Current / ongoing</option>
          <option value="upcoming">Upcoming</option>
          <option value="ended">Ended</option>
        </select>
      </div>

      <div class="toolbar">
        <span id="summaryText"></span>
        <button class="clear-button" id="clearFilters" type="button">Clear filters</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th data-sort="reviewStatus">Status</th>
              <th data-sort="venue">Venue</th>
              <th data-sort="title">Title</th>
              <th data-sort="startDate">Start</th>
              <th data-sort="endDate">End</th>
              <th data-sort="borough">Borough</th>
              <th data-sort="neighborhood">Neighborhood</th>
              <th>Artists</th>
              <th>Description</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
        <div class="empty" id="empty" hidden>No matches. Clear a filter or search for something broader.</div>
      </div>
    </section>

    <script>
      const payload = ${json};
      const PASSWORDS = new Set(["zachary", "zz slice", "janglejangler"]);
      const state = {
        query: "",
        venue: "",
        borough: "",
        status: "",
        sort: "venue",
        dateMode: "all",
        direction: 1,
      };

      const $ = (id) => document.getElementById(id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const normalized = (value) => String(value || "").toLowerCase();
      const formatList = (items) => Array.isArray(items) ? items.filter(Boolean).join(", ") : "";
      const formatDate = (value) => {
        if (!value) return "";
        const date = new Date(value + "T00:00:00");
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      };

      const dateState = (row) => {
        const start = row.startDate ? new Date(row.startDate + "T00:00:00") : null;
        const end = row.endDate ? new Date(row.endDate + "T00:00:00") : null;
        if (end && end < today) return "ended";
        if (start && start > today) return "upcoming";
        return "current";
      };

      const searchable = (row) => normalized([
        row.title,
        row.venue,
        row.dateText,
        row.neighborhood,
        row.borough,
        row.city,
        row.description,
        row.address,
        row.url,
        row.sourceUrl,
        row.sourceFile,
        row.confidence,
        formatList(row.artists),
        formatList(row.curators),
        formatList(row.tags),
      ].join(" "));

      const compare = (a, b) => {
        const key = state.sort;
        const av = key.includes("Date") ? (a[key] || "9999-99-99") : normalized(a[key]);
        const bv = key.includes("Date") ? (b[key] || "9999-99-99") : normalized(b[key]);
        return String(av).localeCompare(String(bv)) * state.direction;
      };

      const option = (value, label) => {
        const node = document.createElement("option");
        node.value = value;
        node.textContent = label;
        return node;
      };

      const setOptions = (select, allLabel, items) => {
        select.replaceChildren(option("", allLabel), ...items.map((item) => option(item, item)));
      };

      const render = () => {
        const query = normalized(state.query).trim();
        const filtered = payload.data
          .filter((row) => !query || searchable(row).includes(query))
          .filter((row) => !state.venue || row.venue === state.venue)
          .filter((row) => !state.borough || row.borough === state.borough)
          .filter((row) => !state.status || row.reviewStatus === state.status)
          .filter((row) => state.dateMode === "all" || dateState(row) === state.dateMode)
          .sort(compare);

        $("visibleCount").textContent = filtered.length;
        $("summaryText").textContent = filtered.length === payload.data.length
          ? "Showing every exhibition."
          : "Showing " + filtered.length + " of " + payload.data.length + " exhibitions.";
        $("empty").hidden = filtered.length > 0;

        $("rows").replaceChildren(...filtered.map((row) => {
          const tr = document.createElement("tr");
          const link = row.url ? '<a href="' + row.url + '" target="_blank" rel="noopener">Open</a>' : "";
          tr.innerHTML = [
            '<td><span class="pill ' + row.reviewStatus + '">' + row.reviewStatus + '</span></td>',
            '<td>' + escapeHtml(row.venue) + '</td>',
            '<td class="title-cell"><strong>' + escapeHtml(row.title) + '</strong><br><span>' + escapeHtml(row.dateText || "") + '</span></td>',
            '<td>' + escapeHtml(formatDate(row.startDate)) + '</td>',
            '<td>' + escapeHtml(formatDate(row.endDate)) + '</td>',
            '<td>' + escapeHtml(row.borough) + '</td>',
            '<td>' + escapeHtml(row.neighborhood) + '</td>',
            '<td>' + escapeHtml(formatList(row.artists)) + '</td>',
            '<td class="desc-cell">' + escapeHtml(row.description || "") + '</td>',
            '<td>' + link + '</td>',
          ].join("");
          return tr;
        }));
      };

      const escapeHtml = (value) => String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

      const unlock = () => {
        document.body.classList.add("unlocked");
        $("app").classList.add("is-open");
        $("search").focus();
        render();
      };

      $("gate").addEventListener("submit", (event) => {
        event.preventDefault();
        const value = normalized($("password").value).trim();
        if (PASSWORDS.has(value)) {
          sessionStorage.setItem("friend-data-open", "yes");
          unlock();
        } else {
          $("gateError").textContent = "Wrong password.";
        }
      });

      setOptions($("venue"), "All venues", payload.venues);
      setOptions($("borough"), "All boroughs", payload.boroughs);
      setOptions($("status"), "All review statuses", payload.statuses);
      $("sort").replaceChildren(
        option("venue", "Sort by venue"),
        option("startDate", "Sort by start date"),
        option("endDate", "Sort by end date"),
        option("title", "Sort by title"),
        option("reviewStatus", "Sort by review status"),
        option("borough", "Sort by borough")
      );

      $("totalCount").textContent = payload.data.length;
      $("venueCount").textContent = payload.venues.length;

      for (const id of ["search", "venue", "borough", "status", "sort", "dateMode"]) {
        $(id).addEventListener("input", (event) => {
          const key = id === "search" ? "query" : id;
          state[key] = event.target.value;
          render();
        });
      }

      document.querySelectorAll("th[data-sort]").forEach((th) => {
        th.addEventListener("click", () => {
          const key = th.dataset.sort;
          state.direction = state.sort === key ? state.direction * -1 : 1;
          state.sort = key;
          $("sort").value = key;
          render();
        });
      });

      $("clearFilters").addEventListener("click", () => {
        Object.assign(state, { query: "", venue: "", borough: "", status: "", sort: "venue", dateMode: "all", direction: 1 });
        $("search").value = "";
        $("venue").value = "";
        $("borough").value = "";
        $("status").value = "";
        $("sort").value = "venue";
        $("dateMode").value = "all";
        render();
      });

      if (sessionStorage.getItem("friend-data-open") === "yes") unlock();
    </script>
  </body>
</html>
`;

await fs.mkdir(__dirname, { recursive: true });
await fs.writeFile(outFile, html, "utf8");
console.log(`Wrote ${outFile}`);
console.log(`${data.length} exhibition rows embedded.`);
