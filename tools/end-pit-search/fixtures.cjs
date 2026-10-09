"use strict";
// MIT. E30 from the adopted baseline; old proposal-A boundary positions remain
// useful physical fixtures with the explicit v0.10.0 takasia field added.
const E=require('../../prototype/end-pit-engine.js');
function e30(active=true) {
  return {pits:[[[0,2,0,0,1,1,0,0],[0,0,2,2,0,2,6,4]],[[1,0,1,2,10,0,0,10],[2,2,8,4,1,2,1,0]]],
    reserve:[0,0],nyakuaReserve:[0,0],houseOwned:[false,false],player:1,phase:'mtaji',winner:null,reason:'',turn:2,pending:[0,0],takasia:active?{player:1,index:3}:null};
}
function mirror(b) { const c=E.clone(b);
  for(const k of ['pits','reserve','nyakuaReserve','houseOwned','pending']) c[k].reverse();
  c.player=1-c.player;if(c.winner!==null)c.winner=1-c.winner;
  if(c.takasia)c.takasia.player=1-c.takasia.player;return c;
}
const examples=Object.entries(require('../nyakua-end-pit/results/checks.json').examples)
  .map(([name,x])=>({name,state:{...E.clone(x.before),takasia:null},move:x.move}));
module.exports={e30,mirror,examples};
