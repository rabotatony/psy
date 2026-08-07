import {clamp,mtof} from './core.js';

const EngineProto={
  ctx:null, st:null, arrFilt:1, lastAcidF:0, recDest:null,

  bind(st){this.st=st;},

  init(existing){
    if(this.ctx) return;
    const c=existing||new (window.AudioContext||window.webkitAudioContext)();
    this.ctx=c;

    this.sum=c.createGain();
    this.duck=c.createGain(); this.duck.connect(this.sum);

    this.masterFilter=c.createBiquadFilter(); this.masterFilter.type='lowpass'; this.masterFilter.Q.value=0.9;
    this.shaper=c.createWaveShaper(); this.shaper.oversample='4x';
    this.post=c.createGain();
    this.comp=c.createDynamicsCompressor();
    this.comp.threshold.value=-14; this.comp.ratio.value=5; this.comp.knee.value=18;
    this.comp.attack.value=0.004; this.comp.release.value=0.16;
    this.comp2=c.createDynamicsCompressor();
    this.comp2.threshold.value=-6; this.comp2.ratio.value=20; this.comp2.knee.value=3;
    this.comp2.attack.value=0.002; this.comp2.release.value=0.09;
    this.clip=c.createWaveShaper(); this.clip.curve=this.softClip(); this.clip.oversample='4x';
    this.out=c.createGain(); this.out.gain.value=0.92;
    this.analyser=c.createAnalyser(); this.analyser.fftSize=1024; this.analyser.smoothingTimeConstant=0.82;

    this.sum.connect(this.masterFilter);
    this.masterFilter.connect(this.shaper);
    this.shaper.connect(this.post);
    this.post.connect(this.comp);
    this.comp.connect(this.comp2);
    this.toneLow=c.createBiquadFilter(); this.toneLow.type='lowshelf'; this.toneLow.frequency.value=110; this.toneLow.gain.value=1.5;
    this.toneHigh=c.createBiquadFilter(); this.toneHigh.type='highshelf'; this.toneHigh.frequency.value=8500; this.toneHigh.gain.value=-2;
    this.comp2.connect(this.toneLow); this.toneLow.connect(this.toneHigh); this.toneHigh.connect(this.clip);
    this.clip.connect(this.out);
    this.out.connect(this.analyser);
    this.analyser.connect(c.destination);
    if(typeof c.createMediaStreamDestination==='function'){
      this.recDest=c.createMediaStreamDestination();
      this.out.connect(this.recDest);
    }

    // v7: ping-pong delay with band-limited feedback (dub tails)
    this.delaySend=c.createGain();
    this.delayL=c.createDelay(2); this.delayR=c.createDelay(2);
    this.fL=c.createBiquadFilter(); this.fL.type='lowpass'; this.fL.frequency.value=3300;
    this.fR=c.createBiquadFilter(); this.fR.type='lowpass'; this.fR.frequency.value=3300;
    this.hpL=c.createBiquadFilter(); this.hpL.type='highpass'; this.hpL.frequency.value=140;
    this.hpR=c.createBiquadFilter(); this.hpR.type='highpass'; this.hpR.frequency.value=140;
    this.fb=c.createGain(); this.fb2=c.createGain();
    this.panL=this.mkPan(-0.65); this.panR=this.mkPan(0.65);
    this.delaySend.connect(this.delayL);
    this.hpDL=c.createBiquadFilter(); this.hpDL.type='highpass'; this.hpDL.frequency.value=180; this.delayL.connect(this.hpDL); this.hpDL.connect(this.fL); this.fL.connect(this.hpL);
    this.hpL.connect(this.panL); this.panL.connect(this.sum);
    this.hpL.connect(this.fb); this.fb.connect(this.delayR);
    this.hpDR=c.createBiquadFilter(); this.hpDR.type='highpass'; this.hpDR.frequency.value=180; this.delayR.connect(this.hpDR); this.hpDR.connect(this.fR); this.fR.connect(this.hpR);
    this.hpR.connect(this.panR); this.panR.connect(this.sum);
    this.hpR.connect(this.fb2); this.fb2.connect(this.delayL);

    this.revSend=c.createGain();
    this.conv=c.createConvolver(); this.conv.buffer=this.makeImpulse(1.8,4.2);
    this.rRet=c.createGain(); this.rRet.gain.value=0.6;
    this.revPre=c.createDelay(0.06); this.revPre.delayTime.value=0.028; this.revSend.connect(this.revPre); this.revPre.connect(this.conv); this.conv.connect(this.rRet); this.rRet.connect(this.sum);

    this.wideIn=c.createGain();
    this.wideDry=c.createGain(); this.wideDry.gain.value=1;
    this.wideTap=c.createDelay(0.05); this.wideTap.delayTime.value=0.012;
    this.wideWet=c.createGain(); this.wideWet.gain.value=0.35;
    this.widePan=this.mkPan(0.7);
    this.wideIn.connect(this.wideDry); this.wideDry.connect(this.sum);
    this.wideIn.connect(this.wideTap); this.wideTap.connect(this.wideWet);
    this.wideWet.connect(this.widePan); this.widePan.connect(this.sum);

    this.noise=this.makeNoise(2);
    if(this.st) this.applyMacros();
  },

  mkPan(v){
    if(this.ctx.createStereoPanner){const p=this.ctx.createStereoPanner(); p.pan.value=v; return p;}
    return this.ctx.createGain();
  },
  makeNoise(sec){
    const b=this.ctx.createBuffer(1,Math.floor(this.ctx.sampleRate*sec),this.ctx.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return b;
  },
  makeImpulse(sec,decay){
    const sr=this.ctx.sampleRate,len=Math.floor(sr*sec);
    const b=this.ctx.createBuffer(2,len,sr);
    for(let ch=0;ch<2;ch++){
      const d=b.getChannelData(ch);
      let seed=1234+ch*777;
      const rnd=()=>{seed=(seed*16807)%2147483647; return seed/2147483647;};
      const taps=14;
      for(let k=0;k<taps;k++){
        const idx=Math.floor(rnd()*sr*0.09);
        const amp=(rnd()*2-1)*Math.max(0.08,0.5-k*0.028);
        if(idx<len) d[idx]+=amp*0.5;
      }
      for(let i=0;i<len;i++){
        const env=Math.pow(1-i/len,decay);
        d[i]+=(rnd()*2-1)*env*0.55;
      }
      let prev=0;
      for(let i=0;i<len;i++){prev=prev*0.25+d[i]*0.75; d[i]=prev;}
    }
    return b;
  },
  driveCurve(a){
    const n=257,c=new Float32Array(n),k=a*4;
    for(let i=0;i<n;i++){const x=i/(n-1)*2-1; c[i]=k<0.02?x:Math.tanh(k*x)/Math.tanh(k);}
    return c;
  },
  bassCurve(){
    const n=257,c=new Float32Array(n),k=1.8;
    for(let i=0;i<n;i++){const x=i/(n-1)*2-1; c[i]=Math.tanh(k*x)/Math.tanh(k);}
    return c;
  },
  // v7: wavefolder transfer — sin folding into tanh saturation
  foldCurve(amount){
    const n=1024,c=new Float32Array(n);
    for(let i=0;i<n;i++){
      const x=i/(n-1)*2-1;
      c[i]=Math.tanh(Math.sin(x*amount*Math.PI*0.5));
    }
    return c;
  },
  softClip(){
    const n=257,c=new Float32Array(n);
    for(let i=0;i<n;i++){const x=i/(n-1)*2-1; c[i]=Math.tanh(1.8*x)/Math.tanh(1.8);}
    return c;
  },

  applyMacros(tc=0.03){
    if(!this.ctx||!this.st) return;
    const m=this.st.macros,t=this.ctx.currentTime;
    this.masterFilter.frequency.setTargetAtTime(100*Math.pow(160,clamp(m.filter)*this.arrFilt),t,tc);
    this.delaySend.gain.setTargetAtTime(0.15+m.space*0.85,t,0.03);
    this.revSend.gain.setTargetAtTime(m.space*1.1,t,0.03);
    const fb=0.3+m.morphY*0.3;
    this.fb.gain.setTargetAtTime(fb,t,0.05);
    this.fb2.gain.setTargetAtTime(fb,t,0.05);
    const dt=60/this.st.bpm*0.75;
    this.delayL.delayTime.setTargetAtTime(dt,t,0.08);
    this.delayR.delayTime.setTargetAtTime(dt,t,0.08);
    this.shaper.curve=this.driveCurve(m.drive);
    this.post.gain.setTargetAtTime(1+m.drive*0.2,t,0.03);
  },

  targetCut(){return 100*Math.pow(160,clamp(this.st.macros.filter)*this.arrFilt);},
  setSectionFilter(f){this.arrFilt=f; this.applyMacros(1.4);},

  // v7: deeper, smoother pump
  duckHit(t,depth=0.3){
    const g=this.duck.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.05,g.value),t);
    g.linearRampToValueAtTime(depth,t+0.006);
    g.exponentialRampToValueAtTime(1,t+0.28);
  },

  mkSend(amt){
    const d=this.ctx.createGain(); d.gain.value=amt; d.connect(this.delaySend);
    const r=this.ctx.createGain(); r.gain.value=amt*0.4; r.connect(this.revSend);
    return [d,r];
  },

  stepDur(){return 60/this.st.bpm/4;},
  barDur(){return this.stepDur()*16;},

  kick(t,acc=1){
    const c=this.ctx;
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(165,t);
    o.frequency.exponentialRampToValueAtTime(50,t+0.035);
    g.gain.setValueAtTime(1.05*acc,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    o.connect(g); g.connect(this.sum);
    o.start(t); o.stop(t+0.3);
    const o2=c.createOscillator(),g2=c.createGain();
    o2.type='triangle';
    o2.frequency.setValueAtTime(300,t);
    o2.frequency.exponentialRampToValueAtTime(60,t+0.025);
    g2.gain.setValueAtTime(0.45*acc,t);
    g2.gain.exponentialRampToValueAtTime(0.001,t+0.05);
    o2.connect(g2); g2.connect(this.sum);
    o2.start(t); o2.stop(t+0.06);
    const s=c.createBufferSource(); s.buffer=this.noise;
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=4500;
    const cg=c.createGain();
    cg.gain.setValueAtTime(0.3*acc,t);
    cg.gain.exponentialRampToValueAtTime(0.001,t+0.012);
    s.connect(hp); hp.connect(cg); cg.connect(this.sum);
    s.start(t); s.stop(t+0.03);
    this.duckHit(t,0.3);
  },

  hat(t,open,vol=0.13,pan=0){
    const c=this.ctx,s=c.createBufferSource(); s.buffer=this.noise; s.loop=true;
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=open?7000:8600;
    const g=c.createGain();
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+(open?0.2:0.045));
    const p=this.mkPan(pan);
    s.connect(hp); hp.connect(g); g.connect(p); p.connect(this.sum);
    s.start(t); s.stop(t+0.3);
  },

  clap(t,vol=1,pan=0){
    const c=this.ctx,s=c.createBufferSource(); s.buffer=this.noise; s.loop=true;
    const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1750; bp.Q.value=1.6;
    const g=c.createGain();
    g.gain.setValueAtTime(0,t);
    g.gain.setValueAtTime(0.5*vol,t+0.001);
    g.gain.setValueAtTime(0.12*vol,t+0.02);
    g.gain.setValueAtTime(0.45*vol,t+0.035);
    g.gain.setValueAtTime(0.1*vol,t+0.06);
    g.gain.setValueAtTime(0.34*vol,t+0.09);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.26);
    const p=this.mkPan(pan),res=this.mkSend(0.15);
    s.connect(bp); bp.connect(g); g.connect(p); p.connect(this.sum); g.connect(res[0]);
    s.start(t); s.stop(t+0.3);
  },

  crash(t,vol=0.3){
    const c=this.ctx,s=c.createBufferSource(); s.buffer=this.noise; s.loop=true;
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=4600;
    const g=c.createGain();
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+1.5);
    const res=this.mkSend(0.6);
    s.connect(hp); hp.connect(g); g.connect(this.sum); g.connect(res[1]);
    s.start(t); s.stop(t+1.6);
  },

  perc(t,f,pan=0){
    const c=this.ctx;
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(f,t);
    o.frequency.exponentialRampToValueAtTime(f*0.88,t+0.06);
    g.gain.setValueAtTime(0.28,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.09);
    const o2=c.createOscillator(),g2=c.createGain();
    o2.type='sine'; o2.frequency.value=f*1.47;
    g2.gain.setValueAtTime(0.12,t);
    g2.gain.exponentialRampToValueAtTime(0.001,t+0.05);
    const p=this.mkPan(pan),res=this.mkSend(0.12);
    o.connect(g); o2.connect(g2); g.connect(p); g2.connect(p); p.connect(this.sum); g.connect(res[0]);
    o.start(t); o.stop(t+0.12); o2.start(t); o2.stop(t+0.08);
  },

  bass(t,midi,long){
    const c=this.ctx,f=mtof(midi),m=this.st.macros,dur=this.stepDur()*(long?1.9:0.82);
    const o1=c.createOscillator(),o2=c.createOscillator(),sub=c.createOscillator();
    o1.type='sawtooth'; o2.type='sawtooth'; sub.type='sine';
    o1.frequency.value=f; o2.frequency.value=f; o2.detune.value=8; sub.frequency.value=f;
    const fl=c.createBiquadFilter(); fl.type='lowpass'; fl.Q.value=1+m.morphY*9;
    const peak=Math.min(9000,260+m.filter*4300+800);
    fl.frequency.setValueAtTime(peak,t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(130,peak*0.25),t+dur);
    const bs=c.createWaveShaper(); bs.curve=this.bassCurve(); bs.oversample='4x';
    const g=c.createGain();
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.4,t+0.006);
    g.gain.setValueAtTime(0.4,t+dur*0.7);
    g.gain.linearRampToValueAtTime(0,t+dur);
    const sg=c.createGain(); sg.gain.value=0.6;
    o1.connect(fl); o2.connect(fl); sub.connect(sg); sg.connect(fl);
    fl.connect(bs); bs.connect(g); g.connect(this.duck);
    o1.start(t); o2.start(t); sub.start(t);
    const e=t+dur+0.03; o1.stop(e); o2.stop(e); sub.stop(e);
  },

  // v7 lead: acid 303 (square + accent), fold engine, saw with light fold
  lead(t,midi,dur,type,vol=1){
    const c=this.ctx,m=this.st.macros,f=mtof(midi);
    const fl=c.createBiquadFilter(); fl.type='lowpass'; fl.Q.value=1+m.morphY*12;
    const g=c.createGain(),res=this.mkSend(0.45);
    const base=Math.max(180,140+m.filter*5200);
    if(type==='acid'){
      const o=c.createOscillator(); o.type='square';
      if(this.lastAcidF>0){
        o.frequency.setValueAtTime(this.lastAcidF,t);
        o.frequency.exponentialRampToValueAtTime(f,t+0.045);
      }else o.frequency.setValueAtTime(f,t);
      this.lastAcidF=f;
      fl.frequency.setValueAtTime(base*0.35,t);
      fl.frequency.exponentialRampToValueAtTime(Math.min(base*(4+vol*3),11000),t+0.025);
      fl.frequency.exponentialRampToValueAtTime(base*0.6,t+dur);
      const pk=0.24+vol*0.1;
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(pk,t+0.005);
      g.gain.setValueAtTime(pk,t+dur*0.6);
      g.gain.linearRampToValueAtTime(0,t+dur+0.05);
      o.connect(fl); o.start(t); o.stop(t+dur+0.1);
    }else if(type==='fold'){
      const o1=c.createOscillator(),o2=c.createOscillator(),o3=c.createOscillator();
      o1.type='sawtooth'; o2.type='sawtooth'; o3.type='square';
      o1.frequency.value=f; o2.frequency.value=f; o3.frequency.value=f;
      o1.detune.value=-6+(Math.random()*6-3); o2.detune.value=6+(Math.random()*6-3); o3.detune.value=3+(Math.random()*6-3);
      const ws=c.createWaveShaper(); ws.curve=this.foldCurve(2.5+m.morphX*4); ws.oversample='4x';
      const fg=c.createGain(); fg.gain.value=0.5;
      fl.frequency.setValueAtTime(base*0.5,t);
      fl.frequency.exponentialRampToValueAtTime(Math.min(base*3.5,9500),t+0.02);
      fl.frequency.exponentialRampToValueAtTime(base*0.8,t+dur);
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(0.26,t+0.006);
      g.gain.setValueAtTime(0.26,t+dur*0.7);
      g.gain.linearRampToValueAtTime(0,t+dur+0.08);
      o1.connect(ws); o2.connect(ws); o3.connect(fg); fg.connect(ws);
      ws.connect(fl);
      o1.start(t); o2.start(t); o3.start(t);
      const e=t+dur+0.12; o1.stop(e); o2.stop(e); o3.stop(e);
    }else{
      // v13: 7-voice supersaw with continuous per-voice drift
      const wg=c.createGain(); wg.gain.value=0.22;
      const spread=(4+m.morphX*14)/3;
      const pos=[-3,-2,-1,0,1,2,3];
      const oscs=[];
      for(let v=0;v<7;v++){
        const ov=c.createOscillator(); ov.type='sawtooth';
        ov.frequency.value=f;
        ov.detune.value=pos[v]*spread+(Math.random()*2-1);
        const drift=c.createOscillator(); drift.type='sine';
        drift.frequency.value=0.08+Math.random()*0.4;
        const dg=c.createGain(); dg.gain.value=2.5+Math.random()*3;
        drift.connect(dg); dg.connect(ov.detune);
        ov.connect(wg);
        oscs.push([ov,drift]);
      }
      const ws=c.createWaveShaper(); ws.curve=this.foldCurve(1+m.morphX*1.4); ws.oversample='4x';
      const lfo=c.createOscillator(),lg=c.createGain();
      lfo.type='sine'; lfo.frequency.value=0.5+m.morphX*11;
      lg.gain.value=500+m.morphX*2400;
      lfo.connect(lg); lg.connect(fl.frequency);
      fl.frequency.setValueAtTime(base,t);
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(0.2,t+0.01);
      g.gain.setValueAtTime(0.2,t+dur*0.75);
      g.gain.linearRampToValueAtTime(0,t+dur+0.09);
      wg.connect(ws); ws.connect(fl);
      for(const pr of oscs){pr[0].start(t); pr[1].start(t);}
      lfo.start(t);
      const e=t+dur+0.15;
      for(const pr of oscs){pr[0].stop(e); pr[1].stop(e);}
      lfo.stop(e);
    }
    fl.connect(g);
    g.connect(this.wideIn);
    g.connect(res[0]); g.connect(res[1]);
  },

  pad(t,root,chord,bars){
    const c=this.ctx,dur=bars*this.barDur();
    const notes=chord.map(x=>root+12+x);
    notes.push(root+24+chord[0]);
    notes.forEach(mid=>{
      const f=mtof(mid),o1=c.createOscillator(),o2=c.createOscillator();
      o1.type='sawtooth'; o2.type='sawtooth';
      o1.frequency.value=f; o2.frequency.value=f;
      o1.detune.value=-6+(Math.random()*8-4); o2.detune.value=6+(Math.random()*8-4);
      const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
      const plfo=c.createOscillator(),plg=c.createGain();
      plfo.type='sine'; plfo.frequency.value=0.06+Math.random()*0.04; plg.gain.value=350;
      plfo.connect(plg); plg.connect(lp.frequency);
      const g=c.createGain();
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(0.028,t+0.7);
      g.gain.setValueAtTime(0.028,t+Math.max(0.8,dur-0.8));
      g.gain.linearRampToValueAtTime(0,t+dur);
      const rg=c.createGain(); rg.gain.value=0.5;
      o1.connect(lp); o2.connect(lp); lp.connect(g);
      g.connect(rg); rg.connect(this.revSend);
      g.connect(this.duck);
      o1.start(t); o2.start(t); plfo.start(t);
      const e=t+dur+0.1; o1.stop(e); o2.stop(e); plfo.stop(e);
    });
  },

  riser(t0,dur){
    const c=this.ctx;
    if(t0<c.currentTime) t0=c.currentTime+0.02;
    const s=c.createBufferSource(); s.buffer=this.noise; s.loop=true;
    const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.8;
    bp.frequency.setValueAtTime(300,t0);
    bp.frequency.exponentialRampToValueAtTime(9200,t0+dur);
    const g=c.createGain();
    g.gain.setValueAtTime(0.001,t0);
    g.gain.exponentialRampToValueAtTime(0.34,t0+dur);
    s.connect(bp); bp.connect(g); g.connect(this.sum);
    s.start(t0); s.stop(t0+dur+0.05);
  },

  build(t0,dur){
    this.riser(t0,dur);
    const bd=dur/2, sd=bd/16;
    for(let k=0;k<16;k++) this.clap(t0+bd+k*sd,0.06+0.3*k/16,0);
  },

  fill(t0){
    const sd=this.stepDur();
    for(let k=0;k<16;k++){
      this.clap(t0+k*sd,0.1+0.4*k/15,((k%2)?0.3:-0.3));
      if(k%4===2) this.hat(t0+k*sd,true,0.14,0);
    }
    const s=this.ctx.createBufferSource(); s.buffer=this.noise; s.loop=true;
    const bp=this.ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=2;
    bp.frequency.setValueAtTime(900,t0);
    bp.frequency.exponentialRampToValueAtTime(7000,t0+sd*16);
    const g=this.ctx.createGain();
    g.gain.setValueAtTime(0.001,t0);
    g.gain.exponentialRampToValueAtTime(0.18,t0+sd*16);
    g.gain.exponentialRampToValueAtTime(0.001,t0+sd*16+0.08);
    s.connect(bp); bp.connect(g); g.connect(this.sum);
    s.start(t0); s.stop(t0+sd*16+0.1);
  },

  zap(){
    if(!this.ctx) return;
    const t=this.ctx.currentTime+0.01,c=this.ctx;
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(1300,t);
    o.frequency.exponentialRampToValueAtTime(90,t+0.22);
    g.gain.setValueAtTime(0.4,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
    const res=this.mkSend(0.8);
    o.connect(g); g.connect(this.sum); g.connect(res[0]);
    o.start(t); o.stop(t+0.3);
  },

  drop(){
    if(!this.ctx||!this.st) return;
    const t=this.ctx.currentTime+0.02,bd=this.barDur();
    this.masterFilter.frequency.cancelScheduledValues(t);
    this.masterFilter.frequency.setValueAtTime(Math.max(150,this.masterFilter.frequency.value),t);
    this.masterFilter.frequency.exponentialRampToValueAtTime(110,t+bd*0.9);
    this.masterFilter.frequency.setTargetAtTime(this.targetCut(),t+bd*0.95,0.25);
  },
};

export const eng=Object.create(EngineProto);
export {EngineProto};
