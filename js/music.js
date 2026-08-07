import {SCENES,ARRANGEMENT,SECTIONS_BY_NAME,DEFAULT_SONG,STYLE_ORDER,mtof} from './core.js';
import {eng,EngineProto} from './engine.js';
import {lop} from './looper.js';

export function genMotif(seed,scale){
  const rnd=(function(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})(seed);
  const n=scale.length;
  const strong=[0,Math.min(4,n-1),Math.min(7,n-1)];
  const A=new Array(16);
  let deg=Math.min(7,n-1);
  for(let s=0;s<16;s++){
    if(s%4===0){
      deg=strong[Math.floor(rnd()*strong.length)];
      if(s===12) deg=rnd()<0.6?strong[0]:strong[1];
    }else{
      deg+=rnd()<0.5?-1:1;
      if(rnd()<0.12) deg+=rnd()<0.5?-2:2;
    }
    deg=Math.max(0,Math.min(n-1,deg));
    A[s]=deg;
  }
  A[14]=Math.min(A[14],1);
  A[15]=0;
  const B=A.map(d=>{
    const r=rnd();
    if(r<0.25) return Math.max(0,Math.min(n-1,d+(rnd()<0.5?-1:1)));
    if(r<0.33) return Math.min(n-1,d+7);
    return d;
  });
  return {a:A,b:B};
}


// v10: 2D style field — bilinear blend between PROG/GOA/DARK/FULL-ON corners
const CORNERS=[2,4,1,0];
function clamp01(v){return Math.max(0,Math.min(1,v));}
export function blendedScene(st){
  if(st.styleOverride!==undefined&&st.styleOverride!==null){
    const sc=SCENES[st.styleOverride];
    return {nearIdx:st.styleOverride,name:sc.name,heb:sc.heb,leadType:sc.leadType,pad:sc.pad,bassLong:sc.bassLong,
      root:sc.root,scale:sc.scale,chord:sc.chord,kick:sc.kick,bass:sc.bass,bassOct:sc.bassOct,hat:sc.hat,
      open:sc.open,clap:sc.clap,perc:sc.perc,gate:sc.gate,percFreq:sc.percFreq,hue:sc.hue,bpm:sc.bpm,seed:sc.seed};
  }
  const x=clamp01(st.styleX===undefined?0.5:st.styleX),y=clamp01(st.styleY===undefined?0.5:st.styleY);
  const C=CORNERS.map(i=>SCENES[i]);
  const w=[(1-x)*(1-y),x*(1-y),(1-x)*y,x*y];
  let mi=0; for(let k=1;k<4;k++) if(w[k]>w[mi]) mi=k;
  const near=C[mi];
  let bpm=0,hue=0,pf=0;
  for(let k=0;k<4;k++){bpm+=w[k]*C[k].bpm; hue+=w[k]*C[k].hue; pf+=w[k]*C[k].percFreq;}
  return {nearIdx:CORNERS[mi],name:near.name,heb:near.heb,leadType:near.leadType,pad:near.pad,bassLong:near.bassLong,
    root:near.root,scale:near.scale,chord:near.chord,kick:near.kick,bass:near.bass,bassOct:near.bassOct,hat:near.hat,
    open:near.open,clap:near.clap,perc:near.perc,gate:near.gate,percFreq:pf,hue:hue,bpm:Math.round(bpm),seed:near.seed};
}

