import {clamp,SCENES,SCALES,LANES,LS_KEY,SECTIONS_BY_NAME,DEFAULT_SONG,STYLE_ORDER} from './core.js';
import {eng,EngineProto} from './engine.js';
import {seq,genMotif,resetArrange,bounce,blendedScene,euclid} from './music.js';
import {lop,bufferToWav,bufferToWav24,downloadBlob} from './looper.js';
import {viz} from './viz.js';

const $=s=>document.querySelector(s);
function safeOn(sel,ev,fn){
  const el=$(sel);
  if(el) el.addEventListener(ev,fn);
  else console.warn('PSYWEAVE: missing element',sel);
}
let toastT=null;
function toast(msg,fatal){
  const el=$('#toast'); if(!el) return;
  el.textContent=msg;
  el.classList.add('show');
  el.classList.toggle('fatal',!!fatal);
  clearTimeout(toastT);
  toastT=setTimeout(()=>el.classList.remove('show'),fatal?5000:2200);
}
window.addEventListener('error',e=>toast('שגיאה: '+(e.message||'unknown'),true));
function masterToTarget(buf,rmsTargetDb){
  let peak=0,sq=0,n=0;
  for(let ch=0;ch<buf.numberOfChannels;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<d.length;i++){
      const v=d[i]; const a=Math.abs(v);
      if(a>peak)peak=a;
      if(i%4===0){sq+=v*v;n++;}
    }
  }
  if(peak<0.001) return buf;
  const rmsDb=10*Math.log10(Math.max(1e-9,sq/n));
  let gain=Math.pow(10,(rmsTargetDb-rmsDb)/20);
  if(peak*gain>0.98) gain=0.98/peak;
  for(let ch=0;ch<buf.numberOfChannels;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<d.length;i++) d[i]*=gain;
  }
  return buf;
}
/* v13: true K-weighted LUFS (ITU-R BS.1770-4) for offline renders */
function biquadBuf(d,b,a){
  let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<d.length;i++){
    const x=d[i];
    const y=b[0]*x+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2;
    x2=x1;x1=x;y2=y1;y1=y;
    d[i]=y;
  }
}
function kLufs(buf){
  if(Math.abs(buf.sampleRate-44100)>1){
    let sq=0,n=0;
    for(let ch=0;ch<buf.numberOfChannels;ch++){
      const d=buf.getChannelData(ch);
      for(let i=0;i<d.length;i+=4){sq+=d[i]*d[i];n++;}
    }
    return 10*Math.log10(Math.max(1e-9,sq/n))-0.6;
  }
  const b1=[1.53512485958697,-2.69169618940638,1.19839281085285],a1=[1,-1.69065929318241,0.73248077421585];
  const b2=[1,-2,1],a2=[1,-1.99004745483398,0.99007225036621];
  const data=[];
  for(let c=0;c<buf.numberOfChannels;c++){
    const d=buf.getChannelData(c).slice(0);
    biquadBuf(d,b1,a1); biquadBuf(d,b2,a2);
    data.push(d);
  }
  const sr=buf.sampleRate,n=buf.length;
  const bs=Math.floor(sr*0.4),step=Math.floor(bs/4);
  const blocks=[];
  for(let st=0;st+bs<=n;st+=step){
    let ms=0;
    for(let c=0;c<data.length;c++){
      const d=data[c]; let s2=0;
      for(let i=st;i<st+bs;i+=4) s2+=d[i]*d[i];
      ms+=s2/(bs/4);
    }
    blocks.push(-0.691+10*Math.log10(ms+1e-10));
  }
  if(!blocks.length) return -70;
  const abs=blocks.filter(l=>l>-70);
  const mAbs=abs.reduce((s3,l)=>s3+Math.pow(10,(l+0.691)/10),0)/Math.max(1,abs.length);
  const gate=-0.691+10*Math.log10(mAbs)-10;
  const rel=blocks.filter(l=>l>gate);
  const mRel=rel.reduce((s3,l)=>s3+Math.pow(10,(l+0.691)/10),0)/Math.max(1,rel.length);
  return -0.691+10*Math.log10(mRel);
}
function masterToTargetLufs(buf,targetLufs){
  const before=kLufs(buf);
  let gain=Math.pow(10,(targetLufs-before)/20);
  let peak=0;
  for(let ch=0;ch<buf.numberOfChannels;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<d.length;i+=2){const a=Math.abs(d[i]); if(a>peak)peak=a;}
  }
  if(peak*gain>0.98) gain=0.98/Math.max(1e-6,peak);
  for(let ch=0;ch<buf.numberOfChannels;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<d.length;i++) d[i]*=gain;
  }
  return {buf:buf,lufs:kLufs(buf),peak:peak*gain};
}
function rmsDb(buf){
  let sq=0,n=0;
  for(let ch=0;ch<buf.numberOfChannels;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<d.length;i+=8){sq+=d[i]*d[i]; n++;}
  }
  return 10*Math.log10(Math.max(1e-9,sq/n));
}
function normalizeBuffer(buf,target){
  let peak=0;
  for(let ch=0;ch<buf.numberOfChannels;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<d.length;i++){const v=Math.abs(d[i]); if(v>peak)peak=v;}
  }
  if(peak<0.001) return buf;
  const gg=target/peak;
  for(let ch=0;ch<buf.numberOfChannels;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<d.length;i++) d[i]*=gg;
  }
  return buf;
}
if(location.protocol==='file:'){
  setTimeout(()=>toast('קבצים לא רצים ישירות! הרץ בתיקייה: python3 -m http.server',true),600);
}

