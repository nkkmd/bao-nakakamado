'use strict';
// MIT. One ply less than 009 at every child horizon preserves original root bounds.
const Old=require('../v010-pn007/schedule.cjs');
const SCHEDULE=[{depth:15,maxNodes:200000},{depth:19,maxNodes:400000},{depth:23,maxNodes:800000},{depth:31,maxNodes:1600000},{depth:47,maxNodes:3200000},{depth:77,maxNodes:3800000}];
function prove(start,target,options={}){return Old.prove(start,target,{horizons:SCHEDULE,maxNodes:10000000,wallMs:300000,phaseWallMs:50000,maxTableEntries:1000000,...options});}
module.exports={prove,SCHEDULE};
