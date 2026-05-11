// TV Hörde – WVV Scraper v8
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://ergebnisdienst.volleyball.nrw';

const TEAMS = [
  // ── ERWACHSENE ────────────────────────────────────────────────────
  { id:'damen2',  name:'2. Damen',  searchName:'TV Hörde II',  url:`${BASE}/cms/home/erwachsene/verbandsligen/vl_frauen/verbandsliga_4_frauen.xhtml` },
  { id:'damen3',  name:'3. Damen',  searchName:'TV Hörde III', url:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_frauen/bezirksliga_9_frauen.xhtml` },
  { id:'damen4',  name:'4. Damen',  searchName:'TV Hörde',     url:`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`, searchAll:true, gender:'frauen' },
  { id:'herren2', name:'2. Herren', searchName:'TV Hörde II',  url:`${BASE}/cms/home/erwachsene/verbandsligen/vl_maenner/verbandsliga_3_maenner.xhtml` },
  { id:'herren3', name:'3. Herren', searchName:'TV Hörde III', url:`${BASE}/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_6_maenner.xhtml` },
  { id:'herren4', name:'4. Herren', searchName:'TV Hörde IV',  url:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml` },
  { id:'herren5', name:'5. Herren', searchName:'TV Hörde V',   url:`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`, searchAll:true, gender:'maenner' },
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

// Zusätzliche Jugend-URLs (Oberligen, Bezirksligen, Kreisligen)
const JUGEND_FALLBACK_URLS = {
  u16w: [`${BASE}/cms/home/jugend/u16/u16_midi.xhtml`],
  u14w: [`${BASE}/cms/home/jugend/u14/nrw_ligen.xhtml`, `${BASE}/cms/home/jugend/u14/u14_mixed.xhtml`],
  u13w: [`${BASE}/cms/home/jugend/u13/u13_mixed.xhtml`],
  u12w: [`${BASE}/cms/home/jugend/u12/u12_mixed.xhtml`],
  u14m: [`${BASE}/cms/home/jugend/u14/nrw_ligen.xhtml`, `${BASE}/cms/home/jugend/u14/u14_mixed.xhtml`],
  u13m: [`${BASE}/cms/home/jugend/u13/u13_mixed.xhtml`],
  u12m: [`${BASE}/cms/home/jugend/u12/u12_mixed.xhtml`],
};

function norm(s) {
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}

function isMatch(name, searchNorm) {
  return norm(name).includes(searchNorm);
}

async function dismissCookieBanner(page) {
  try {
    await page.waitForSelector('.sams-cookie-modal', { timeout: 3000 });
    await page.evaluate(() => {
      document.querySelectorAll('.sams-cookie-modal,.sams-cookie-modal-overlay').forEach(el=>el.remove());
      document.body.style.overflow='auto';
      document.body.style.pointerEvents='auto';
    });
    await page.waitForTimeout(300);
  } catch(e) {}
}

async function getTableFromPage(page, searchNorm) {
  return page.evaluate((searchNorm) => {
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
        rows.push({rank,name,sp:(tds[2]?.innerText||'').trim(),s:(tds[3]?.innerText||'').trim(),pkt:(tds[tds.length-1]?.innerText||'').trim(),current:n(name).includes(searchNorm)});
      }
      if(rows.length>2)return rows;
    }
    return[];
  }, searchNorm);
}

async function getAllStaffelnFromPage(page) {
  return page.evaluate(() => {
    const result=[];
    document.querySelectorAll('a[href*="matchSeriesId"]').forEach(a=>{
      const m=(a.href||'').match(/matchSeriesId=(\d+)/);
      if(m&&(a.href||'').includes('view=resultTable')){
        result.push({id:m[1],text:(a.innerText||'').trim()});
      }
    });
    return [...new Map(result.map(r=>[r.id,r])).values()];
  });
}

async function searchAllStaffeln(page, context, baseUrl, searchNorm, staffeln) {
  for(const staffel of staffeln){
    const url=`${baseUrl}?LeaguePresenter.view=resultTable&LeaguePresenter.matchSeriesId=${staffel.id}`;
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(1000);
    await dismissCookieBanner(page);
    const rows=await getTableFromPage(page,searchNorm);
    if(rows.some(r=>r.current)){
      console.log(`      ✓ TV Hörde in "${staffel.text}" (ID:${staffel.id})`);
      return{rows,matchSeriesId:staffel.id};
    }
  }
  return null;
}

