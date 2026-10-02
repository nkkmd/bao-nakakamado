"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=require('./core.cjs');
const dir=process.argv[2]||path.join(__dirname,'results');
const summaries=[];let replays=0,totalGames=0;
for(const task of fs.readdirSync(dir).filter(n=>fs.statSync(path.join(dir,n)).isDirectory()).sort()){
 const root=path.join(dir,task),summary=JSON.parse(fs.readFileSync(path.join(root,'summary.json')));assert.equal(summary.completed,true);summaries.push(summary);
 if(task!=='proof')for(const model of ['current','three']){
  const rows=fs.readdirSync(root).filter(n=>new RegExp('^'+model+'-\\d+\\.json$').test(n)).flatMap(n=>JSON.parse(fs.readFileSync(path.join(root,n))).rows),games=rows.flatMap(r=>r.games);totalGames+=games.length;
  assert.deepEqual(c.summarize(games),Object.fromEntries(Object.entries(summary.results.find(r=>r.model===model)).filter(([k])=>Object.hasOwn(c.summarize(games),k))));
 }
 for(const name of fs.readdirSync(root).filter(n=>n.startsWith('example-'))){
  const g=JSON.parse(fs.readFileSync(path.join(root,name)));let b=c.engines[g.model].initial();b.player=g.first;
  for(const step of g.path){const candidate=c.children(g.model,b).find(x=>JSON.stringify(x.m)===JSON.stringify(step.move));assert.ok(candidate);assert.equal(c.key(candidate.b),c.key(step.after));assert.deepEqual(JSON.parse(JSON.stringify(candidate.entry)),step.entry);c.validate(candidate.b);b=candidate.b;}
  assert.equal(c.key(b),c.key(g.final));replays++;
 }
}
const checks=JSON.parse(fs.readFileSync(path.join(dir,'checks.json'))),verification={totalGames,exampleReplays:replays,completedTasks:summaries.length,checks};
fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(verification,null,2)+'\n');
const rows=summaries.filter(s=>s.metadata.task!=='proof').flatMap(s=>s.results.map(r=>({task:s.metadata.task,...r})));const all={reference:'db84f8b431b80efb6fa072761a0968b293c50c04',verification,rows,proof:summaries.find(s=>s.metadata.task==='proof').results};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(all,null,2)+'\n');
const pct=n=>n.toFixed(1),range=r=>r?.map(pct).join('–')||'—',label={current:'現行：一穴全投入',three:'新案：次手3個'};
let md='# ニャクア・次の自分の手で3個投入する案の調査\n\n更新日：2026年10月2日。調査ID：NYAKUA-THREE-20261002。対象は4列32穴、各人ハンド22個の初期局面です。公開実装v0.7.0を変更せず、隔離した研究用実装で比較しました。\n\n## 条件\n\n'+
 '- ニャクアはNAMUAの一着手で捕獲2回以上のとき1個。相手の通常ハンドが2個以上なら奪い、最後の1個と別確保分は奪いません。\n- 奪った1個は通常ハンドと分け、次の自分の手で必ず使用。通常ハンド2個＋確保分1個を同じ合法開始穴へ一度に投入します。通常ハンドが1個なら合計2個、0個なら確保分1個のみ。確保分なしは通常1個投入です。\n- 一穴全投入は廃止。捕獲義務・捕獲入口・NYUMBAの2個蒔き・所有規則・種まきは現行と同じ。3個投入の手でもニャクアが発動します。\n- 両者の通常ハンドと確保分がすべて0になり、現在の着手のNAMUA処理を終えたら共通MTAJIへ移行。\n- 対照は固定コミット `'+all.reference+'` のv0.7.0。旧1列盤の結果・必勝証明は適用しません。\n\n## パスと実装確認\n\n'+
 '盤上の捕獲可能性を制限せず、ニャクアの発動・不発動のすべての組合せを残数モデルで列挙しました。'+checks.accounting.states+'状態・'+checks.accounting.edges+'遷移でパスが必要な状態は0。実際の合法棋譜はこのモデルの一部なので、上記条件を維持する限り、ハンド枯渇によるパスは不要です。これは連続種まきやMTAJI全局面の停止証明ではありません。\n\n'+
 '実装は'+checks.boundaryCases+'境界確認、別方式の会計処理による'+checks.oracleTransitions+'候補遷移の照合、南北交換'+checks.mirrorPairs+'組、棋譜再構築'+checks.replays+'局を通過。正式結果についても'+replays+'件の代表棋譜を再構築し、合法手・全着手の結果・総KETE64個を照合しました。\n\n## 比較対局\n\n'+
 '手数は片側の一着手を1手と数えます。両者の1往復は2手です。自己対戦は同じ思考方針同士。各条件で独立seedを用い、現行と新案に同じseed集合を適用。初期局面は毎回共通で、ランダムな初期配置を作っていません。\n\n'+
 '| 方針 | 条件 | 局数 | 先手勝率 | 95%区間 | 平均手数 | 中央値 | 95%点 | MTAJIで指した割合 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n';
