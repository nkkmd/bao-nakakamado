'use strict';
const self={random:3000,noisy:3000,greedy:3000,reply:3000,search3:800,search4:800,search5:400,search6:400,'search4-mobility':800,'search6-mobility':400};
const cross=[['noisy','reply'],['reply','search4'],['search4','search6'],['search4-mobility','search6-mobility']];
const tasks=[...Object.keys(self).map(p=>'self-'+p),...cross.map((_,i)=>'cross-'+i),'open-search4','open-search6','proof'];
function config(task){if(task==='proof')return {kind:'proof',budget:10000000,maxDepth:16};if(task.startsWith('self-')){const p=task.slice(5);if(!self[p])throw Error(task);return {kind:'self',policies:[p,p],n:self[p],offset:500000+Object.keys(self).indexOf(p)*10000};}if(task.startsWith('cross-')){const i=Number(task.slice(6));if(!cross[i])throw Error(task);return {kind:'cross',policies:cross[i],n:250,offset:700000+i*10000};}if(['open-search4','open-search6'].includes(task)){const p=task.slice(5);return {kind:'opening',policies:[p,p],n:1000,offset:800000+(p==='search6'?10000:0)};}throw Error(task);}
module.exports={self,cross,tasks,config};
