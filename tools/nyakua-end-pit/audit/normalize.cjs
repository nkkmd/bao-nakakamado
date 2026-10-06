"use strict";
// MIT; see ../../../LICENSE. Preserve frozen comparison sources and raw blocks.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const core=require('../core.cjs');
const original=core.summarize;
// Raw JSON uses null for a not-applicable average (0 search decisions).
// Compare the recomputation in the same JSON representation as the stored data.
core.summarize=rows=>JSON.parse(JSON.stringify(original(rows)));
function audit(root){
  const result=require('../report.cjs').report(root);
  const receipt={status:'PASS',kind:'JSON representation normalization during independent aggregation',
    detail:'NaN from 0/0 average completed depth in non-search policies is represented as JSON null. No game, policy, checkpoint or frozen source is changed.',
    sourceCommit:'6f91b5a1069fe9d54ca65d4a4fd988b0b5ffbf4f',comparisonRunId:37398350927,
    auditCommit:process.env.GITHUB_SHA||null,auditRunId:process.env.GITHUB_RUN_ID||null,
    wrapperSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    games:result.audit.games,replayed:result.audit.replayed};
  fs.writeFileSync(path.join(root,'aggregation-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  return result;
}
if(require.main===module)audit(process.argv[2]||path.join(__dirname,'../results'));
module.exports={audit};
