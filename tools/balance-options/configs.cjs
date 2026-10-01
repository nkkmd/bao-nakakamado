"use strict";
const standard=[0,0,0,0,6,2,2,0];
const config=(id,hands,pits=standard,threshold=6)=>({id,hands,pits,threshold});
const equal=[9,10,11,12].map(h=>config('equal-'+h,[h,h]));
const asym=[config('asym-11-13',[11,13]),config('asym-13-11',[13,11]),config('asym-9-10',[9,10]),config('asym-10-9',[10,9])];
const nyumba=[
 config('threshold4-12',[12,12],standard,4),
 config('spread433-threshold6-12',[12,12],[0,0,0,0,4,3,3,0],6),
 config('spread433-threshold4-12',[12,12],[0,0,0,0,4,3,3,0],4),
 config('reduced422-threshold4-12',[12,12],[0,0,0,0,4,2,2,0],4),
 config('spread631-threshold6-12',[12,12],[0,0,0,0,6,3,1,0],6),
 config('spread613-threshold6-12',[12,12],[0,0,0,0,6,1,3,0],6)
];
const extra=[config('asym-9-11',[9,11]),config('asym-11-9',[11,9]),
 config('combined-equal10-613',[10,10],[0,0,0,0,6,1,3,0],6),
 config('combined-9-11-613',[9,11],[0,0,0,0,6,1,3,0],6),
 config('combined-11-9-613',[11,9],[0,0,0,0,6,1,3,0],6)];
module.exports={config,standard,equal,asym,nyumba,extra};