// v10: one musical scheduler for live play + offline bounce (ENERGY & CHAOS aware)
export function scheduleNotes(E,st,sc,sec,P,s,tt,bar,fl,motifs){
  fl=fl||{kick:true,bass:true,hat:true,lead:true,pad:true,perc:true,loops:true};
  const en=st.macros?clamp01(st.macros.filter):0.85;
  const ch=clamp01(st.swing||0);
  if(fl.kick&&sec.kick&&P.kick[s]) E.kick(tt,s%4===0?1:0.92);
  if(fl.bass&&sec.bass&&P.bass[s]&&Math.random()>ch*0.1){
    E.bass(tt,sc.root+(sc.bassOct[s]||0),sc.bassLong);
  }
  if(fl.hat&&sec.hat){
    const keep=s%2===0||Math.random()<0.3+en*0.7;
    if(P.hat[s]&&keep) E.hat(tt,false,(0.09+en*0.08)*(s%4===0?1.25:1)*(1+((s*37)%5)*0.03*(1+ch*3)),s%2?0.18:-0.18);
    if(sc.open.includes(s)&&en>0.35) E.hat(tt,true,0.09+en*0.05,0);
    if(sc.clap.includes(s)) E.clap(tt,1,0);
    if(st.roll) E.hat(tt+(60/st.bpm/8),true,0.08+en*0.05,0);
  }
  if(fl.perc&&sec.perc&&P.perc&&P.perc[s]&&en>0.45) E.perc(tt,sc.percFreq,s%4<2?-0.35:0.35);
  if(fl.hat&&ch>0&&Math.random()<ch*0.03){
    const gf=mtof(sc.root+24+st.scaleArr[Math.floor(Math.random()*st.scaleArr.length)]);
    E.perc(tt,gf,Math.random()*0.8-0.4);
  }
  if(fl.lead&&sec.lead&&P.lead[s]){
    const mot=((bar>>1)%2===0)?motifs.a:motifs.b;
    const deg=mot[s];
    const oct=en>0.8?12:0;
    if(st.arp){
      const sdL=60/st.bpm/4;
      for(let k=0;k<4;k++){
        const d2=Math.min(st.scaleArr.length-1,deg+k*2);
        const midi=sc.root+24+st.scaleArr[d2]+oct;
        E.lead(tt+k*sdL,midi,sdL*0.5,sc.leadType,(s%4===0)?1:0.8);
      }
    }else{
      const midi=sc.root+24+st.scaleArr[deg]+oct;
      E.lead(tt,midi,(60/st.bpm/4)*(sc.leadType==='acid'?1.05:0.92),sc.leadType,(s%4===0)?1:0.8);
    }
  }
}

// v14: gentle motif mutation (evolution, not replacement)
function mutateMotif(m,n){
  const a=m.a.slice(),b=m.b.slice();
  for(let i=0;i<16;i++){
    if(Math.random()<0.18) a[i]=Math.max(0,Math.min(n-1,a[i]+(Math.random()<0.5?-1:1)));
  }
  for(let i=0;i<16;i++){
    if(Math.random()<0.25) b[i]=a[i];
    else if(Math.random()<0.1) b[i]=Math.max(0,Math.min(n-1,a[i]+1));
  }
  return {a:a,b:b};
}
// v14: Euclidean rhythms (Bjorklund)
export function euclid(pulses,steps,rot=0){
  pulses=Math.max(0,Math.min(steps,pulses));
  const p=[]; let bucket=0;
  for(let i=0;i<steps;i++){
    bucket+=pulses;
    if(bucket>=steps){bucket-=steps; p.push(1);} else p.push(0);
  }
  return p.map((_,i)=>p[(i+rot)%steps]);
}
function songAt(bar,st){
  const chain=(st.song&&st.song.length)?st.song:DEFAULT_SONG;
  const secs=[];
  for(const n of chain){const s=SECTIONS_BY_NAME[n]; if(s)secs.push(s);}
  if(!secs.length) return {sec:ARRANGEMENT[0],pos:bar%ARRANGEMENT[0].bars};
  let total=0;
  for(const s of secs) total+=s.bars;
  let b=bar%total;
  for(const s of secs){ if(b<s.bars) return {sec:s,pos:b}; b-=s.bars; }
  return {sec:secs[0],pos:0};
}

let lastSec=null;
function arrangeBar(bar,t,st){
  if(!st.autoArr){
    if(eng.arrFilt!==1){eng.arrFilt=1; eng.applyMacros(0.4);}
    lastSec=null;
    return {kick:1,bass:1,hat:1,lead:1,pad:1,perc:1,label:'MANUAL'};
  }
  const r=songAt(bar,st);
  const sec=r.sec,pos=r.pos;
  if(sec!==lastSec){
    lastSec=sec;
    eng.setSectionFilter(sec.filt);
    const bd=60/st.bpm*4;
    if(sec.riser) eng.build(t+(sec.bars-2)*bd,2*bd);
    if(sec.crash) eng.crash(t,0.35);
  }
  return {kick:sec.kick,bass:sec.bass,hat:sec.hat,lead:sec.lead,pad:sec.pad,perc:sec.perc,
          label:sec.name+' '+(pos+1)+'/'+sec.bars};
}
export function resetArrange(){lastSec=null;}

