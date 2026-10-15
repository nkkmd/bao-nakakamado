'use strict';
// MIT. New bounded 011 allocation, unchanged audited df-pn implementation.
const Old=require('../v010-pn007/schedule.cjs');
const SCHEDULE=[{depth:16,maxNodes:100000},{depth:24,maxNodes:200000},{depth:40,maxNodes:400000},{depth:56,maxNodes:600000},{depth:78,maxNodes:700000}];
function prove(start,target,options={}){return Old.prove(start,target,{horizons:SCHEDULE,maxNodes:2000000,wallMs:120000,phaseWallMs:24000,maxTableEntries:1000000,...options});}
module.exports={prove,SCHEDULE};
