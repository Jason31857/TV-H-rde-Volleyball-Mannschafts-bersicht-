// TV Hörde – WVV Scraper v12
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://ergebnisdienst.volleyball.nrw';

const TEAMS = [
  // ── ERWACHSENE ────────────────────────────────────────────────────
  { id:'damen2',  name:'2. Damen',  sn:'TV Hörde II',  base:`${BASE}/cms/home/erwachsene/verbandsligen/vl_frauen/verbandsliga_4_frauen.xhtml`,            msId:'95242231' },
  { id:'damen3',  name:'3. Damen',  sn:'TV Hörde III', base:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_frauen/bezirksliga_9_frauen.xhtml`,    msId:'95240543' },
  { id:'damen4',  name:'4. Damen',  sn:'TV Hörde',     base:`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`,                               msId:'98622543' },
  { id:'herren2', name:'2. Herren', sn:'TV Hörde II',  base:`${BASE}/cms/home/erwachsene/verbandsligen/vl_maenner/verbandsliga_3_maenner.xhtml`,          msId:'95242507' },
  { id:'herren3', name:'3. Herren', sn:'TV Hörde III', base:`${BASE}/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_6_maenner.xhtml`,     msId:'95238341' },
  { id:'herren4', name:'4. Herren', sn:'TV Hörde IV',  base:`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml`, msId:'95240622' },
  { id:'herren5', name:'5. Herren', sn:'TV Hörde V',   base:null, msId:null },
  // ── WEIBLICHE JUGEND – Hauptseiten mit allen Staffeln durchsuchen ──
  { id:'u20w', name:'U20 Damen', sn:'TV Hörde', pages:[`${BASE}/cms/home/jugend/u20/u20_weiblich.xhtml`] },
  { id:'u18w', name:'U18 Damen', sn:'TV Hörde', pages:[`${BASE}/cms/home/jugend/u18/u18_weiblich.xhtml`] },
  { id:'u16w', name:'U16 Damen', sn:'TV Hörde', pages:[`${BASE}/cms/home/jugend/u16/u16_weiblich.xhtml`,`${BASE}/cms/home/jugend/u16/u16_midi.xhtml`] },
  { id:'u14w', name:'U14 Damen', sn:'TV Hörde', pages:[`${BASE}/cms/home/jugend/u14/nrw_ligen.xhtml`,`${BASE}/cms/home/jugend/u14/u14_weiblich.xhtml`] },
  { id:'u13w', name:'U13 Damen', sn:'TV Hörde', pages:[`${BASE}/cms/home/jugend/u13/u13_weiblich.xhtml`,`${BASE}/cms/home/jugend/u13/u13_mixed.xhtml`] },
  { id:'u12w', name:'U12 Damen', sn:'TV Hörde', pages:[`${BASE}/cms/home/jugend/u12/u12_weiblich.xhtml`,`${BASE}/cms/home/jugend/u12/u12_mixed.xhtml`] },
  // ── MÄNNLICHE JUGEND ──────────────────────────────────────────────
  { id:'u20m', name:'U20 Herren', sn:'TV Hörde', base:`${BASE}/cms/home/jugend/u20/u20_maennlich.xhtml`, msId:'95251447' },
  { id:'u18m', name:'U18 Herren', sn:'TV Hörde', base:`${BASE}/cms/home/jugend/u18/u18_maennlich.xhtml`, msId:'95250679' },
  { id:'u16m', name:'U16 Herren', sn:'TV Hörde', pages:[`${BASE}/cms/home/jugend/u16/u16_maennlich.xhtml`] },
  { id:'u14m', name:'U14 Herren', sn:'TV Hörde', base:`${BASE}/cms/home/jugend/u14/nrw_ligen.xhtml`, msId:'95251152' },
  { id:'u13m', name:'U13 Herren', sn:'TV Hörde', pages:[`${BASE}/cms/home/jugend/u13/u13_maennlich.xhtml`,`${BASE}/cms/home/jugend/u13/u13_mixed.xhtml`] },
  { id:'u12m', name:'U12 Herren', sn:'TV Hörde', pages:[`${BASE}/cms/home/jugend/u12/u12_maennlich.xhtml`,`${BASE}/cms/home/jugend/u12/u12_mixed.xhtml`] },
];

function norm(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}

async function dismissCookies(page){
  try{
    await page.waitForSelector('.sams-cookie-modal',{timeout:3000});
    await page.evaluate(()=>{
      document.querySelectorAll('.sams-cookie-modal,.sams-cookie-modal-overlay').forEach(e=>e.remove());
      document.body.style.overflow='auto';document.body.style.pointerEvents='auto';
    });
  }catch(e){}
}

async function getTable(page,sn){
  return page.evaluate((sn)=>{
    function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
    for(const t of document.querySelectorAll('table')){
      const txt=t.innerText||'';
      if(!txt.includes('Mannschaft')&&!txt.includes('Team')&&!txt.includes('Platz'))continue;
      const rows=[];let r=0;
      for(const tr of t.querySelectorAll('tbody tr,tr')){
        const tds=tr.querySelectorAll('td');if(tds.length<3)continue;r++;
        const name=(tds[1]?.innerText||tds[0]?.innerText||'').split('\n')[0].replace(/\s+/g,' ').trim();
        if(!name||name.length<2)continue;
        rows.push({rank:r,name,sp:(tds[2]?.innerText||'').trim(),s:(tds[3]?.innerText||'').trim(),pkt:(tds[tds.length-1]?.innerText||'').trim(),current:n(name).includes(sn)});
      }
      if(rows.length>2)return rows;
    }
    return[];
  },sn);
}

// Suche TV Hörde in allen Staffeln einer Seite
async function findInPage(page, baseUrl, sn){
  const staffeln=await page.evaluate(()=>{
    const r=[];
    document.querySelectorAll('a[href*="matchSeriesId"]').forEach(a=>{
      const m=(a.href||'').match(/matchSeriesId=(\d+)/);
      if(m&&(a.href||'').includes('view=resultTable'))r.push({id:m[1],text:(a.innerText||'').trim()});
    });
    return[...new Map(r.map(x=>[x.id,x])).values()];
  });

  if(staffeln.length===0){
    const rows=await getTable(page,sn);
    if(rows.some(r=>r.current)){
      const msId=await page.evaluate(()=>{for(const a of document.querySelectorAll('a')){const m=(a.href||'').match(/matchSeriesId=(\d+)/);if(m)return m[1];}return null;});
      return{rows,msId,base:baseUrl};
    }
    return null;
  }

  for(const s of staffeln){
    const url=`${baseUrl}?LeaguePresenter.view=resultTable&LeaguePresenter.matchSeriesId=${s.id}`;
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
    await page.waitForTimeout(800);
    await dismissCookies(page);
    const rows=await getTable(page,sn);
    if(rows.some(r=>r.current)){
      console.log(`      ✓ Staffel: "${s.text}" (${s.id})`);
      return{rows,msId:s.id,base:baseUrl};
    }
  }
  return null;
}

async function scrapeTeam(context,team){
  if(!team.base&&!team.pages&&!team.msId)
    return{league:'',rank:null,rankTotal:null,tabelle:[],spiele:[],kader:[]};

  const sn=norm(team.sn);
  const page=await context.newPage();
  let tabelle=[],msId=team.msId||null,base=team.base||null,league='';

  if(team.msId&&team.base){
    // Direkt mit bekannter ID
    const url=`${team.base}?LeaguePresenter.view=resultTable&LeaguePresenter.matchSeriesId=${team.msId}`;
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
    await page.waitForTimeout(1500);
    await dismissCookies(page);
    league=await page.evaluate(()=>(document.querySelector('h1,h2')?.innerText||'').trim());
    tabelle=await getTable(page,sn);
    const own=tabelle.find(r=>r.current);
    if(own)console.log(`      ✓ Platz ${own.rank}/${tabelle.length}`);
    else console.log(`      ⚠ Nicht in Tabelle. Teams: ${tabelle.slice(0,3).map(r=>r.name).join(', ')}`);

  } else if(team.pages){
    // Mehrere Seiten durchsuchen
    for(const pageUrl of team.pages){
      await page.goto(pageUrl,{waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});
      await page.waitForTimeout(1200);
      await dismissCookies(page);
      const found=await findInPage(page,pageUrl.split('?')[0],sn);
      if(found){
        tabelle=found.rows;msId=found.msId;base=found.base;
        league=await page.evaluate(()=>(document.querySelector('h1,h2')?.innerText||'').trim());
        break;
      }
    }
    if(!tabelle.length)console.log(`      ⚠ TV Hörde nicht gefunden`);
  }

  const own=tabelle.find(r=>r.current);

  // ── SPIELPLAN ─────────────────────────────────────────────────────
  let spiele=[];
  if(msId&&base){
    await page.goto(`${base}?LeaguePresenter.view=matches&LeaguePresenter.matchSeriesId=${msId}`,{waitUntil:'domcontentloaded',timeout:15000});
    await page.waitForTimeout(1000);
    await dismissCookies(page);
    spiele=await page.evaluate((sn)=>{
      function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
      const r=[];
      for(const t of document.querySelectorAll('table')){
        for(const tr of t.querySelectorAll('tbody tr,tr')){
          if(!n(tr.innerText).includes(sn))continue;
          const tds=tr.querySelectorAll('td');if(tds.length<4)continue;
          const erg=(tds[4]?.innerText||'').trim();
          if(!erg||erg.includes('–')||erg==='')
            r.push({datum:(tds[0]?.innerText||'').trim(),team1:(tds[2]?.innerText||'').trim().split('\n')[0],team2:(tds[3]?.innerText||'').trim().split('\n')[0],heim:n((tds[2]?.innerText||'')).includes(sn),halle:(tds[5]?.innerText||'').trim().split('\n')[0]});
        }
      }
      return r.slice(0,6);
    },sn);
  }

  // ── KADER ─────────────────────────────────────────────────────────
  let kader=[];
  if(msId&&base){
    try{
      // Warte länger auf networkidle damit AJAX-Links geladen werden
      await page.goto(`${base}?LeaguePresenter.view=teamOverview&LeaguePresenter.matchSeriesId=${msId}`,{waitUntil:'networkidle',timeout:25000});
      await page.waitForTimeout(3000);
      await dismissCookies(page);

      // Explizit warten bis Links erscheinen
      await page.waitForFunction(()=>document.querySelectorAll('a[href*="ListView.teamId"]').length>0,{timeout:8000}).catch(()=>{});

      const link=await page.evaluate((sn)=>{
        function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
        // Kader-Link hat ListView.teamId in der URL
        const all=[...document.querySelectorAll('a[href*="ListView.teamId"]')];
        for(const a of all)if(n(a.innerText||'').includes(sn))return a.href;
        return all.length===1?all[0].href:null;
      },sn);

      if(link){
        const pop=await context.newPage();
        await pop.goto(link,{waitUntil:'domcontentloaded',timeout:12000});
        await pop.waitForTimeout(1000);
        await dismissCookies(pop);
        kader=await pop.evaluate(()=>{
          for(const t of document.querySelectorAll('table')){
            const rows=[];
            for(const tr of t.querySelectorAll('tr')){
              const tds=tr.querySelectorAll('td');if(tds.length<2)continue;
              const c0=(tds[0]?.innerText||'').trim();
              const c1=(tds[1]?.innerText||'').trim().split('\n')[0];
              const c2=(tds[2]?.innerText||'').trim();
              if(/^\d{2}\.\d{2}/.test(c0))continue;
              if(!c1||c1.length<2)continue;
              if(/^(name|spieler|pos|nr|#|trikot)/i.test(c1))continue;
              if(/volleyball|verband|mannschaftsdetail|impressum|westdeutsch/i.test(c1))continue;
              rows.push({nr:c0||'–',name:c1,pos:c2||'–'});
            }
            if(rows.length>=2&&!rows.some(r=>/^\d{2}\.\d{2}/.test(r.name)))return rows;
          }
          return[];
        });
        console.log(`      Kader: ${kader.length}`);
        await pop.close();
      }else{
        // Debug: zeige was auf der Seite ist
        const info=await page.evaluate(()=>({
          links:document.querySelectorAll('a[href*="ListView.teamId"]').length,
          names:[...document.querySelectorAll('a[href*="ListView.teamId"]')].map(a=>(a.innerText||'').trim().slice(0,25)).slice(0,4)
        }));
        console.log(`      Kader-Links: ${info.links}, Teams: ${info.names.join(', ')}`);
      }
    }catch(e){console.log(`      ⚠ Kader: ${e.message.split('\n')[0].slice(0,40)}`);}
  }

  await page.close();
  return{league,rank:own?.rank||null,rankTotal:tabelle.length,tabelle,spiele,kader};
}

async function scrapeAll(){
  console.log('🏐 TV Hörde WVV-Scraper v12 startet...\n');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'});
  await context.addCookies([{name:'cookieConsent',value:'true',domain:'ergebnisdienst.volleyball.nrw',path:'/'}]);
  const results={};
  for(const team of TEAMS){
    console.log(`📋 ${team.name}...`);
    try{
      results[team.id]=await scrapeTeam(context,team);
      const d=results[team.id];
      console.log(`   ✅ "${d.league}" | Platz ${d.rank}/${d.rankTotal} | Spiele:${d.spiele.length} | Kader:${d.kader.length}`);
    }catch(e){
      console.log(`   ❌ ${e.message.split('\n')[0]}`);
      results[team.id]={league:'',rank:null,rankTotal:null,tabelle:[],spiele:[],kader:[]};
    }
    await new Promise(r=>setTimeout(r,800));
  }
  await browser.close();
  fs.writeFileSync('tvhoerde-data.json',JSON.stringify(results,null,2),'utf8');
  console.log('\n✅ Fertig!');
}
scrapeAll().catch(e=>{console.error(e);process.exit(1);});
