"use strict";
// MIT. Both swapped games execute in one thread on one host; no search in the supervisor.
const {parentPort,workerData}=require('node:worker_threads');
const M=require('./equal-time-match.cjs');
try {
 const {opening,pairIndex,budgetMs,maximumPlies}=workerData;
 const {players,setupMs}=M.createPlayers();
 const games=[];
 for(const modelSide of (pairIndex%2?[1,0]:[0,1])){
  const game=M.playGame(opening,pairIndex,modelSide,budgetMs,{players,maximumPlies});
  M.auditGame(game,{opening,pairIndex,modelSide,budgetMs,maximumPlies});
  games.push(game);parentPort.postMessage({type:'game',game});
 }
 parentPort.postMessage({type:'pair',games,setupMs,environment:M.environment()});
} catch {parentPort.postMessage({type:'failure'});process.exitCode=1;}
