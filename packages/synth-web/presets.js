import {applyRecipe,motionRecipe} from './recipes.js';
function setCharacter(amount,values){const motion=applyRecipe(motionRecipe,amount,values);for(const t of motionRecipe.targets)values[t.id]=motion[t.id];values[14]=.1+amount*.5;values[33]=.18;values[34]=.85*amount;}
export function factoryPatch(name,parameters) {
    const next=parameters.map(p=>p.default);
    if(name==='velvet'){next[4]=.12;next[5]=.7;next[6]=.72;next[7]=.8;next[11]=2800;next[2]=4;setCharacter(.32,next);if(parameters[18])next[18]=.28;}
    if(name==='glass'){next[4]=.004;next[5]=.48;next[6]=.16;next[7]=.45;next[11]=7500;next[1]=.15;next[2]=2;next[9]=-.65;setCharacter(.16,next);if(parameters[18])next[18]=.12;}
    if(name==='low'){next[4]=.008;next[5]=.3;next[6]=.68;next[7]=.18;next[11]=680;next[1]=.7;next[2]=-3;setCharacter(.6,next);if(parameters[18])next[18]=.5;}
    if(next.length>=23){next[21]=1-next[1];next[22]=next[1];}
    return next;
  }
