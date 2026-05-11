// TV Hörde – WVV Scraper v9
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://ergebnisdienst.volleyball.nrw';

// Direkte matchSeriesIds – aus dem WVV-Ergebnisdienst
// Diese IDs sind stabil und ändern sich nur saisonweise
const TEAMS = [
  // ── ERWACHSENE ────────────────────────────────────────────────────
  { id:'damen2',  name:'2. Damen',  searchName:'TV Hörde II',  url:`${BASE}/cms/home/erwachsene/verbandsligen/vl_frauen/verbandsliga_4_frauen.xhtml` },
  { id:'damen3',  name:'3. Damen',  searchName:'TV Hörde III', url:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_frauen/bezirksliga_9_frauen.xhtml` },
  { id:'damen4',  name:'4. Damen',  searchName:'TV Hörde',     url:`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`, searchAll:true, gender:'frauen' },
  { id:'herren2', name:'2. Herren', searchName:'TV Hörde II',  url:`${BASE}/cms/home/erwachsene/verbandsligen/vl_maenner/verbandsliga_3_maenner.xhtml` },
  { id:'herren3', name:'3. Herren', searchName:'TV Hörde III', url:`${BASE}/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_6_maenner.xhtml` },
  { id:'herren4', name:'4. Herren', searchName:'TV Hörde IV',  url:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml` },
  { id:'herren5', name:'5. Herren', searchName:'TV Hörde V',   url:`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`, searchAll:true, gender:'maenner' },
  // ── WEIBLICHE JUGEND ─ jede Altersklasse hat mehrere Ligen ────────
  { id:'u20w', name:'U20 Damen',  searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u20/u20_weiblich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u20/u20_weiblich.xhtml`,
  ]},
  { id:'u18w', name:'U18 Damen',  searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u18/u18_weiblich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u18/u18_weiblich.xhtml`,
  ]},
  { id:'u16w', name:'U16 Damen',  searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u16/u16_weiblich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u16/u16_weiblich.xhtml`,
    `${BASE}/cms/home/jugend/u16/u16_midi.xhtml`,
  ]},
  { id:'u14w', name:'U14 Damen',  searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u14/nrw_ligen.xhtml`,
    `${BASE}/cms/home/jugend/u14/u14_weiblich.xhtml`,
  ]},
  { id:'u13w', name:'U13 Damen',  searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u13/u13_weiblich.xhtml`,
    `${BASE}/cms/home/jugend/u13/u13_mixed.xhtml`,
  ]},
  { id:'u12w', name:'U12 Damen',  searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u12/u12_weiblich.xhtml`,
    `${BASE}/cms/home/jugend/u12/u12_mixed.xhtml`,
  ]},
  // ── MÄNNLICHE JUGEND ──────────────────────────────────────────────
  { id:'u20m', name:'U20 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u20/u20_maennlich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u20/u20_maennlich.xhtml`,
  ]},
  { id:'u18m', name:'U18 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u18/u18_maennlich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u18/u18_maennlich.xhtml`,
  ]},
  { id:'u16m', name:'U16 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u16/u16_maennlich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u16/u16_maennlich.xhtml`,
  ]},
  { id:'u14m', name:'U14 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u14/nrw_ligen.xhtml`,
    `${BASE}/cms/home/jugend/u14/u14_maennlich.xhtml`,
  ]},
  { id:'u13m', name:'U13 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u13/u13_maennlich.xhtml`,
    `${BASE}/cms/home/jugend/u13/u13_mixed.xhtml`,
  ]},
  { id:'u12m', name:'U12 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u12/u12_maennlich.xhtml`,
    `${BASE}/cms/home/jugend/u12/u12_mixed.xhtml`,
  ]},
];

function norm(s) {
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}

async function dismissCookieBanner(page) {
  try {
    await page.waitForSelector('.sams-cookie-modal',{timeout:3000});
    await page.evaluate(()=>{
      document.querySelectorAll('.sams-cookie-modal,.sams-cookie-modal-overlay').forEach(el=>el.remove());
      document.body.style.overflow='auto';
      document.body.style.pointerEvents='auto';
    });
    await page.waitForTimeout(300);
  } catch(e) {}
}

