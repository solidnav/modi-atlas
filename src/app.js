(function(){
  "use strict";
  const reduced = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  const HOME = {name:"New Delhi", lonlat:[77.21, 28.61]};

  function greatCircle(a,b){
    const interp=d3.geoInterpolate(a,b), n=50, c=[];
    for(let i=0;i<=n;i++) c.push(interp(i/n));
    return {type:"LineString", coordinates:c};
  }
  const MEDAL_MARKUP='<polygon class="rib-l" points="-6,-17 -1.8,-17 1.8,-6 -2.4,-6"/>'+
    '<polygon class="rib-r" points="6,-17 1.8,-17 -1.8,-6 2.4,-6"/>'+
    '<circle class="disc" cx="0" cy="0" r="9"/>'+
    '<ellipse class="shine" cx="-2.9" cy="-3.2" rx="3.7" ry="2.4"/>'+
    '<polygon class="star" points="0,-4.6 1.12,-1.54 4.37,-1.42 1.81,0.59 2.70,3.72 0,1.9 -2.70,3.72 -1.81,0.59 -4.37,-1.42 -1.12,-1.54"/>';

  // ---- precompute ----
  VISITS.forEach(v=>{ v.startMs = Date.parse(v.start); v.endMs = Date.parse(v.end); v.lonlat=[v.lon, v.lat]; });
  VISITS.sort((a,b)=> a.startMs-b.startMs || (a.seq-b.seq));
  VISITS.forEach((v,i)=> v.seq=i);
  const N = VISITS.length;
  const T0 = VISITS[0].startMs;
  const T1 = VISITS[N-1].endMs;
  VISITS.forEach((v,i)=>{
    const from = i>0 ? VISITS[i-1].lonlat : HOME.lonlat;
    v.sameSpot = (from[0]===v.lonlat[0] && from[1]===v.lonlat[1]);
    v.segGC = v.sameSpot ? null : greatCircle(from, v.lonlat);
  });

  // sequential journey numbering (legs of one trip share a number) + estimated cost
  function gcKm(a,b){
    const R=6371, toR=Math.PI/180;
    const dLat=(b[1]-a[1])*toR, dLon=(b[0]-a[0])*toR;
    const h=Math.sin(dLat/2)**2 + Math.cos(a[1]*toR)*Math.cos(b[1]*toR)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  let jno=0;
  VISITS.forEach((v,i)=>{
    if(i===0 || (v.startMs - VISITS[i-1].endMs) > 2*86400000) jno++;
    v.journeyNo=jno;
    // ---- ESTIMATED taxpayer cost (a transparent guesstimate, NOT an official figure) ----
    // model: round-trip flight hours from Delhi x hourly VVIP-aircraft cost, plus a
    // per-day cost for the delegation/security/logistics, plus a fixed overhead.
    const flightHrs = gcKm(HOME.lonlat, v.lonlat)/800;
    const aviationCr = flightHrs * 0.12 * 2;   // ~Rs 0.12 crore per flying hour, both ways
    const groundCr   = v.days * 1.2;           // ~Rs 1.2 crore per day on the ground
    v.estCr = Math.round((aviationCr + groundCr + 1.5) * 10) / 10;  // +Rs 1.5 cr fixed
  });
  const TOTAL_TRIPS = jno;

  // ---- map setup ----
  const svg = d3.select("#map");
  const gWorld = svg.append("g");           // zoomed: ocean, land, borders, arcs
  const gArc   = gWorld.append("g");
  const gScreen= svg.append("g");           // screen-space marks
  const sphere = {type:"Sphere"};
  const land = topojson.feature(TOPO, TOPO.objects.countries);
  const borders = topojson.mesh(TOPO, TOPO.objects.countries, (a,b)=>a!==b);
  const rawByName = new Map(land.features.map(f=>[f.properties.name, f]));

  const projection = (d3.geoNaturalEarth1 ? d3.geoNaturalEarth1() : d3.geoEquirectangular());
  const geoPath = d3.geoPath(projection);
  const graticule = d3.geoGraticule10();

  let W=0,H=0, curT = d3.zoomIdentity;

  // static layers
  const spherePath = gWorld.insert("path",":first-child").attr("class","sphere");
  const gratPath = gWorld.append("path").datum(graticule).attr("class","graticule");
  const gCountries = gWorld.append("g");
  const bordersPath = gWorld.append("path").datum(borders).attr("class","borders");
  gArc.raise();

  // which topo names should be tinted "visited" (mapped from our data)
  const NAME_ALIAS = {  // our rawCountry -> topojson name
    "United States":"United States of America","United Nations":"United States of America",
    "United Kingdom":"United Kingdom","South Korea":"South Korea","Republic of Korea":"South Korea",
    "Islamic Republic of Afghanistan":"Afghanistan","Russia":"Russia","Czechia":"Czechia",
    "Serbia":"Republic of Serbia","Tanzania":"United Republic of Tanzania",
    "European Union":"Belgium","Vatican City":"Italy","Palestine":"Israel","Singapore":"Singapore",
    "Bahrain":"Bahrain","Brunei":"Brunei","Trinidad and Tobago":"Trinidad and Tobago",
  };
  function topoNameFor(raw){
    return NAME_ALIAS[raw] || raw;
  }
  // canonical sovereign country for the "Countries" counter (Vatican / Palestine kept distinct)
  const COUNT_CANON = {
    "United Nations":"United States","Republic of Korea":"South Korea",
    "Islamic Republic of Afghanistan":"Afghanistan","European Union":"Belgium"
  };
  function canonCountry(raw){ return COUNT_CANON[raw] || raw; }

  const countrySel = gCountries.selectAll("path.country")
    .data(land.features).join("path")
      .attr("class",d=> "country" + (d.properties.name==="India" ? " india":""));

  // ---- marks (screen space) ----
  const pulse = gScreen.append("circle").attr("class","pulse").attr("r",0).style("display","none");
  const dotSel = gScreen.selectAll("circle.dot")
    .data(VISITS, d=>d.seq).join("circle")
      .attr("class","dot future").attr("r",3)
      .on("pointerenter", (e,d)=> showTip(e,d))
      .on("pointermove", (e)=> moveTip(e))
      .on("pointerleave", hideTip)
      .on("click", (e,d)=> { setActive(d.seq, true); });
  const medalSel = gScreen.selectAll("g.medal-g")
    .data(VISITS.filter(v=>v.award), d=>d.seq).join("g")
      .attr("class","medal-g").style("display","none")
      .html(MEDAL_MARKUP);
  const homeDot = gScreen.append("circle").attr("class","home").attr("r",4.5);
  const homeLabel = gScreen.append("text").attr("class","home-label").attr("dy",-9)
      .attr("text-anchor","middle").text("New Delhi");
  const flight = gScreen.append("circle").attr("class","flight").attr("r",5).style("display","none");
  const activeLabel = gScreen.append("text").attr("class","active-label")
      .attr("text-anchor","middle").attr("dy",-13);

  // ---- zoom ----
  const zoom = d3.zoom().scaleExtent([1,9])
    .on("start",()=> svg.classed("grabbing",true))
    .on("zoom",(e)=>{ curT=e.transform; gWorld.attr("transform",curT); positionMarks(); })
    .on("end",()=> svg.classed("grabbing",false));
  svg.call(zoom).on("dblclick.zoom", null);

  function screenXY(lonlat){
    const p = projection(lonlat); if(!p) return null;
    return curT.apply(p);
  }

  // ---- layout ----
  function layout(){
    const stage = document.getElementById("stage");
    W = stage.clientWidth; H = stage.clientHeight;
    svg.attr("viewBox",`0 0 ${W} ${H}`).attr("width",W).attr("height",H);
    projection.fitExtent([[10,12],[W-10,H-12]], sphere);
    spherePath.attr("d", geoPath(sphere));
    gratPath.attr("d", geoPath);
    countrySel.attr("d", geoPath);
    bordersPath.attr("d", geoPath);
    positionMarks();
    if(activeIdx>=0) renderTrail(false);
    layoutTimeline();
  }

  function positionMarks(){
    dotSel.each(function(d){
      const p = screenXY(d.lonlat);
      d3.select(this).attr("cx",p[0]).attr("cy",p[1]);
    });
    medalSel.each(function(d){
      const p = screenXY(d.lonlat);
      this.setAttribute("transform","translate("+p[0]+","+p[1]+") scale(0.92)");
    });
    const hp = screenXY(HOME.lonlat);
    homeDot.attr("cx",hp[0]).attr("cy",hp[1]);
    homeLabel.attr("x",hp[0]).attr("y",hp[1]);
    if(activeIdx>=0){
      const a = screenXY(VISITS[activeIdx].lonlat);
      pulse.attr("cx",a[0]).attr("cy",a[1]);
      activeLabel.attr("x",a[0]).attr("y",a[1]);
    }
  }

  // ---- state ----
  let activeIdx = -1;
  let playHeadMs = T0;

  function visitedCount(ms){ // number of visits with start<=ms
    let lo=0,hi=N;
    while(lo<hi){ const m=(lo+hi)>>1; if(VISITS[m].startMs<=ms) lo=m+1; else hi=m; }
    return lo; // count
  }

  function styleMarks(){
    dotSel.attr("class",d=>{
      if(d.seq===activeIdx) return "dot active";
      return d.seq<activeIdx ? "dot visited" : "dot future";
    }).attr("r",d=> d.seq===activeIdx?6:(d.seq<activeIdx?3.4:3));
    medalSel.style("display",d=> d.seq<=activeIdx ? null : "none");
    // tint visited countries
    const reached = new Set();
    for(let i=0;i<=activeIdx;i++) reached.add(topoNameFor(VISITS[i].rawCountry));
    countrySel.classed("visited", d=> reached.has(d.properties.name));
  }

  function fmtDate(ms){
    const d=new Date(ms);
    return d.getUTCDate()+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]+" "+d.getUTCFullYear();
  }
  function fmtRange(v){
    const a=new Date(v.startMs), b=new Date(v.endMs);
    const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    if(v.start===v.end) return fmtDate(v.startMs);
    const sameY=a.getUTCFullYear()===b.getUTCFullYear();
    const sameM=sameY&&a.getUTCMonth()===b.getUTCMonth();
    if(sameM) return `${a.getUTCDate()}\u2013${b.getUTCDate()} ${M[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
    if(sameY) return `${a.getUTCDate()} ${M[a.getUTCMonth()]} \u2013 ${b.getUTCDate()} ${M[b.getUTCMonth()]} ${a.getUTCFullYear()}`;
    return `${a.getUTCDate()} ${M[a.getUTCMonth()]} ${a.getUTCFullYear()} \u2013 ${b.getUTCDate()} ${M[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }

  function updateStats(){
    const upto = activeIdx;
    const set=new Set(); let days=0,med=0;
    for(let i=0;i<=upto;i++){ set.add(canonCountry(VISITS[i].rawCountry)); days+=VISITS[i].days; if(VISITS[i].award) med++; }
    document.getElementById("s-countries").textContent = set.size;
    document.getElementById("s-visits").textContent = upto+1;
    document.getElementById("s-days").textContent = days;
    document.getElementById("s-medals").textContent = med;
  }

  function updateCard(){
    const v = VISITS[activeIdx];
    const prev = activeIdx>0 ? VISITS[activeIdx-1].country : HOME.name;
    document.getElementById("ic-trip").textContent = "Trip " + v.journeyNo;
    document.getElementById("ic-year").textContent = v.year;
    document.getElementById("ic-from").textContent = prev;
    document.getElementById("ic-to").textContent = v.country;
    document.getElementById("ic-city").textContent = v.city || "";
    document.getElementById("ic-dates").textContent = fmtRange(v) + "  \u00b7  " + v.days + (v.days===1?" day":" days");
    document.getElementById("ic-purpose").textContent = v.purpose || "\u2014";
    document.getElementById("ic-cost").textContent = "\u2248 \u20b9" + fmtCr(v.estCr) + " cr";
    const med = document.getElementById("ic-medal");
    if(v.award){ med.classList.add("show"); document.getElementById("ic-medal-name").textContent = v.award; }
    else med.classList.remove("show");
    activeLabel.text(v.country);
  }
  function fmtCr(n){
    return (n>=100 ? Math.round(n) : n).toLocaleString("en-IN");
  }

  function updateReadout(){
    document.getElementById("dateReadout").textContent = fmtDate(playHeadMs);
    document.getElementById("progReadout").textContent = `Stop ${activeIdx+1} of ${N}`;
    const tl=document.getElementById("timeline");
    tl.setAttribute("aria-valuenow", activeIdx);
    tl.setAttribute("aria-valuetext", `${VISITS[activeIdx].country}, ${fmtRange(VISITS[activeIdx])}`);
  }

  // ---- estimated cost counter (bottom-right) ----
  let shownTrip=0, shownTotal=0, costTimer=null;
  function totalTo(idx){ let s=0; for(let i=0;i<=idx;i++) s+=VISITS[i].estCr; return s; }
  function paintCost(trip,total){
    document.getElementById("cb-trip").textContent = "\u20B9" + fmtCr(Math.round(trip*10)/10) + " cr";
    document.getElementById("cb-total").textContent = "\u20B9" + Math.round(total).toLocaleString("en-IN") + " cr";
  }
  function updateCost(animateUp){
    const trip=VISITS[activeIdx].estCr, total=totalTo(activeIdx);
    if(costTimer){ costTimer.stop(); costTimer=null; }
    if(reduced || !animateUp || document.hidden){ shownTrip=trip; shownTotal=total; paintCost(trip,total); return; }
    const t0=shownTrip, tot0=shownTotal, dur=650;
    costTimer=d3.timer((el)=>{
      const k=Math.min(1, el/dur), e=1-Math.pow(1-k,3);
      paintCost(t0+(trip-t0)*e, tot0+(total-tot0)*e);
      if(k>=1){ costTimer.stop(); costTimer=null; shownTrip=trip; shownTotal=total; }
    });
  }

  // ---- medal celebration (Sonic-ring style burst) ----
  const gFx = gScreen.append("g").attr("class","fx").style("pointer-events","none");
  let bannerTimer=null;
  function showMedalBanner(name){
    const b=document.getElementById("medalBurst");
    document.getElementById("mb-name").textContent=name;
    b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
    clearTimeout(bannerTimer); bannerTimer=setTimeout(()=> b.classList.remove("show"), 2300);
  }
  function celebrateMedal(idx){
    const p=screenXY(VISITS[idx].lonlat); if(!p) return;
    showMedalBanner(VISITS[idx].award);
    if(reduced) return;
    const x=p[0], y=p[1];
    for(let k=0;k<3;k++){
      gFx.append("circle").attr("cx",x).attr("cy",y).attr("r",8).attr("fill","none")
        .attr("stroke","#E7B23A").attr("stroke-width",3.6).attr("opacity",0.9)
        .transition().delay(k*130).duration(780).ease(d3.easeCubicOut)
        .attr("r",44+k*12).attr("stroke-width",0.4).attr("opacity",0).remove();
    }
    const n=11;
    for(let k=0;k<n;k++){
      const ang=(k/n)*2*Math.PI+Math.random()*0.5, dist=28+Math.random()*24;
      gFx.append("circle").attr("cx",x).attr("cy",y).attr("r",2.7)
        .attr("fill", k%2?"#F0C24E":"#FFE79A").attr("opacity",1)
        .transition().duration(560+Math.random()*300).ease(d3.easeCubicOut)
        .attr("cx",x+Math.cos(ang)*dist).attr("cy",y+Math.sin(ang)*dist)
        .attr("r",0.3).attr("opacity",0).remove();
    }
    gFx.append("circle").attr("cx",x).attr("cy",y).attr("r",5).attr("fill","#FFF3C9").attr("opacity",0.95)
      .transition().duration(340).ease(d3.easeCubicOut).attr("r",24).attr("opacity",0).remove();
  }

  // ---- travel trail (accumulates every hop; latest highlighted) ----
  let flightTimer=null;
  // build a path in projection space, breaking where a great circle crosses the map seam
  function arcPathD(gc){
    const pts=gc.coordinates.map(c=>projection(c));
    let d="",prev=null;
    for(let i=0;i<pts.length;i++){
      const p=pts[i];
      if(!p){ prev=null; continue; }
      if(prev===null || Math.abs(p[0]-prev[0])>W*0.5) d+="M"+p[0]+","+p[1];
      else d+="L"+p[0]+","+p[1];
      prev=p;
    }
    return d;
  }
  function renderTrail(animateLast){
    if(flightTimer){ flightTimer.stop(); flightTimer=null; }
    const segs=[];
    for(let i=0;i<=activeIdx;i++){ if(!VISITS[i].sameSpot) segs.push(VISITS[i]); }
    const sel=gArc.selectAll("path.seg").data(segs, d=>d.seq).join("path")
      .attr("class", d=> "arc seg"+(d.seq===activeIdx?"":" ghost"))
      .attr("d", d=> arcPathD(d.segGC));
    sel.filter(d=>d.seq!==activeIdx).attr("stroke-dasharray",null).attr("stroke-dashoffset",null);
    flight.style("display","none");
    const lastSel=sel.filter(d=>d.seq===activeIdx);
    if(lastSel.empty()) return;
    if(!animateLast || reduced){ lastSel.attr("stroke-dasharray",null).attr("stroke-dashoffset",null); return; }
    const node=lastSel.node(), len=node.getTotalLength();
    lastSel.attr("stroke-dasharray",len+" "+len).attr("stroke-dashoffset",len)
      .transition().duration(560).ease(d3.easeCubicInOut)
      .attr("stroke-dashoffset",0)
      .on("end",function(){ d3.select(this).attr("stroke-dasharray",null); });
    // flight marker glides along the latest leg
    const from=activeIdx>0? VISITS[activeIdx-1].lonlat : HOME.lonlat;
    const interp=d3.geoInterpolate(from, VISITS[activeIdx].lonlat);
    flight.style("display",null);
    const dur=560;
    flightTimer=d3.timer((el)=>{
      let t=el/dur; if(t>1)t=1;
      const p=screenXY(interp(t)); if(p) flight.attr("cx",p[0]).attr("cy",p[1]);
      if(t>=1){ flightTimer.stop(); flightTimer=null; flight.style("display","none"); }
    });
  }

  // pulse animation on active
  let pulseTimer=null;
  function startPulse(){
    if(reduced){ pulse.style("display","none"); return; }
    if(pulseTimer) pulseTimer.stop();
    pulse.style("display",null);
    pulseTimer=d3.timer((el)=>{
      const t=(el%1400)/1400;
      pulse.attr("r",6+t*20).attr("opacity",0.5*(1-t));
    });
  }

  // ---- set active ----
  function setActive(idx, animate){
    idx=Math.max(0,Math.min(N-1,idx));
    const changed = idx!==activeIdx;
    const forward = idx>activeIdx;
    activeIdx=idx;
    playHeadMs=VISITS[idx].startMs;
    styleMarks(); updateStats(); updateCard(); updateReadout(); positionMarks();
    renderTrail(animate && forward);
    updateCost(animate && forward);
    if(animate && forward && VISITS[idx].award) celebrateMedal(idx);
    startPulse();
    drawTimelineHead();
  }

  // scrub to an arbitrary date (continuous)
  function scrubTo(ms){
    playHeadMs=Math.max(T0,Math.min(T1,ms));
    const cnt=visitedCount(playHeadMs);
    const idx=Math.max(0,cnt-1);
    if(idx!==activeIdx){
      activeIdx=idx;
      styleMarks(); updateStats(); updateCard(); positionMarks();
      renderTrail(false); updateCost(false); startPulse();
    }
    updateReadout(); drawTimelineHead();
  }

  // ---- tooltip ----
  const tip=document.getElementById("tooltip");
  function showTip(e,d){
    const medal = d.award? `<div class="tt-m"><svg class="mico" viewBox="-11 -19 22 30" width="17" height="23">${MEDAL_MARKUP}</svg><span>${d.award}</span></div>`:"";
    tip.innerHTML=`<div class="tt-c">${d.country}</div>`+
      `<div class="tt-d">${fmtRange(d)} \u00B7 ${d.days} day${d.days===1?"":"s"}</div>`+
      (d.city?`<div class="tt-p">${d.city}</div>`:"")+medal;
    tip.classList.add("show"); moveTip(e);
  }
  function moveTip(e){
    const stage=document.getElementById("stage").getBoundingClientRect();
    let x=e.clientX-stage.left+14, y=e.clientY-stage.top+14;
    const tw=tip.offsetWidth, th=tip.offsetHeight;
    if(x+tw>stage.width-6) x=e.clientX-stage.left-tw-14;
    if(y+th>stage.height-6) y=e.clientY-stage.top-th-14;
    tip.style.left=x+"px"; tip.style.top=y+"px";
  }
  function hideTip(){ tip.classList.remove("show"); }

  // ---- timeline ----
  const tl=d3.select("#timeline");
  const tlProgress=tl.append("rect").attr("class","tl-progress").attr("x",0).attr("y",0);
  const tlGrid=tl.append("g");
  const tlTicks=tl.append("g");
  const tlAxis=tl.append("line").attr("class","tl-axis");
  const tlHead=tl.append("g").attr("class","tl-head-wrap");
  const tlHeadLine=tlHead.append("line").attr("class","tl-head");
  const tlKnob=tlHead.append("circle").attr("class","tl-knob").attr("r",7);
  let tlW=0, tlH=74, tlPad=14, xScale=null, baseY=46;

  function layoutTimeline(){
    tlW=document.getElementById("timeline").clientWidth||600;
    tl.attr("viewBox",`0 0 ${tlW} ${tlH}`);
    xScale=d3.scaleLinear().domain([T0,T1]).range([tlPad,tlW-tlPad]);
    baseY=44;
    tlAxis.attr("x1",tlPad).attr("y1",baseY).attr("x2",tlW-tlPad).attr("y2",baseY);
    // year grid
    const years=d3.range(2014,2027).map(y=>Date.UTC(y,0,1)).filter(ms=>ms>=T0&&ms<=T1);
    const g=tlGrid.selectAll("g.yr").data(years,d=>d).join(enter=>{
      const gg=enter.append("g").attr("class","yr");
      gg.append("line").attr("class","tl-grid");
      gg.append("text").attr("class","tl-yr");
      return gg;
    });
    g.select("line").attr("x1",d=>xScale(d)).attr("x2",d=>xScale(d)).attr("y1",14).attr("y2",baseY+8);
    g.select("text").attr("x",d=>xScale(d)+4).attr("y",baseY+20).text(d=>new Date(d).getUTCFullYear());
    // ticks per visit
    const tk=tlTicks.selectAll("line.tl-tick").data(VISITS,d=>d.seq).join("line")
      .attr("class",d=> "tl-tick"+(d.award?" medal":""))
      .attr("x1",d=>xScale(d.startMs)).attr("x2",d=>xScale(d.startMs))
      .attr("y1",d=> d.award?baseY-20:baseY-11).attr("y2",baseY);
    tlProgress.attr("y",14).attr("height",baseY-14+2);
    drawTimelineHead();
  }
  function drawTimelineHead(){
    if(!xScale) return;
    const x=xScale(playHeadMs);
    tlHeadLine.attr("x1",x).attr("x2",x).attr("y1",10).attr("y2",baseY+2);
    tlKnob.attr("cx",x).attr("cy",baseY+2);
    tlProgress.attr("x",tlPad).attr("width",Math.max(0,x-tlPad));
  }
  // drag / click on timeline
  function msFromEvent(ev){
    const rect=document.getElementById("timeline").getBoundingClientRect();
    const px=(ev.clientX-rect.left)*(tlW/rect.width);
    return xScale.invert(Math.max(tlPad,Math.min(tlW-tlPad,px)));
  }
  const tlDrag=d3.drag()
    .on("start",(ev)=>{ stopPlay(); scrubTo(msFromEvent(ev.sourceEvent)); })
    .on("drag",(ev)=> scrubTo(msFromEvent(ev.sourceEvent)));
  tl.call(tlDrag);
  document.getElementById("timeline").addEventListener("keydown",(e)=>{
    if(e.key==="ArrowRight"||e.key==="ArrowUp"){ stopPlay(); setActive(activeIdx+1,true); e.preventDefault(); }
    else if(e.key==="ArrowLeft"||e.key==="ArrowDown"){ stopPlay(); setActive(activeIdx-1,true); e.preventDefault(); }
    else if(e.key==="Home"){ stopPlay(); setActive(0,true); e.preventDefault(); }
    else if(e.key==="End"){ stopPlay(); setActive(N-1,true); e.preventDefault(); }
  });

  // ---- play ----
  let playing=false, playTimer=null, stepMs=850;
  const playBtn=document.getElementById("play");
  function play(){
    if(activeIdx>=N-1) setActive(0,false);
    playing=true; playBtn.textContent="\u275A\u275A"; playBtn.setAttribute("aria-label","Pause");
    schedule();
  }
  function schedule(){
    clearTimeout(playTimer);
    playTimer=setTimeout(()=>{
      if(!playing) return;
      if(activeIdx>=N-1){ stopPlay(); return; }
      setActive(activeIdx+1,true);
      schedule();
    }, stepMs);
  }
  function stopPlay(){
    playing=false; clearTimeout(playTimer);
    playBtn.textContent="\u25B6"; playBtn.setAttribute("aria-label","Play the journey");
  }
  playBtn.addEventListener("click",()=> playing?stopPlay():play());
  document.querySelectorAll(".speed button").forEach(b=>{
    b.addEventListener("click",()=>{
      document.querySelectorAll(".speed button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on"); stepMs=+b.dataset.sp;
      if(playing) schedule();
    });
  });

  // zoom buttons
  document.getElementById("zin").addEventListener("click",()=> svg.transition().duration(250).call(zoom.scaleBy,1.6));
  document.getElementById("zout").addEventListener("click",()=> svg.transition().duration(250).call(zoom.scaleBy,1/1.6));
  document.getElementById("zreset").addEventListener("click",()=> svg.transition().duration(400).call(zoom.transform,d3.zoomIdentity));

  // ---- init ----
  document.querySelectorAll("svg.mico g.mg").forEach(g=> g.innerHTML=MEDAL_MARKUP);
  let rz;
  window.addEventListener("resize",()=>{ clearTimeout(rz); rz=setTimeout(layout,120); });
  layout();
  setActive(0,false);
  // gentle intro: auto-play a few after load
  if(!reduced) setTimeout(()=>{ if(activeIdx===0 && !playing) play(); }, 900);
})();