let state={
  bpm:142,scene:0,autoArr:true,swing:0.12,arp:false,roll:false,stylePos:0.3333,styleX:0.92,styleY:0.95,styleOverride:null,
  song:DEFAULT_SONG.slice(),
  macros:{filter:0.85,space:0.35,drive:0.15,morphX:0.5,morphY:0.45},
  edits:{},ccMap:{},patterns:null,scaleArr:SCALES[SCENES[0].scale],
};

function projectData(){
  return {v:5,bpm:state.bpm,scene:state.scene,autoArr:state.autoArr,swing:state.swing,
          arp:state.arp,song:state.song,stylePos:state.stylePos,styleX:state.styleX,styleY:state.styleY,styleOverride:state.styleOverride,
          macros:state.macros,edits:state.edits,ccMap:state.ccMap};
}
function applyProject(d,silent){
  if(!d||typeof d!=='object') return;
  if(typeof d.bpm==='number') state.bpm=clamp(d.bpm,120,160)|0;
  if(Number.isInteger(d.scene)&&SCENES[d.scene]) state.scene=d.scene;
  if(typeof d.autoArr==='boolean') state.autoArr=d.autoArr;
  if(typeof d.swing==='number') state.swing=clamp(d.swing);
  if(typeof d.arp==='boolean') state.arp=d.arp;
  if(typeof d.stylePos==='number') state.stylePos=clamp(d.stylePos);
  if(typeof d.styleX==='number') state.styleX=clamp(d.styleX);
  if(typeof d.styleY==='number') state.styleY=clamp(d.styleY);
  if(d.styleOverride===null||Number.isInteger(d.styleOverride)) state.styleOverride=d.styleOverride;
  if(typeof d.styleX!=='number'){
    if(CORNER_SCENES[d.scene]){state.styleX=CORNER_SCENES[d.scene][0];state.styleY=CORNER_SCENES[d.scene][1];state.styleOverride=null;}
    else if(Number.isInteger(d.scene)&&SCENES[d.scene]) state.styleOverride=d.scene;
  }
  if(Array.isArray(d.song)&&d.song.length){
    state.song=d.song.map(n=>SECTIONS_BY_NAME[n]?n:'DROP');
  }
  if(d.macros) Object.keys(state.macros).forEach(k=>{
    if(typeof d.macros[k]==='number') state.macros[k]=clamp(d.macros[k]);
  });
  if(d.edits&&typeof d.edits==='object') state.edits=d.edits;
  if(d.ccMap&&typeof d.ccMap==='object') state.ccMap=d.ccMap;
  if(!silent){
    applyScene(state.scene,{init:true});
    setBpm(state.bpm);
    renderAuto(); renderArp(); renderXY(); refreshKnobs(); buildSong();
    toast('פרויקט נטען ✓');
  }
}
function loadState(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(!raw) return;
    applyProject(JSON.parse(raw),true);
  }catch(e){}
}
let saveT=null;
function save(){
  clearTimeout(saveT);
  saveT=setTimeout(()=>{
    try{localStorage.setItem(LS_KEY,JSON.stringify(projectData()));}catch(e){}
  },400);
}