async function getTableFromPage(page, searchNorm) {
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

async function getAllMatchSeriesIds(page) {
  return page.evaluate(()=>{
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

// Suche TV Hörde in allen Staffeln einer Seite
async function findTeamInStaffeln(page, baseUrl, searchNorm, staffeln, gender) {
  for(const staffel of staffeln){
    // Geschlechtsfilter
    if(gender){
      const t=norm(staffel.text);
      if(gender==='maenner'&&(t.includes('frauen')||t.includes('weiblich')||t.includes('damen')))continue;
      if(gender==='frauen'&&(t.includes('manner')||t.includes('mannlich')||t.includes('herren')||t.includes('jungen')))continue;
    }
    const url=`${baseUrl}?LeaguePresenter.view=resultTable&LeaguePresenter.matchSeriesId=${staffel.id}`;
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(800);
    await dismissCookieBanner(page);
    const rows=await getTableFromPage(page,searchNorm);
    if(rows.some(r=>r.current)){
      console.log(`      ✓ Gefunden in "${staffel.text}" (ID:${staffel.id})`);
      return{rows,matchSeriesId:staffel.id,foundUrl:url};
    }
  }
  return null;
}

async function getKaderFromPopup(context, teamLink) {
  const popup=await context.newPage();
  await popup.goto(teamLink,{waitUntil:'domcontentloaded',timeout:15000});
  await popup.waitForTimeout(1500);
  try{
    await popup.waitForSelector('.sams-cookie-modal',{timeout:2000});
    await popup.evaluate(()=>{
      document.querySelectorAll('.sams-cookie-modal,.sams-cookie-modal-overlay').forEach(el=>el.remove());
      document.body.style.overflow='auto';
    });
  }catch(e){}

  const kader=await popup.evaluate(()=>{
    const players=[];
    // Finde die richtige Tabelle: hat keine Datumsspalten
    for(const table of document.querySelectorAll('table')){
      const rows=[];
      for(const tr of table.querySelectorAll('tr')){
        const tds=tr.querySelectorAll('td');
        if(tds.length<2)continue;
        const col0=(tds[0]?.innerText||'').trim();
        const col1=(tds[1]?.innerText||'').trim().split('\n')[0];
        const col2=(tds[2]?.innerText||'').trim();
        // Überspringe Zeilen mit Datum in Spalte 0
        if(/^\d{2}\.\d{2}/.test(col0))continue;
        // Überspringe Header und WVV-Texte
        if(!col1||col1.length<2)continue;
        if(/^(name|spieler|pos|nr|#|trikot)/i.test(col1))continue;
        if(/volleyball|verband|mannschaftsdetail|impressum|westdeutsch/i.test(col1))continue;
        // Gültige Zeile
        rows.push({nr:col0||'–',name:col1,pos:col2||'–'});
      }
      // Nur wenn plausible Spielerdaten (mindestens 3 Einträge, keine Datumswerte)
      if(rows.length>=3&&!rows.some(r=>/^\d{2}\.\d{2}/.test(r.name))){
        return rows;
      }
    }
    return[];
  });
  await popup.close();
  return kader;
}

async function scrapeTeam(context, team) {
  const searchNorm=norm(team.searchName);
  const page=await context.newPage();
  let tabelle=[], correctMatchSeriesId=null, foundBaseUrl=null, league='';

  if(team.searchAll){
    // Kreisligen: alle durchsuchen mit Geschlechtsfilter
    await page.goto(team.url,{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForTimeout(2000);
    await dismissCookieBanner(page);
    const staffeln=await getAllMatchSeriesIds(page);
    console.log(`      Kreisligen: ${staffeln.length} Staffeln`);
    const found=await findTeamInStaffeln(page,team.url.split('?')[0],searchNorm,staffeln,team.gender);
    if(found){tabelle=found.rows;correctMatchSeriesId=found.matchSeriesId;foundBaseUrl=team.url.split('?')[0];}
    else console.log(`      ⚠ TV Hörde nicht gefunden`);
    league=await page.evaluate(()=>(document.querySelector('h1,h2')?.innerText||'').trim());

  } else if(team.urls) {
    // Jugend: mehrere URLs ausprobieren
    for(const url of team.urls){
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
      await page.waitForTimeout(2000);
      await dismissCookieBanner(page);
      const staffeln=await getAllMatchSeriesIds(page);
      console.log(`      ${url.split('/').slice(-2).join('/')}: ${staffeln.length} Staffeln`);
      if(staffeln.length>0){
        const found=await findTeamInStaffeln(page,url.split('?')[0],searchNorm,staffeln,null);
        if(found){
          tabelle=found.rows;correctMatchSeriesId=found.matchSeriesId;foundBaseUrl=url.split('?')[0];
          league=await page.evaluate(()=>(document.querySelector('h1,h2')?.innerText||'').trim());
          break;
        }
      } else {
        // Direkte Tabelle auf der Seite
        const rows=await getTableFromPage(page,searchNorm);
        if(rows.some(r=>r.current)){
          tabelle=rows;
          const msId=await page.evaluate(()=>{
            for(const a of document.querySelectorAll('a')){
              const m=(a.href||'').match(/matchSeriesId=(\d+)/);if(m)return m[1];
            }return null;
          });
          correctMatchSeriesId=msId;
          foundBaseUrl=url.split('?')[0];
          league=await page.evaluate(()=>(document.querySelector('h1,h2')?.innerText||'').trim());
          console.log(`      ✓ Direkt gefunden`);
          break;
        }
      }
    }
    if(!tabelle.length) console.log(`      ⚠ TV Hörde in keiner URL gefunden`);

  } else {
    // Erwachsene direkt
    await page.goto(team.url,{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForTimeout(2500);
    await dismissCookieBanner(page);
    league=await page.evaluate(()=>(document.querySelector('h1,h2')?.innerText||'').trim());
    const staffeln=await getAllMatchSeriesIds(page);
    if(staffeln.length>0){
      const found=await findTeamInStaffeln(page,team.url.split('?')[0],searchNorm,staffeln,null);
      if(found){tabelle=found.rows;correctMatchSeriesId=found.matchSeriesId;foundBaseUrl=team.url.split('?')[0];}
    } else {
      tabelle=await getTableFromPage(page,searchNorm);
      correctMatchSeriesId=await page.evaluate(()=>{for(const a of document.querySelectorAll('a')){const m=(a.href||'').match(/matchSeriesId=(\d+)/);if(m)return m[1];}return null;});
      foundBaseUrl=team.url.split('?')[0];
    }
    const ownRow=tabelle.find(r=>r.current);
    if(ownRow) console.log(`      ✓ "${ownRow.name}" → Platz ${ownRow.rank}/${tabelle.length}`);
    else console.log(`      ⚠ Nicht gefunden. Teams: ${tabelle.slice(0,3).map(r=>r.name).join(', ')}`);
  }

  const ownRow=tabelle.find(r=>r.current);

  // ── SPIELPLAN ─────────────────────────────────────────────────────
  let spiele=[];
  if(correctMatchSeriesId&&foundBaseUrl){
    await page.goto(`${foundBaseUrl}?LeaguePresenter.view=matches&LeaguePresenter.matchSeriesId=${correctMatchSeriesId}`,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(1500);
    await dismissCookieBanner(page);
    spiele=await page.evaluate((sn)=>{
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
          if(!erg||erg.includes('–')||erg===''){
            result.push({datum,team1:t1,team2:t2,heim:n(t1).includes(sn),halle});
          }
        }
      }
      return result.slice(0,6);
    },searchNorm);
  }

  // ── KADER ─────────────────────────────────────────────────────────
  let kader=[];
  if(correctMatchSeriesId&&foundBaseUrl){
    try{
      await page.goto(`${foundBaseUrl}?LeaguePresenter.view=teamOverview&LeaguePresenter.matchSeriesId=${correctMatchSeriesId}`,{waitUntil:'networkidle',timeout:25000});
      await page.waitForTimeout(3000);
      await dismissCookieBanner(page);

      // Warte auf teamDetails Links
      await page.waitForSelector('a[href*="teamDetails"]',{timeout:8000}).catch(()=>{});

      const teamLink=await page.evaluate((sn)=>{
        function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
        // Alle teamDetails Links
        const all=Array.from(document.querySelectorAll('a[href*="teamDetails"]'));
        // Exakter Match
        for(const a of all){if(n(a.innerText||'').includes(sn))return a.href;}
        // Fallback: erster Link + Anzeige aller
        const info=all.map(a=>({text:(a.innerText||'').trim().slice(0,40),href:a.href}));
        return info.length?{all:info}:null;
      },searchNorm);

      if(typeof teamLink==='string'){
        kader=await getKaderFromPopup(context,teamLink);
        console.log(`      Kader: ${kader.length} Spieler`);
      } else if(teamLink?.all){
        console.log(`      Teams auf Seite: ${teamLink.all.map(l=>l.text).slice(0,5).join(', ')}`);
        // Versuche ersten Link falls nur ein Team
        if(teamLink.all.length===1){
          kader=await getKaderFromPopup(context,teamLink.all[0].href);
          console.log(`      Kader (erster Link): ${kader.length} Spieler`);
        }
      } else {
        console.log(`      Keine teamDetails-Links`);
      }
    }catch(e){
      console.log(`      ⚠ Kader: ${e.message.split('\n')[0].slice(0,60)}`);
    }
  }

  await page.close();
  return{league,rank:ownRow?.rank||null,rankTotal:tabelle.length,tabelle,spiele,kader};
}

async function scrapeAll(){
  console.log('🏐 TV Hörde WVV-Scraper v9 startet...\n');
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
