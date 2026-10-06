"use strict";
// MIT. Reuse the frozen A experiment's policies and budgets for comparability.
const B=require('./engine.cjs'),C=require('../nyakua-end-pit/core.cjs'),R=C.R;
const previousEngine=R.engine,previousAdvance=R.advance;
R.engine=m=>m.startsWith('B-')?B.engine(m):previousEngine(m);
R.advance=(m,...args)=>m.startsWith('B-')?B.advance(m,...args):previousAdvance(m,...args);
const summarize=pairs=>JSON.parse(JSON.stringify(C.summarize(pairs)));
module.exports={...C,summarize,B,MODELS:['B-early','B-end','A','current']};