const SECTION_NAMES=Object.keys(SECTIONS_BY_NAME);
function buildSong(){
  const wrap=$('#songChain'); if(!wrap) return;
  wrap.innerHTML='';
  state.song.forEach((n,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='songchip '+n;
    b.textContent=n;
    b.addEventListener('pointerdown',e=>{e.preventDefault(); cycleSong(i);});
    wrap.appendChild(b);
  });
}
function cycleSong(i){
  const idx=SECTION_NAMES.indexOf(state.song[i]);
  state.song[i]=SECTION_NAMES[(idx+1)%SECTION_NAMES.length];
  resetArrange(); buildSong(); save();
}
const sf=$('#styleField');
if(sf){
  let dragF=false;
  const lightF=e=>{
    const r=sf.getBoundingClientRect();
    state.styleX=clamp((e.clientX-r.left)/r.width);
    state.styleY=clamp(1-(e.clientY-r.top)/r.height);
    const sc=blendedScene(state);
    document.documentElement.style.setProperty('--hue',Math.round(sc.hue));
    setBpm(sc.bpm);
    const dot=$('#styleDot');
    if(dot){dot.style.left=(state.styleX*100)+'%';dot.style.top=((1-state.styleY)*100)+'%';}
    const sn=$('#styleName'); if(sn) sn.textContent=sc.heb+' · '+sc.bpm+' BPM';
  };
  sf.addEventListener('pointerdown',e=>{dragF=true; sf.setPointerCapture(e.pointerId); lightF(e); e.preventDefault();});
  sf.addEventListener('pointermove',e=>{if(dragF)lightF(e);});
  sf.addEventListener('pointerup',()=>{if(dragF){dragF=false; applyStyle(false);}});
  sf.addEventListener('pointercancel',()=>{dragF=false;});
}
safeOn('#btnSongReset','click',()=>{
  state.song=DEFAULT_SONG.slice();
  resetArrange(); buildSong(); save();
  toast('שרשרת הסקציות אופסה');
});

function percArr(sc){const a=new Array(16).fill(0); sc.perc.forEach(i=>a[i]=1); return a;}
function defaultsFor(i){
  const sc=SCENES[i];
  return {muts:0,patterns:{kick:[...sc.kick],bass:[...sc.bass],hat:[...sc.hat],lead:[...sc.gate],perc:percArr(sc)}};
}
function currentEdit(){
  if(!state.edits[state.scene]) state.edits[state.scene]=defaultsFor(state.scene);
  return state.edits[state.scene];
}
function regenMotif(){
  const sc=SCENES[state.scene];
  seq.motif=genMotif(sc.seed+currentEdit().muts*7+3,state.scaleArr);
}

function buildScenes(){
  const wrap=$('#scenes'); if(!wrap) return;
  wrap.innerHTML='';
  SCENES.forEach((sc,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='scene'+(i===state.scene?' active':'');
    b.innerHTML=sc.heb+'<small>'+sc.name+' · '+sc.bpm+'</small>';
    b.addEventListener('click',()=>applyScene(i));
    wrap.appendChild(b);
  });
}
const CORNER_SCENES={1:[0.08,0.8],0:[0.92,0.95],2:[0.08,0.45],4:[0.92,0.45]};
function applyStyle(announce){
  const sc=blendedScene(state);
  state.scene=sc.nearIdx;
  state.scaleArr=SCALES[sc.scale];
  state.patterns=currentEdit().patterns;
  regenMotif();
  document.documentElement.style.setProperty('--hue',Math.round(sc.hue));
  buildScenes(); rebuildGrid(); resetArrange();
  setBpm(sc.bpm);
  const sn=$('#styleName');
  if(sn) sn.textContent=sc.heb+' · '+sc.bpm+' BPM';
  const dot=$('#styleDot');
  if(dot&&state.styleOverride===null){
    dot.style.left=(state.styleX*100)+'%';
    dot.style.top=((1-state.styleY)*100)+'%';
  }
  save();
  if(announce) toast('סגנון: '+sc.heb+' ('+sc.name+')');
}
function applyScene(i,opts){
  opts=opts||{};
  if(CORNER_SCENES[i]){
    state.styleOverride=null;
    state.styleX=CORNER_SCENES[i][0];
    state.styleY=CORNER_SCENES[i][1];
  }else{
    state.styleOverride=i;
  }
  applyStyle(!opts.init);
}

const undoStack=[];
function pushUndo(){
  undoStack.push(JSON.stringify(state.patterns));
  if(undoStack.length>40) undoStack.shift();
}
function doUndo(){
  if(!undoStack.length){toast('אין מה לבטל'); return;}
  state.patterns=JSON.parse(undoStack.pop());
  rebuildGrid(); save();
  toast('בוטל ↩');
}
safeOn('#btnUndo','click',doUndo);

