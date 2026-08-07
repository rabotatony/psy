// core.js v17 — emotional scales + trance module grammar + 32-step resolution
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const mtof=m=>440*Math.pow(2,(m-69)/12);
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// ---------- emotional scale library (2-octave degree arrays) ----------
export const SCALES={
  PHRY:[0,1,3,5,7,8,10,12,13,15,17,19,20,22],      // dark mystery
  MIN:[0,2,3,5,7,8,10,12,14,15,17,19,20,22],        // sadness
  HARM:[0,2,3,5,7,8,11,12,14,15,17,19,20,23],       // dramatic tension
  DORIAN:[0,2,3,5,7,9,10,12,14,15,17,19,21,22],     // hopeful melancholy
  LYDIAN:[0,2,4,6,7,9,11,12,14,16,18,19,21,23],     // dreamy float
  MAJOR:[0,2,4,5,7,9,11,12,14,16,17,19,21,23],      // uplift
  MIXO:[0,2,4,5,7,9,10,12,14,16,17,19,21,22],       // positive groove
  DHARM:[0,1,4,5,7,8,11,12,13,16,17,19,20,23],      // double-harmonic exotic emotion
  PHRYDOM:[0,1,4,5,7,8,10,12,13,16,17,19,20,22],    // middle-eastern / goa feeling
  PDMIN:[0,3,5,7,10,12,15,17,19,22],                // minor pentatonic — safe & emotional
};

export const STEPS=32;

// ---------- trance modules: deterministic 32-step pattern grammar ----------
function pat32(idxs){const a=new Array(32).fill(0);(idxs||[]).forEach(i=>{a[i]=1;});return a;}
export const pat32x=pat32;

export const MOD={
  kick:{ four:pat32([0,8,16,24]), halftime:pat32([0,16]), soft:pat32([0,16]), none:pat32([]) },
  bass:{
    roll:pat32([2,4,6,10,12,14,18,20,22,26,28,30]),
    offbeat:pat32([4,12,20,28]),
    sub:pat32([0,8,16,24]),
    wobble:pat32([0,6,12,20,26]),
    none:pat32([]),
  },
  hat:{
    full:pat32([0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30]),
    eighth:pat32([0,4,8,12,16,20,24,28]),
    off:pat32([4,12,20,28]),
    sparse:pat32([8,24]),
    none:pat32([]),
  },
  perc:{
    tribal:pat32([6,12,22,28]),
    shuffle:pat32([3,7,11,19,23,27]),
    sparse:pat32([14,30]),
    none:pat32([]),
  },
  leadGate:{
    anthem:pat32([0,6,12,16,22,28]),
    pulse:pat32([0,4,8,12,16,20,24,28]),
    sparse:pat32([0,12,16,28]),
    arp:pat32([0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30]),
    echo:pat32([0,10,16,26]),
    none:pat32([]),
  },
};

const O32=new Array(32).fill(0);
[6,14,22,30].forEach(i=>{O32[i]=12;});
const Z32=new Array(32).fill(0);

