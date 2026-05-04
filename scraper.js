// TV Hörde – WVV Scraper
// Startet mit: node scraper.js
// Ergebnis wird gespeichert in: tvhoerde-data.json

const { chromium } = require('playwright');
const fs = require('fs');

// ── KONFIGURATION ─────────────────────────────────────────────────────
const TEAMS = [
  {
    id: 'damen2',
    name: '2. Damen',
    age: 'Frauen',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/oberligen/Ol_frauen/oberliga_2_frauen.xhtml',
    searchName: 'Hörde',
  },
  {
    id: 'damen3',
    name: '3. Damen',
    age: 'Frauen',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/landesligen/landesligen_frauen/landesliga_6_frauen.xhtml',
    searchName: 'Hörde',
  },
  {
    id: 'damen4',
    name: '4. Damen',
    age: 'Frauen',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/bezirksklassen/bezirksklassen_frauen/bezirksklasse_21_frauen.xhtml',
    searchName: 'Hörde',
  },
  {
    id: 'herren2',
    name: '2. Herren',
    age: 'Männer',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/oberligen/OL_maenner/oberliga_2_maenner.xhtml',
    searchName: 'Hörde',
  },
  {
    id: 'herren3',
    name: '3. Herren',
    age: 'Männer',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_5_maenner.xhtml',
    searchName: 'Hörde',
  },
  {
    id: 'herren4',
    name: '4. Herren',
    age: 'Männer',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml',
    searchName: 'Hörde',
  },
  {
    id: 'herren5',
    name: '5. Herren',
    age: 'Männer',
    url: 'https://ergebnisdienst.volleyball.nrw/cms/home/erwachsene/bezirksklassen/bezirksklassen_maenner/bezirksklasse_18_maenner.xhtml',
    searchName: 'Hörde',
  },
];

