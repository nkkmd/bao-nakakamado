'use strict';
// MIT. One ply less than 013 at every child horizon preserves original root bounds.
const Old=require('../v010-pn007/schedule.cjs');
const SCHEDULE=[{depth:14,maxNodes:200000},{depth:18,maxNodes:400000},{depth:22,maxNodes:800000},{depth:30,maxNodes:1600000},{depth:46,maxNodes:3200000},{depth:76,maxNodes:3800000}];
function prove(start,target,options={}){return Old.prove(start,target,{horizons:SCHEDULE,maxNodes:10000000,wallMs:300000,phaseWallMs:50000,maxTableEntries:1000000,...options});}
module.exports={prove,SCHEDULE};
