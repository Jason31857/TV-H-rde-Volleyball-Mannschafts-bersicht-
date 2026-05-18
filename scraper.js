// TV Hörde – WVV Scraper v10 – finale Version
const { chromium } = require('playwright');
const fs = require('fs');
 
const BASE = 'https://ergebnisdienst.volleyball.nrw';
 
const TEAMS = [
  // ── ERWACHSENE ────────────────────────────────────────────────────
  { id:'damen2',  name:'2. Damen',  searchName:'TV Hörde II',  urls:[`${BASE}/cms/home/erwachsene/verbandsligen/vl_frauen/verbandsliga_4_frauen.xhtml`] },
  { id:'damen3',  name:'3. Damen',  searchName:'TV Hörde III', urls:[`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_frauen/bezirksliga_9_frauen.xhtml`] },
  { id:'damen4',  name:'4. Damen',  searchName:'TV Hörde',     urls:[`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`], gender:'frauen' },
  { id:'herren2', name:'2. Herren', searchName:'TV Hörde II',  urls:[`${BASE}/cms/home/erwachsene/verbandsligen/vl_maenner/verbandsliga_3_maenner.xhtml`] },
  { id:'herren3', name:'3. Herren', searchName:'TV Hörde III', urls:[`${BASE}/cms/home/erwachsene/landesligen/landesligen_maenner/landesliga_6_maenner.xhtml`] },
  { id:'herren4', name:'4. Herren', searchName:'TV Hörde IV',  urls:[`${BASE}/cms/home/erwachsene/bezirksligen/bezirksligen_maenner/bezirksliga_10_maenner.xhtml`] },
  { id:'herren5', name:'5. Herren', searchName:'TV Hörde V',   urls:[`${BASE}/cms/home/erwachsene/kreisligen/alle_kreisligen.xhtml`], gender:'maenner' },
  // ── WEIBLICHE JUGEND ──────────────────────────────────────────────
  { id:'u20w', name:'U20 Damen', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u20/u20_weiblich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u20/u20_weiblich/oberligen.xhtml`,
    `${BASE}/cms/home/jugend/u20/u20_weiblich/bezirksligen.xhtml`,
  ]},
  { id:'u18w', name:'U18 Damen', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u18/u18_weiblich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u18/u18_weiblich/oberligen.xhtml`,
    `${BASE}/cms/home/jugend/u18/u18_weiblich/bezirksligen.xhtml`,
  ]},
  { id:'u16w', name:'U16 Damen', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u16/u16_weiblich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u16/u16_weiblich/oberligen.xhtml`,
    `${BASE}/cms/home/jugend/u16/u16_weiblich/bezirksligen.xhtml`,
    `${BASE}/cms/home/jugend/u16/u16_midi.xhtml`,
  ]},
  { id:'u14w', name:'U14 Damen', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u14/nrw_ligen/wu14_NRW.xhtml`,
    `${BASE}/cms/home/jugend/u14/u14_weiblich.xhtml`,
  ]},
  { id:'u13w', name:'U13 Damen', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u13/u13_weiblich.xhtml`,
    `${BASE}/cms/home/jugend/u13/u13_mixed.xhtml`,
  ]},
  { id:'u12w', name:'U12 Damen', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u12/u12_weiblich.xhtml`,
    `${BASE}/cms/home/jugend/u12/u12_mixed.xhtml`,
    `${BASE}/cms/home/jugend/u12/u12_mixed/bezirksliga.xhtml`,
  ]},
  // ── MÄNNLICHE JUGEND ──────────────────────────────────────────────
  { id:'u20m', name:'U20 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u20/u20_maennlich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u20/u20_maennlich/oberligen.xhtml`,
    `${BASE}/cms/home/jugend/u20/u20_maennlich/bezirksligen.xhtml`,
  ]},
  { id:'u18m', name:'U18 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u18/u18_maennlich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u18/u18_maennlich/oberligen.xhtml`,
    `${BASE}/cms/home/jugend/u18/u18_maennlich/bezirksligen.xhtml`,
  ]},
  { id:'u16m', name:'U16 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u16/u16_maennlich/nrw_liga.xhtml`,
    `${BASE}/cms/home/jugend/u16/u16_maennlich/oberligen.xhtml`,
    `${BASE}/cms/home/jugend/u16/u16_maennlich/bezirksligen.xhtml`,
  ]},
  { id:'u14m', name:'U14 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u14/nrw_ligen/mu14_NRW.xhtml`,
    `${BASE}/cms/home/jugend/u14/u14_maennlich.xhtml`,
  ]},
  { id:'u13m', name:'U13 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u13/u13_maennlich.xhtml`,
    `${BASE}/cms/home/jugend/u13/u13_mixed.xhtml`,
  ]},
  { id:'u12m', name:'U12 Herren', searchName:'TV Hörde', urls:[
    `${BASE}/cms/home/jugend/u12/u12_maennlich.xhtml`,
    `${BASE}/cms/home/jugend/u12/u12_mixed.xhtml`,
    `${BASE}/cms/home/jugend/u12/u12_mixed/bezirksliga.xhtml`,
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
      document.body.style.overflow='auto';document.body.style.pointerEvents='auto';
    });
    await page.waitForTimeout(300);
  } catch(e){}
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
 