const gridEl=$('#grid');
let colEls=[],phCol=-1;
function rebuildGrid(){
  if(!gridEl) return;
  gridEl.innerHTML='';
  colEls=Array.from({length:16},()=>[]); phCol=-1;
  LANES.forEach(lane=>{
    const row=document.createElement('div'); row.className='lane';
    const lab=document.createElement('div'); lab.className='lane-label';
    const rnd=document.createElement('button'); rnd.type='button'; rnd.className='lanebtn'; rnd.textContent='🎲';
    rnd.addEventListener('pointerdown',e=>{e.preventDefault(); pushUndo(); randomizeLane(lane.id);});
    const clr=document.createElement('button'); clr.type='button'; clr.className='lanebtn'; clr.textContent='✕';
    clr.addEventListener('pointerdown',e=>{e.preventDefault(); pushUndo(); clearLane(lane.id);});
    const span=document.createElement('span'); span.textContent=lane.heb;
    lab.appendChild(rnd); lab.appendChild(clr); lab.appendChild(span);
    row.appendChild(lab);
    for(let i=0;i<16;i++){
      const p=document.createElement('button'); p.type='button';
      p.className='pad'+(state.patterns[lane.id][i]?' on':'')+(i%4===0&&i>0?' g4':'');
      p.addEventListener('pointerdown',e=>{
        e.preventDefault();
        pushUndo();
        state.patterns[lane.id][i]=state.patterns[lane.id][i]?0:1;
        p.classList.toggle('on',!!state.patterns[lane.id][i]);
        save();
      });
      row.appendChild(p); colEls[i].push(p);
    }
    gridEl.appendChild(row);
  });
}
function randomizeLane(id){
  const P=state.patterns[id];
  const dens={kick:0.15,bass:0.6,hat:0.55,lead:0.45,perc:0.25}[id];
  for(let i=0;i<16;i++){
    if(id==='kick') P[i]=((i%4===0)||Math.random()<dens)?1:0;
    else P[i]=Math.random()<dens?1:0;
  }
  rebuildGrid(); save();
}
function clearLane(id){
  state.patterns[id].fill(0);
  rebuildGrid(); save();
}
function setPlayhead(s){
  if(phCol>=0&&colEls[phCol]) colEls[phCol].forEach(e=>e.classList.remove('ph'));
  phCol=s;
  if(s>=0&&colEls[s]) colEls[s].forEach(e=>e.classList.add('ph'));
}

