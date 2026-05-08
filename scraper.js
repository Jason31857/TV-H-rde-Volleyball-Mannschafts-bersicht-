// TV Hörde – WVV Scraper v4 – korrekte Staffeln
const { chromium } = require('playwright');
const fs = require('fs');
 
const TEAMS = [
  {
    id: 'damen2',
    name: '2. Damen',
    age: 'Frauen',
    searchName: 'TV Hörde II',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/verbandsligen/vl_frauen/verbandsliga_4_frauen.xhtml',
  },
  {
    id: 'damen3',
    name: '3. Damen',
    age: 'Frauen',
    searchName: 'TV Hörde III',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/bezirksligen/bezirksligen_frauen/bezirksliga_9_frauen.xhtml',
  },
  {
    id: 'damen4',
    name: '4. Damen',
    age: 'Frauen',
    searchName: 'TV Hörde',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/bezirksklassen/bezirksklassen_frauen/bezirksklasse_21_frauen.xhtml',
  },
  {
    id: 'herren2',
    name: '2. Herren',
    age: 'Männer',
    searchName: 'TV Hörde II',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/verbandsligen/vl_maenner/verbandsliga_3_maenner.xhtml',
  },
  {
    id: 'herren3',
    name: '3. Herren',
    age: 'Männer',
    searchName: 'TV Hörde III',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_6_maenner.xhtml',
  },
  {
    id: 'herren4',
    name: '4. Herren',
    age: 'Männer',
    searchName: 'TV Hörde IV',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml',
  },
  {
    id: 'herren5',
    name: '5. Herren',
    age: 'Männer',
    searchName: 'TV Hörde V',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/kreisligen/kreisligen_maenner/kreisliga_dortmund_unna_maenner.xhtml',
  },
];
 
async function dismissCookieBanner(page) {
  try {
    await page.waitForSelector('.sams-cookie-modal', { timeout: 4000 });
    await page.evaluate(() => {
      document.querySelectorAll('.sams-cookie-modal, .sams-cookie-modal-overlay').forEach(el => el.remove());
      document.body.style.overflow = 'auto';
      document.body.style.pointerEvents = 'auto';
    });
    await page.waitForTimeout(400);
  } catch(e) {}
}
 
function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
 
async function scrapeTeam(context, team) {
  const page = await context.newPage();
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);
 
  const league = await page.evaluate(() => (document.querySelector('h1,h2')?.innerText || '').trim());
 
  // ── TABELLE ───────────────────────────────────────────────────────
  const searchNorm = normalize(team.searchName);
  const tabelle = await page.evaluate((searchNorm) => {
    function norm(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
    const rows = [];
    for (const table of document.querySelectorAll('table')) {
      const txt = table.innerText || '';
      if (!txt.includes('Mannschaft') && !txt.includes('Team') && !txt.includes('Verein')) continue;
      const trs = table.querySelectorAll('tbody tr, tr');
      let rank = 0;
      for (const tr of trs) {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 3) continue;
        rank++;
        const name = (tds[1]?.innerText || tds[0]?.innerText || '').split('\n')[0].replace(/\s+/g,' ').trim();
        if (!name || name.length < 2) continue;
        const sp  = (tds[2]?.innerText || '').trim();
        const s   = (tds[3]?.innerText || '').trim();
        const pkt = (tds[tds.length-1]?.innerText || '').trim();
        const isCurrent = norm(name).includes(searchNorm);
        rows.push({ rank, name, sp, s, pkt, current: isCurrent });
      }
      if (rows.length > 2) break;
    }
    return rows;
  }, searchNorm);
 
  const ownRow = tabelle.find(r => r.current);
  if (ownRow) {
    console.log(`      ✓ Gefunden: "${ownRow.name}" (Platz ${ownRow.rank}/${tabelle.length})`);
  } else if (tabelle.length > 0) {
    console.log(`      ⚠ "${team.searchName}" nicht gefunden! Erste Teams: ${tabelle.slice(0,3).map(r=>r.name).join(', ')}`);
  } else {
    console.log(`      ⚠ Keine Tabelle gefunden auf: ${team.url}`);
  }
 
  // ── SPIELPLAN ─────────────────────────────────────────────────────
  await page.evaluate(() => {
    for (const a of document.querySelectorAll('a')) {
      const t = (a.innerText || '').toLowerCase();
      const h = (a.href || '');
      if (h.includes('view=matches') || t === 'spiele' || t === 'spielplan') { a.click(); return; }
    }
  });
  await page.waitForTimeout(1500);
  await dismissCookieBanner(page);
 
  const spiele = await page.evaluate((searchNorm) => {
    function norm(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
    const result = [];
    for (const table of document.querySelectorAll('table')) {
      for (const tr of table.querySelectorAll('tbody tr, tr')) {
        if (!norm(tr.innerText).includes(searchNorm)) continue;
        const tds = tr.querySelectorAll('td');
        if (tds.length < 4) continue;
        const datum    = (tds[0]?.innerText || '').trim();
        const uhrzeit  = (tds[1]?.innerText || '').trim();
        const team1    = (tds[2]?.innerText || '').trim().split('\n')[0];
        const team2    = (tds[3]?.innerText || '').trim().split('\n')[0];
        const ergebnis = (tds[4]?.innerText || '').trim();
        const halle    = (tds[5]?.innerText || '').trim().split('\n')[0];
        if (!ergebnis || ergebnis.includes('–') || ergebnis === '') {
          result.push({ datum, uhrzeit, team1, team2, heim: norm(team1).includes(searchNorm), halle });
        }
      }
    }
    return result.slice(0, 6);
  }, searchNorm);
 
  // ── KADER ─────────────────────────────────────────────────────────
  let kader = [];
  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await dismissCookieBanner(page);
 
    await page.evaluate(() => {
      for (const a of document.querySelectorAll('a')) {
        const t = (a.innerText || '').toLowerCase();
        const h = (a.href || '');
        if (h.includes('view=teamOverview') || t === 'mannschaften' || t === 'teams') { a.click(); return; }
      }
    });
    await page.waitForTimeout(2000);
    await dismissCookieBanner(page);
 
    const teamLink = await page.evaluate((searchNorm) => {
      function norm(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
      for (const a of document.querySelectorAll('a')) {
        if (norm(a.innerText).includes(searchNorm) && (a.href||'').includes('teamDetails')) return a.href;
      }
      return null;
    }, searchNorm);
 
    if (teamLink) {
      console.log(`      Kader-Link gefunden`);
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
      await popup.close();
    }
  } catch(e) {
    console.log(`      ⚠ Kader-Fehler: ${e.message.split('\n')[0].slice(0,60)}`);
  }
 
  await page.close();
  return { league, rank: ownRow?.rank || null, rankTotal: tabelle.length, tabelle, spiele, kader };
}
 
async function scrapeAll() {
  console.log('🏐 TV Hörde WVV-Scraper v4 startet...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  await context.addCookies([{ name: 'cookieConsent', value: 'true', domain: 'ergebnisdienst.volleyball.nrw', path: '/' }]);
 
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
    await new Promise(r => setTimeout(r, 2500));
  }
 
  await browser.close();
  fs.writeFileSync('tvhoerde-data.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\n✅ Fertig! tvhoerde-data.json gespeichert.');
}
 
scrapeAll().catch(err => { console.error(err); process.exit(1); });
