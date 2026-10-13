'use strict';
// MIT. Quantified certificate composition, independently checked with normal moves.
const assert=require('node:assert/strict'),C=require('../v010-balance/core.cjs'),P=require('../v010-gc/prover.cjs'),V=require('../v010-balance/diagnostics/proof.cjs');
function compose(start,certificates){const moves=C.Q.moveVariants(start);assert.equal(certificates.length,moves.length);
 for(let i=0;i<moves.length;i++){const c=certificates[i];if(!c)continue;V.verify(c);assert.deepEqual(c.start,C.Q.applyMove(start,moves[i]).state);assert.equal(c.depth,c.nodes[c.root].depth);}
 const one=certificates.findIndex(c=>c?.target===start.player);
 if(one>=0)return P.attach(start,[moves[one]],[certificates[one]],start.player);
 if(moves.length&&certificates.every(c=>c?.target===1-start.player))return P.attach(start,moves,certificates,1-start.player);
 return null;
}
module.exports={compose};