const knobRenders=[];
let learnArmed=false,learnTarget=null;
function refreshKnobs(){knobRenders.forEach(r=>r());}
function bindKnob(el,key,post){
  if(!el) return;
  let dragging=false,sy=0,sv=0;
  const kval=el.parentElement.querySelector('.kval');
  const render=()=>{
    const v=state.macros[key];
    el.style.setProperty('--v',v);
    el.style.setProperty('--rot',(-135+v*270)+'deg');
    if(kval) kval.textContent=String(Math.round(v*100));
  };
  knobRenders.push(render);
  el.addEventListener('pointerdown',e=>{
    if(learnArmed){
      learnTarget=key;
      toast('LEARN: '+key+' — הזז כפתור במכשיר ה-MIDI');
      e.preventDefault();
      return;
    }
    dragging=true; sy=e.clientY; sv=state.macros[key];
    el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  el.addEventListener('pointermove',e=>{
    if(!dragging) return;
    state.macros[key]=clamp(sv+(sy-e.clientY)/140);
    render(); if(post)post(state.macros[key]); eng.applyMacros(); save();
  });
  const up=()=>{dragging=false;};
  el.addEventListener('pointerup',up);
  el.addEventListener('pointercancel',up);
  render();
}
const xy=$('#xy'),xydot=$('#xydot');
function renderXY(){
  if(!xy||!xydot) return;
  xydot.style.left=(state.macros.morphX*100)+'%';
  xydot.style.top=((1-state.macros.morphY)*100)+'%';
  xy.style.setProperty('--dx',(state.macros.morphX*100)+'%');
  xy.style.setProperty('--dy',((1-state.macros.morphY)*100)+'%');
}
if(xy){
  let drag=false;
  const setFromEvent=e=>{
    const r=xy.getBoundingClientRect();
    state.macros.morphX=clamp((e.clientX-r.left)/r.width);
    state.macros.morphY=clamp(1-(e.clientY-r.top)/r.height);
    renderXY(); eng.applyMacros(); save();
  };
  xy.addEventListener('pointerdown',e=>{drag=true; xy.setPointerCapture(e.pointerId); setFromEvent(e); e.preventDefault();});
  xy.addEventListener('pointermove',e=>{if(drag) setFromEvent(e);});
  xy.addEventListener('pointerup',()=>drag=false);
  xy.addEventListener('pointercancel',()=>drag=false);
}

function setBpm(v){
  state.bpm=clamp(Math.round(v),120,160);
  const bv=$('#bpmVal'),bs=$('#bpmSlider');
  if(bv) bv.textContent=String(state.bpm);
  if(bs) bs.value=String(state.bpm);
  eng.applyMacros();
  lop.updateRates();
  save();
}
safeOn('#bpmSlider','input',e=>setBpm(parseInt(e.target.value,10)));
safeOn('#btnPlay','click',()=>{
  if(seq.playing){seq.stop(); $('#btnPlay').textContent='▶'; $('#btnPlay').classList.remove('playing');}
  else{seq.start(); $('#btnPlay').textContent='■'; $('#btnPlay').classList.add('playing');}
});
safeOn('#btnPerform','click',()=>document.body.classList.toggle('perform'));

let taps=[];
safeOn('#btnTap','click',()=>{
  const now=performance.now();
  taps=taps.filter(t=>now-t<2500);
  taps.push(now);
  if(taps.length>=3){
    let s=0;
    for(let i=1;i<taps.length;i++) s+=taps[i]-taps[i-1];
    const avg=s/(taps.length-1);
    setBpm(60000/avg);
  }
});

const btnAuto=$('#btnAuto');
function renderAuto(){
  if(!btnAuto) return;
  btnAuto.classList.toggle('on',state.autoArr);
  btnAuto.textContent=state.autoArr?'AUTO ▸ ON':'AUTO ▸ OFF';
}
safeOn('#btnAuto','click',()=>{state.autoArr=!state.autoArr; resetArrange(); renderAuto(); save();});

function renderArp(){
  const el=$('#aArp'); if(el) el.classList.toggle('on',!!state.arp);
}
safeOn('#aArp','click',()=>{
  state.arp=!state.arp;
  renderArp(); save();
  toast(state.arp?'ARP ON — ארפגיו דיאטוני על הליד':'ARP OFF');
});

safeOn('#aRise','click',()=>{
  if(!seq.playing){toast('קודם לחץ PLAY'); return;}
  eng.build(seq.nextBarBoundary(),2*eng.barDur());
  toast('RISE — 2 תיבות');
});
safeOn('#aDrop','click',()=>{
  if(!eng.ctx){toast('קודם לחץ PLAY'); return;}
  eng.drop(); toast('DROP!');
});
safeOn('#aFill','click',()=>{
  if(!seq.playing){toast('קודם לחץ PLAY'); return;}
  eng.fill(seq.nextBarBoundary());
  toast('FILL — תיבה הבאה');
});
safeOn('#aZap','click',()=>{
  if(!eng.ctx){toast('קודם לחץ PLAY'); return;}
  eng.zap();
});
safeOn('#aMut','click',()=>{
  currentEdit().muts++;
  regenMotif(); save();
  toast('מוטציה למלודיה');
});

/* v11 smart play */
function playLick(kind){
  if(!eng.ctx){toast('קודם לחץ PLAY'); return;}
  const t0=eng.ctx.currentTime+0.03;
  const st=state,sc=blendedScene(st),sd=60/st.bpm/4,scale=st.scaleArr;
  if(kind==='bass'){
    const offs=[0,0,scale[Math.min(4,scale.length-1)]||7,0];
    offs.forEach((off,k)=>eng.bass(t0+k*sd,sc.root+off,false));
  }else if(kind==='lead'){
    const mot=seq.motif.a;
    for(let k=0;k<6;k++){
      const deg=mot[Math.floor(Math.random()*16)];
      eng.lead(t0+k*sd*0.5,sc.root+24+scale[deg],sd*0.45,sc.leadType,1);
    }
  }else if(kind==='stab'){
    sc.chord.forEach(c=>eng.lead(t0,sc.root+12+c,sd*1.5,sc.leadType,0.8));
  }else{ eng.zap(); }
}
function jam(){
  pushUndo();
  const P=state.patterns;
  for(let i=0;i<16;i++){P.kick[i]=(i%4===0)?1:0;}
  if(Math.random()<0.25){
    const extra=2+Math.floor(Math.random()*3);
    for(let k=0;k<extra;k++){const i=Math.floor(Math.random()*16); if(i%4!==0)P.kick[i]=1;}
  }
  const hp=euclid(5+Math.floor(Math.random()*5),16,Math.floor(Math.random()*4));
  const pp=euclid(2+Math.floor(Math.random()*4),16,1+Math.floor(Math.random()*3));
  for(let i=0;i<16;i++){
    P.hat[i]=hp[i];
    if(P.perc) P.perc[i]=pp[i];
  }
  currentEdit().muts++;
  regenMotif();
  rebuildGrid(); save();
  toast('JAM — גרוב אוקלידי חדש');
}
safeOn('#pBass','click',()=>playLick('bass'));
safeOn('#pLead','click',()=>playLick('lead'));
safeOn('#pStab','click',()=>playLick('stab'));
safeOn('#pFx','click',()=>playLick('fx'));
safeOn('#btnJam','click',jam);
const rollBtn=$('#btnRoll');
if(rollBtn){
  const off=()=>{state.roll=false; rollBtn.classList.remove('on');};
  rollBtn.addEventListener('pointerdown',e=>{e.preventDefault(); state.roll=true; rollBtn.classList.add('on');});
  rollBtn.addEventListener('pointerup',off);
  rollBtn.addEventListener('pointercancel',off);
  rollBtn.addEventListener('pointerleave',off);
}
safeOn('#btnRec','click',()=>{
  if(!seq.playing){seq.start(); $('#btnPlay').textContent='■'; $('#btnPlay').classList.add('playing');}
  lop.tap();
});
lop.onArm=b=>{const el=$('#btnRec'); if(el) el.classList.toggle('armed',b);};
lop.onRec=b=>{
  const el=$('#btnRec'); if(!el) return;
  el.classList.toggle('recording',b);
  el.textContent=b?'●':'REC';
};
document.querySelectorAll('.seg button').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.seg button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    lop.recSel=parseInt(b.dataset.bars,10);
  });
});