// ---------- styles: each is a full recipe (scale+bass+drums+lead+fx+mood) ----------
export const SCENES=[
 {name:'FULL-ON',heb:'פול-און',mood:'אנרגיה אופטימית',hue:140,root:42,scale:'PHRY',leadType:'saw',pad:true,bassLong:false,bassType:'roll',bpm:142,
  kick:MOD.kick.four,bass:MOD.bass.roll,bassOct:O32,hat:MOD.hat.full,open:[4,12,20,28],clap:[8,24],perc:MOD.perc.tribal,gate:MOD.leadGate.anthem,chord:[0,7,12],seed:11},
 {name:'DARK',heb:'דארק',mood:'אפלה ומתח',hue:288,root:38,scale:'PHRY',leadType:'acid',pad:true,bassLong:false,bassType:'roll',bpm:145,
  kick:MOD.kick.four,bass:MOD.bass.roll,bassOct:O32,hat:MOD.hat.eighth,open:[],clap:[8,24],perc:MOD.perc.sparse,gate:MOD.leadGate.echo,chord:[0,3,7],seed:29},
 {name:'PROG',heb:'פרוגרסיב',mood:'מרחב וגעגוע',hue:28,root:45,scale:'DORIAN',leadType:'pluck',pad:true,bassLong:true,bassType:'offbeat',bpm:134,
  kick:MOD.kick.four,bass:MOD.bass.offbeat,bassOct:Z32,hat:MOD.hat.off,open:[4,12,20,28],clap:[],perc:MOD.perc.shuffle,gate:MOD.leadGate.sparse,chord:[0,7,12],seed:47},
 {name:'ACID',heb:'אסיד',mood:'טירוף מתכתי',hue:192,root:40,scale:'HARM',leadType:'acid',pad:false,bassLong:false,bassType:'roll',bpm:144,
  kick:MOD.kick.four,bass:MOD.bass.roll,bassOct:O32,hat:MOD.hat.full,open:[4,12,20,28],clap:[8,24],perc:MOD.perc.tribal,gate:MOD.leadGate.pulse,chord:[0,7],seed:83},
 {name:'GOA',heb:'גואה',mood:'רגש מזרחי-קוסמי',hue:55,root:43,scale:'PHRYDOM',leadType:'saw',pad:true,bassLong:false,bassType:'roll',bpm:138,
  kick:MOD.kick.four,bass:MOD.bass.roll,bassOct:O32,hat:MOD.hat.eighth,open:[4,12,20,28],clap:[8,24],perc:MOD.perc.shuffle,gate:MOD.leadGate.anthem,chord:[0,7,12],seed:131},
 {name:'NIGHT',heb:'לילה',mood:'היפנוזה מהירה',hue:330,root:41,scale:'HARM',leadType:'fm',pad:false,bassLong:false,bassType:'roll',bpm:150,
  kick:MOD.kick.four,bass:MOD.bass.roll,bassOct:O32,hat:MOD.hat.full,open:[4,12,20,28],clap:[8,24],perc:MOD.perc.tribal,gate:MOD.leadGate.pulse,chord:[0,7],seed:197},
 {name:'FOLD',heb:'פולד',mood:'כאוס מהפנט',hue:200,root:44,scale:'HARM',leadType:'fold',pad:true,bassLong:false,bassType:'roll',bpm:146,
  kick:MOD.kick.four,bass:MOD.bass.roll,bassOct:O32,hat:MOD.hat.full,open:[],clap:[8,24],perc:MOD.perc.sparse,gate:MOD.leadGate.echo,chord:[0,7],seed:233},
 {name:'CHILL',heb:'צ׳יל',mood:'חום ורוגע',hue:170,root:45,scale:'MAJOR',leadType:'saw',pad:true,bassLong:true,bassType:'sub',bpm:92,
  kick:MOD.kick.soft,bass:MOD.bass.sub,bassOct:Z32,hat:MOD.hat.sparse,open:[],clap:[],perc:MOD.perc.shuffle,gate:MOD.leadGate.sparse,chord:[0,4,7],seed:55},
 {name:'AMBIENT',heb:'אמביאנט',mood:'ריחוף חסר-זמן',hue:220,root:48,scale:'LYDIAN',leadType:'saw',pad:true,bassLong:true,bassType:'drone',bpm:66,
  kick:MOD.kick.none,bass:MOD.bass.none,bassOct:Z32,hat:MOD.hat.none,open:[],clap:[],perc:MOD.perc.none,gate:MOD.leadGate.echo,chord:[0,7,11],seed:77},
 {name:'PSYCHILL',heb:'פסייצ׳יל',mood:'רגש אקזוטי',hue:260,root:43,scale:'DHARM',leadType:'fold',pad:true,bassLong:true,bassType:'sub',bpm:96,
  kick:MOD.kick.soft,bass:MOD.bass.sub,bassOct:Z32,hat:MOD.hat.off,open:[],clap:[],perc:MOD.perc.tribal,gate:MOD.leadGate.echo,chord:[0,5,7],seed:99},
 {name:'DUB',heb:'דאב',mood:'עומק מהדהד',hue:30,root:40,scale:'MIN',leadType:'fold',pad:true,bassLong:true,bassType:'wobble',bpm:76,
  kick:MOD.kick.halftime,bass:MOD.bass.wobble,bassOct:Z32,hat:MOD.hat.off,open:[],clap:[],perc:MOD.perc.sparse,gate:MOD.leadGate.echo,chord:[0,3,7],seed:121},
];

