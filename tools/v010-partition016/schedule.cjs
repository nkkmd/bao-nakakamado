'use strict';
// MIT. Same verified solver, new bounded split schedule.
const Base=require('../v010-table015/schedule.cjs');
const SCHEDULE=[{depth:13,maxNodes:50000},{depth:17,maxNodes:100000},{depth:21,maxNodes:200000},{depth:29,maxNodes:400000},{depth:45,maxNodes:800000},{depth:75,maxNodes:950000}];
module.exports={SCHEDULE,prove:(s,t,o)=>Base.prove(s,t,{horizons:SCHEDULE,...o})};
