// TV Hörde – WVV Scraper v6
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://ergebnisdienst.volleyball.nrw';

const TEAMS = [
  {
    id: 'damen2', name: '2. Damen', age: 'Frauen',
    searchName: 'TV Hörde II',
    url: `${BASE}/cms/home/erwachsene/verbandsligen/vl_frauen/verbandsliga_4_frauen.xhtml`,
  },
  {
    id: 'damen3', name: '3. Damen', age: 'Frauen',
    searchName: 'TV Hörde III',
    url: `${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_frauen/bezirksliga_9_frauen.xhtml`,
  },
  {
    id: 'damen4', name: '4. Damen', age: 'Frauen',
    searchName: 'TV Hörde IV',
    // Bezirksklasse 21 Frauen enthält laut PDF: TUS Weddinghofen, TV Asseln, SLC Bockum-Hövel → kein Hörde
    // Laut Kreisliga-PDF: TV Hörde IV & V spielen in Kreisliga Dortmund-Unna Frauen
    url: `${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml?LeaguePresenter.view=resultTable&LeaguePresenter.matchSeriesId=98622543`,
  },
  {
    id: 'herren2', name: '2. Herren', age: 'Männer',
    searchName: 'TV Hörde II',
    url: `${BASE}/cms/home/erwachsene/verbandsligen/vl_maenner/verbandsliga_3_maenner.xhtml`,
  },
  {
    id: 'herren3', name: '3. Herren', age: 'Männer',
    searchName: 'TV Hörde III',
    url: `${BASE}/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_6_maenner.xhtml`,
  },
  {
    id: 'herren4', name: '4. Herren', age: 'Männer',
    searchName: 'TV Hörde IV',
    url: `${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml`,
  },
  {
    id: 'herren5', name: '5. Herren', age: 'Männer',
    searchName: 'TV Hörde V',
    // Kreisliga Dortmund-Unna Männer
    url: `${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml?LeaguePresenter.view=resultTable&LeaguePresenter.matchSeriesId=95241748`,
  },
];

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

async function dismissCookieBanner(page) {
  try {
    await page.waitForSelector('.sams-cookie-modal', { timeout: 3000 });
    await page.evaluate(() => {
      document.querySelectorAll('.sams-cookie-modal, .sams-cookie-modal-overlay').forEach(el => el.remove());
      document.body.style.overflow = 'auto';
      document.body.style.pointerEvents = 'auto';
    });
    await page.waitForTimeout(300);
  } catch(e) {}
}

async function getTabelle(page, searchNorm) {
  return page.evaluate((searchNorm) => {
    function n(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
    for (const table of document.querySelectorAll('table')) {
      const txt = table.innerText || '';
      if (!txt.includes('Mannschaft') && !txt.includes('Team') && !txt.includes('Platz')) continue;
      const rows = [];
      let rank = 0;
      for (const tr of table.querySelectorAll('tbody tr, tr')) {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 3) continue;
        rank++;
        const name = (tds[1]?.innerText || tds[0]?.innerText || '').split('\n')[0].replace(/\s+/g,' ').trim();
        if (!name || name.length < 2) continue;
        rows.push({
          rank, name,
          sp:  (tds[2]?.innerText || '').trim(),
          s:   (tds[3]?.innerText || '').trim(),
          pkt: (tds[tds.length-1]?.innerText || '').trim(),
          current: n(name).includes(n(searchNorm))
        });
      }
      if (rows.length > 2) return rows;
    }
    return [];
  }, searchNorm);
}

