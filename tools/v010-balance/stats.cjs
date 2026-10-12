'use strict';
// MIT. Bounded seed-pair uncertainty; unresolved games stay in the denominator.
function summarize(pairs,alpha=.05){if(!pairs.length)throw Error('No pairs');let wins=0,losses=0,unresolved=0;
  const lower=[],upper=[];
  for(const games of pairs){if(games.length!==2)throw Error('Pair must have two seats');let l=0,u=0;
    for(const g of games){if(g.firstWin===null){unresolved++;u++;}else if(g.firstWin===1){wins++;l++;u++;}else if(g.firstWin===0)losses++;else throw Error('Invalid result');}
    lower.push(l/2);upper.push(u/2);
  }
  const n=pairs.length,l=lower.reduce((a,b)=>a+b,0)/n,u=upper.reduce((a,b)=>a+b,0)/n;
  const width=Math.sqrt(Math.log(2/alpha)/(2*n)),ci=[Math.max(0,l-width),Math.min(1,u+width)];
  return {pairs:n,games:n*2,normal:wins+losses,firstWins:wins,secondWins:losses,unresolved,
    normalFirstWinRate:wins+losses?wins/(wins+losses):null,
    unresolvedBounds:[l,u],alpha,hoeffdingRadius:width,conservativeInterval:ci,
    direction:ci[0]>.5?'FIRST':ci[1]<.5?'SECOND':'UNDETERMINED',
    practicalBalanceSupported:ci[0]>=.47&&ci[1]<=.53};
}
module.exports={summarize};
