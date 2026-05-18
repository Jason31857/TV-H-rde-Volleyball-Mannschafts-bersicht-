// TV Hörde – WVV Scraper v11 – hardcoded IDs, schnell
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://ergebnisdienst.volleyball.nrw';

// Alle matchSeriesIds sind hardcodiert – kein Suchen mehr nötig
// Format: { baseUrl, matchSeriesId, searchName }
const TEAMS = [
  // ── ERWACHSENE ────────────────────────────────────────────────────
  { id:'damen2',  name:'2. Damen',  searchName:'TV Hörde II',  baseUrl:`${BASE}/cms/home/erwachsene/verbandsligen/vl_frauen/verbandsliga_4_frauen.xhtml`,              msId:'95242231' },
  { id:'damen3',  name:'3. Damen',  searchName:'TV Hörde III', baseUrl:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_frauen/bezirksliga_9_frauen.xhtml`,      msId:'95240543' },
  { id:'damen4',  name:'4. Damen',  searchName:'TV Hörde',     baseUrl:`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`,                                 msId:'98622543' },
  { id:'herren2', name:'2. Herren', searchName:'TV Hörde II',  baseUrl:`${BASE}/cms/home/erwachsene/verbandsligen/vl_maenner/verbandsliga_3_maenner.xhtml`,            msId:'95242507' },
  { id:'herren3', name:'3. Herren', searchName:'TV Hörde III', baseUrl:`${BASE}/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_6_maenner.xhtml`,       msId:'95238341' },
  { id:'herren4', name:'4. Herren', searchName:'TV Hörde IV',  baseUrl:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml`,   msId:'95240622' },
  // Herren 5 spielt in der Stadtliga Dortmund (nicht im WVV-Ergebnisdienst)
  { id:'herren5', name:'5. Herren', searchName:'TV Hörde V',   baseUrl:null, msId:null },
  // ── WEIBLICHE JUGEND ──────────────────────────────────────────────
  { id:'u20w', name:'U20 Damen', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u20/u20_weiblich/nrw_liga.xhtml`,        msId:null },
  { id:'u18w', name:'U18 Damen', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u18/u18_weiblich/nrw_liga.xhtml`,        msId:null },
  { id:'u16w', name:'U16 Damen', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u16/u16_weiblich/nrw_liga.xhtml`,        msId:null },
  { id:'u14w', name:'U14 Damen', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u14/nrw_ligen/wu14_NRW.xhtml`,           msId:'95251152' },
  { id:'u13w', name:'U13 Damen', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u13/u13_weiblich.xhtml`,                 msId:null },
  { id:'u12w', name:'U12 Damen', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u12/u12_weiblich.xhtml`,                 msId:null },
  // ── MÄNNLICHE JUGEND ──────────────────────────────────────────────
  { id:'u20m', name:'U20 Herren', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u20/u20_maennlich/nrw_liga.xhtml`,      msId:'95251447' },
  { id:'u18m', name:'U18 Herren', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u18/u18_maennlich/nrw_liga.xhtml`,      msId:'95250679' },
  { id:'u16m', name:'U16 Herren', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u16/u16_maennlich/nrw_liga.xhtml`,      msId:null },
  { id:'u14m', name:'U14 Herren', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u14/nrw_ligen/mu14_NRW.xhtml`,          msId:'95251152' },
  { id:'u13m', name:'U13 Herren', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u13/u13_maennlich.xhtml`,               msId:null },
  { id:'u12m', name:'U12 Herren', searchName:'TV Hörde', baseUrl:`${BASE}/cms/home/jugend/u12/u12_maennlich.xhtml`,               msId:null },
];

function norm(s) {
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}

async function dismissCookieBanner(page) {
  try {
    await page.waitForSelector('.sams-cookie-modal',{timeout:3000});
    await page.evaluate(()=>{
      document.querySelectorAll('.sams-cookie-modal,.sams-cookie-modal-overlay').forEach(el=>el.remove());
      document.body.style.overflow='auto';document.body.style.pointerEvents='auto';
    });
  } catch(e){}
}

async function getTable(page, searchNorm) {
  return page.evaluate((sn)=>{
    function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
    for(const table of document.querySelectorAll('table')){
      const txt=table.innerText||'';
      if(!txt.includes('Mannschaft')&&!txt.includes('Team')&&!txt.includes('Platz'))continue;
      const rows=[];let rank=0;
      for(const tr of table.querySelectorAll('tbody tr,tr')){
        const tds=tr.querySelectorAll('td');
        if(tds.length<3)continue;
        rank++;
        const name=(tds[1]?.innerText||tds[0]?.innerText||'').split('\n')[0].replace(/\s+/g,' ').trim();
        if(!name||name.length<2)continue;
        rows.push({rank,name,sp:(tds[2]?.innerText||'').trim(),s:(tds[3]?.innerText||'').trim(),pkt:(tds[tds.length-1]?.innerText||'').trim(),current:n(name).includes(sn)});
      }
      if(rows.length>2)return rows;
    }
    return[];
  },searchNorm);
}

async function getMsId(page) {
  return page.evaluate(()=>{
    for(const a of document.querySelectorAll('a')){
      const m=(a.href||'').match(/matchSeriesId=(\d+)/);
      if(m)return m[1];
    }
    return null;
  });
}

async function scrapeTeam(context, team) {
  // Kein baseUrl = keine Daten im WVV (z.B. Herren 5 Stadtliga)
  if(!team.baseUrl) return {league:'',rank:null,rankTotal:null,tabelle:[],spiele:[],kader:[]};

  const sn = norm(team.searchName);
  const page = await context.newPage();

  // Direkt zur Tabelle navigieren
  let msId = team.msId;
  const tableUrl = msId
    ? `${team.baseUrl}?LeaguePresenter.view=resultTable&LeaguePresenter.matchSeriesId=${msId}`
    : team.baseUrl;

  await page.goto(tableUrl,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(1500);
  await dismissCookieBanner(page);

  const league = await page.evaluate(()=>(document.querySelector('h1,h2')?.innerText||'').trim());

  // matchSeriesId aus Seite lesen falls nicht hardcodiert
  if(!msId) msId = await getMsId(page);

  const tabelle = await getTable(page, sn);
  const ownRow = tabelle.find(r=>r.current);

  if(ownRow) console.log(`      ✓ Platz ${ownRow.rank}/${tabelle.length}`);
  else if(tabelle.length>0) console.log(`      ⚠ Nicht in Tabelle. Teams: ${tabelle.slice(0,3).map(r=>r.name).join(', ')}`);
  else console.log(`      ⚠ Keine Tabelle gefunden`);

  // ── SPIELPLAN ─────────────────────────────────────────────────────
  let spiele = [];
  if(msId){
    await page.goto(`${team.baseUrl}?LeaguePresenter.view=matches&LeaguePresenter.matchSeriesId=${msId}`,{waitUntil:'domcontentloaded',timeout:15000});
    await page.waitForTimeout(1000);
    await dismissCookieBanner(page);
    spiele = await page.evaluate((sn)=>{
      function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
      const result=[];
      for(const table of document.querySelectorAll('table')){
        for(const tr of table.querySelectorAll('tbody tr,tr')){
          if(!n(tr.innerText).includes(sn))continue;
          const tds=tr.querySelectorAll('td');
          if(tds.length<4)continue;
          const datum=(tds[0]?.innerText||'').trim();
          const t1=(tds[2]?.innerText||'').trim().split('\n')[0];
          const t2=(tds[3]?.innerText||'').trim().split('\n')[0];
          const erg=(tds[4]?.innerText||'').trim();
          const halle=(tds[5]?.innerText||'').trim().split('\n')[0];
          if(!erg||erg.includes('–')||erg==='')
            result.push({datum,team1:t1,team2:t2,heim:n(t1).includes(sn),halle});
        }
      }
      return result.slice(0,6);
    },sn);
  }

  // ── KADER ─────────────────────────────────────────────────────────
  let kader = [];
  if(msId){
    try{
      await page.goto(`${team.baseUrl}?LeaguePresenter.view=teamOverview&LeaguePresenter.matchSeriesId=${msId}`,{waitUntil:'networkidle',timeout:20000});
      await page.waitForTimeout(2000);
      await dismissCookieBanner(page);
      await page.waitForSelector('a[href*="teamDetails"]',{timeout:5000}).catch(()=>{});

      const teamLink = await page.evaluate((sn)=>{
        function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
        const all=Array.from(document.querySelectorAll('a[href*="teamDetails"]'));
        for(const a of all) if(n(a.innerText||'').includes(sn)) return a.href;
        return all.length===1 ? all[0].href : null;
      },sn);

      if(teamLink){
        const popup=await context.newPage();
        await popup.goto(teamLink,{waitUntil:'domcontentloaded',timeout:12000});
        await popup.waitForTimeout(1000);
        await dismissCookieBanner(popup);
        kader=await popup.evaluate(()=>{
          for(const table of document.querySelectorAll('table')){
            const rows=[];
            for(const tr of table.querySelectorAll('tr')){
              const tds=tr.querySelectorAll('td');
              if(tds.length<2)continue;
              const col0=(tds[0]?.innerText||'').trim();
              const col1=(tds[1]?.innerText||'').trim().split('\n')[0];
              const col2=(tds[2]?.innerText||'').trim();
              if(/^\d{2}\.\d{2}/.test(col0))continue;
              if(!col1||col1.length<2)continue;
              if(/^(name|spieler|pos|nr|#|trikot)/i.test(col1))continue;
              if(/volleyball|verband|mannschaftsdetail|impressum|westdeutsch/i.test(col1))continue;
              rows.push({nr:col0||'–',name:col1,pos:col2||'–'});
            }
            if(rows.length>=2&&!rows.some(r=>/^\d{2}\.\d{2}/.test(r.name)))return rows;
          }
          return[];
        });
        console.log(`      Kader: ${kader.length}`);
        await popup.close();
      } else {
        console.log(`      Keine teamDetails-Links`);
      }
    }catch(e){
      console.log(`      ⚠ Kader: ${e.message.split('\n')[0].slice(0,40)}`);
    }
  }

  await page.close();
  return{league,rank:ownRow?.rank||null,rankTotal:tabelle.length,tabelle,spiele,kader};
}

async function scrapeAll(){
  console.log('🏐 TV Hörde WVV-Scraper v11 startet...\n');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  await context.addCookies([{name:'cookieConsent',value:'true',domain:'ergebnisdienst.volleyball.nrw',path:'/'}]);

  const results={};
  for(const team of TEAMS){
    console.log(`📋 ${team.name}...`);
    try{
      results[team.id]=await scrapeTeam(context,team);
      const d=results[team.id];
      console.log(`   ✅ "${d.league}" | Platz ${d.rank}/${d.rankTotal} | Spiele: ${d.spiele.length} | Kader: ${d.kader.length}`);
    }catch(e){
      console.log(`   ❌ ${e.message.split('\n')[0]}`);
      results[team.id]={league:'',rank:null,rankTotal:null,tabelle:[],spiele:[],kader:[]};
    }
    await new Promise(r=>setTimeout(r,1000));
  }

  await browser.close();
  fs.writeFileSync('tvhoerde-data.json',JSON.stringify(results,null,2),'utf8');
  console.log('\n✅ Fertig!');
}

scrapeAll().catch(err=>{console.error(err);process.exit(1);});