let micStream=null,micSrcNode=null;
safeOn('#btnMic','click',async()=>{
  eng.init(); eng.ctx.resume();
  if(micStream){
    micStream.getTracks().forEach(tr=>tr.stop());
    try{micSrcNode.disconnect();}catch(e){}
    micStream=null; $('#btnMic').classList.remove('on');
    toast('המיקרופון נותק'); return;
  }
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    micSrcNode=eng.ctx.createMediaStreamSource(micStream);
    micSrcNode.connect(eng.recDest);
    $('#btnMic').classList.add('on');
    toast('מיקרופון מחובר — נכנס להקלטות');
  }catch(e){toast('המיקרופון לא זמין');}
});

let exporting=false;
safeOn('#btnExport','click',async()=>{
  if(exporting) return;
  exporting=true;
  const btn=$('#btnExport'); if(btn){btn.classList.add('busy'); btn.textContent='...';}
  toast('מייצא WAV ('+lop.recSel+' תיבות)...');
  try{
    const m=masterToTargetLufs(await bounce(lop.recSel),-9);
    downloadBlob(bufferToWav24(m.buf),'psyweave-'+state.bpm+'bpm-'+lop.recSel+'bars.wav');
    toast('WAV ⬇ · '+m.lufs.toFixed(1)+' LUFS · פיק '+Math.round(m.peak*100)+'%');
  }catch(e){toast('שגיאת ייצוא: '+(e&&e.message?e.message:'unknown'),true);}
  exporting=false;
  if(btn){btn.classList.remove('busy'); btn.textContent='⬇ WAV';}
});

let stemsBusy=false;
safeOn('#btnStems','click',async()=>{
  if(stemsBusy) return;
  stemsBusy=true;
  const btn=$('#btnStems'); if(btn){btn.classList.add('busy'); btn.textContent='...';}
  const none={kick:false,bass:false,hat:false,lead:false,pad:false,perc:false,loops:false};
  const jobs=[
    ['drums',Object.assign({},none,{kick:true,hat:true,perc:true})],
    ['bass',Object.assign({},none,{bass:true})],
    ['lead',Object.assign({},none,{lead:true})],
    ['pads',Object.assign({},none,{pad:true})],
  ];
  if(lop.layers.some(L=>L.buf)) jobs.push(['loops',Object.assign({},none,{loops:true})]);
  try{
    for(const j of jobs){
      toast('מייצא STEM: '+j[0]+'...');
      const buf=normalizeBuffer(await bounce(lop.recSel,j[1]),0.95);
      downloadBlob(bufferToWav(buf),'psyweave-stem-'+j[0]+'-'+state.bpm+'bpm.wav');
    }
    toast('כל ה-STEMS ירדו ⬇');
  }catch(e){toast('שגיאת ייצוא STEMS',true);}
  stemsBusy=false;
  if(btn){btn.classList.remove('busy'); btn.textContent='STEMS';}
});

safeOn('#btnSave','click',()=>{
  const blob=new Blob([JSON.stringify(projectData(),null,2)],{type:'application/json'});
  downloadBlob(blob,'psyweave-project.json');
  toast('פרויקט נשמר לקובץ ✓');
});
safeOn('#btnLoad','click',()=>{const fi=$('#fileInput'); if(fi) fi.click();});
safeOn('#fileInput','change',async e=>{
  const f=e.target.files&&e.target.files[0];
  e.target.value='';
  if(!f) return;
  try{
    const d=JSON.parse(await f.text());
    applyProject(d,false);
  }catch(err){toast('קובץ לא תקין',true);}
});

