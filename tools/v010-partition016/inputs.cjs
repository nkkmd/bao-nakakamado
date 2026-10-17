'use strict';
// MIT. New exhaustive split; reuse only independently verified old certificates.
const assert=require('node:assert/strict'),C=require('../v010-balance/core.cjs'),I=require('../v010-table015/inputs.cjs');
function roots(){return I.deeperRoots().map(r=>({...r,splitChildId:r.parentId}));}
function validate(){const leaves=roots();assert.equal(leaves.length,8);for(const p of I.roots()){const moves=C.S.moveVariants({board:p.state,history:[]}),cs=leaves.filter(c=>c.parentId===p.id);assert.deepEqual(cs.map(c=>c.move),moves);for(const c of cs){assert.deepEqual(c.state,C.S.apply({board:p.state,history:[]},c.move).board);assert.deepEqual(c.state,C.Q.applyMove(p.state,c.move).state);}}return leaves;}
module.exports={...I,roots,leafParents:I.roots,validate};