async function getAllMatchSeriesIds(page, gender) {
  return page.evaluate((gender)=>{
    function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
    const result=[];
    document.querySelectorAll('a[href*="matchSeriesId"]').forEach(a=>{
      const m=(a.href||'').match(/matchSeriesId=(\d+)/);
      if(!m||(!(a.href||'').includes('view=resultTable')))return;
      const txt=n(a.innerText||'');
      if(gender==='maenner'&&(txt.includes('frauen')||txt.includes('weiblich')||txt.includes('damen')))return;
      if(gender==='frauen'&&(txt.includes('manner')||txt.includes('mannlich')||txt.includes('herren')||txt.includes('jungen')))return;
      result.push({id:m[1],text:(a.innerText||'').trim()});
    });
    return [...new Map(result.map(r=>[r.id,r])).values()];
  },gender||null);
}
 
async function findInStaffeln(page, baseUrl, searchNorm, staffeln) {
  for(const staffel of staffeln){
    const url=`${baseUrl}?LeaguePresenter.view=resultTable&LeaguePresenter.matchSeriesId=${staffel.id}`;
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(800);
    await dismissCookieBanner(page);
    const rows=await getTableFromPage(page,searchNorm);
    if(rows.some(r=>r.current)){
      console.log(`      ✓ In "${staffel.text}" (ID:${staffel.id})`);
      return{rows,matchSeriesId:staffel.id};
    }
  }
  return null;
}
 