let midiAccess=null;
function attachMidiInputs(){
  if(!midiAccess) return;
  midiAccess.inputs.forEach(inp=>{inp.onmidimessage=onMidiMsg;});
}
function onMidiMsg(e){
  const d=e.data;
  if(!d||d.length<3) return;
  if((d[0]&0xF0)!==0xB0) return;
  const cc=d[1],val=d[2]/127;
  if(learnArmed&&learnTarget){
    state.ccMap[String(cc)]=learnTarget;
    toast('MIDI CC '+cc+' → '+learnTarget+' ✓');
    learnArmed=false; learnTarget=null;
    const bl=$('#btnLearn'); if(bl) bl.classList.remove('on');
    save();
    return;
  }
  const key=state.ccMap[String(cc)];
  if(key&&state.macros[key]!==undefined){
    state.macros[key]=val;
    eng.applyMacros(); refreshKnobs(); save();
  }
}
safeOn('#btnMidi','click',async()=>{
  if(midiAccess){toast('MIDI כבר מחובר'); return;}
  if(!navigator.requestMIDIAccess){toast('MIDI לא נתמך בדפדפן הזה'); return;}
  try{
    midiAccess=await navigator.requestMIDIAccess();
    attachMidiInputs();
    midiAccess.onstatechange=attachMidiInputs;
    const bm=$('#btnMidi'); if(bm) bm.classList.add('on');
    let n=0; midiAccess.inputs.forEach(()=>n++);
    toast(n? 'MIDI מחובר ('+n+' התקנים)':'MIDI פעיל — אין התקנים עדיין');
  }catch(err){toast('בקשת MIDI נדחתה',true);}
});
safeOn('#btnLearn','click',()=>{
  if(!midiAccess){toast('קודם לחץ MIDI'); return;}
  learnArmed=!learnArmed; learnTarget=null;
  const bl=$('#btnLearn'); if(bl) bl.classList.toggle('on',learnArmed);
  if(learnArmed) toast('לחץ על אחד המקרואים, ואז הזז כפתור במכשיר');
});

window.addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault(); const pb=$('#btnPlay'); if(pb) pb.click();}
  else if(e.key>='1'&&e.key<='7') applyScene(parseInt(e.key,10)-1);
  else if(e.key==='r'||e.key==='R'||e.key==='ר'){const el=$('#btnRec'); if(el) el.click();}
  else if(e.key==='m'||e.key==='M'||e.key==='צ'){const el=$('#aMut'); if(el) el.click();}
  else if(e.key==='d'||e.key==='D'){const el=$('#aDrop'); if(el) el.click();}
  else if(e.key==='f'||e.key==='F'){const el=$('#aFill'); if(el) el.click();}
  else if(e.key==='u'||e.key==='U') doUndo();
  else if(e.key==='q'||e.key==='Q') playLick('bass');
  else if(e.key==='w'||e.key==='W') playLick('lead');
  else if(e.key==='e'||e.key==='E') playLick('stab');
  else if(e.key==='j'||e.key==='J') jam();
});

let freqArr=null,pulse=0;
function frame(){
  requestAnimationFrame(frame);
  if(eng.ctx){
    if(!freqArr) freqArr=new Uint8Array(eng.analyser.frequencyBinCount);
    while(seq.uiQ.length&&seq.uiQ[0].t<=eng.ctx.currentTime+0.012){
      const u=seq.uiQ.shift();
      setPlayhead(u.s);
      if(u.s===0){
        pulse=1;
        const bl=$('#barLbl'); if(bl) bl.textContent='BAR '+((u.bar%8)+1);
        const sc=$('#secChip'); if(sc) sc.textContent=(state.autoArr?'AUTO':'MANUAL')+' ▸ '+u.label;
      }
    }
    eng.analyser.getByteFrequencyData(freqArr);
  }else{
    while(seq.uiQ.length) seq.uiQ.shift();
  }
  pulse*=0.9;
  let bass=0;
  if(freqArr&&seq.playing){
    for(let i=2;i<12;i++) bass+=freqArr[i];
    bass/=(10*255);
  }
  viz.draw(freqArr,bass,SCENES[state.scene].hue,pulse,seq.playing);
  lop.meters();
}

