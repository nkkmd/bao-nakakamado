'use strict';
// MIT. Same fixed 007 df-pn, a separate 009 cumulative budget / table experiment.
const Old=require('../v010-pn007/schedule.cjs');
const SCHEDULE=[{depth:16,maxNodes:200000},{depth:20,maxNodes:400000},{depth:24,maxNodes:800000},{depth:32,maxNodes:1600000},{depth:48,maxNodes:3200000},{depth:78,maxNodes:3800000}];
function prove(start,target,options={}){return Old.prove(start,target,{horizons:SCHEDULE,maxNodes:10000000,wallMs:1200000,phaseWallMs:200000,maxTableEntries:1000000,...options});}
module.exports={prove,SCHEDULE};
