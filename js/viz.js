export const viz={
  el:null,c:null,rot:0,
  init(el){
    this.el=el; if(!el) return;
    this.c=el.getContext('2d');
    const rs=()=>this.resize();
    window.addEventListener('resize',rs);
    rs();
  },
  resize(){
    if(!this.el) return;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const r=this.el.getBoundingClientRect();
    this.el.width=Math.max(2,r.width*dpr);
    this.el.height=Math.max(2,r.height*dpr);
  },
  draw(freq,bass,hue,pulse,playing){
    const c=this.c;
    if(!c) return;
    const W=this.el.width,H=this.el.height;
    if(!W||!H) return;
    const cx=W/2,cy=H/2;
    c.fillStyle='rgba(7,9,15,0.38)';
    c.fillRect(0,0,W,H);
    this.rot+=0.003+bass*0.02;
    const R0=Math.min(W,H)*(0.2+bass*0.05);
    const N=90,maxLen=Math.min(W,H)*0.28;
    for(let i=0;i<N;i++){
      let v=0;
      if(freq&&playing) v=freq[i*3]/255;
      else v=0.035+0.03*Math.sin(Date.now()/700+i*0.35);
      const a=i/N*Math.PI*2+this.rot;
      const len=v*maxLen+2;
      const x1=cx+Math.cos(a)*R0,y1=cy+Math.sin(a)*R0;
      const x2=cx+Math.cos(a)*(R0+len),y2=cy+Math.sin(a)*(R0+len);
      c.strokeStyle='hsla('+((hue+i*2.2)%360)+',95%,'+(52+v*25)+'%,'+(0.28+v*0.7)+')';
      c.lineWidth=Math.max(1.2,W/N*0.45);
      c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
    }
    const core=R0*0.55*(1+bass*0.3+pulse*0.12);
    const g=c.createRadialGradient(cx,cy,0,cx,cy,core);
    g.addColorStop(0,'hsla('+hue+',95%,70%,'+(0.5+bass*0.4)+')');
    g.addColorStop(1,'hsla('+hue+',95%,50%,0)');
    c.fillStyle=g;
    c.beginPath(); c.arc(cx,cy,core,0,Math.PI*2); c.fill();
    if(pulse>0.03){
      c.strokeStyle='hsla('+hue+',100%,75%,'+(pulse*0.85)+')';
      c.lineWidth=2+pulse*5;
      c.beginPath(); c.arc(cx,cy,R0*(1.05+(1-pulse)*0.5),0,Math.PI*2); c.stroke();
    }
  },
};
