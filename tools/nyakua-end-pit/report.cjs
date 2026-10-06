"use strict";
// MIT; see ../../LICENSE. Recompute summaries and replay stored evidence.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),c=require('./core.cjs');
const hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
function report(root){
  const runner=require('./run.cjs'),expected=runner.hashes(),tasks=[],audit={status:'PASS',blocks:0,pairs:0,games:0,replayed:0,anomalies:[],certificates:[]};
  for(const task of Object.keys(runner.TASKS)){
    const dir=path.join(root,task),s=read(path.join(dir,'summary.json'));assert.equal(s.completed,true);assert.equal(s.metadata.n,runner.TASKS[task].pairs);assert.deepEqual(s.metadata.sourceHashes,expected);assert.deepEqual(s.metadata.config,runner.TASKS[task]);assert.equal(s.metadata.reference,'a093f527a9284184731bc44bde8ce8b62c39dc37');assert.equal(s.signature,hash(JSON.stringify({study:'NYAKUA-END-PIT-A-20261006',task,n:s.metadata.n,config:runner.TASKS[task],sourceHashes:expected}))); 
    const models={};
    for(const model of ['A','current','none']){
      const rows=[];for(let start=0;start<s.metadata.n;start+=20){const b=read(path.join(dir,model+'-'+String(start).padStart(5,'0')+'.json'));assert.equal(b.signature,s.signature);assert.equal(b.start,start);assert.equal(b.model,model);assert.equal(b.rows.length,Math.min(20,s.metadata.n-start));rows.push(...b.rows);audit.blocks++;}
      rows.forEach((r,i)=>{assert.equal(r.index,i);assert.equal(r.seed,c.seedAt(1000000+Object.keys(runner.TASKS).indexOf(task)*10000+i));assert.equal(r.games.length,2);assert.equal(r.games[0].swapStreams,false);assert.equal(r.games[1].swapStreams,true);assert.deepEqual(r.games[0].policies,runner.TASKS[task].policies);assert.deepEqual(r.games[1].policies,runner.TASKS[task].policies.slice().reverse());assert.equal(r.games[0].seed,r.seed);assert.equal(r.games[1].seed,r.seed);for(const g of r.games){assert.equal(g.model,model);assert.equal(g.passes,0);}});
      const computed=c.summarize(rows);assert.deepEqual({model,...computed},s.results.find(x=>x.model===model));models[model]={rows,summary:computed};audit.pairs+=rows.length;audit.games+=rows.length*2;
    }
    const complete=models.A.rows.filter((r,i)=>r.games.every(g=>g.winner!==null)&&models.current.rows[i].games.every(g=>g.winner!==null));
    const diffs=complete.map(r=>r.games.filter(g=>g.winner===0).length/2-models.current.rows[r.index].games.filter(g=>g.winner===0).length/2),mean=diffs.reduce((a,x)=>a+x,0)/diffs.length,se=diffs.length>1?Math.sqrt(diffs.reduce((a,x)=>a+(x-mean)**2,0)/(diffs.length-1)/diffs.length):null;
    tasks.push({task,config:s.metadata.config,models:Object.fromEntries(Object.entries(models).map(([m,x])=>[m,x.summary])),AminusCurrent:{completePairs:complete.length,percentagePoints:100*mean,cluster95:se===null?null:[100*(mean-1.959964*se),100*(mean+1.959964*se)]}});
    for(const file of fs.readdirSync(dir).filter(x=>x.startsWith('example-')||x.startsWith('anomaly-'))){
      const g=read(path.join(dir,file));let b=c.R.engine(g.model).initialState();for(const x of g.history){const r=c.R.advance(g.model,b,x.move);assert.equal(JSON.stringify(r.b),JSON.stringify(x.after));assert.equal(JSON.stringify(r.entry),JSON.stringify(x.entry));b=r.b;c.validate(b);}assert.equal(JSON.stringify(b),JSON.stringify(g.final));audit.replayed++;
      if(g.winner===null){const previous=g.history.length===1?c.R.engine(g.model).initialState():g.history.at(-2).after,last=g.history.at(-1);let exactLoop=null;
        if(g.reason==='relay-limit'&&g.model!=='current'){
          const d=c.R.advance(g.model,previous,last.move,false,true),seen=new Map();for(const e of d.events.filter(e=>e.kind==='study-loop')){if(seen.has(e.loopKey)){exactLoop={first:seen.get(e.loopKey),again:e.relays,period:e.relays-seen.get(e.loopKey)};break;}seen.set(e.loopKey,e.relays);}
        }
        const alternatives=c.children(g.model,previous).filter(x=>x.b.reason!=='relay-limit').length;
        audit.anomalies.push({task,file,model:g.model,seed:g.seed,swapStreams:g.swapStreams,reason:g.reason,phase:previous.phase,exactLoop,nonLimitAlternatives:alternatives});
      }
    }
  }
  const proof=read(path.join(root,'proof/summary.json'));assert.equal(proof.completed,true);const receipt=read(path.join(root,'proof/receipt.json'));assert.deepEqual(receipt.sourceHashes,expected);assert.equal(receipt.budget,300000);assert.equal(proof.budgetPerDepth,300000);assert.equal(receipt.summaryHash,hash(fs.readFileSync(path.join(root,'proof/summary.json'))));
  for(const file of fs.readdirSync(path.join(root,'proof')).filter(x=>x.endsWith('-certificate.json')||x.startsWith('initial-certificate-'))){audit.certificates.push({file,...require('./proof.cjs').verify(read(path.join(root,'proof',file)))});}
  for(const t of proof.tactical){let b=c.R.engine('A').initialState();for(const m of t.history)b=c.R.advance('A',b,m).b;assert.equal(JSON.stringify(b),JSON.stringify(t.root));}
  const checks=read(path.join(root,'checks.json'));assert.equal(checks.status,'PASS');
  const result={study:'NYAKUA-END-PIT-A-20261006',reference:'a093f527a9284184731bc44bde8ce8b62c39dc37',sourceHashes:expected,tasks,proof,checks:{...checks,examples:undefined,handGraph:{...checks.handGraph,edgesDetail:undefined}},audit};
  fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(result,null,2)+'\n');
  const pct=n=>Number.isFinite(n)?n.toFixed(2):'未判定',ci=x=>x?x.map(pct).join('–'):'未判定';
  let md='# 案A：ニャクア終点2個追加の調査\n\n調査日：2026年10月6日（Asia/Tokyo）。未採用の調査用条件です。現行公開規則v0.8.0・公開AIは変更していません。\n\n';
  md+='## 調査条件\n\nNAMUAの捕獲2回以上で、着手終了時に自分の通常ハンド1個と相手の通常ハンド1個を自分の最終終点へ追加します。自分に追加用1個・相手に2個以上が必要。一着手1回で、後列・NYUMBA終点にも適用します。追加後の再判定は行わず、前列全空・安全上限で終了した手は追加しません。次手への別確保はありません。4列32穴、初期6・2・2／ハンド22、総KETE64、共通MTAJIです。\n\n';
  md+='対照は現行v0.8.0と、同じ基礎エンジンでニャクアを行わない条件です。元ソース固定点は `'+result.reference+'`。規則の提案者はnkkmd、調査仕様・コード・解析はAI支援で作成。新規則の採用判断は行っていません。\n\n';
  md+='## 先後比較\n\n各seedで2局を組み、乱数列と異なる方針の先後担当を交換しました。同じ方針でも2局は同じseed内の依存した標本として扱います。表の区間はseed単位の95%区間です。安全上限・局面反復・400手打切りを通常勝敗から分離し、区間は両局とも通常終局した組に限ります。全局の不確定結果を先手勝ち／負けに割り当てた範囲もJSONに保存しています。複数比較の補正は行っておらず、探索的な目安です。\n\n';
  md+='| 方針 | 条件 | 通常終局／全局 | 先手勝率 | seed単位95%区間 | 平均手数 | パス |\n|---|---|---:|---:|---|---:|---:|\n';
  for(const t of tasks)for(const model of ['A','current','none']){const s=t.models[model];md+='| '+t.task+' | '+({A:'案A',current:'現行v0.8.0',none:'ニャクアなし'}[model])+' | '+s.normal+'/'+s.n+' | '+pct(s.firstWinPct)+'% | '+ci(s.pairCluster95Pct)+'% | '+pct(s.avgPlies)+' | '+s.passes+' |\n';}
  md+='\nrandomは合法な結果候補の一様選択、noisyは1手評価の最良値から7点以内、greedyは1手評価、replyは相手の1手応答まで。search3/4/6は反復深化の最大深さ3/4/6で、1手あたり12,000ノード（search6は4,000ノード）を上限とします。mobilityは最大深さ4で合法手数と前列の占有穴数を追加。cross-0はnoisy/reply、cross-1はreply/search4。各予算停止件数と完成深さをJSONに記録しています。評価は前列数と総保有数の手作り評価で、現行の学習済みモデルや人間の最善手ではありません。異なる方針の結果を単一の真の先手勝率として合算しません。\n\n';
  md+='## 必勝ルートの探索\n\n相手の全合法手とNYUMBAの停止／使用選択を対象としたAND/OR探索です。正常終局だけを勝ちの証拠とし、未終局の深さ末端・安全上限はUNKNOWN。各深さ最大300,000ノード・各条件480秒、最大16手です。\n\n| 条件 | 完了した最大深さ | 最後の記録 |\n|---|---:|---|\n';
  for(const p of proof.initial){const completed=p.records.filter(x=>!['NODE_BUDGET','TIME_BUDGET'].includes(x.result));md+='| '+p.model+' | '+(completed.at(-1)?.depth||0)+' | 深さ'+p.records.at(-1).depth+'：'+p.records.at(-1).result+' |\n';}
  md+='\nUNKNOWNは必勝ルートがないという証明ではありません。途中の到達局面12候補についても最大8手・各深さ20,000ノードで調べ、勝ちを証明できた場合は、相手の全応答を含む証明木を保存・再検証しました。途中局面の必勝は初期局面からの必勝とは別です。\n\n';
  md+='## 状態・進行の検証\n\n調査用遷移 '+checks.transitions+'件が、基礎の種まき後に会計と手番終了を別に計算する照合器と一致しました。種まき本体は共通であり、Bao全規則の独立実装ではありません。南北交換 '+checks.symmetry+'件、表示・探索 '+checks.snapshotChecks+'件、MTAJIでニャクアなしとの一致 '+checks.mtajiEquality+'件、浅い全探索との選択一致 '+checks.searchChecks+'件も確認しました。100局の到達局面と1,200人工局面の候補を検査しています。\n\n';
  md+='ハンド残数だけの全'+checks.handGraph.states+'状態・'+checks.handGraph.edges+'遷移を検査し、ハンド枯渇によるパス0件を確認しました。手番側の残数は相手と同数または1個多く、通常投入で1個減り、追加では両者が1個ずつ減ります。各正常なNAMUA着手は合計1個以上を盤へ移すため44手以内にハンドを使い終えます。途中の勝敗や一着手が停止することの証明とは別です。全試験局の候補遷移で総数64・非負整数を検査しました。\n\n';
  md+='| 方針 | 案Aの停止理由 | 後列への追加 | NYUMBAへの追加 |\n|---|---|---:|---:|\n';for(const t of tasks){const s=t.models.A;md+='| '+t.task+' | '+Object.entries(s.reasons).map(([k,v])=>k+':'+v).join(', ')+' | '+s.backAdds+' | '+s.houseAdds+' |\n';}
  md+='\n安全上限への到達は負けの証明として扱いません。異常対局の棋譜は各taskのanomalyファイルに保存し、集計監査に再生結果・代替手・確認できた循環周期を記録しています。MTAJIの遷移は対照と同じため、既知の種まき循環の構造を引き継ぎます。既存の循環局面を案Aで再計測し、同じ一着手内状態へ戻る周期'+checks.inheritedCycle.exactLoop.period+'の循環と、安全上限に達しない代替手'+checks.inheritedCycle.nonLimitAlternatives+'個を確認しました。この既存局面への案Aの初期配置からの到達は未証明です。今回の標本で異常が0件でも、全局面の破綻なしとは判定できません。\n\n';
  md+='## 原記録と再現\n\n[集計・監査JSON](../tools/nyakua-end-pit/results/summary.json)、[境界と残数検査](../tools/nyakua-end-pit/results/checks.json)、[再現手順](../tools/nyakua-end-pit/README.md)、[元の2案](NYAKUA_END_PIT_PROPOSALS_20261006.md)。元の基礎規則・出典は[ルールブック](RULEBOOK.md)、考案・初公開日は[履歴](ORIGIN_AND_HISTORY.md)を参照してください。全taskの集計完了後に一括判断し、原チェックポイントとソースSHA-256を保持しています。\n\n本書の説明文は © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。調査コードはMITです。既存の公開実装・過去の試験原記録は変更していません。\n';
  const doc=path.join(__dirname,'../../doc/NYAKUA_END_PIT_A_STUDY_20261006.md');fs.writeFileSync(doc,md);console.log(JSON.stringify({status:'PASS',games:audit.games,replayed:audit.replayed,anomalies:audit.anomalies}));return result;
}
if(require.main===module)report(process.argv[2]||path.join(__dirname,'results'));
module.exports={report};
