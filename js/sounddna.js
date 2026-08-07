// sounddna.js — Sound DNA: procedural sound library.
// Each sound = a DNA object (synthesis parameters). Seeded generation yields
// thousands of unique, style-aware sounds the algorithm can pick from.

function seededRand(seed){
  let a=seed|0;
  return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
function pick(r,arr){return arr[Math.floor(r()*arr.length)%arr.length];}
function rr(r,a,b){return a+r()*(b-a);}

// Category templates define parameter RANGES; generation samples within them.
const TEMPLATES={
  kick:[
    {name:'punchy',osc:{wave:'sine',pitchStart:170,pitchEnd:44,pitchTime:0.06},amp:{dec:0.26},click:0.4},
    {name:'deep',osc:{wave:'sine',pitchStart:120,pitchEnd:38,pitchTime:0.08},amp:{dec:0.34},click:0.25},
    {name:'clicky',osc:{wave:'sine',pitchStart:200,pitchEnd:50,pitchTime:0.05},amp:{dec:0.22},click:0.6},
    {name:'distorted',osc:{wave:'sine',pitchStart:150,pitchEnd:45,pitchTime:0.07},amp:{dec:0.3},click:0.5,drive:0.6},
  ],
  bass:[
    {name:'rolling',wave:'sawtooth',filter:{cut:[800,4000],Q:[1,4],env:[0.4,0.9]},amp:{dec:[0.5,0.9]}},
    {name:'offbeat',wave:'sawtooth',filter:{cut:[600,2500],Q:[1,3],env:[0.3,0.7]},amp:{dec:[0.8,1.4]}},
    {name:'acid',wave:'square',filter:{cut:[400,3000],Q:[4,12],env:[0.6,1.0]},amp:{dec:[0.4,0.8]}},
    {name:'sub',wave:'sine',filter:{cut:[200,800],Q:[0.5,2],env:[0.2,0.5]},amp:{dec:[0.8,1.5]}},
    {name:'wobble',wave:'sawtooth',filter:{cut:[300,1500],Q:[2,8],env:[0.5,0.9]},amp:{dec:[0.6,1.0]},lfo:{rate:[2,8],depth:[0.3,0.8],target:'cutoff'}},
  ],
  lead:[
    {name:'supersaw',wave:'sawtooth',unison:[4,7],detune:[8,25],filter:{cut:[1500,8000],Q:[0.7,3],env:[0.2,0.6]},amp:{dec:[0.4,1.0]}},
    {name:'pluck',wave:'sawtooth',unison:[1,2],detune:[3,10],filter:{cut:[1000,7000],Q:[1,6],env:[0.7,1.0]},amp:{dec:[0.15,0.4]}},
    {name:'acid',wave:'square',unison:[1,1],detune:[0,5],filter:{cut:[500,4000],Q:[5,14],env:[0.6,1.0]},amp:{dec:[0.3,0.7]}},
    {name:'fold',wave:'sawtooth',unison:[2,4],detune:[5,15],filter:{cut:[800,5000],Q:[1,4],env:[0.3,0.7]},amp:{dec:[0.3,0.8]},fold:[1.5,4]},
    {name:'fm',wave:'sine',unison:[1,2],detune:[0,8],filter:{cut:[1000,6000],Q:[1,5],env:[0.4,0.8]},amp:{dec:[0.2,0.6]},fm:[1,3]},
  ],
  pad:[
    {name:'warm',wave:'sawtooth',unison:[3,5],detune:[6,14],filter:{cut:[400,1500],Q:[0.5,2],env:[0.1,0.3]},amp:{atk:[0.4,1.2],dec:[1.5,3]}},
    {name:'airy',wave:'triangle',unison:[2,4],detune:[8,18],filter:{cut:[800,3000],Q:[0.5,2],env:[0.1,0.3]},amp:{atk:[0.6,1.5],dec:[2,4]}},
    {name:'gated',wave:'sawtooth',unison:[3,5],detune:[5,12],filter:{cut:[500,2000],Q:[0.7,2],env:[0.1,0.3]},amp:{atk:[0.1,0.4],dec:[1,2]},gate:true},
  ],
};

// generateDNA(category, seed, styleBias) -> SoundDNA object
export function generateDNA(category,seed,styleBias){
  const r=seededRand(seed);
  const tpls=TEMPLATES[category]; if(!tpls) return null;
  const t=pick(r,tpls);
  const dna={category,template:t.name,styleBias:styleBias||null};
  dna.osc={wave:t.wave};
  if(t.unison) dna.osc.unison=Math.round(rr(r,t.unison[0],t.unison[1]));
  if(t.detune) dna.osc.detune=rr(r,t.detune[0],t.detune[1]);
  if(t.osc){dna.osc.pitchStart=t.osc.pitchStart;dna.osc.pitchEnd=t.osc.pitchEnd;dna.osc.pitchTime=t.osc.pitchTime;}
  if(t.filter){
    dna.filter={
      cut:rr(r,t.filter.cut[0],t.filter.cut[1]),
      Q:rr(r,t.filter.Q[0],t.filter.Q[1]),
      env:rr(r,t.filter.env[0],t.filter.env[1]),
    };
  }
  dna.amp={};
  if(t.amp){
    if(t.amp.atk) dna.amp.atk=rr(r,t.amp.atk[0],t.amp.atk[1]);
    if(t.amp.dec) dna.amp.dec=Array.isArray(t.amp.dec)?rr(r,t.amp.dec[0],t.amp.dec[1]):t.amp.dec;
  }
  if(t.lfo) dna.lfo={rate:rr(r,t.lfo.rate[0],t.lfo.rate[1]),depth:rr(r,t.lfo.depth[0],t.lfo.depth[1]),target:t.lfo.target};
  if(t.fold) dna.fold=rr(r,t.fold[0],t.fold[1]);
  if(t.fm) dna.fm=rr(r,t.fm[0],t.fm[1]);
  if(t.click!==undefined) dna.click=t.click;
  if(t.drive) dna.drive=t.drive;
  if(t.gate) dna.gate=true;
  return dna;
}

// generateLibrary(style, count) -> array of DNA per category, biased to a style
export function generateLibrary(style,countPerCat){
  const lib={};
  const cats=Object.keys(TEMPLATES);
  for(const cat of cats){
    lib[cat]=[];
    for(let i=0;i<(countPerCat||8);i++){
      lib[cat].push(generateDNA(cat,(style.seed||1)*1000+i*17+cat.length,style.name));
    }
  }
  return lib;
}
export const SoundDNA={generateDNA,generateLibrary,TEMPLATES};