export const seq={
  playing:false,timer:null,nextTime:0,stepIdx:0,barLocal:0,lastBarTime:0,
  uiQ:[],motif:{a:new Array(16).fill(0),b:new Array(16).fill(0)},curSec:null,pendingLayers:false,
  st:null,

  bind(st){this.st=st;},

  start(){
    eng.init(); eng.ctx.resume();
    if(this.playing) return;
    this.playing=true;
    this.stepIdx=0; this.barLocal=0;
    this.uiQ.length=0;
    this.pendingLayers=true;
    this.nextTime=eng.ctx.currentTime+0.08;
    this.timer=setInterval(()=>this.sched(),25);
  },

  stop(){
    if(!this.playing) return;
    this.playing=false;
    clearInterval(this.timer);
    this.uiQ.length=0;
    this.curSec=null;
    lop.abort();
    lop.stopAll();
  },

  sched(){
    const s16=60/this.st.bpm/4;
    while(this.nextTime<eng.ctx.currentTime+0.12){
      this.step(this.stepIdx,this.nextTime);
      this.stepIdx=(this.stepIdx+1)%16;
      this.nextTime+=s16;
    }
  },

  step(s,t){
    const st=this.st,sc=blendedScene(st),P=st.patterns;
    const sw=s%2===1? st.swing*(60/st.bpm/4)*0.33 : 0;
    const tt=t+sw;
    let sec;
    if(s===0){
      this.lastBarTime=tt;
      sec=arrangeBar(this.barLocal,tt,st);
      this.curSec=sec;
      this.uiQ.push({t:tt,s:0,bar:this.barLocal,label:sec.label});
      if(this.barLocal>0&&this.barLocal%8===0&&Math.random()<0.12+st.swing*0.35){
        this.motif=mutateMotif(this.motif,st.scaleArr.length);
      }
      if(sc.pad&&sec.pad&&this.barLocal%2===0) eng.pad(tt,sc.root,sc.chord,2);
      if(this.pendingLayers){lop.startAll(tt); this.pendingLayers=false;}
      lop.startPending(tt);
      lop.onBar(tt);
    }else{
      this.uiQ.push({t:tt,s});
      sec=this.curSec||{kick:1,bass:1,hat:1,lead:1,pad:1,perc:1};
    }
    scheduleNotes(eng,st,sc,sec,P,s,tt,this.barLocal,null,this.motif);
    if(s===0) this.barLocal++;
  },

  nextBarBoundary(){
    let tb=this.lastBarTime;
    const bd=60/this.st.bpm*4;
    if(!eng.ctx) return 0;
    while(tb<=eng.ctx.currentTime+0.06) tb+=bd;
    return tb;
  },
};

export async function bounce(bars,opts){
  const fl=Object.assign({kick:true,bass:true,hat:true,lead:true,pad:true,perc:true,loops:true},opts||{});
  const st=seq.st;
  const sr=44100, bd=60/st.bpm*4, sd=bd/4;
  const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!OAC) throw new Error('offline-not-supported');
  const off=new OAC(2,Math.ceil((bars*bd+1)*sr),sr);
  const o=Object.create(EngineProto);
  o.init(off); o.bind(st); o.applyMacros();
  const sc=blendedScene(st),P=st.patterns;
  let secLast=null;
  for(let bar=0;bar<bars;bar++){
    const tBar=bar*bd;
    let sec;
    if(st.autoArr){
      sec=songAt(bar,st).sec;
      if(sec!==secLast){
        secLast=sec;
        o.setSectionFilter(sec.filt);
        if(sec.riser) o.build(tBar+(sec.bars-2)*bd,2*bd);
        if(sec.crash) o.crash(tBar,0.35);
      }
    }else{
      sec={kick:1,bass:1,hat:1,lead:1,pad:1,perc:1};
    }
    if(fl.pad&&sc.pad&&sec.pad&&bar%2===0) o.pad(tBar,sc.root,sc.chord,2);
    for(let s=0;s<16;s++){
      const sw=(s%2===1)? st.swing*sd*0.33 : 0;
      const tt=tBar+s*sd+sw;
      scheduleNotes(o,st,sc,sec,P,s,tt,bar,fl,seq.motif);
    }
  }
  if(fl.loops){
    lop.layers.forEach(L=>{
      if(L.buf&&!L.muted){
        const src=off.createBufferSource();
        src.buffer=L.buf; src.loop=true;
        src.playbackRate.value=st.bpm/L.recBPM;
        src.connect(o.duck);
        src.start(0);
      }
    });
  }
  return off.startRendering();
}
