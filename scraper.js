// TV Hörde – WVV Scraper v5
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
    url: `${BASE}/cms/home/erwachsene/bezirksklassen/bezirksklassen_frauen/bezirksklasse_21_frauen.xhtml`,
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
    // Kreisliga Dortmund-Unna Männer – matchSeriesId aus dem WVV-Ergebnisdienst
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
 
async function scrapeTeam(context, team) {
  const searchNorm = norm(team.searchName);
  const page = await context.newPage();
 
  // ── TABELLE ───────────────────────────────────────────────────────
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);
 
  const league = await page.evaluate(() => (document.querySelector('h1,h2')?.innerText || '').trim());
 
  const tabelle = await page.evaluate((searchNorm) => {
    function n(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
    for (const table of document.querySelectorAll('table')) {
      const txt = table.innerText || '';
      if (!txt.includes('Mannschaft') && !txt.includes('Team') && !txt.includes('Verein')) continue;
      const rows = [];
      let rank = 0;
      for (const tr of table.querySelectorAll('tbody tr, tr')) {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 3) continue;
        rank++;
        const name = (tds[1]?.innerText || tds[0]?.innerText || '').split('\n')[0].replace(/\s+/g,' ').trim();
        if (!name || name.length < 2) continue;
        rows.push({
          rank,
          name,
          sp:  (tds[2]?.innerText || '').trim(),
          s:   (tds[3]?.innerText || '').trim(),
          pkt: (tds[tds.length-1]?.innerText || '').trim(),
          current: n(name).includes(searchNorm)
        });
      }
      if (rows.length > 2) return rows;
    }
    return [];
  }, searchNorm);
 
  const ownRow = tabelle.find(r => r.current);
  if (ownRow) console.log(`      ✓ "${ownRow.name}" → Platz ${ownRow.rank}/${tabelle.length}`);
  else if (tabelle.length > 0) console.log(`      ⚠ Nicht gefunden! Teams: ${tabelle.slice(0,3).map(r=>r.name).join(', ')}`);
  else console.log(`      ⚠ Keine Tabelle!`);
 
  // ── SPIELPLAN ─────────────────────────────────────────────────────
  // Direkt die Spiele-URL aufrufen (matchSeriesId aus der aktuellen URL holen)
  const spieleUrl = await page.evaluate(() => {
    for (const a of document.querySelectorAll('a')) {
      if ((a.href || '').includes('view=matches')) return a.href;
    }
    return null;
  });
 
  let spiele = [];
  if (spieleUrl) {
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
 
  // ── KADER ─────────────────────────────────────────────────────────
  let kader = [];
  try {
    // Direkt die Mannschaften-URL aufrufen
    const mannUrl = await page.evaluate(() => {
      for (const a of document.querySelectorAll('a')) {
        if ((a.href || '').includes('view=teamOverview')) return a.href;
      }
      return null;
    }) || spieleUrl?.replace('view=matches', 'view=teamOverview');
 
    // Zurück zur Haupt-URL falls nötig
    if (!mannUrl) {
      await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      await dismissCookieBanner(page);
    }
 
    const targetMannUrl = mannUrl || await page.evaluate(() => {
      for (const a of document.querySelectorAll('a')) {
        if ((a.href || '').includes('view=teamOverview')) return a.href;
      }
      return null;
    });
 
    if (targetMannUrl) {
      await page.goto(targetMannUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      await dismissCookieBanner(page);
 
      // Finde TV Hörde Link
      const teamLink = await page.evaluate((searchNorm) => {
        function n(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
        for (const a of document.querySelectorAll('a')) {
          const txt = n(a.innerText);
          const href = a.href || '';
          if (txt.includes(searchNorm) && href.includes('teamDetails')) return href;
        }
        // Fallback: alle Links loggen
        return Array.from(document.querySelectorAll('a'))
          .filter(a => (a.href||'').includes('teamDetails'))
          .map(a => ({ text: (a.innerText||'').trim(), href: a.href }));
      }, searchNorm);
 
      if (typeof teamLink === 'string') {
        console.log(`      Kader-Link: gefunden`);
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
      } else if (Array.isArray(teamLink)) {
        // Debug: zeige alle verfügbaren Team-Links
        console.log(`      Verfügbare Teams: ${teamLink.map(l => l.text).join(', ')}`);
      }
    }
  } catch(e) {
    console.log(`      ⚠ Kader-Fehler: ${e.message.split('\n')[0].slice(0,60)}`);
  }
 
  await page.close();
  return { league, rank: ownRow?.rank || null, rankTotal: tabelle.length, tabelle, spiele, kader };
}
 
async function scrapeAll() {
  console.log('🏐 TV Hörde WVV-Scraper v5 startet...\n');
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
    await new Promise(r => setTimeout(r, 2500));
  }
 
  await browser.close();
  fs.writeFileSync('tvhoerde-data.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\n✅ Fertig! tvhoerde-data.json gespeichert.');
}
 
scrapeAll().catch(err => { console.error(err); process.exit(1); });