export const SYNTH=[
 {bass:{drive:1.1,peak:1.2,q:0.9,decay:0.9,sub:1.0},kick:{decay:0.9,click:1.2,punch:1.2},lead:{bright:1.3,fold:0.8,width:1.1},space:{delay:1.0,reverb:0.9}},
 {bass:{drive:2.0,peak:0.5,q:1.6,decay:0.85,sub:1.2},kick:{decay:0.8,click:1.8,punch:1.3},lead:{bright:0.5,fold:3.0,width:0.7},space:{delay:0.7,reverb:0.6}},
 {bass:{drive:0.5,peak:0.9,q:0.6,decay:1.5,sub:0.9},kick:{decay:1.2,click:0.7,punch:0.8},lead:{bright:0.9,fold:0.4,width:1.5},space:{delay:1.4,reverb:1.5}},
 {bass:{drive:1.3,peak:1.2,q:2.5,decay:0.8,sub:0.8},kick:{decay:0.9,click:1.0,punch:1.0},lead:{bright:1.0,fold:2.0,width:0.9},space:{delay:1.0,reverb:0.8}},
 {bass:{drive:0.9,peak:0.9,q:1.0,decay:1.1,sub:0.95},kick:{decay:1.0,click:0.9,punch:0.95},lead:{bright:1.0,fold:1.2,width:1.4},space:{delay:1.6,reverb:1.2}},
 {bass:{drive:1.6,peak:0.8,q:1.3,decay:0.75,sub:1.0},kick:{depth:0.75,decay:0.75,click:1.3,punch:1.2},lead:{bright:0.6,fold:2.5,width:0.85},space:{delay:0.8,reverb:0.7}},
 {bass:{drive:1.7,peak:0.8,q:1.4,decay:0.85,sub:1.0},kick:{decay:0.85,click:1.1,punch:1.0},lead:{bright:0.7,fold:3.5,width:1.0},space:{delay:1.0,reverb:0.9}},
 {bass:{drive:0.3,peak:0.6,q:0.5,decay:1.7,sub:1.1},kick:{decay:1.4,click:0.4,punch:0.6},lead:{bright:0.6,fold:0.5,width:1.3},space:{delay:1.3,reverb:1.7}},
 {bass:{drive:0.2,peak:0.4,q:0.4,decay:2.2,sub:1.2},kick:{decay:1.6,click:0.3,punch:0.4},lead:{bright:0.4,fold:0.8,width:1.6},space:{delay:1.4,reverb:2.2}},
 {bass:{drive:0.7,peak:0.7,q:1.1,decay:1.4,sub:1.1},kick:{decay:1.3,click:0.7,punch:0.75},lead:{bright:0.7,fold:2.0,width:1.2},space:{delay:1.5,reverb:1.4}},
 {bass:{drive:0.8,peak:0.5,q:1.0,decay:1.3,sub:1.5},kick:{decay:1.5,click:0.7,punch:0.75},lead:{bright:0.5,fold:2.8,width:1.0},space:{delay:1.8,reverb:1.5}},
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

export const BPM_MIN=40;
export const BPM_MAX=220;
export const LS_KEY='psyweave17';