async function getKader(context, page, baseUrl, matchSeriesId, searchNorm) {
  try{
    const mannUrl=`${baseUrl}?LeaguePresenter.view=teamOverview&LeaguePresenter.matchSeriesId=${matchSeriesId}`;
    await page.goto(mannUrl,{waitUntil:'networkidle',timeout:25000});
    await page.waitForTimeout(2000);
    await dismissCookieBanner(page);
    await page.waitForSelector('a[href*="teamDetails"]',{timeout:6000}).catch(()=>{});

    const teamLink=await page.evaluate((searchNorm)=>{
      function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
      for(const a of document.querySelectorAll('a[href*="teamDetails"]')){
        if(n(a.innerText).includes(searchNorm))return a.href;
      }
      const all=Array.from(document.querySelectorAll('a[href*="teamDetails"]'));
      return all.length?{links:all.map(a=>({text:(a.innerText||'').trim().slice(0,30),href:a.href}))}:null;
    },searchNorm);

    if(typeof teamLink==='string'){
      const popup=await context.newPage();
      await popup.goto(teamLink,{waitUntil:'domcontentloaded',timeout:15000});
      await popup.waitForTimeout(1500);
      await dismissCookieBanner(popup);

      const kader=await popup.evaluate(()=>{
        const players=[];
        // Suche die Spieler-Tabelle (hat Spalten #/Nr, Name, Position)
        for(const table of document.querySelectorAll('table')){
          const txt=table.innerText||'';
          // Kader-Tabelle hat "Name" in Header, NICHT "Datum"
          if(txt.includes('Datum')||txt.includes('Sa,')||txt.includes('So,'))continue;
          const rows=[];
          for(const tr of table.querySelectorAll('tr')){
            const tds=tr.querySelectorAll('td');
            if(tds.length<2)continue;
            const nr=(tds[0]?.innerText||'').trim();
            const name=(tds[1]?.innerText||'').trim().split('\n')[0].trim();
            const pos=(tds[2]?.innerText||'').trim();
            if(!name||name.length<2)continue;
            if(/^(name|spieler|pos|nr|#|trikot)/i.test(name))continue;
            if(/volleyball|verband|mannschaftsdetail|impressum|datenschutz|westdeutsch/i.test(name))continue;
            if(/^\d{2}\.\d{2}\.\d{2}/.test(nr))continue; // Datum in erster Spalte = Spiel, kein Spieler
            rows.push({nr:nr||'–',name,pos:pos||'–'});
          }
          if(rows.length>0)return rows;
        }
        return[];
      });
      console.log(`      Kader: ${kader.length} Spieler`);
      await popup.close();
      return kader;
    } else if(teamLink?.links){
      console.log(`      Verfügbare Teams: ${teamLink.links.map(l=>l.text).join(', ')}`);
    } else {
      console.log(`      Keine teamDetails-Links gefunden`);
    }
  }catch(e){
    console.log(`      ⚠ Kader: ${e.message.split('\n')[0].slice(0,60)}`);
  }
  return[];
}

async function scrapeTeam(context, team){
  const searchNorm=norm(team.searchName);
  const page=await context.newPage();

  // ── TABELLE ───────────────────────────────────────────────────────
  await page.goto(team.url,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);

  const league=await page.evaluate(()=>(document.querySelector('h1,h2')?.innerText||'').trim());
  let tabelle=[];
  let correctMatchSeriesId=null;

  if(team.searchAll){
    // Kreisligen: alle Staffeln durchsuchen, gefiltert nach Geschlecht
    const allStaffeln=await getAllStaffelnFromPage(page);
    // Filtere nach Geschlecht um falsche Ligen zu vermeiden
    const gefiltert=allStaffeln.filter(s=>{
      const t=norm(s.text);
      if(team.gender==='maenner') return !t.includes('frauen')&&!t.includes('weiblich')&&!t.includes('damen');
      if(team.gender==='frauen')  return !t.includes('manner')&&!t.includes('mannlich')&&!t.includes('herren')&&!t.includes('jungen');
      return true;
    });
    console.log(`      Kreisligen: ${allStaffeln.length} gesamt, ${gefiltert.length} nach Geschlechtsfilter`);
    const found=await searchAllStaffeln(page,context,team.url.split('?')[0],searchNorm,gefiltert);
    if(found){tabelle=found.rows;correctMatchSeriesId=found.matchSeriesId;}
    else console.log(`      ⚠ TV Hörde nicht gefunden`);

  } else {
    // Normal: direkt oder alle Staffeln auf der Seite
    const allStaffeln=await getAllStaffelnFromPage(page);
    if(allStaffeln.length>0){
      console.log(`      Staffeln: ${allStaffeln.length}`);
      const found=await searchAllStaffeln(page,context,team.url.split('?')[0],searchNorm,allStaffeln);
      if(found){tabelle=found.rows;correctMatchSeriesId=found.matchSeriesId;}
      else{
        // Fallback-URLs für Jugend
        const fallbacks=JUGEND_FALLBACK_URLS[team.id]||[];
        for(const fbUrl of fallbacks){
          await page.goto(fbUrl,{waitUntil:'domcontentloaded',timeout:20000});
          await page.waitForTimeout(2000);
          await dismissCookieBanner(page);
          const fbStaffeln=await getAllStaffelnFromPage(page);
          console.log(`      Fallback ${fbUrl.split('/').pop()}: ${fbStaffeln.length} Staffeln`);
          const fbFound=await searchAllStaffeln(page,context,fbUrl.split('?')[0],searchNorm,fbStaffeln);
          if(fbFound){tabelle=fbFound.rows;correctMatchSeriesId=fbFound.matchSeriesId;break;}
        }
        if(!tabelle.length) console.log(`      ⚠ TV Hörde nicht gefunden`);
      }
    } else {
      tabelle=await getTableFromPage(page,searchNorm);
      const m=await page.evaluate(()=>{
        for(const a of document.querySelectorAll('a')){
          const match=(a.href||'').match(/matchSeriesId=(\d+)/);
          if(match)return match[1];
        }return null;
      });
      correctMatchSeriesId=m;
      const ownRow=tabelle.find(r=>r.current);
      if(ownRow) console.log(`      ✓ "${ownRow.name}" → Platz ${ownRow.rank}/${tabelle.length}`);
      else console.log(`      ⚠ Nicht gefunden! Teams: ${tabelle.slice(0,3).map(r=>r.name).join(', ')}`);
    }
  }

  const ownRow=tabelle.find(r=>r.current);

  // ── SPIELPLAN ─────────────────────────────────────────────────────
  let spiele=[];
  if(correctMatchSeriesId){
    const baseUrl=team.url.split('?')[0];
    await page.goto(`${baseUrl}?LeaguePresenter.view=matches&LeaguePresenter.matchSeriesId=${correctMatchSeriesId}`,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(1500);
    await dismissCookieBanner(page);
    spiele=await page.evaluate((searchNorm)=>{
      function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
      const result=[];
      for(const table of document.querySelectorAll('table')){
        for(const tr of table.querySelectorAll('tbody tr,tr')){
          if(!n(tr.innerText).includes(searchNorm))continue;
          const tds=tr.querySelectorAll('td');
          if(tds.length<4)continue;
          const datum=(tds[0]?.innerText||'').trim();
          const team1=(tds[2]?.innerText||'').trim().split('\n')[0];
          const team2=(tds[3]?.innerText||'').trim().split('\n')[0];
          const ergebnis=(tds[4]?.innerText||'').trim();
          const halle=(tds[5]?.innerText||'').trim().split('\n')[0];
          if(!ergebnis||ergebnis.includes('–')||ergebnis===''){
            result.push({datum,team1,team2,heim:n(team1).includes(searchNorm),halle});
          }
        }
      }
      return result.slice(0,6);
    },searchNorm);
  }

  // ── KADER ─────────────────────────────────────────────────────────
  let kader=[];
  if(correctMatchSeriesId){
    kader=await getKader(context,page,team.url.split('?')[0],correctMatchSeriesId,searchNorm);
  }

  await page.close();
  return{league,rank:ownRow?.rank||null,rankTotal:tabelle.length,tabelle,spiele,kader};
}

async function scrapeAll(){
  console.log('🏐 TV Hörde WVV-Scraper v8 startet...\n');
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
    await new Promise(r=>setTimeout(r,2000));
  }

  await browser.close();
  fs.writeFileSync('tvhoerde-data.json',JSON.stringify(results,null,2),'utf8');
  console.log('\n✅ Fertig! tvhoerde-data.json gespeichert.');
}

scrapeAll().catch(err=>{console.error(err);process.exit(1);});