// ── HAUPT-FUNKTION ────────────────────────────────────────────────────
async function scrapeAll() {
  console.log('🏐 TV Hörde WVV-Scraper startet...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });

  const results = {};

  for (const team of TEAMS) {
    console.log(`📋 Lade ${team.name} (${team.age})...`);
    try {
      const data = await scrapeTeam(context, team);
      results[team.id] = data;
      console.log(`   ✅ Liga: "${data.league}" | Platz: ${data.rank}/${data.rankTotal} | Spiele: ${data.spiele.length} | Kader: ${data.kader.length}`);
    } catch (e) {
      console.log(`   ❌ Fehler bei ${team.name}: ${e.message}`);
      results[team.id] = { league: '', rank: null, rankTotal: null, tabelle: [], spiele: [], kader: [] };
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  fs.writeFileSync('tvhoerde-data.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\n✅ Fertig! Gespeichert in tvhoerde-data.json');
  console.log('   → Datei in denselben Ordner wie tvhoerde.html legen');
}

// ── TEAM SCRAPEN ──────────────────────────────────────────────────────
async function scrapeTeam(context, team) {
  const page = await context.newPage();
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  // ── LIGA-NAME ─────────────────────────────────────────────────────
  const league = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? h1.innerText.trim() : '';
  });

  // ── TABELLE ───────────────────────────────────────────────────────
  const tabelle = await page.evaluate((searchName) => {
    const rows = [];
    const allTables = document.querySelectorAll('table');
    let mainTable = null;
    for (const t of allTables) {
      const txt = t.innerText || '';
      if (txt.includes('Mannschaft') && txt.includes('Punkte') && txt.includes('Siege')) {
        mainTable = t;
        break;
      }
    }
    if (!mainTable) return rows;

    const trs = mainTable.querySelectorAll('tbody tr');
    let rank = 0;
    for (const tr of trs) {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 4) continue;
      rank++;
      // Manche Zeilen haben Rang in td[0]
      const rankTd = (tds[0]?.innerText || '').trim();
      const actualRank = parseInt(rankTd) || rank;
      // Name – manchmal doppelt, nehme ersten Teil
      const rawName = (tds[1]?.innerText || '').trim();
      const name = rawName.split('\n')[0].replace(/\s+/g, ' ').trim();
      const sp  = (tds[2]?.innerText || '').trim();
      const s   = (tds[3]?.innerText || '').trim();
      const saetze = (tds[4]?.innerText || '').trim();
      const pkt = (tds[tds.length - 1]?.innerText || '').trim();
      const isCurrent = name.toLowerCase().includes(searchName.toLowerCase());
      if (name) rows.push({ rank: actualRank, name, sp, s, saetze, pkt, current: isCurrent });
    }
    return rows;
  }, team.searchName);

  const ownRow = tabelle.find(r => r.current);
  const rank = ownRow ? ownRow.rank : null;
  const rankTotal = tabelle.length;

  // ── SPIELPLAN ─────────────────────────────────────────────────────
  // Klicke auf "Spiele"-Tab
  const spieleTab = await page.$('a[href*="view=matches"]');
  if (spieleTab) {
    await spieleTab.click();
    await page.waitForTimeout(2000);
  }

  const spiele = await page.evaluate((searchName) => {
    const result = [];
    const allTables = document.querySelectorAll('table');
    for (const t of allTables) {
      const txt = t.innerText || '';
      if (!txt.includes('Datum') && !txt.includes('Team 1')) continue;
      const rows = t.querySelectorAll('tbody tr');
      for (const row of rows) {
        const rowText = row.innerText || '';
        if (!rowText.toLowerCase().includes(searchName.toLowerCase())) continue;
        const tds = row.querySelectorAll('td');
        if (tds.length < 4) continue;
        const datum   = (tds[0]?.innerText || '').trim();
        const team1   = (tds[2]?.innerText || tds[1]?.innerText || '').trim().split('\n')[0].trim();
        const team2   = (tds[3]?.innerText || tds[2]?.innerText || '').trim().split('\n')[0].trim();
        const ergebnis = (tds[4]?.innerText || '').trim();
        // Nur noch nicht gespielte Spiele
        if (!ergebnis || ergebnis === '–' || ergebnis === '' || ergebnis.includes('–')) {
          const isHeim = team1.toLowerCase().includes(searchName.toLowerCase());
          // Halle aus letzter Spalte
          const halle = (tds[tds.length - 2]?.innerText || '').trim().split('\n')[0];
          result.push({ datum, team1, team2, heim: isHeim, halle });
        }
      }
    }
    return result.slice(0, 6);
  }, team.searchName);

  // ── KADER ─────────────────────────────────────────────────────────
  let kader = [];
  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);

    // Klicke auf "Mannschaften"-Tab
    const mannTab = await page.$('a[href*="view=teamOverview"]');
    if (mannTab) {
      await mannTab.click();
      await page.waitForTimeout(2000);

      // Finde den Link für TV Hörde
      const teamLink = await page.evaluate((searchName) => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const a of links) {
          if ((a.innerText || '').toLowerCase().includes(searchName.toLowerCase()) && a.href.includes('teamDetails')) {
            return a.href;
          }
        }
        return null;
      }, team.searchName);

      if (teamLink) {
        // Popup als neue Seite öffnen
        const popupPage = await context.newPage();
        await popupPage.goto(teamLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await popupPage.waitForTimeout(1500);

        kader = await popupPage.evaluate(() => {
          const players = [];
          const rows = document.querySelectorAll('table tr');
          for (const row of rows) {
            const tds = row.querySelectorAll('td');
            if (tds.length < 2) continue;
            const nr   = (tds[0]?.innerText || '').trim();
            const name = (tds[1]?.innerText || '').trim();
            const pos  = (tds[2]?.innerText || '').trim();
            // Filtere Kopfzeilen und leere Zeilen
            if (name && name.length > 2 && !/^(name|spieler|position|nr|#)/i.test(name)) {
              players.push({ nr: nr || '–', name, pos: pos || '–' });
            }
          }
          return players;
        });

        await popupPage.close();
        console.log(`      Kader geladen: ${kader.length} Spieler`);
      } else {
        console.log(`      Kein Team-Link für "${team.searchName}" gefunden`);
      }
    }
  } catch (e) {
    console.log(`      Kader nicht verfügbar: ${e.message.slice(0, 60)}`);
  }

  await page.close();
  return { league, rank, rankTotal, tabelle, spiele, kader };
}

// ── START ─────────────────────────────────────────────────────────────
scrapeAll().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
