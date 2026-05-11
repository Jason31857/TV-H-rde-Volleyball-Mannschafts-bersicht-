// TV Hörde – WVV Scraper v7 (mit Jugend)
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://ergebnisdienst.volleyball.nrw';

const TEAMS = [
  // ── ERWACHSENE ────────────────────────────────────────────────────
  { id:'damen2',  name:'2. Damen',   searchName:'TV Hörde II',  url:`${BASE}/cms/home/erwachsene/verbandsligen/vl_frauen/verbandsliga_4_frauen.xhtml` },
  { id:'damen3',  name:'3. Damen',   searchName:'TV Hörde III', url:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_frauen/bezirksliga_9_frauen.xhtml` },
  { id:'damen4',  name:'4. Damen',   searchName:'TV Hörde IV',  url:`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`, searchAll: true },
  { id:'herren2', name:'2. Herren',  searchName:'TV Hörde II',  url:`${BASE}/cms/home/erwachsene/verbandsligen/vl_maenner/verbandsliga_3_maenner.xhtml` },
  { id:'herren3', name:'3. Herren',  searchName:'TV Hörde III', url:`${BASE}/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_6_maenner.xhtml` },
  { id:'herren4', name:'4. Herren',  searchName:'TV Hörde IV',  url:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml` },
  { id:'herren5', name:'5. Herren',  searchName:'TV Hörde V',   url:`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`, searchAll: true },
  // ── WEIBLICHE JUGEND ──────────────────────────────────────────────
  { id:'u20w', name:'U20 Damen', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u20/u20_weiblich.xhtml` },
  { id:'u18w', name:'U18 Damen', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u18/u18_weiblich.xhtml` },
  { id:'u16w', name:'U16 Damen', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u16/u16_weiblich.xhtml` },
  { id:'u14w', name:'U14 Damen', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u14/u14_weiblich.xhtml` },
  { id:'u13w', name:'U13 Damen', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u13/u13_weiblich.xhtml` },
  { id:'u12w', name:'U12 Damen', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u12/u12_weiblich.xhtml` },
  // ── MÄNNLICHE JUGEND ──────────────────────────────────────────────
  { id:'u20m', name:'U20 Herren', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u20/u20_maennlich.xhtml` },
  { id:'u18m', name:'U18 Herren', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u18/u18_maennlich.xhtml` },
  { id:'u16m', name:'U16 Herren', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u16/u16_maennlich.xhtml` },
  { id:'u14m', name:'U14 Herren', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u14/u14_maennlich.xhtml` },
  { id:'u13m', name:'U13 Herren', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u13/u13_maennlich.xhtml` },
  { id:'u12m', name:'U12 Herren', searchName:'TV Hörde', url:`${BASE}/cms/home/jugend/u12/u12_maennlich.xhtml` },
];

function norm(s) {
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
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

async function scrapeTeam(context, team) {
  const searchNorm = norm(team.searchName);
  const page = await context.newPage();

  // ── TABELLE ───────────────────────────────────────────────────────
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);

  const league = await page.evaluate(() => (document.querySelector('h1,h2')?.innerText || '').trim());

  // matchSeriesId aus der Seite lesen
  const matchSeriesId = await page.evaluate(() => {
    for (const a of document.querySelectorAll('a')) {
      const m = (a.href||'').match(/matchSeriesId=(\d+)/);
      if (m) return m[1];
    }
    return null;
  });

  // Jugend: Suche die richtige Staffel wo TV Hörde drin ist
  // Bei Jugend gibt es mehrere Staffeln auf einer Seite – wir müssen die richtige finden
  const isJugend = team.id.startsWith('u');

  let tabelle = [];
  let correctMatchSeriesId = matchSeriesId;

  if (isJugend) {
    // Alle Staffeln auf der Seite durchsuchen
    const allStaffeln = await page.evaluate(() => {
      const result = [];
      document.querySelectorAll('a[href*="matchSeriesId"]').forEach(a => {
        const m = (a.href||'').match(/matchSeriesId=(\d+)/);
        if (m && (a.href||'').includes('view=resultTable')) {
          result.push({ id: m[1], text: (a.innerText||'').trim() });
        }
      });
      return [...new Map(result.map(r => [r.id, r])).values()];
    });
    console.log(`      Staffeln gefunden: ${allStaffeln.length}`);

    // Jede Staffel laden und nach TV Hörde suchen
    for (const staffel of allStaffeln) {
      const baseUrl = team.url.split('?')[0];
      const staffelUrl = `${baseUrl}?LeaguePresenter.view=resultTable&LeaguePresenter.matchSeriesId=${staffel.id}`;
      await page.goto(staffelUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      await dismissCookieBanner(page);

      const rows = await page.evaluate((searchNorm) => {
        function n(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
        for (const table of document.querySelectorAll('table')) {
          if (!(table.innerText||'').includes('Mannschaft') && !(table.innerText||'').includes('Platz')) continue;
          const rows = [];
          let rank = 0;
          for (const tr of table.querySelectorAll('tbody tr, tr')) {
            const tds = tr.querySelectorAll('td');
            if (tds.length < 3) continue;
            rank++;
            const name = (tds[1]?.innerText||tds[0]?.innerText||'').split('\n')[0].replace(/\s+/g,' ').trim();
            if (!name || name.length < 2) continue;
            rows.push({ rank, name, sp:(tds[2]?.innerText||'').trim(), s:(tds[3]?.innerText||'').trim(), pkt:(tds[tds.length-1]?.innerText||'').trim(), current:n(name).includes(searchNorm) });
          }
          if (rows.length > 2) return rows;
        }
        return [];
      }, searchNorm);

      if (rows.some(r => r.current)) {
        tabelle = rows;
        correctMatchSeriesId = staffel.id;
        console.log(`      ✓ TV Hörde in Staffel ${staffel.id} gefunden (${staffel.text})`);
        break;
      }
    }
    if (!tabelle.length) console.log(`      ⚠ TV Hörde in keiner Staffel gefunden`);
  } else {
    // Erwachsene: direkt
    tabelle = await page.evaluate((searchNorm) => {
      function n(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
      for (const table of document.querySelectorAll('table')) {
        if (!(table.innerText||'').includes('Mannschaft') && !(table.innerText||'').includes('Team')) continue;
        const rows = [];
        let rank = 0;
        for (const tr of table.querySelectorAll('tbody tr, tr')) {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 3) continue;
          rank++;
          const name = (tds[1]?.innerText||tds[0]?.innerText||'').split('\n')[0].replace(/\s+/g,' ').trim();
          if (!name || name.length < 2) continue;
          rows.push({ rank, name, sp:(tds[2]?.innerText||'').trim(), s:(tds[3]?.innerText||'').trim(), pkt:(tds[tds.length-1]?.innerText||'').trim(), current:n(name).includes(searchNorm) });
        }
        if (rows.length > 2) return rows;
      }
      return [];
    }, searchNorm);
    const ownRow = tabelle.find(r => r.current);
    if (ownRow) console.log(`      ✓ "${ownRow.name}" → Platz ${ownRow.rank}/${tabelle.length}`);
    else console.log(`      ⚠ Nicht gefunden! Teams: ${tabelle.slice(0,3).map(r=>r.name).join(', ')}`);
  }

  const ownRow = tabelle.find(r => r.current);

  // ── SPIELPLAN ─────────────────────────────────────────────────────
  let spiele = [];
  if (correctMatchSeriesId) {
    const baseUrl = team.url.split('?')[0];
    const spieleUrl = `${baseUrl}?LeaguePresenter.view=matches&LeaguePresenter.matchSeriesId=${correctMatchSeriesId}`;
    await page.goto(spieleUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
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
          const datum    = (tds[0]?.innerText||'').trim();
          const team1    = (tds[2]?.innerText||'').trim().split('\n')[0];
          const team2    = (tds[3]?.innerText||'').trim().split('\n')[0];
          const ergebnis = (tds[4]?.innerText||'').trim();
          const halle    = (tds[5]?.innerText||'').trim().split('\n')[0];
          if (!ergebnis || ergebnis.includes('–') || ergebnis === '') {
            result.push({ datum, team1, team2, heim:n(team1).includes(searchNorm), halle });
          }
        }
      }
      return result.slice(0, 6);
    }, searchNorm);
  }

  // ── KADER ─────────────────────────────────────────────────────────
  let kader = [];
  if (correctMatchSeriesId) {
    try {
      const baseUrl = team.url.split('?')[0];
      const mannUrl = `${baseUrl}?LeaguePresenter.view=teamOverview&LeaguePresenter.matchSeriesId=${correctMatchSeriesId}`;
      await page.goto(mannUrl, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(2000);
      await dismissCookieBanner(page);
      await page.waitForSelector('a[href*="teamDetails"]', { timeout: 6000 }).catch(()=>{});

      const teamLink = await page.evaluate((searchNorm) => {
        function n(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
        for (const a of document.querySelectorAll('a[href*="teamDetails"]')) {
          if (n(a.innerText).includes(searchNorm)) return a.href;
        }
        // Fallback: alle Links anzeigen
        const links = Array.from(document.querySelectorAll('a[href*="teamDetails"]')).map(a=>({text:(a.innerText||'').trim().slice(0,30),href:a.href}));
        return links.length ? { links } : null;
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
            const nr   = (tds[0]?.innerText||'').trim();
            const name = (tds[1]?.innerText||'').trim();
            const pos  = (tds[2]?.innerText||'').trim();
            if (name && name.length > 2 && !/^(name|spieler|pos|nr|#|trikot)/i.test(name)) {
              players.push({ nr: nr||'–', name, pos: pos||'–' });
            }
          }
          return players;
        });
        console.log(`      Kader: ${kader.length} Spieler`);
        await popup.close();
      } else if (teamLink?.links) {
        console.log(`      Verfügbare Teams: ${teamLink.links.map(l=>l.text).join(', ')}`);
      } else {
        console.log(`      Keine teamDetails-Links gefunden`);
      }
    } catch(e) {
      console.log(`      ⚠ Kader: ${e.message.split('\n')[0].slice(0,60)}`);
    }
  }

  await page.close();
  return { league, rank: ownRow?.rank||null, rankTotal: tabelle.length, tabelle, spiele, kader };
}

async function scrapeAll() {
  console.log('🏐 TV Hörde WVV-Scraper v7 (mit Jugend) startet...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  await context.addCookies([{ name:'cookieConsent', value:'true', domain:'ergebnisdienst.volleyball.nrw', path:'/' }]);

  const results = {};
  for (const team of TEAMS) {
    console.log(`📋 ${team.name}...`);
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
