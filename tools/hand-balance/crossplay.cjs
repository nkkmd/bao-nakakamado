"use strict";
const fs=require("node:fs");
const {play,seedAt,summarize,REF}=require("./balance.cjs");
const n=Number(process.argv[2]||500);
const hands=(process.argv[3]||"12,8,6").split(",").map(Number);
if(!Number.isSafeInteger(n)||n<1||!hands.length||!hands.every(h=>[12,8,6].includes(h)))throw new Error("Positive pair count and hands 12,8,6 required");
const pairs=[["random","greedy"],["noisy","reply"],["reply","search4"],["search4","search6"],["search6","search4-mobility"]];
const output={reference:REF,mode:"crossplay",pairsPerCondition:n,seedStartIndex:20000,rows:[]};
for(const hand of hands)for(const [a,b] of pairs) {
 const games=[],details=[];
 for(let i=0;i<n;i++) {
   const seed=seedAt(20000+i);
   const x=play(hand,[a,b],seed,0,false,true);
   const y=play(hand,[b,a],seed,0,false,"swap");
   games.push(x,y);details.push({seed,firstWins:Number(x.firstWon)+Number(y.firstWon),aWins:Number(x.firstWon)+Number(!y.firstWon)});
 }
 const row={hand,a,b,...summarize(games),pairFirstWins:{both:details.filter(x=>x.firstWins===2).length,split:details.filter(x=>x.firstWins===1).length,neither:details.filter(x=>x.firstWins===0).length},pairDetails:details};
 delete row.wilson95Pct;
 output.rows.push(row);console.log(JSON.stringify({...row,pairDetails:undefined}));
}
fs.writeFileSync(process.argv[4]||"results/crossplay.json",JSON.stringify(output,null,2)+"\n");
