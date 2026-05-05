// TV Hörde – WVV Scraper v3
const { chromium } = require('playwright');
const fs = require('fs');

const TEAMS = [
  {
    id: 'damen2',
    name: '2. Damen',
    age: 'Frauen',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/oberligen/Ol_frauen/oberliga_2_frauen.xhtml',
  },
  {
    id: 'damen3',
    name: '3. Damen',
    age: 'Frauen',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/landesligen/landesligen_frauen/landesliga_6_frauen.xhtml',
  },
  {
    id: 'damen4',
    name: '4. Damen',
    age: 'Frauen',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/bezirksklassen/bezirksklassen_frauen/bezirksklasse_21_frauen.xhtml',
  },
  {
    id: 'herren2',
    name: '2. Herren',
    age: 'Männer',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/oberligen/OL_maenner/oberliga_2_maenner.xhtml',
  },
  {
    id: 'herren3',
    name: '3. Herren',
    age: 'Männer',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_5_maenner.xhtml',
  },
  {
    id: 'herren4',
    name: '4. Herren',
    age: 'Männer',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml',
  },
  {
    id: 'herren5',
    name: '5. Herren',
    age: 'Männer',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/bezirksklassen/bezirksklassen_maenner/bezirksklasse_18_maenner.xhtml',
  },
];

// Alle möglichen Schreibweisen von TV Hörde
const SEARCH_TERMS = ['hörde', 'hoerde', 'tv h', 'tvh', 'horde'];

