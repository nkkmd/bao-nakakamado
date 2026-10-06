"use strict";
// MIT. Source-bound checkpoint audit; every stored anomaly is replayed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),c=require('./core.cjs'),runner=require('./run.cjs');
const read=p=>JSON.parse(fs.readFileSync(p)),same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const BASE='1daf4d1bcbc6a115f1788da9fbd501b2dd036fe1',STUDY='NYAKUA-CONTINUE-B-20261006';
function report(root,pilotPairs=null){
  const expected=runner.hashes(),tasks=[],audit={status:'PASS',blocks:0,pairs:0,games:0,replayed:0,anomalies:[],certificates:[]},groups=new Map();
  for(const task of Object.keys(runner.TASKS)){
    const dir=path.join(root,task),s=read(path.join(dir,'summary.json')),n=pilotPairs||runner.TASKS[task].pairs;
    assert.equal(s.completed,true);assert.equal(s.metadata.n,n);same(s.metadata.sourceHashes,expected);same(s.metadata.config,runner.TASKS[task]);assert.equal(s.metadata.reference,BASE);
    assert.equal(s.signature,runner.hash(JSON.stringify({study:STUDY,task,n,config:runner.TASKS[task],sourceHashes:expected})));
    const models={};
    for(const model of c.MODELS){
      const rows=[];
      for(let start=0;start<n;start+=20){const b=read(path.join(dir,model+'-'+String(start).padStart(5,'0')+'.json'));assert.equal(b.signature,s.signature);assert.equal(b.start,start);assert.equal(b.model,model);assert.equal(b.rows.length,Math.min(20,n-start));rows.push(...b.rows);audit.blocks++;}
      rows.forEach((r,i)=>{assert.equal(r.index,i);assert.equal(r.seed,c.seedAt(1000000+Object.keys(runner.TASKS).indexOf(task)*10000+i));assert.equal(r.games.length,2);
        for(let role=0;role<2;role++){const g=r.games[role];assert.equal(g.swapStreams,Boolean(role));same(g.policies,role?runner.TASKS[task].policies.slice().reverse():runner.TASKS[task].policies);assert.equal(g.seed,r.seed);assert.equal(g.model,model);assert.equal(g.passes,0);}});
      const computed=c.summarize(rows);same({model,...computed},s.results.find(x=>x.model===model));models[model]={rows,summary:computed};audit.pairs+=rows.length;audit.games+=2*rows.length;
    }
    const differences=[];
    for(const [left,right] of [['B-early','current'],['B-end','current'],['B-early','A'],['B-end','A'],['B-early','B-end']]){
      const complete=models[left].rows.filter((r,i)=>r.games.every(g=>g.winner!==null)&&models[right].rows[i].games.every(g=>g.winner!==null));
      const vs=complete.map(r=>r.games.filter(g=>g.winner===0).length/2-models[right].rows[r.index].games.filter(g=>g.winner===0).length/2),mean=vs.reduce((a,x)=>a+x,0)/vs.length;
      const se=vs.length>1?Math.sqrt(vs.reduce((a,x)=>a+(x-mean)**2,0)/(vs.length-1)/vs.length):null;
      differences.push({left,right,completePairs:complete.length,percentagePoints:100*mean,cluster95:se===null?null:[100*(mean-1.959964*se),100*(mean+1.959964*se)]});
    }
    tasks.push({task,config:s.metadata.config,sourceCommit:s.metadata.commit,runId:s.metadata.runId,models:Object.fromEntries(Object.entries(models).map(([m,x])=>[m,x.summary])),differences});
    for(const file of fs.readdirSync(dir).filter(x=>x.startsWith('example-')||x.startsWith('anomaly-'))){
      const g=read(path.join(dir,file));let b=c.R.engine(g.model).initialState();
      for(const x of g.history){const r=c.R.advance(g.model,b,x.move);same(r.b,x.after);same(r.entry,x.entry);b=r.b;c.validate(b);}same(b,g.final);audit.replayed++;
      if(g.winner!==null)continue;
      const before=g.history.at(-2)?.after||c.R.engine(g.model).initialState(),move=g.history.at(-1).move;
      const key=g.model+'|'+c.key(before)+'|'+JSON.stringify(move);
      if(!groups.has(key)){
        let diagnostic=null,commonMtaji=null;
        if(g.reason==='relay-limit'){
          if(g.model.startsWith('B-')){const d=c.B.extended(g.model,before,move);diagnostic={reason:d.state.reason,cycle:d.events.find(e=>e.kind==='cycle')||null,bonusUsed:d.events.some(e=>e.kind==='end-pit-add'),captureCount:d.events.filter(e=>e.kind==='capture').length};}
          else {assert.equal(before.phase,'mtaji');diagnostic=require('../nyakua-end-pit/diagnostics/followup.cjs').extended(before,move);}
          if(before.phase==='mtaji'){
            const results=c.MODELS.map(m=>c.R.advance(m,before,move).b);results.slice(1).forEach(x=>same(x,results[0]));commonMtaji=true;
          }
        }
        groups.set(key,{model:g.model,before,move,observed:0,diagnostic,commonMtaji,nonLimitAlternatives:c.children(g.model,before).filter(x=>x.b.reason!=='relay-limit').length});
      }
      groups.get(key).observed++;
      audit.anomalies.push({task,file,model:g.model,seed:g.seed,swapStreams:g.swapStreams,reason:g.reason,phase:before.phase,ply:g.plies,groupKey:key});
    }
  }
  const proof=read(path.join(root,'proof/summary.json')),receipt=read(path.join(root,'proof/receipt.json'));
  assert.equal(proof.completed,true);same(receipt.sourceHashes,expected);assert.equal(receipt.budget,pilotPairs?1000:300000);assert.equal(proof.budgetPerDepth,receipt.budget);assert.equal(receipt.summaryHash,runner.hash(fs.readFileSync(path.join(root,'proof/summary.json'))));
  same(proof.initial.map(x=>x.model),c.MODELS);
  for(const file of fs.readdirSync(path.join(root,'proof')).filter(x=>x.endsWith('-certificate.json'))){audit.certificates.push({file,...require('./proof.cjs').verify(read(path.join(root,'proof',file)))});}
  for(const t of proof.tactical){let b=c.R.engine(t.model).initialState();for(const m of t.history)b=c.R.advance(t.model,b,m).b;same(b,t.root);}
  const checks=read(path.join(root,'checks.json'));assert.equal(checks.status,'PASS');same(checks.results.map(x=>x.model),['B-early','B-end']);
  const intervals=tasks.flatMap(t=>c.MODELS.map(model=>{const s=t.models[model],h=100*Math.sqrt(Math.log(40)/(2*s.pairs));return {task:t.task,model,hoeffding95AllGameBoundsPct:[Math.max(0,s.firstWinsAllGameBoundsPct[0]-h),Math.min(100,s.firstWinsAllGameBoundsPct[1]+h)],assumption:'Independent seed-level observations; exploratory unadjusted interval'};}));
  const result=JSON.parse(JSON.stringify({study:STUDY,reference:BASE,pilot:Boolean(pilotPairs),sourceHashes:expected,tasks,proof,checks:checks.results.map(x=>({...x,examples:undefined,handGraph:{...x.handGraph,edgesDetail:undefined}})),audit,anomalyGroups:[...groups.values()],intervals}));
  runner.atomic(path.join(root,'summary.json'),result);
  if(!pilotPairs){
    const pct=x=>Number.isFinite(x)?x.toFixed(2):'未判定',label={'B-early':'案B：早期追加','B-end':'案B：終了時追加',A:'案A',current:'現行v0.8.0'};
    let md='# 案B：ニャクア終点追加後も進行する案の調査\n\n調査日：2026年10月6日（Asia/Tokyo）。未採用の調査条件です。現行公開規則・UI・公開AIは変更していません。\n\n';
    md+='## 固定した2解釈\n\n元の案Bでは追加タイミングが未確定のため、次の両解釈を別に測定しました。\n\n- **B-early（早期追加）**：捕獲が2回以上になった後、最初の種まき単位の終点で、通常の捕獲・停止判定より前に2個追加する。\n- **B-end（終了時追加）**：通常処理が空穴終点またはNYUMBA停止で終わろうとするとき、2個追加してその穴を再判定する。\n\n共通条件はNAMUAのみ、通常の最初の投入1個を保持、自分の追加用ハンド1個以上・相手2個以上で両者から1個ずつ同時に移す、一着手1回、相手の最後の1個を保護、後列・NYUMBAも対象、次手への確保なしです。空穴終点は既存の1個に2個を足した3個の占有穴として扱い、追加前の「空だった」印を消して捕獲またはリレーを再判定します。単に個数だけ増やす処理とは異なる仕様です。NYUMBAの停止／使用選択を保持し、B-earlyでは追加によって6個の停止条件に達する場合もあります。NYUMBA停止を選択済みのB-endでは再判定後も停止します。\n\n前列全空の捕獲直後終局は新しい種まき終点がないため優先し、追加しません。B-earlyの追加後に終局・循環へ至っても追加を取り消しません。MTAJIへの移行は着手全体の終了時で、途中で両ハンドが0になっても当該手はNAMUAのまま進行します。4列32穴、初期6・2・2／ハンド22、総KETE64、MTAJIは共通です。\n\n';
    md+='## 先後比較\n\n各seedで2局を組み、方針の先後担当と乱数列を交換しました。案Aと同じ10方針・seed群・探索予算で、両B解釈・案A・現行の計'+audit.games+'局を再計測しました。安全上限・局面反復・400手打切りは通常勝敗から分離します。区間は両局が通常終局したseed組の95%区間で、独立な対局とは扱いません。全局の未知結果を勝ち／負けに割り当てた範囲と、標本分散が0でも幅があるHoeffding参考区間もJSONに記録しています。seed組の独立性を仮定した探索的な目安で、複数比較を補正していません。\n\n';
    md+='| 方針 | 条件 | 通常終局／全局 | 先手勝率 | seed単位95%区間 | 平均手数 |\n|---|---|---:|---:|---|---:|\n';
    for(const t of tasks)for(const m of c.MODELS){const s=t.models[m];md+='| '+t.task+' | '+label[m]+' | '+s.normal+'/'+s.n+' | '+pct(s.firstWinPct)+'% | '+(s.pairCluster95Pct?.map(pct).join('–')||'未判定')+'% | '+pct(s.avgPlies)+' |\n';}
    md+='\nrandomは合法結果候補の一様選択、noisyは1手評価の最良値から7点以内、greedyは1手評価、replyは相手の1手応答まで。search3/4/6は反復深化の最大深さ3/4/6、1手あたり12,000ノード（search6は4,000）。mobilityは最大深さ4で合法手数と前列の占有穴数を評価に追加。cross-0はnoisy/reply、cross-1はreply/search4を先後交換します。手作り評価と予算付き探索であり、人間や最善手の真の勝率とは区別します。完成深さ・予算停止・対照との差をJSONに記録し、方針を横断して単一勝率に合算しません。\n\n';
    md+='## 必勝ルート\n\n相手の全合法手とNYUMBAの停止／使用を含むAND/OR探索。深さ末端と安全上限はUNKNOWNで、正常終局だけが勝ちの証拠です。各深さ300,000ノード、各条件480秒、最大16手。\n\n| 条件 | 完了した最大深さ | 最後の記録 |\n|---|---:|---|\n';
    for(const x of proof.initial){const done=x.records.filter(r=>!['NODE_BUDGET','TIME_BUDGET'].includes(r.result));md+='| '+label[x.model]+' | '+(done.at(-1)?.depth||0)+' | 深さ'+x.records.at(-1).depth+'：'+x.records.at(-1).result+' |\n';}
    md+='\nUNKNOWNは必勝がないことの証明ではありません。B各解釈につき到達局面12候補を最大8手・各深さ20,000ノードで探索し、証明木が得られた場合は相手の全応答を含め別の状態機械でも検証しました。途中局面の勝ちは初期局面からの必勝とは別です。\n\n';
    md+='## 状態と進行の検査\n\n別に書いた参照状態機械で追加時点・再判定・手番終了を照合しました。基礎の合法手・種まき・捕獲の関数は歴史的エンジンと共通で、Bao全体の独立実装ではありません。\n\n| 検査 | B-early | B-end |\n|---|---:|---:|\n';
    for(const [k,l] of [['transitions','参照遷移一致'],['symmetry','南北対称'],['snapshotChecks','表示／探索一致'],['mtajiEquality','共通MTAJI一致'],['searchChecks','浅い全探索との選択一致']])md+='| '+l+' | '+checks.results[0][k]+' | '+checks.results[1][k]+' |\n';
    md+='\n各解釈100局の到達局面と1,200人工局面で、全候補の非負整数・総数64を検査しました。追加後の再捕獲・リレー・終局、後列・NYUMBAへの追加、自分の最後の1個・相手の最後の1個・最小の2対2も確認しています。一着手1回のためハンド残数グラフは案Aと同じ45状態85遷移で、枯渇パスは0。正常NAMUA着手は合計1個以上を盤へ移すため44手以内に両ハンドが尽きます。一着手そのものが停止する証明とは別です。\n\n';
    md+='| 方針 | B-earlyの停止理由 | B-endの停止理由 |\n|---|---|---|\n';for(const t of tasks)md+='| '+t.task+' | '+JSON.stringify(t.models['B-early'].reasons)+' | '+JSON.stringify(t.models['B-end'].reasons)+' |\n';
    md+='\n全異常棋譜を初期配置から再生し、異常手は65,536回を上限に延長して同一状態への再到達を検査しました。循環キーは盤・両ハンド・NYUMBA所有・手番・段階・種まき位置・方向・捕獲モードと「当該手で追加済み」を含みます。既存MTAJI循環は4条件の同じ局面・同じ手の遷移一致を確認し、NAMUAの新循環と区別します。安全上限への到達だけを循環や負けの証明にはしません。\n\n';
    md+='| 条件 | 段階 | 観測件数 | 延長結果 | 周期 | 追加済み | 上限に達しない代替手 |\n|---|---|---:|---|---:|---|---:|\n';for(const g of result.anomalyGroups)md+='| '+label[g.model]+' | '+g.before.phase+' | '+g.observed+' | '+(g.diagnostic?.reason||'未調査')+' | '+(g.diagnostic?.cycle?.period||'—')+' | '+(g.diagnostic?.bonusUsed===undefined?'—':g.diagnostic.bonusUsed)+' | '+g.nonLimitAlternatives+' |\n';
    md+='\n## 原記録と再現\n\n基礎の固定点は `'+BASE+'`、計測ソースcommitとActions実行IDは各taskのmetadataに保存しています。[全集計と監査](../tools/nyakua-continue/results/summary.json)、[境界検査](../tools/nyakua-continue/results/checks.json)、[実行手順](../tools/nyakua-continue/README.md)、[元の2案](NYAKUA_END_PIT_PROPOSALS_20261006.md)、[案Aの調査](NYAKUA_END_PIT_A_STUDY_20261006.md)を参照してください。元規則の考案者nkkmd・初公開2026年9月30日の記録は[履歴](ORIGIN_AND_HISTORY.md)に保持します。調査コード・仕様固定・解析はAI支援。説明文は© 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。コードはMIT。\n';
    fs.writeFileSync(path.join(__dirname,'../../doc/NYAKUA_CONTINUE_B_STUDY_20261006.md'),md);
  }
  console.log(JSON.stringify({status:'PASS',games:audit.games,replayed:audit.replayed,anomalies:audit.anomalies.length,groups:result.anomalyGroups.map(g=>({model:g.model,phase:g.before.phase,observed:g.observed,diagnostic:g.diagnostic,alternatives:g.nonLimitAlternatives}))}));return result;
}
if(require.main===module)report(process.argv[2]||path.join(__dirname,'results'),Number(process.argv[3])||null);
module.exports={report};
