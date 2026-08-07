import {clamp,mtof,SYNTH} from './core.js';

const EngineProto={
  ctx:null, st:null, arrFilt:1, lastAcidF:0, recDest:null,

  bind(st){this.st=st;},
  vs(){
    return SYNTH[this.st.scene]||{bass:{drive:1,peak:1,q:1,decay:1,sub:1},kick:{decay:1,click:1,punch:1},lead:{bright:1,fold:1,width:1},space:{delay:1,reverb:1}};
  },

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
    this.comp.threshold.value=-16; this.comp.ratio.value=4; this.comp.knee.value=24;
    this.comp.attack.value=0.006; this.comp.release.value=0.28;
    this.comp2=c.createDynamicsCompressor();
    this.comp2.threshold.value=-6; this.comp2.ratio.value=20; this.comp2.knee.value=3;
    this.comp2.attack.value=0.002; this.comp2.release.value=0.09;
    this.clip=c.createWaveShaper(); this.clip.curve=this.softClip(); this.clip.oversample='4x';
    this.limiter=c.createDynamicsCompressor();
    this.limiter.threshold.value=-1.5; this.limiter.ratio.value=20; this.limiter.knee.value=0;
    this.limiter.attack.value=0.001; this.limiter.release.value=0.12;
    this.out=c.createGain(); this.out.gain.value=0.92;
    this.analyser=c.createAnalyser(); this.analyser.fftSize=1024; this.analyser.smoothingTimeConstant=0.82;

    this.sum.connect(this.masterFilter);
    this.masterFilter.connect(this.shaper);
    this.shaper.connect(this.post);
    // --- v34: MULTI-BAND MASTERING (low/mid/high compressed independently) ---
    this.xLow=c.createBiquadFilter(); this.xLow.type='lowpass'; this.xLow.frequency.value=120; this.xLow.Q.value=0.707;
    this.xMidHP=c.createBiquadFilter(); this.xMidHP.type='highpass'; this.xMidHP.frequency.value=120; this.xMidHP.Q.value=0.707;
    this.xMidLP=c.createBiquadFilter(); this.xMidLP.type='lowpass'; this.xMidLP.frequency.value=2500; this.xMidLP.Q.value=0.707;
    this.xHigh=c.createBiquadFilter(); this.xHigh.type='highpass'; this.xHigh.frequency.value=2500; this.xHigh.Q.value=0.707;
    this.mbLow=c.createDynamicsCompressor(); this.mbLow.threshold.value=-20; this.mbLow.ratio.value=3; this.mbLow.knee.value=20; this.mbLow.attack.value=0.01; this.mbLow.release.value=0.3;
    this.mbMid=c.createDynamicsCompressor(); this.mbMid.threshold.value=-18; this.mbMid.ratio.value=3; this.mbMid.knee.value=20; this.mbMid.attack.value=0.008; this.mbMid.release.value=0.25;
    this.mbHigh=c.createDynamicsCompressor(); this.mbHigh.threshold.value=-20; this.mbHigh.ratio.value=2.5; this.mbHigh.knee.value=20; this.mbHigh.attack.value=0.005; this.mbHigh.release.value=0.2;
    this.gLow=c.createGain(); this.gLow.gain.value=1.15;
    this.gMid=c.createGain(); this.gMid.gain.value=1.0;
    this.gHigh=c.createGain(); this.gHigh.gain.value=0.95;
    this.mbSum=c.createGain();
    this.post.connect(this.xLow); this.xLow.connect(this.mbLow); this.mbLow.connect(this.gLow); this.gLow.connect(this.mbSum);
    this.post.connect(this.xMidHP); this.xMidHP.connect(this.xMidLP); this.xMidLP.connect(this.mbMid); this.mbMid.connect(this.gMid); this.gMid.connect(this.mbSum);
    this.post.connect(this.xHigh); this.xHigh.connect(this.mbHigh); this.mbHigh.connect(this.gHigh); this.gHigh.connect(this.mbSum);
    this.toneLow=c.createBiquadFilter(); this.toneLow.type='lowshelf'; this.toneLow.frequency.value=110; this.toneLow.gain.value=1.5;
    this.toneHigh=c.createBiquadFilter(); this.toneHigh.type='highshelf'; this.toneHigh.frequency.value=8500; this.toneHigh.gain.value=-2;
    this.mbSum.connect(this.toneLow); this.toneLow.connect(this.toneHigh); this.toneHigh.connect(this.clip);
    this.clip.connect(this.limiter); this.limiter.connect(this.out);
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
  bassCurve(k=1.8){
    const n=257,c=new Float32Array(n);
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
    const sp=this.vs().space;
    this.delaySend.gain.setTargetAtTime((0.15+m.space*0.85)*sp.delay,t,0.03);
    this.revSend.gain.setTargetAtTime(m.space*1.1*sp.reverb,t,0.03);
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


  playKey(midi,vol=1){
    const c=this.ctx; if(!c) return;
    const m=this.st.macros,vs=this.vs();
    const leadType=this.st.leadVoice||'pluck';
    const f=mtof(midi);
    const fl=c.createBiquadFilter(); fl.type='lowpass'; fl.Q.value=1+m.morphY*10;
    const base=Math.max(200,150+m.filter*5500*vs.lead.bright);
    fl.frequency.setValueAtTime(base,this.ctx.currentTime);
    const g=c.createGain();
    const now=this.ctx.currentTime;
    g.gain.setValueAtTime(0,now);
    g.gain.linearRampToValueAtTime(0.3*vol,now+0.008);
    g.gain.setTargetAtTime(0.18*vol,now+0.15,0.12);
    if(leadType==='pluck'||leadType==='saw'){
      const o1=c.createOscillator(),o2=c.createOscillator();
      o1.type='sawtooth'; o2.type='sawtooth';
      o1.frequency.value=f; o2.frequency.value=f;
      o1.detune.value=-(3+m.morphX*10); o2.detune.value=3+m.morphX*10;
      o1.connect(fl); o2.connect(fl);
      o1.start(now); o2.start(now);
      o1.stop(now+3); o2.stop(now+3);
    }else{
      const o=c.createOscillator(); o.type=leadType==='acid'?'square':'sawtooth';
      o.frequency.value=f; o.connect(fl);
      o.start(now); o.stop(now+3);
    }
    fl.connect(g); g.connect(this.sum);
    const rs=this.mkSend(0.35); g.connect(rs[0]); g.connect(rs[1]);
  },

  playKeyRelease(){
    // placeholder for future sustain control
  },

  kick(t,acc=1){
    const c=this.ctx,vs=this.vs();
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(165,t);
    o.frequency.exponentialRampToValueAtTime(50,t+0.035);
    g.gain.setValueAtTime(1.05*acc,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.18*vs.kick.decay);
    o.connect(g); g.connect(this.sum);
    o.start(t); o.stop(t+0.3);
    const o2=c.createOscillator(),g2=c.createGain();
    o2.type='triangle';
    o2.frequency.setValueAtTime(300,t);
    o2.frequency.exponentialRampToValueAtTime(60,t+0.025);
    g2.gain.setValueAtTime(0.45*acc*vs.kick.punch,t);
    g2.gain.exponentialRampToValueAtTime(0.001,t+0.05);
    o2.connect(g2); g2.connect(this.sum);
    o2.start(t); o2.stop(t+0.06);
    const s=c.createBufferSource(); s.buffer=this.noise;
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=4500;
    const cg=c.createGain();
    cg.gain.setValueAtTime(0.3*acc*vs.kick.click,t);
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

  bass(t,midi,long,bassType){
    const c=this.ctx,f=mtof(midi),m=this.st.macros,vs=this.vs(),dur=this.stepDur()*(long?1.9:0.82)*vs.bass.decay;
    const bt=bassType||'roll';
    const o1=c.createOscillator(),o2=c.createOscillator(),sub=c.createOscillator(),sub2=c.createOscillator();
    o1.type='sawtooth'; o2.type='sawtooth'; sub.type='sine'; sub2.type='sine';
    o1.frequency.value=f; o2.frequency.value=f; o2.detune.value=8; sub.frequency.value=f; sub2.frequency.value=f/2;
    const fl=c.createBiquadFilter(); fl.type='lowpass';
    const peak=Math.min(9000,(260+m.filter*4300+800)*vs.bass.peak);
    let wlfo=null;
    if(bt==='acid'){
      fl.Q.value=Math.min(14,(4+m.morphY*10)*vs.bass.q);
      fl.frequency.setValueAtTime(peak*0.3,t);
      fl.frequency.exponentialRampToValueAtTime(Math.min(peak*2.5,11000),t+0.03);
      fl.frequency.exponentialRampToValueAtTime(Math.max(120,peak*0.2),t+dur);
    }else if(bt==='wobble'){
      fl.Q.value=Math.min(10,(2+m.morphY*7)*vs.bass.q);
      fl.frequency.setValueAtTime(peak*0.6,t);
      wlfo=c.createOscillator(); const wlg=c.createGain();
      wlfo.type='sine'; wlfo.frequency.value=3+m.morphX*6;
      wlg.gain.value=peak*0.4;
      wlfo.connect(wlg); wlg.connect(fl.frequency);
    }else{
      fl.Q.value=(1+m.morphY*9)*vs.bass.q;
      fl.frequency.setValueAtTime(peak,t);
      fl.frequency.exponentialRampToValueAtTime(Math.max(130,peak*0.25),t+dur);
    }
    const bs=c.createWaveShaper(); bs.curve=this.bassCurve(1.2+vs.bass.drive*1.2); bs.oversample='4x';
    const g=c.createGain();
    if(bt==='sub'){
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.32,t+0.012);
      g.gain.setValueAtTime(0.32,t+dur*0.7); g.gain.linearRampToValueAtTime(0,t+dur);
    }else if(bt==='acid'){
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.38,t+0.004);
      g.gain.setValueAtTime(0.38,t+dur*0.6); g.gain.linearRampToValueAtTime(0,t+dur);
    }else{
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.4,t+0.006);
      g.gain.setValueAtTime(0.4,t+dur*0.7); g.gain.linearRampToValueAtTime(0,t+dur);
    }
    const sg=c.createGain(); sg.gain.value=(bt==='sub'?0.75:0.6)*vs.bass.sub;
    const sg2=c.createGain(); sg2.gain.value=(bt==='sub'?0.6:0.45)*vs.bass.sub;
    o1.connect(fl); o2.connect(fl); sub.connect(sg); sg.connect(fl); sub2.connect(sg2); sg2.connect(fl);
    fl.connect(bs); bs.connect(g); g.connect(this.duck);
    o1.start(t); o2.start(t); sub.start(t); sub2.start(t);
    if(wlfo){wlfo.start(t); wlfo.stop(t+dur+0.05);}
    const e=t+dur+0.03; o1.stop(e); o2.stop(e); sub.stop(e); sub2.stop(e);
  },

  lead(t,midi,dur,type,vol=1){
    const c=this.ctx,m=this.st.macros,vs=this.vs(),f=mtof(midi);
    const fl=c.createBiquadFilter(); fl.type='lowpass'; fl.Q.value=1+m.morphY*12;
    const g=c.createGain(),res=this.mkSend(0.45);
    const base=Math.max(180,140+m.filter*5200*vs.lead.bright);
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
      const ws=c.createWaveShaper(); ws.curve=this.foldCurve((2.5+m.morphX*4)*vs.lead.fold); ws.oversample='4x';
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
    }else if(type==='pluck'){
      const o=c.createOscillator(); o.type='sawtooth';
      o.frequency.value=f;
      const flp=c.createBiquadFilter(); flp.type='lowpass'; flp.Q.value=2+vs.lead.fold*6;
      const pk=Math.min(8000,(300+m.filter*5000)*vs.lead.bright);
      flp.frequency.setValueAtTime(pk,t);
      flp.frequency.exponentialRampToValueAtTime(Math.max(200,pk*0.15),t+dur*0.7);
      const g2=c.createGain();
      g2.gain.setValueAtTime(0,t);
      g2.gain.linearRampToValueAtTime(0.32*vol,t+0.004);
      g2.gain.exponentialRampToValueAtTime(0.001,t+dur);
      o.connect(flp); flp.connect(g2); g2.connect(this.sum);
      const rs=this.mkSend(0.35); g2.connect(rs[0]); g2.connect(rs[1]);
      o.start(t); o.stop(t+dur+0.05);
      return;
    }else{
      // v13: 7-voice supersaw with continuous per-voice drift
      const wg=c.createGain(); wg.gain.value=0.22;
      const spread=(4+m.morphX*14)/3*vs.lead.width;
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
      const vib=c.createOscillator(),vg2=c.createGain();
      vib.type='sine'; vib.frequency.value=4.5+m.morphX*1.5;
      vg2.gain.value=4+m.morphX*5;
      vib.connect(vg2);
      wg.connect(ws); ws.connect(fl);
      for(const pr of oscs){pr[0].start(t); pr[1].start(t); vg2.connect(pr[0].detune);}
      lfo.start(t); vib.start(t);
      const e=t+dur+0.15;
      for(const pr of oscs){pr[0].stop(e); pr[1].stop(e);}
      lfo.stop(e); vib.stop(e);
    }
    fl.connect(g);
    g.connect(this.wideIn);
    g.connect(res[0]); g.connect(res[1]);
  },

  pad(t,root,chord,bars){
    const c=this.ctx,dur=bars*this.barDur(),m=this.st.macros,vs=this.vs();
    const notes=chord.map(x=>root+12+x);
    notes.push(root+24+chord[0]);
    notes.forEach(mid=>{
      const f=mtof(mid);
      const vg=c.createGain(); vg.gain.value=0.016;
      const oscs=[];
      const pos=[-2,-1,1,2];
      for(let v=0;v<4;v++){
        const o=c.createOscillator(); o.type='sawtooth';
        o.frequency.value=f;
        o.detune.value=pos[v]*7+(Math.random()*6-3);
        o.connect(vg); oscs.push(o);
      }
      const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=0.8;
      lp.frequency.value=700+m.filter*1200;
      const plfo=c.createOscillator(),plg=c.createGain();
      plfo.type='sine'; plfo.frequency.value=0.05+Math.random()*0.05; plg.gain.value=400;
      plfo.connect(plg); plg.connect(lp.frequency);
      const vlfo=c.createOscillator(),vlg=c.createGain();
      vlfo.type='sine'; vlfo.frequency.value=0.1+Math.random()*0.1; vlg.gain.value=0.004;
      vlfo.connect(vlg); vlg.connect(vg.gain);
      const g=c.createGain();
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(1,t+0.9);
      g.gain.setValueAtTime(1,t+Math.max(1.0,dur-1.0));
      g.gain.linearRampToValueAtTime(0,t+dur);
      vg.connect(lp); lp.connect(g);
      g.connect(this.revSend); g.connect(this.duck);
      for(const o of oscs)o.start(t);
      plfo.start(t); vlfo.start(t);
      const e=t+dur+0.1;
      for(const o of oscs)o.stop(e);
      plfo.stop(e); vlfo.stop(e);
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

  // v17: drone bass for ambient/dub/chill styles
  bassDrone(t,midi,dur){
    const c=this.ctx,f=mtof(midi);
    const o1=c.createOscillator(); o1.type='sawtooth'; o1.frequency.value=f;
    const sub=c.createOscillator(); sub.type='sine'; sub.frequency.value=f;
    const sg=c.createGain(); sg.gain.value=0.7;
    const fl=c.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=320; fl.Q.value=1;
    const g=c.createGain();
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.28,t+0.4);
    g.gain.setValueAtTime(0.28,t+Math.max(0.5,dur-0.6));
    g.gain.linearRampToValueAtTime(0,t+dur);
    o1.connect(fl); sub.connect(sg); sg.connect(fl); fl.connect(g); g.connect(this.duck);
    o1.start(t); sub.start(t);
    const e=t+dur+0.1; o1.stop(e); sub.stop(e);
  },

  // v17: slow trance filter sweep (opens then closes)
  sweep(){
    if(!this.ctx||!this.st) return;
    const t=this.ctx.currentTime+0.02, bar=60/this.st.bpm*4;
    const f=this.masterFilter.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(150,f.value),t);
    f.exponentialRampToValueAtTime(9000,t+bar*1.5);
    f.exponentialRampToValueAtTime(220,t+bar*3);
    f.setTargetAtTime(this.targetCut(),t+bar*3.2,0.4);
  },

  // v17: dub echo throw — feedback spike for a big delay tail
  dubThrow(){
    if(!this.ctx) return;
    const t=this.ctx.currentTime+0.02;
    const base=this.st?0.3+this.st.macros.morphY*0.3:0.45;
    this.fb.gain.cancelScheduledValues(t); this.fb2.gain.cancelScheduledValues(t);
    this.fb.gain.setValueAtTime(base,t);
    this.fb.gain.linearRampToValueAtTime(0.88,t+0.15);
    this.fb.gain.setTargetAtTime(base,t+1.6,0.4);
    this.fb2.gain.setValueAtTime(base,t);
    this.fb2.gain.linearRampToValueAtTime(0.88,t+0.15);
    this.fb2.gain.setTargetAtTime(base,t+1.6,0.4);
  },

  // v33: playDNA — render any Sound DNA object (large procedural sound library)
  playDNA(t,midi,dur,dna,vol=1){
    const c=this.ctx,f=mtof(midi),m=this.st.macros;
    const o=dna.osc||{},fl0=dna.filter||{},am=dna.amp||{};
    const unison=o.unison||1,det=o.detune||0;
    const fl=c.createBiquadFilter(); fl.type='lowpass';
    fl.Q.value=fl0.Q||1;
    const cutBase=fl0.cut||2000, envAmt=fl0.env||0.5;
    fl.frequency.setValueAtTime(Math.min(12000,cutBase*(1+envAmt*2)),t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(120,cutBase*(1-envAmt*0.6)),t+(am.dec||0.5));
    // drive stage
    let driveNode=null;
    if(dna.drive){driveNode=c.createWaveShaper();driveNode.curve=this.bassCurve(1+dna.drive*2);driveNode.oversample='4x';}
    // fold stage
    let foldNode=null;
    if(dna.fold){foldNode=c.createWaveShaper();foldNode.curve=this.foldCurve(dna.fold);foldNode.oversample='4x';}
    const g=c.createGain();
    const atk=am.atk||0.01,dec=(am.dec||0.5);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.3*vol/Math.max(1,unison*0.5),t+atk);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    const oscs=[];
    for(let v=0;v<unison;v++){
      const ov=c.createOscillator(); ov.type=o.wave||'sawtooth';
      ov.frequency.value=f;
      if(unison>1) ov.detune.value=(v-(unison-1)/2)*(det||10)+(Math.random()*2-1);
      if(o.pitchStart){ov.frequency.setValueAtTime(o.pitchStart,t);ov.frequency.exponentialRampToValueAtTime(o.pitchEnd||f,t+(o.pitchTime||0.05));}
      ov.connect(fl); oscs.push(ov);
    }
    // LFO modulation
    if(dna.lfo){
      const lfo=c.createOscillator(),lg=c.createGain();
      lfo.type='sine'; lfo.frequency.value=dna.lfo.rate||4;
      lg.gain.value=(dna.lfo.depth||0.5)*(dna.lfo.target==='cutoff'?1500:30);
      lfo.connect(lg);
      if(dna.lfo.target==='pitch'){for(const ov of oscs)lg.connect(ov.detune);}else{lg.connect(fl.frequency);}
      lfo.start(t); lfo.stop(t+dur+0.1);
    }
    // chain: fl -> [drive] -> [fold] -> g -> sum (+sends)
    let node=fl;
    if(driveNode){node.connect(driveNode);node=driveNode;}
    if(foldNode){node.connect(foldNode);node=foldNode;}
    node.connect(g); g.connect(this.sum);
    const rs=this.mkSend(0.35); g.connect(rs[0]); g.connect(rs[1]);
    for(const ov of oscs){ov.start(t);ov.stop(t+dur+0.1);}
  },
};

export const eng=Object.create(EngineProto);
export {EngineProto};
