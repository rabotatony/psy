// wavetable.js — NEW synthesis core: rich harmonic timbres via PeriodicWave.
// Instead of basic saw/square, each voice is built from a custom harmonic recipe,
// giving genuinely rich, distinct timbres per style. This is the new foundation.
function harm(reals){ // build PeriodicWave from harmonic amplitudes
  return {reals};
}
// Harmonic recipes: [amp of harmonic 1..N]. Distinct character per family.
export const TIMBRES={
  // bright, rich supersaw-like (many harmonics, slow rolloff)
  supersaw:{reals:[0,1,0.9,0.8,0.7,0.6,0.5,0.45,0.4,0.35,0.3,0.26,0.22,0.18,0.15,0.12]},
  // warm analog lead (odd-heavy, fast rolloff)
  warm:{reals:[0,1,0.5,0.35,0.25,0.18,0.12,0.08,0.05,0.03]},
  // hollow / flutey (odd harmonics only)
  hollow:{reals:[0,1,0,0.4,0,0.25,0,0.15,0,0.08,0,0.05]},
  // reed / square-ish (odd, slow rolloff)
  reed:{reals:[0,1,0,0.55,0,0.4,0,0.3,0,0.22,0,0.16,0,0.12]},
  // metallic / FM-like (inharmonic partials)
  metallic:{reals:[0,1,0.6,0.2,0.5,0.1,0.4,0.15,0.3,0.1,0.25,0.2,0.15,0.1,0.2,0.12]},
  // deep sub-bass (fundamental + tiny harmonics)
  sub:{reals:[0,1,0.15,0.06,0.03,0.01]},
  // growl bass (rich low harmonics)
  growl:{reals:[0,1,0.7,0.5,0.4,0.32,0.26,0.2,0.15,0.12,0.09,0.07]},
  // pluck (bright attack harmonics)
  pluck:{reals:[0,1,0.8,0.65,0.5,0.4,0.3,0.22,0.16,0.11,0.07,0.04]},
};
export function makeWave(ctx,timbreName){
  const t=TIMBRES[timbreName]||TIMBRES.supersaw;
  const n=t.reals.length;
  const real=new Float32Array(n); const imag=new Float32Array(n);
  for(let i=0;i<n;i++){real[i]=t.reals[i]; imag[i]=0;}
  return ctx.createPeriodicWave(real,imag,{disableNormalization:false});
}
// map each style to a timbre set (bass/lead/pad)
export const STYLE_TIMBRE={
  'FULL-ON':{bass:'growl',lead:'supersaw',pad:'warm'},
  'DARK':{bass:'growl',lead:'reed',pad:'hollow'},
  'PROG':{bass:'sub',lead:'warm',pad:'warm'},
  'ACID':{bass:'growl',lead:'reed',pad:'hollow'},
  'GOA':{bass:'growl',lead:'supersaw',pad:'warm'},
  'NIGHT':{bass:'growl',lead:'metallic',pad:'hollow'},
  'FOLD':{bass:'growl',lead:'metallic',pad:'hollow'},
  'CHILL':{bass:'sub',lead:'warm',pad:'warm'},
  'AMBIENT':{bass:'sub',lead:'hollow',pad:'warm'},
  'PSYCHILL':{bass:'sub',lead:'hollow',pad:'warm'},
  'DUB':{bass:'sub',lead:'reed',pad:'hollow'},
};
export function timbreFor(styleName,voice){
  const s=STYLE_TIMBRE[styleName]||STYLE_TIMBRE['FULL-ON'];
  return s[voice]||'supersaw';
}