for(const r of rows.filter(r=>r.policy))md+='| '+r.policy+' | '+label[r.model]+' | '+r.n+' | '+pct(r.firstWinPct)+'% | '+range(r.wilson95Pct)+'% | '+pct(r.avgPlies)+' | '+r.medianPlies+' | '+r.p95Plies+' | '+pct(r.mtajiPlayedPct)+'% |\n';
md+='\nrandomは合法手の一様選択、noisyは1手評価の最良値から7点以内の手を選択、greedyは1手評価、replyは相手の1手応答まで。search3/4はそれぞれ3/4手先までのミニマックス、search6は最大6手先・1着手10,000ノードの反復深化です。search4-mobilityは合法手数と前列の占有穴数を評価に追加します。評価は盤上総数・ハンド・確保分と前列のKETE数を使用。公開AI-GEN4や完全最善手の試験ではありません。\n\n'+
 '| 異なる方針の対戦 | 条件 | 入替組数 | 局数 | 先手勝率 | 組単位95%区間 | 平均手数 |\n|---|---|---:|---:|---:|---:|---:|\n';
for(const r of rows.filter(r=>!r.policy))md+='| '+r.pair.join(' / ')+' | '+label[r.model]+' | '+r.pairs+' | '+r.n+' | '+pct(r.firstWinPct)+'% | '+range(r.pairCluster95Pct)+'% | '+pct(r.avgPlies)+' |\n';
md+='\n方針Aを先手・Bを後手にした対局と、その逆を同一seedで組にしました。乱数列は方針の主体とともに入れ替えます。区間は自己対戦ではWilson、交差対戦では組を単位とした標準誤差から計算。方針ごとに同じseed集合を再利用しているため、全方針の局数を合算して独立標本の区間を計算しません。50%を含むことは均衡の証明ではなく、50%を外れることも完全最善手の先後評価ではありません。\n\n## 進行・異常\n\n'+
 '| 方針 | 条件 | 通常終局 | パス | 終局理由 | 平均NAMUA手数 | 平均MTAJI手数 | 平均ニャクア回数 |\n|---|---|---:|---:|---|---:|---:|---:|\n';
for(const r of rows)md+='| '+(r.policy||r.pair.join('/'))+' | '+label[r.model]+' | '+r.completed+'/'+r.n+' | '+r.passes+' | '+Object.entries(r.reasons).map(([k,v])=>k+':'+v).join(', ')+' | '+pct(r.avgNamuaMoves)+' | '+pct(r.avgMtajiMoves)+' | '+pct(r.avgNyakua)+' |\n';
md+='\n連続種まき512回の安全上限、同じ局面の再出現、400手打切りは通常の勝敗と分け、勝率の分母から除外します。手数統計は全試験局の停止までの長さであり、打切りがある条件では真の終局平均ではありません。総数保存と非負整数条件は全対局の全着手後に検査しました。平均NAMUA手数はNAMUAで終局した対局も含み、MTAJI移行に要する平均とは区別します。\n\n## 初期局面からの必勝探索\n\n'+
 '実際の通常終局だけを勝敗の根拠にしたAND/OR探索です。勝つ側は1つの手を示せば足り、相手の番ではすべての合法手・NYUMBA選択に勝てる必要があります。未終局の探索末端はUNKNOWN。安全上限による終局もUNKNOWNとして扱います。各深さ50万ノード、各条件約550秒を上限としました。\n\n'+
 '| 条件 | 深さ | 判定 | 探索ノード | 時間（秒） |\n|---|---:|---|---:|---:|\n';
for(const p of all.proof)for(const r of p.records)md+='| '+label[p.model]+' | '+r.depth+' | '+r.result+' | '+r.nodes+' | '+(r.elapsedMs/1000).toFixed(1)+' |\n';
md+='\nUNKNOWNは、その深さ以内の必勝が見つからないことだけを意味します。NODE_BUDGET/TIME_BUDGETではその深さの探索が未完了です。したがって、未検出を「必勝ルートなし」と解釈しません。もし必勝判定が得られた場合は、相手の全応答を含む証明書を別に生成し、合法手と終局葉を検証します。各初手の結果は結果JSONに保存しています。\n\n## 再現・記録\n\n'+
 '- [検証・実行方法](../tools/nyakua-three/README.md)\n- [集約結果](../tools/nyakua-three/results/summary.json)、[検証結果](../tools/nyakua-three/results/verification.json)\n- チェックポイント・seed・方針・終局理由・最終局面ハッシュ・代表棋譜は `tools/nyakua-three/results/` 配下。各実行のコードSHA-256とActions実行IDは各taskのsummaryに保存。\n- 正式調査はGitHub Actions。20単位ごとの原子的チェックポイントとartifactを保存し、最後にこの調査ブランチへ記録します。公開実装の採用判断・mainへの統合は今回の調査に含めません。\n';
fs.mkdirSync(path.join(__dirname,'../../doc'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../../doc/NYAKUA_THREE_STUDY_20261002.md'),md);
const hashes={};function walk(p){for(const n of fs.readdirSync(p)){const full=path.join(p,n);if(fs.statSync(full).isDirectory())walk(full);else if(n!=='SHA256.json')hashes[path.relative(dir,full)]=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');}}walk(dir);fs.writeFileSync(path.join(dir,'SHA256.json'),JSON.stringify(hashes,null,2)+'\n');
console.log(JSON.stringify({verification,rows,proof:all.proof}));
