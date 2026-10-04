"use strict";
// Binary/threshold encoding informed by the fixed PBAI-P6 encoder.
// Copyright (c) 2026 cultivationdata.net. MIT; see prototype/ENGINE_LICENSE.txt.
// NYAKUA-specific layout; not compatible with the source's 399-bit model.
const E = require("../../prototype/next-turn-engine.js");
const Q = require("../../prototype/search-transition.js").createForEngine(E);
const ID = "NAKAKAMADO-BINARY-v1", INPUT_SIZE = 368;
function validate(s) {
  if (!s || ![0,1].includes(s.player) || !["namua","mtaji"].includes(s.phase)
    || s.winner !== null || s.reason !== "" || Q.outcome(s) !== "ongoing"
    || !Number.isSafeInteger(s.turn) || s.turn < 0) throw Error("Only ongoing v0.8.0 states are encodable");
  const pair = a => Array.isArray(a) && a.length === 2;
  const count = (n,max=64) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  if (![s.pits,s.reserve,s.nyakuaReserve,s.pending,s.houseOwned].every(pair)) throw Error("State shape");
  for (let p=0;p<2;p++) {
    if (!pair(s.pits[p]) || !s.pits[p].every(r=>Array.isArray(r)&&r.length===8&&r.every(n=>count(n)))) throw Error("Pit range or shape");
    if (!count(s.reserve[p]) || !count(s.nyakuaReserve[p],1) || s.pending[p] !== 0
      || typeof s.houseOwned[p] !== "boolean") throw Error("Hand, pending or house range");
  }
  if ([...s.pits.flat(2),...s.reserve,...s.nyakuaReserve,...s.pending].reduce((a,n)=>a+n,0)!==64) throw Error("Total KETE must be 64");
  if (s.phase === "mtaji" && [...s.reserve,...s.nyakuaReserve].some(Boolean)) throw Error("MTAJI hand must be empty");
}
function placement(s,p) {return s.phase === "mtaji" ? 0 : Math.min(s.reserve[p],s.nyakuaReserve[p]?2:1)+s.nyakuaReserve[p];}
function encode(s,p=s.player) {
  validate(s); if (![0,1].includes(p)) throw Error("Perspective");
  const sides=[p,1-p], x=[];
  const bits=(n,w)=>{for(let j=0;j<w;j++)x.push((n>>>j)&1);};
  for (const side of sides) for (const row of s.pits[side]) for (const n of row) {
    bits(n,7);for(const t of [1,2,4])x.push(Number(n>=t));
  }
  for(const side of sides)bits(s.reserve[side],7);
  for(const side of sides)x.push(s.nyakuaReserve[side]);
  for(const side of sides)bits(s.pending[side],7);
  for(const side of sides)x.push(Number(s.houseOwned[side]));
  x.push(Number(s.player===p),Number(s.phase==="mtaji"));
  for(const side of sides)for(let n=0;n<=3;n++)x.push(Number(placement(s,side)===n));
  for(const side of sides)for(let n=0;n<=2;n++)x.push(Number(s.reserve[side]===n));
  if(x.length!==INPUT_SIZE)throw Error("Input size"); return x;
}
function positionKey(s) {
  validate(s); const sides=[s.player,1-s.player];
  // Normalize side names only. Do not reflect the pit indexes or fixed NYUMBA.
  // Turn is bookkeeping in this engine, retained separately by Q.stateKey.
  return JSON.stringify([E.RULE_ID,E.RULES_VERSION,sides.map(p=>s.pits[p]),
    sides.map(p=>s.reserve[p]),sides.map(p=>s.nyakuaReserve[p]),sides.map(p=>s.pending[p]),
    sides.map(p=>s.houseOwned[p]),s.phase]);
}
module.exports={ID,INPUT_SIZE,validate,encode,positionKey,placement};