async function scrapeTeam(context, team) {
  const searchNorm = norm(team.searchName);
  const page = await context.newPage();

  // ── TABELLE ───────────────────────────────────────────────────────
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);

  const league = await page.evaluate(() => (document.querySelector('h1,h2')?.innerText || '').trim());
  const tabelle = await getTabelle(page, searchNorm);
  const ownRow = tabelle.find(r => r.current);

  if (ownRow) console.log(`      ✓ "${ownRow.name}" → Platz ${ownRow.rank}/${tabelle.length}`);
  else console.log(`      ⚠ Nicht gefunden! Teams: ${tabelle.slice(0,4).map(r=>r.name).join(', ')}`);

  // ── matchSeriesId aus der Seite holen ─────────────────────────────
  const matchSeriesId = await page.evaluate(() => {
    // Aus den Tab-Links die matchSeriesId lesen
    for (const a of document.querySelectorAll('a')) {
      const href = a.href || '';
      const m = href.match(/matchSeriesId=(\d+)/);
      if (m) return m[1];
    }
    return null;
  });
  console.log(`      matchSeriesId: ${matchSeriesId}`);

  // ── SPIELPLAN (direkt per URL) ─────────────────────────────────────
  let spiele = [];
  if (matchSeriesId) {
    const spieleUrl = `${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml?LeaguePresenter.view=matches&LeaguePresenter.matchSeriesId=${matchSeriesId}`;
    // Versuche die Liga-spezifische URL zu ermitteln
    const basePageUrl = team.url.split('?')[0];
    const spielePageUrl = `${basePageUrl}?LeaguePresenter.view=matches&LeaguePresenter.matchSeriesId=${matchSeriesId}`;

    await page.goto(spielePageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    await dismissCookieBanner(page);

    spiele = await page.evaluate((searchNorm) => {
      function n(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
      const result = [];
      for (const table of document.querySelectorAll('table')) {
        for (const tr of table.querySelectorAll('tbody tr, tr')) {
          if (!n(tr.innerText).includes(searchNorm)) continue;
          const tds = tr.querySelectorAll('td');
          if (tds.length < 4) continue;
          const datum    = (tds[0]?.innerText || '').trim();
          const team1    = (tds[2]?.innerText || '').trim().split('\n')[0];
          const team2    = (tds[3]?.innerText || '').trim().split('\n')[0];
          const ergebnis = (tds[4]?.innerText || '').trim();
          const halle    = (tds[5]?.innerText || '').trim().split('\n')[0];
          if (!ergebnis || ergebnis.includes('–') || ergebnis === '') {
            result.push({ datum, team1, team2, heim: n(team1).includes(searchNorm), halle });
          }
        }
      }
      return result.slice(0, 6);
    }, searchNorm);
  }

  // ── KADER (direkt per URL + warte auf JS) ─────────────────────────
  let kader = [];
  if (matchSeriesId) {
    try {
      const basePageUrl = team.url.split('?')[0];
      const mannUrl = `${basePageUrl}?LeaguePresenter.view=teamOverview&LeaguePresenter.matchSeriesId=${matchSeriesId}`;
      await page.goto(mannUrl, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(3000);
      await dismissCookieBanner(page);

      // Warte explizit auf Links mit teamDetails
      await page.waitForSelector('a[href*="teamDetails"]', { timeout: 8000 }).catch(() => {});

      const teamLink = await page.evaluate((searchNorm) => {
        function n(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
        const allLinks = Array.from(document.querySelectorAll('a[href*="teamDetails"]'));
        console.log('teamDetail links found:', allLinks.length);
        for (const a of allLinks) {
          console.log('  link text:', (a.innerText||'').trim(), 'href:', a.href);
          if (n(a.innerText).includes(searchNorm)) return a.href;
        }
        // Fallback: erstes teamDetails Link
        if (allLinks.length > 0) {
          return { fallback: true, links: allLinks.map(a => ({ text: (a.innerText||'').trim().slice(0,30), href: a.href })) };
        }
        return null;
      }, searchNorm);

      if (typeof teamLink === 'string') {
        const popup = await context.newPage();
        await popup.goto(teamLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await popup.waitForTimeout(1500);
        await dismissCookieBanner(popup);
        kader = await popup.evaluate(() => {
          const players = [];
          for (const row of document.querySelectorAll('table tr')) {
            const tds = row.querySelectorAll('td');
            if (tds.length < 2) continue;
            const nr   = (tds[0]?.innerText || '').trim();
            const name = (tds[1]?.innerText || '').trim();
            const pos  = (tds[2]?.innerText || '').trim();
            if (name && name.length > 2 && !/^(name|spieler|pos|nr|#|trikot)/i.test(name)) {
              players.push({ nr: nr || '–', name, pos: pos || '–' });
            }
          }
          return players;
        });
        console.log(`      Kader: ${kader.length} Spieler`);
        await popup.close();
      } else if (teamLink?.fallback) {
        console.log(`      Verfügbare Team-Links: ${teamLink.links.map(l=>l.text).join(', ')}`);
      } else {
        console.log(`      Keine teamDetails-Links gefunden`);
      }
    } catch(e) {
      console.log(`      ⚠ Kader-Fehler: ${e.message.split('\n')[0].slice(0,60)}`);
    }
  }

  await page.close();
  return { league, rank: ownRow?.rank || null, rankTotal: tabelle.length, tabelle, spiele, kader };
}

async function scrapeAll() {
  console.log('🏐 TV Hörde WVV-Scraper v6 startet...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  await context.addCookies([{
    name: 'cookieConsent', value: 'true',
    domain: 'ergebnisdienst.volleyball.nrw', path: '/'
  }]);

  const results = {};
  for (const team of TEAMS) {
    console.log(`📋 ${team.name} (${team.age})...`);
    try {
      results[team.id] = await scrapeTeam(context, team);
      const d = results[team.id];
      console.log(`   ✅ "${d.league}" | Platz ${d.rank}/${d.rankTotal} | Spiele: ${d.spiele.length} | Kader: ${d.kader.length}`);
    } catch(e) {
      console.log(`   ❌ ${e.message.split('\n')[0]}`);
      results[team.id] = { league:'', rank:null, rankTotal:null, tabelle:[], spiele:[], kader:[] };
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
  fs.writeFileSync('tvhoerde-data.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\n✅ Fertig! tvhoerde-data.json gespeichert.');
}

scrapeAll().catch(err => { console.error(err); process.exit(1); });