function isHoerde(text) {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return SEARCH_TERMS.some(s => t.includes(s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

async function dismissCookieBanner(page) {
  try {
    await page.waitForSelector('.sams-cookie-modal', { timeout: 4000 });
    await page.evaluate(() => {
      // Akzeptieren-Button klicken
      const modal = document.querySelector('.sams-cookie-modal');
      if (!modal) return;
      const btns = modal.querySelectorAll('button, a');
      for (const b of btns) {
        const t = (b.innerText || '').toLowerCase();
        if (t.includes('akzept') || t.includes('ok') || t.includes('zustimm') || t.includes('alle')) {
          b.click(); return;
        }
      }
      // Fallback: Modal ausblenden
      modal.remove();
      document.querySelectorAll('[class*="cookie"], [class*="overlay"], [class*="modal"]').forEach(el => {
        if (el.innerText && el.innerText.includes('Cookie')) el.remove();
      });
      document.body.style.overflow = 'auto';
      document.body.style.pointerEvents = 'auto';
    });
    await page.waitForTimeout(600);
    // Sicherheits-Cleanup
    await page.evaluate(() => {
      document.querySelectorAll('.sams-cookie-modal, .sams-cookie-modal-overlay').forEach(el => el.remove());
      document.body.style.overflow = 'auto';
      document.body.style.pointerEvents = 'auto';
    });
  } catch(e) { /* kein Banner */ }
}

async function clickTabByText(page, keywords) {
  return await page.evaluate((kws) => {
    const links = document.querySelectorAll('a, button, li');
    for (const el of links) {
      const t = (el.innerText || el.textContent || '').toLowerCase().trim();
      for (const kw of kws) {
        if (t.includes(kw)) { el.click(); return t; }
      }
    }
    return null;
  }, keywords);
}

async function scrapeTeam(context, team) {
  const page = await context.newPage();
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);

  // ── DEBUG: Alle Tabellen-Inhalte loggen ──────────────────────────
  const pageInfo = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const info = { tableCount: tables.length, firstRows: [] };
    if (tables.length > 0) {
      const rows = tables[0].querySelectorAll('tr');
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        info.firstRows.push(rows[i].innerText.replace(/\s+/g, ' ').trim().slice(0, 100));
      }
    }
    // Alle Links
    info.links = Array.from(document.querySelectorAll('a')).map(a => ({
      text: (a.innerText || '').trim().slice(0, 40),
      href: (a.href || '').slice(0, 100)
    })).filter(l => l.text.length > 1).slice(0, 20);
    return info;
  });
  console.log(`      Tabellen: ${pageInfo.tableCount}`);
  if (pageInfo.firstRows.length) console.log(`      Erste Zeilen: ${pageInfo.firstRows.join(' | ')}`);

  // ── LIGA-NAME ─────────────────────────────────────────────────────
  const league = await page.evaluate(() => {
    return (document.querySelector('h1,h2')?.innerText || '').trim();
  });

  // ── TABELLE ───────────────────────────────────────────────────────
  const tabelle = await page.evaluate((searchTerms) => {
    function isHoerde(text) {
      const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return searchTerms.some(s => t.includes(s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
    }
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
        rows.push({ rank, name, sp, s, pkt, current: isHoerde(name) });
      }
      if (rows.length > 2) break;
    }
    return rows;
  }, SEARCH_TERMS);

  // TV Hörde in Tabelle gefunden?
  const ownRow = tabelle.find(r => r.current);
  if (ownRow) {
    console.log(`      ✓ TV Hörde gefunden als: "${ownRow.name}" (Platz ${ownRow.rank})`);
  } else if (tabelle.length > 0) {
    console.log(`      ⚠ TV Hörde NICHT gefunden! Erste Teams: ${tabelle.slice(0,3).map(r=>r.name).join(', ')}`);
  }

  // ── SPIELPLAN ─────────────────────────────────────────────────────
  const spieleTab = await clickTabByText(page, ['spiel', 'ergebnis', 'begegnung']);
  if (spieleTab) {
    await page.waitForTimeout(1500);
    await dismissCookieBanner(page);
  }

  const spiele = await page.evaluate((searchTerms) => {
    function isHoerde(text) {
      const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return searchTerms.some(s => t.includes(s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
    }
    const result = [];
    for (const table of document.querySelectorAll('table')) {
      const trs = table.querySelectorAll('tbody tr, tr');
      for (const tr of trs) {
        const txt = tr.innerText || '';
        if (!isHoerde(txt)) continue;
        const tds = tr.querySelectorAll('td');
        if (tds.length < 4) continue;
        const datum    = (tds[0]?.innerText || '').trim();
        const uhrzeit  = (tds[1]?.innerText || '').trim();
        const team1    = (tds[2]?.innerText || '').trim().split('\n')[0];
        const team2    = (tds[3]?.innerText || '').trim().split('\n')[0];
        const ergebnis = (tds[4]?.innerText || '').trim();
        const halle    = (tds[5]?.innerText || '').trim().split('\n')[0];
        // Nur zukünftige (kein echtes Ergebnis)
        if (!ergebnis || ergebnis.includes('–') || ergebnis === '') {
          result.push({
            datum, uhrzeit,
            team1: team1 || '', team2: team2 || '',
            heim: isHoerde(team1),
            halle: halle || ''
          });
        }
      }
    }
    return result.slice(0, 6);
  }, SEARCH_TERMS);

  // ── KADER ─────────────────────────────────────────────────────────
  let kader = [];
  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await dismissCookieBanner(page);

    const mannTab = await clickTabByText(page, ['mannschaft', 'team', 'verein']);
    if (mannTab) {
      await page.waitForTimeout(2000);
      await dismissCookieBanner(page);
    }

    // Finde Link der TV Hörde enthält UND zu teamDetails führt
    const teamLink = await page.evaluate((searchTerms) => {
      function isHoerde(text) {
        const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        return searchTerms.some(s => t.includes(s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
      }
      for (const a of document.querySelectorAll('a')) {
        const txt = a.innerText || a.title || '';
        const href = a.href || '';
        if (isHoerde(txt) && (href.includes('team') || href.includes('detail') || href.includes('popup'))) {
          return href;
        }
      }
      // Fallback: irgendein Link der Hörde enthält
      for (const a of document.querySelectorAll('a')) {
        if (isHoerde(a.innerText || '')) return a.href;
      }
      return null;
    }, SEARCH_TERMS);

    if (teamLink) {
      console.log(`      Kader-Link: ${teamLink.slice(0, 80)}`);
      const popupPage = await context.newPage();
      await popupPage.goto(teamLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await popupPage.waitForTimeout(1500);
      await dismissCookieBanner(popupPage);

      kader = await popupPage.evaluate(() => {
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
      await popupPage.close();
    }
  } catch(e) {
    console.log(`      ⚠ Kader-Fehler: ${e.message.split('\n')[0].slice(0,60)}`);
  }

  await page.close();
  return { league, rank: ownRow?.rank || null, rankTotal: tabelle.length, tabelle, spiele, kader };
}

async function scrapeAll() {
  console.log('🏐 TV Hörde WVV-Scraper v3 startet...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  await context.addCookies([{
    name: 'cookieConsent', value: 'true',
    domain: 'ergebnisdienst.volleyball.nrw', path: '/',
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
