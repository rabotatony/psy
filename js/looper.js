import {eng} from './engine.js';

export function bufferToWav(buf){
  const nCh=buf.numberOfChannels,sr=buf.sampleRate,len=buf.length;
  const bytes=44+len*nCh*2;
  const ab=new ArrayBuffer(bytes),dv=new DataView(ab);
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF'); dv.setUint32(4,bytes-8,true); ws(8,'WAVE');
  ws(12,'fmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,nCh,true);
  dv.setUint32(24,sr,true); dv.setUint32(28,sr*nCh*2,true); dv.setUint16(32,nCh*2,true); dv.setUint16(34,16,true);
  ws(36,'data'); dv.setUint32(40,len*nCh*2,true);
  const chans=[];
  for(let c=0;c<nCh;c++) chans.push(buf.getChannelData(c));
  let off=44;
  for(let i=0;i<len;i++){
    for(let c=0;c<nCh;c++){
      let v=chans[c][i]; v=Math.max(-1,Math.min(1,v));
      dv.setInt16(off,v<0?v*0x8000:v*0x7FFF,true); off+=2;
    }
  }
  return new Blob([ab],{type:'audio/wav'});
}
export function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},1500);
}

export const lop={
  layers:[0,1,2,3].map(()=>({buf:null,recBPM:142,src:null,gain:null,met:null,muted:false,pending:false})),
  armed:false,recording:false,recSel:2,reason:'normal',rec:null,stopT:null,recStart:0,chunks:[],
  container:null,meterEls:[],_mArr:null,
  st:null,toast:()=>{},onArm:()=>{},onRec:()=>{},

  bind(st){this.st=st;},

  init(){
    if(!eng.ctx) return;
    const c=eng.ctx;
    this.layers.forEach(L=>{
      if(L.gain) return;
      L.gain=c.createGain();
      L.gain.connect(eng.duck);
      L.met=c.createAnalyser(); L.met.fftSize=256;
      L.gain.connect(L.met);
      L.gain.gain.value=L.muted?0:1;
    });
  },

  tap(){
    eng.init(); eng.ctx.resume(); this.init();
    if(!eng.recDest){this.toast('הקלטה לא נתמכת בדפדפן הזה'); return;}
    if(this.recording){
      this.reason='user'; clearTimeout(this.stopT);
      try{this.rec.stop();}catch(e){}
      return;
    }
    if(this.armed){this.armed=false; this.onArm(false); return;}
    this.armed=true; this.onArm(true);
    this.toast('ההקלטה תתחיל בתיבה הבאה');
  },

  abort(){
    this.armed=false; this.onArm(false);
    if(this.recording){this.reason='user'; try{this.rec.stop();}catch(e){}}
  },

  onBar(t){
    if(this.recording||!this.armed) return;
    this.armed=false; this.onArm(false);
    const ms=Math.max(0,(t-eng.ctx.currentTime)*1000);
    setTimeout(()=>this.begin(),ms);
  },

  begin(){
    if(!eng.ctx||!eng.recDest) return;
    this.recording=true; this.recBPM=this.st.bpm;
    this.recStart=eng.ctx.currentTime; this.chunks=[];
    const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4']
      .find(m=>{try{return MediaRecorder.isTypeSupported(m);}catch(e){return false;}});
    try{
      this.rec=new MediaRecorder(eng.recDest.stream,mime?{mimeType:mime}:{});
    }catch(e){this.recording=false; this.toast('ההקלטה נכשלה'); return;}
    this.rec.ondataavailable=e=>{if(e.data&&e.data.size) this.chunks.push(e.data);};
    this.rec.onstop=()=>this.finalize();
    this.onRec(true);
    this.rec.start();
    const bdR=60/this.recBPM*4;
    this.stopT=setTimeout(()=>{
      if(this.recording&&this.rec.state!=='inactive'){this.reason='normal'; this.rec.stop();}
    },this.recSel*bdR*1000+60);
  },

  async finalize(){
    this.recording=false; this.onRec(false);
    const elapsed=eng.ctx.currentTime-this.recStart, bdR=60/this.recBPM*4;
    let bars=this.reason==='normal'?this.recSel:Math.floor(elapsed/bdR+0.15);
    bars=Math.max(1,Math.min(8,bars));
    if(elapsed<bdR*0.7){this.toast('הלופ קצר מדי'); return;}
    try{
      const blob=new Blob(this.chunks),ab=await blob.arrayBuffer();
      const buf=await eng.ctx.decodeAudioData(ab);
      const tr=this.trim(buf,bars*bdR);
      const i=this.layers.findIndex(L=>!L.buf);
      if(i===-1){this.toast('אין לוט פנוי — נקה אחד'); return;}
      const L=this.layers[i];
      L.buf=tr; L.recBPM=this.recBPM; L.muted=false; L.pending=true;
      if(L.gain) L.gain.gain.setTargetAtTime(1,eng.ctx.currentTime,0.02);
      this.render();
      this.toast('לופ '+(i+1)+' הוקלט ('+bars+' תיבות)');
    }catch(e){this.toast('שגיאת פענוח אודיו');}
  },

  trim(buf,lenSec){
    const sr=eng.ctx.sampleRate,frames=Math.min(buf.length,Math.floor(lenSec*sr));
    const out=eng.ctx.createBuffer(buf.numberOfChannels,frames,sr);
    const fade=Math.min(frames>>1,Math.floor(sr*0.004));
    for(let ch=0;ch<buf.numberOfChannels;ch++){
      const d=buf.getChannelData(ch).slice(0,frames);
      for(let i=0;i<fade;i++){const g=i/fade; d[i]*=g; d[frames-1-i]*=g;}
      out.copyToChannel(d,ch);
    }
    return out;
  },

  startAt(i,t){
    const L=this.layers[i];
    if(!L.buf||!eng.ctx) return;
    if(L.src){try{L.src.stop();}catch(e){}}
    const s=eng.ctx.createBufferSource();
    s.buffer=L.buf; s.loop=true;
    s.playbackRate.value=this.st.bpm/L.recBPM;
    s.connect(L.gain);
    s.start(t,0); L.src=s;
  },

  startAll(t){
    this.layers.forEach((L,i)=>{L.pending=false; if(L.buf&&!L.muted) this.startAt(i,t);});
    this.render();
  },
  startPending(t){
    let any=false;
    this.layers.forEach((L,i)=>{
      if(L.pending){L.pending=false; any=true; if(!L.muted) this.startAt(i,t);}
    });
    if(any) this.render();
  },
  stopAll(){
    this.layers.forEach(L=>{if(L.src){try{L.src.stop();}catch(e){} L.src=null;}});
    this.render();
  },
  updateRates(){
    if(!eng.ctx) return;
    this.layers.forEach(L=>{
      if(L.src) L.src.playbackRate.setTargetAtTime(this.st.bpm/L.recBPM,eng.ctx.currentTime,0.05);
    });
  },

  clear(i){
    const L=this.layers[i];
    if(L.src){try{L.src.stop();}catch(e){}}
    L.src=null; L.buf=null; L.pending=false;
    this.render(); this.toast('לופ '+(i+1)+' נוקה');
  },

  render(){
    const c=this.container; if(!c) return;
    c.innerHTML=''; this.meterEls=[];
    this.layers.forEach((L,i)=>{
      const d=document.createElement('div');
      d.className='slot'+(L.buf?' has':'')+(L.muted?' muted':'')+((L.src&&!L.muted)?' playing':'');
      d.innerHTML='<b>L'+(i+1)+'</b><small>'+(L.buf?L.buf.duration.toFixed(1)+'s':'ריק')+'</small><div class="meter"><i></i></div>'
        +(L.buf?'<button class="clr" type="button">✕</button>':'');
      d.addEventListener('pointerdown',e=>{
        if(e.target.classList.contains('clr')){this.clear(i); return;}
        if(!L.buf){this.toast('הקלט משהו קודם (REC)'); return;}
        L.muted=!L.muted;
        if(L.gain) L.gain.gain.setTargetAtTime(L.muted?0:1,eng.ctx.currentTime,0.02);
        this.render();
      });
      c.appendChild(d);
      this.meterEls.push(d.querySelector('.meter i'));
    });
  },

  meters(){
    if(!this.meterEls.length) return;
    if(!this._mArr) this._mArr=new Uint8Array(256);
    const arr=this._mArr;
    this.layers.forEach((L,i)=>{
      const el=this.meterEls[i]; if(!el) return;
      if(L.buf&&L.met){
        L.met.getByteTimeDomainData(arr);
        let s=0;
        for(let k=0;k<arr.length;k+=4){const v=(arr[k]-128)/128; s+=v*v;}
        const rms=Math.sqrt(s/(arr.length/4));
        el.style.width=Math.min(100,rms*340)+'%';
      }else el.style.width='0%';
    });
  },
};