/* v14: SOUND DOCTOR — measurement instead of guessing */
function analyzeBuf(buf){
  const d=buf.getChannelData(0),n=d.length;
  let peak=0,sq=0,c=0,l=0,h=0,lo=0,mi=0,hi=0;
  const aL=2*Math.PI*250/44100,aH=2*Math.PI*3000/44100;
  for(let i=0;i<n;i+=4){
    const x=d[i]; const a=Math.abs(x); if(a>peak)peak=a;
    sq+=x*x; c++;
    l+=aL*(x-l); h+=aH*(x-h);
    lo+=l*l; mi+=(h-l)*(h-l); hi+=(x-h)*(x-h);
  }
  const rms=Math.sqrt(sq/c),tot=lo+mi+hi+1e-9;
  return {lufs:kLufs(buf),peak:peak,rms:rms,crest:20*Math.log10(peak/(rms+1e-9)),
    low:Math.round(lo/tot*100),mid:Math.round(mi/tot*100),high:Math.round(hi/tot*100)};
}
async function sndDoctor(){
  if(!eng.ctx){toast('קודם לחץ PLAY');return;}
  toast('DOCTOR: מרנדר 2 תיבות...');
  try{
    const rep=analyzeBuf(await bounce(2));
    toast('LUFS '+rep.lufs.toFixed(1)+' · Crest '+rep.crest.toFixed(1)+'dB · Low '+rep.low+'% Mid '+rep.mid+'% High '+rep.high+'%',true);
  }catch(e){toast('DOCTOR נכשל: '+(e.message||'unknown'),true);}
}
/* v16: SOUND DOCTOR v2 — tests every voice on the real device audio engine */
async function voiceDoctor(){
  const dEl=$('#doctor'); if(!dEl) return;
  dEl.style.display='block';
  dEl.innerHTML='<b>SOUND DOCTOR</b><div class="dsub">בודק כל כלי בנפרד על מנוע האודיו של המכשיר...</div>';
  const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const SR=(eng.ctx?eng.ctx.sampleRate:44100)||44100;
  const DUR=0.7;
  const voices=[
    ['KICK',e=>e.kick(0.1,1)],
    ['BASS',e=>e.bass(0.1,42,false)],
    ['HAT-C',e=>e.hat(0.1,false,0.16,0)],
    ['HAT-O',e=>e.hat(0.1,true,0.12,0)],
    ['CLAP',e=>e.clap(0.1,1,0)],
    ['PERC',e=>e.perc(0.1,330,0)],
    ['LEAD',e=>e.lead(0.1,66,0.25,'supersaw',1)],
    ['ACID',e=>e.lead(0.1,66,0.25,'acid',1)],
    ['PAD',e=>e.pad(0.1,42,[0,7],1)],
  ];
  let html='<b>SOUND DOCTOR</b>';
  let bad=0;
  for(const v of voices){
    let row;
    try{
      const octx=new OAC(2,Math.ceil(SR*DUR),SR);
      const inst=Object.create(EngineProto);
      inst.bind({bpm:142,macros:state.macros,swing:state.swing});
      inst.init(octx);
      inst.applyMacros();
      v[1](inst);
      const buf=await octx.startRendering();
      const d=buf.getChannelData(0);
      let s2=0; const i0=Math.floor(0.08*SR),i1=Math.min(d.length,Math.floor(0.6*SR));
      for(let i=i0;i<i1;i++) s2+=d[i]*d[i];
      const val=Math.sqrt(s2/Math.max(1,i1-i0));
      const verdict=val>0.003?'OK':(val>0.0005?'WEAK':'SILENT');
      if(verdict!=='OK') bad++;
      const pct=Math.min(100,Math.round(val*500));
      row='<div class="drow"><span>'+v[0]+'</span><span class="dbar"><i style="width:'+pct+'%"></i></span><em class="'+verdict.toLowerCase()+'">'+verdict+'</em></div>';
    }catch(e){
      bad++;
      row='<div class="drow"><span>'+v[0]+'</span><span class="dbar"><i style="width:0%"></i></span><em class="silent">ERR</em></div>';
    }
    html+=row;
    dEl.innerHTML=html;
  }
  try{
    const rep=analyzeBuf(await bounce(2));
    html+='<div class="dsub">MIX: LUFS '+rep.lufs.toFixed(1)+' · Crest '+rep.crest.toFixed(1)+'dB · Low '+rep.low+'% Mid '+rep.mid+'% High '+rep.high+'%</div>';
  }catch(e){ html+='<div class="dsub">MIX: שגיאת מדידה</div>'; }
  html+='<div class="dsub">'+(bad?('נמצאו '+bad+' קולות בעייתיים — שלח לי צילום מסך'):'כל הכלים תקינים ✓')+' · '+APP_VERSION+'</div><div class="dclose">סגירה</div>';
  dEl.innerHTML=html;
  dEl.querySelector('.dclose').addEventListener('click',()=>{dEl.style.display='none';});
}
safeOn('#btnDoctor','click',voiceDoctor);

const APP_VERSION='v16';
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!window.__psyReload){window.__psyReload=1; location.reload();}
  });
}

/* init */
loadState();
eng.bind(state);
seq.bind(state);
lop.bind(state);
lop.toast=toast;
lop.container=$('#slots');
const bv0=$('#bpmVal'),bs0=$('#bpmSlider');
if(bv0) bv0.textContent=String(state.bpm);
if(bs0) bs0.value=String(state.bpm);
renderAuto();
renderArp();
const vt=$('#verTag'); if(vt) vt.textContent=APP_VERSION;
viz.init($('#viz'));
applyScene(state.scene,{init:true});
buildSong();
lop.render();
renderXY();
bindKnob($('#kFilter'),'filter',v=>{state.macros.drive=clamp(v*0.3);});
bindKnob($('#kSpace'),'space');
bindKnob($('#kDrive'),'morphX');
bindKnob($('#kSwing'),'swing');
refreshKnobs();
requestAnimationFrame(frame);