async function getKader(context, page, baseUrl, matchSeriesId, searchNorm) {
  try{
    await page.goto(`${baseUrl}?LeaguePresenter.view=teamOverview&LeaguePresenter.matchSeriesId=${matchSeriesId}`,{waitUntil:'networkidle',timeout:25000});
    await page.waitForTimeout(2500);
    await dismissCookieBanner(page);
    await page.waitForSelector('a[href*="teamDetails"]',{timeout:6000}).catch(()=>{});
 
    const teamLink=await page.evaluate((sn)=>{
      function n(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
      const all=Array.from(document.querySelectorAll('a[href*="teamDetails"]'));
      for(const a of all){if(n(a.innerText||'').includes(sn))return a.href;}
      return all.length===1?all[0].href:(all.length?{links:all.map(a=>({text:(a.innerText||'').trim().slice(0,30),href:a.href}))}:null);
    },searchNorm);
 
    if(!teamLink){console.log(`      Keine teamDetails-Links`);return[];}
    if(typeof teamLink!=='string'){
      console.log(`      Teams: ${teamLink.links?.map(l=>l.text).slice(0,4).join(', ')}`);
      return[];
    }
 
    const popup=await context.newPage();
    await popup.goto(teamLink,{waitUntil:'domcontentloaded',timeout:15000});
    await popup.waitForTimeout(1500);
    await dismissCookieBanner(popup);
 
    const kader=await popup.evaluate(()=>{
      for(const table of document.querySelectorAll('table')){
        const rows=[];
        for(const tr of table.querySelectorAll('tr')){
          const tds=tr.querySelectorAll('td');
          if(tds.length<2)continue;
          const col0=(tds[0]?.innerText||'').trim();
          const col1=(tds[1]?.innerText||'').trim().split('\n')[0];
          const col2=(tds[2]?.innerText||'').trim();
          if(/^\d{2}\.\d{2}/.test(col0))continue; // Datum = Spiel
          if(!col1||col1.length<2)continue;
          if(/^(name|spieler|pos|nr|#|trikot)/i.test(col1))continue;
          if(/volleyball|verband|mannschaftsdetail|impressum|westdeutsch/i.test(col1))continue;
          rows.push({nr:col0||'–',name:col1,pos:col2||'–'});
        }
        if(rows.length>=2&&!rows.some(r=>/^\d{2}\.\d{2}/.test(r.name)))return rows;
      }
      return[];
    });
    await popup.close();
    console.log(`      Kader: ${kader.length} Spieler`);
    return kader;
  }catch(e){
    console.log(`      ⚠ Kader: ${e.message.split('\n')[0].slice(0,50)}`);
    return[];
  }
}
 
async function scrapeTeam(context, team) {
  const sn=norm(team.searchName);
  const page=await context.newPage();
  let tabelle=[],matchSeriesId=null,foundBaseUrl=null,league='';
 
  for(const url of team.urls){
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(2000);
    await dismissCookieBanner(page);
    const curLeague=await page.evaluate(()=>(document.querySelector('h1,h2')?.innerText||'').trim());
    const staffeln=await getAllMatchSeriesIds(page,team.gender||null);
    const shortUrl=url.split('/').slice(-2).join('/');
    console.log(`      ${shortUrl}: ${staffeln.length} Staffeln`);
 
    if(staffeln.length>0){
      const found=await findInStaffeln(page,url.split('?')[0],sn,staffeln);
      if(found){tabelle=found.rows;matchSeriesId=found.matchSeriesId;foundBaseUrl=url.split('?')[0];league=curLeague;break;}
    } else {
      const rows=await getTableFromPage(page,sn);
      if(rows.some(r=>r.current)){
        tabelle=rows;
        matchSeriesId=await page.evaluate(()=>{for(const a of document.querySelectorAll('a')){const m=(a.href||'').match(/matchSeriesId=(\d+)/);if(m)return m[1];}return null;});
        foundBaseUrl=url.split('?')[0];league=curLeague;
        console.log(`      ✓ Direkt gefunden`);
        break;
      }
    }
  }
 
  if(!tabelle.length) console.log(`      ⚠ TV Hörde nicht gefunden`);
  const ownRow=tabelle.find(r=>r.current);
 
  // ── SPIELPLAN ─────────────────────────────────────────────────────
  let spiele=[];
  if(matchSeriesId&&foundBaseUrl){
    await page.goto(`${foundBaseUrl}?LeaguePresenter.view=matches&LeaguePresenter.matchSeriesId=${matchSeriesId}`,{waitUntil:'domcontentloaded',timeout:20000});
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
    },sn);
  }
 
  // ── KADER ─────────────────────────────────────────────────────────
  let kader=[];
  if(matchSeriesId&&foundBaseUrl){
    kader=await getKader(context,page,foundBaseUrl,matchSeriesId,sn);
  }
 
  await page.close();
  return{league,rank:ownRow?.rank||null,rankTotal:tabelle.length,tabelle,spiele,kader};
}
 
async function scrapeAll(){
  console.log('🏐 TV Hörde WVV-Scraper v10 startet...\n');
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
    await new Promise(r=>setTimeout(r,1500));
  }
 
  await browser.close();
  fs.writeFileSync('tvhoerde-data.json',JSON.stringify(results,null,2),'utf8');
  console.log('\n✅ Fertig!');
}
 
scrapeAll().catch(err=>{console.error(err);process.exit(1);});
