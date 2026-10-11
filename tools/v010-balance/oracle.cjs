'use strict';
// MIT. Exhaustive normal-rule oracle, adapted from end-pit-search-oracle.cjs.
const {E,S,Q}=require('./core.cjs');
const V=require('../../prototype/end-pit-search-evaluator.js').createEvaluator(Q);
function solve(b,depth,q=1){const player=b.player;
  function terminal(b,p){return b.reason==='relay-limit'?0:b.winner===null?null:b.winner===player?V.WIN-p:-V.WIN+p;}
  const moves=b=>S.moveVariants({board:b,history:[]});
  const next=(b,m)=>S.apply({board:b,history:[]},m).board;
  function quiet(b,p,n){const t=terminal(b,p);if(t!==null)return t;if(!n)return V.evaluate(b,player);
    const cs=moves(b).filter(m=>m.type==='capture');if(!cs.length)return V.evaluate(b,player);
    const a=cs.map(m=>quiet(next(b,m),p+1,n-1));return b.player===player?Math.max(...a):Math.min(...a);}
  function visit(b,d,p){const t=terminal(b,p);if(t!==null)return t;if(!d)return quiet(b,p,q);
    const ms=moves(b);if(!ms.length)return b.player===player?-V.WIN+p:V.WIN-p;
    const a=ms.map(m=>visit(next(b,m),d-1,p+1));return b.player===player?Math.max(...a):Math.min(...a);}
  return moves(b).map(move=>({move,score:visit(next(b,move),depth-1,1)}));
}
module.exports={solve};
