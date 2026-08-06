import {SCENES,ARRANGEMENT,SECTIONS_BY_NAME,DEFAULT_SONG} from './core.js';
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
    const st=this.st,sc=SCENES[st.scene],P=st.patterns;
    const sw=s%2===1? st.swing*(60/st.bpm/4)*0.33 : 0;
    const tt=t+sw;
    let sec;
    if(s===0){
      this.lastBarTime=tt;
      sec=arrangeBar(this.barLocal,tt,st);
      this.curSec=sec;
      this.uiQ.push({t:tt,s:0,bar:this.barLocal,label:sec.label});
      if(sc.pad&&sec.pad&&this.barLocal%2===0) eng.pad(tt,sc.root,sc.chord,2);
      if(this.pendingLayers){lop.startAll(tt); this.pendingLayers=false;}
      lop.startPending(tt);
      lop.onBar(tt);
    }else{
      this.uiQ.push({t:tt,s});
      sec=this.curSec||{kick:1,bass:1,hat:1,lead:1,pad:1,perc:1};
    }
    if(sec.kick&&P.kick[s]) eng.kick(tt,s%4===0?1:0.92);
    if(sec.bass&&P.bass[s]) eng.bass(tt,sc.root+(sc.bassOct[s]||0),sc.bassLong);
    if(sec.hat&&P.hat[s]) eng.hat(tt,false,(s%4===0?0.16:0.11)*(1+((s*37)%5)*0.03),s%2?0.18:-0.18);
    if(sec.hat&&sc.open.includes(s)) eng.hat(tt,true,0.12,0);
    if(sec.hat&&sc.clap.includes(s)) eng.clap(tt,1,0);
    if(sec.perc&&P.perc&&P.perc[s]) eng.perc(tt,sc.percFreq,s%4<2?-0.35:0.35);
    if(sec.lead&&P.lead[s]){
      const mot=((this.barLocal>>1)%2===0)?this.motif.a:this.motif.b;
      const deg=mot[s];
      if(st.arp){
        const sdL=60/st.bpm/4;
        for(let k=0;k<4;k++){
          const d2=Math.min(st.scaleArr.length-1,deg+k*2);
          const midi=sc.root+24+st.scaleArr[d2];
          eng.lead(tt+k*sdL,midi,sdL*0.5,sc.leadType);
        }
      }else{
        const midi=sc.root+24+st.scaleArr[deg];
        eng.lead(tt,midi,(60/st.bpm/4)*(sc.leadType==='acid'?1.05:0.92),sc.leadType);
      }
    }
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
  const sc=SCENES[st.scene],P=st.patterns;
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
      if(fl.kick&&sec.kick&&P.kick[s]) o.kick(tt,s%4===0?1:0.92);
      if(fl.bass&&sec.bass&&P.bass[s]) o.bass(tt,sc.root+(sc.bassOct[s]||0),sc.bassLong);
      if(fl.hat&&sec.hat){
        if(P.hat[s]) o.hat(tt,false,(s%4===0?0.16:0.11)*(1+((s*37)%5)*0.03),s%2?0.18:-0.18);
        if(sc.open.includes(s)) o.hat(tt,true,0.12,0);
        if(sc.clap.includes(s)) o.clap(tt,1,0);
      }
      if(fl.perc&&sec.perc&&P.perc&&P.perc[s]) o.perc(tt,sc.percFreq,s%4<2?-0.35:0.35);
      if(fl.lead&&sec.lead&&P.lead[s]){
        const mot=((bar>>1)%2===0)?seq.motif.a:seq.motif.b;
        const deg=mot[s];
        if(st.arp){
          for(let k=0;k<4;k++){
            const d2=Math.min(st.scaleArr.length-1,deg+k*2);
            const midi=sc.root+24+st.scaleArr[d2];
            o.lead(tt+k*sd,midi,sd*0.5,sc.leadType);
          }
        }else{
          const midi=sc.root+24+st.scaleArr[deg];
          o.lead(tt,midi,sd*(sc.leadType==='acid'?1.05:0.92),sc.leadType);
        }
      }
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
