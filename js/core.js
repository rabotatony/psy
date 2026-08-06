export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const mtof=m=>440*Math.pow(2,(m-69)/12);
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export const SCALES={
  PHRY:[0,1,3,5,7,8,10,12,13,15,17,19,20,22],
  MIN :[0,2,3,5,7,8,10,12,14,15,17,19,20,22],
  HARM:[0,2,3,5,7,8,11,12,14,15,17,19,20,23],
};

const Q   =[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0];
const ROLL=[0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1];
const A16 =[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
const E8  =[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0];
const OFFB=[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0];
const OCTA=[0,0,0,12,0,0,0,12,0,0,0,12,0,0,0,0];
const OCTB=[0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0];
const ZERO=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

export const RHYTHMS=[
  [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0],
  [1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,1],
  [1,1,0,0,1,0,1,0,0,1,1,0,1,0,0,0],
  [1,0,0,1,0,1,0,0,0,1,0,0,1,0,1,0],
];

export const SCENES=[
  {name:'FULL-ON',heb:'פול-און',hue:140,root:42,scale:'PHRY',leadType:'saw',pad:true,bassLong:false,bpm:142,
   kick:Q,bass:ROLL,bassOct:OCTA,hat:A16,open:[2,6,10,14],clap:[],perc:[3,11],percFreq:330,
   gate:RHYTHMS[0],chord:[0,7,12],seed:11},
  {name:'DARK',heb:'חומר אפל',hue:288,root:38,scale:'PHRY',leadType:'acid',pad:true,bassLong:false,bpm:140,
   kick:Q,bass:ROLL,bassOct:OCTB,hat:E8,open:[],clap:[4,12],perc:[7,15],percFreq:250,
   gate:RHYTHMS[3],chord:[0,3,7],seed:29},
  {name:'PROG',heb:'פרוגרסיב',hue:28,root:45,scale:'MIN',leadType:'saw',pad:true,bassLong:true,bpm:138,
   kick:Q,bass:OFFB,bassOct:ZERO,hat:E8,open:[2,6,10,14],clap:[],perc:[3,6,11,14],percFreq:392,
   gate:RHYTHMS[1],chord:[0,7,12],seed:47},
  {name:'ACID',heb:'אסיד',hue:192,root:40,scale:'HARM',leadType:'acid',pad:false,bassLong:false,bpm:144,
   kick:Q,bass:ROLL,bassOct:OCTA,hat:A16,open:[2,6,10,14],clap:[4,12],perc:[3,10],percFreq:300,
   gate:RHYTHMS[2],chord:[0,7],seed:83},
  {name:'GOA',heb:'גואה',hue:55,root:43,scale:'MIN',leadType:'saw',pad:true,bassLong:false,bpm:138,
   kick:Q,bass:ROLL,bassOct:OCTA,hat:E8,open:[2,6,10,14],clap:[],perc:[3,6,11,14],percFreq:360,
   gate:RHYTHMS[1],chord:[0,7,12],seed:131},
  {name:'NIGHT',heb:'לילה',hue:330,root:41,scale:'HARM',leadType:'acid',pad:false,bassLong:false,bpm:150,
   kick:Q,bass:ROLL,bassOct:OCTB,hat:A16,open:[2,6,10,14],clap:[4,12],perc:[3,10,14],percFreq:280,
   gate:RHYTHMS[2],chord:[0,7],seed:197},
];

export const ARRANGEMENT=[
  {name:'INTRO', bars:8,  kick:1,bass:1,hat:0,lead:0,pad:1,perc:0,filt:0.5},
  {name:'BUILD', bars:8,  kick:1,bass:1,hat:1,lead:0,pad:1,perc:1,filt:0.72,riser:true},
  {name:'DROP',  bars:16, kick:1,bass:1,hat:1,lead:1,pad:1,perc:1,filt:1.0,crash:true},
  {name:'BREAK', bars:8,  kick:0,bass:0,hat:0,lead:1,pad:1,perc:0,filt:0.55},
  {name:'RISER', bars:8,  kick:1,bass:1,hat:1,lead:0,pad:1,perc:1,filt:0.8,riser:true},
  {name:'CLIMAX',bars:16, kick:1,bass:1,hat:1,lead:1,pad:1,perc:1,filt:1.0,crash:true},
];
export const TOTAL_BARS=ARRANGEMENT.reduce((s,x)=>s+x.bars,0);
export const SECTIONS_BY_NAME={};
ARRANGEMENT.forEach(s=>{SECTIONS_BY_NAME[s.name]=s;});
export const DEFAULT_SONG=['INTRO','BUILD','DROP','DROP','BREAK','RISER','CLIMAX','CLIMAX'];

export const LANES=[
  {id:'kick',heb:'קיק'},
  {id:'bass',heb:'בס'},
  {id:'hat',heb:'האטס'},
  {id:'lead',heb:'ליד'},
  {id:'perc',heb:'פרק'},
];

export const LS_KEY='psyweave3';
