"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=require('./core.cjs');
const dir=process.argv[2]||path.join(__dirname,'results');
const summaries=[];let replays=0,totalGames=0;
for(const task of fs.readdirSync(dir).filter(n=>n!=='anomalies'&&fs.statSync(path.join(dir,n)).isDirectory()).sort()){
 const root=path.join(dir,task),summary=JSON.parse(fs.readFileSync(path.join(root,'summary.json')));assert.equal(summary.completed,true);summaries.push(summary);
 if(task!=='proof')for(const model of ['current','three']){
  const rows=fs.readdirSync(root).filter(n=>new RegExp('^'+model+'-\\d+\\.json$').test(n)).flatMap(n=>{const block=JSON.parse(fs.readFileSync(path.join(root,n)));assert.equal(block.signature,summary.signature);return block.rows;}),games=rows.flatMap(r=>r.games);totalGames+=games.length;
  const actual=c.summarize(games),stored=summary.results.find(r=>r.model===model);if(!stored.policy)delete actual.wilson95Pct;
  assert.deepEqual(actual,Object.fromEntries(Object.entries(stored).filter(([k])=>Object.hasOwn(actual,k))));
 }
 for(const name of fs.readdirSync(root).filter(n=>n.startsWith('example-'))){
  const g=JSON.parse(fs.readFileSync(path.join(root,name)));let b=c.engines[g.model].initial();b.player=g.first;
  for(const step of g.path){const candidate=c.children(g.model,b).find(x=>JSON.stringify(x.m)===JSON.stringify(step.move));assert.ok(candidate);assert.equal(c.key(candidate.b),c.key(step.after));assert.deepEqual(JSON.parse(JSON.stringify(candidate.entry)),step.entry);c.validate(candidate.b);b=candidate.b;}
  assert.equal(c.key(b),c.key(g.final));replays++;
 }
}
const checks=JSON.parse(fs.readFileSync(path.join(dir,'checks.json'))),anomalies=fs.existsSync(path.join(dir,'anomalies/summary.json'))?JSON.parse(fs.readFileSync(path.join(dir,'anomalies/summary.json'))).anomalies:[],verification={totalGames,exampleReplays:replays,completedTasks:summaries.length,checks,anomalies,reportRunId:process.env.GITHUB_RUN_ID||null};
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
if(anomalies.length){md+='\n### 安全上限に達した対局の追加確認\n\n| 条件・方針 | seed | 手数 | 段階 | 上限を延ばした結果 | 現行・新案の同一局面照合 |\n|---|---:|---:|---|---|---|\n';for(const a of anomalies)md+='| '+label[a.model]+' / '+a.task.replace('self-','')+' | '+a.seed+' | '+a.plies+' | '+a.phase+' | '+(a.period?'周期'+a.period+'の循環を確認':'65,536回まで停止・循環を確定できず')+' | '+(a.mtajiSameInBothEngines?'同じ挙動':'対象外・要確認')+' |\n';md+='\n新案のランダム対局で到達した局面では、同じ盤・種まき終点・方向・所有状態へ戻るため、上限を外すとこの一手は終わりません。途中で相手の手番も来ません。通常の対局反復とは別の、一着手内の循環です。この局面のMTAJI処理は現行・新案で一致するため、新案の3個投入処理に限った不具合ではありません。しかし新案からも実際に到達でき、破綻なしとは言えません。他の合法手では安全上限に達しない選択肢がありました。再現棋譜・開始局面・周期を示すチェックポイント・代替手は [異常対局の記録](../tools/nyakua-three/results/anomalies/summary.json) と同じフォルダへ保存しています。\n';}
md+='\n連続種まき512回の安全上限、同じ局面の再出現、400手打切りは通常の勝敗と分け、勝率の分母から除外します。手数統計は全試験局の停止までの長さであり、打切りがある条件では真の終局平均ではありません。総数保存と非負整数条件は全対局の全着手後に検査しました。平均NAMUA手数はNAMUAで終局した対局も含み、MTAJI移行に要する平均とは区別します。\n\n## 初期局面からの必勝探索\n\n'+
 '実際の通常終局だけを勝敗の根拠にしたAND/OR探索です。勝つ側は1つの手を示せば足り、相手の番ではすべての合法手・NYUMBA選択に勝てる必要があります。未終局の探索末端はUNKNOWN。安全上限による終局もUNKNOWNとして扱います。各深さ50万ノード、各条件約550秒を上限としました。\n\n'+
 '| 条件 | 深さ | 判定 | 探索ノード | 時間（秒） |\n|---|---:|---|---:|---:|\n';
for(const p of all.proof)for(const r of p.records)md+='| '+label[p.model]+' | '+r.depth+' | '+r.result+' | '+r.nodes+' | '+(r.elapsedMs/1000).toFixed(1)+' |\n';
md+='\nUNKNOWNは、その深さ以内の必勝が見つからないことだけを意味します。NODE_BUDGET/TIME_BUDGETではその深さの探索が未完了です。したがって、未検出を「必勝ルートなし」と解釈しません。もし必勝判定が得られた場合は、相手の全応答を含む証明書を別に生成し、合法手と終局葉を検証します。各初手の結果は結果JSONに保存しています。\n\n## 再現・記録\n\n'+
 '- [検証・実行方法](../tools/nyakua-three/README.md)\n- [集約結果](../tools/nyakua-three/results/summary.json)、[検証結果](../tools/nyakua-three/results/verification.json)\n- チェックポイント・seed・方針・終局理由・最終局面ハッシュ・代表棋譜は `tools/nyakua-three/results/` 配下。各実行のコードSHA-256とActions実行IDは各taskのsummaryに保存。\n- 正式調査はGitHub Actions。20単位ごとの原子的チェックポイントとartifactを保存し、最後にこの調査ブランチへ記録します。公開実装の採用判断・mainへの統合は今回の調査に含めません。\n';
if(totalGames===19400){const conclusion='## 調査結果\n\n計19,400局（現行9,700局、新案9,700局）を比較しました。新案は9,699局が通常終局し、パス0件・総KETEの保存違反0件でした。一方、1局に一着手内の種まき循環があり、盤上の進行がすべて正常とは判定できません。現行にも安全上限に達した対局が2局あり、新案の循環局面は現行エンジンでも同じ挙動でした。\n\n平均手数は方針によって変わります。新案はランダムで46.6手（現行51.7手）、3手先探索で35.9手（47.3手）、4手先探索で54.9手（56.2手）。6手先探索では74.9手（52.8手）と長くなりました。ニャクアが発動しなかったreply自己対戦は両条件とも94.5手です。一般に必ず短くなる変更ではありません。\n\n先手勝率は新案の3手先探索75.0%（95%区間70.5–79.0%）、4手先探索40.0%（34.6–45.6%）と方針によって逆転。6手先探索は50.0%ですが100局・区間40.4–59.6%であり、均衡を断定できません。先後均衡は未確認です。異なる方針の先後交換では新案の先手勝率49.5–54.0%で、3組すべての組単位区間が50%を含みました。\n\n初期局面から双方の10手以内の強制勝ちを検出せず、11手先は50万ノード上限で未完了でした。長い必勝ルートの有無は未判定です。\n\n3個投入案はハンド枯渇によるパスを防げますが、採用前には共通MTAJIの循環処理について停止規定を定め、別評価・より深い探索でも先後傾向を確認する必要があります。今回の調査では公開実装のルール変更を行っていません。\n\n';md=md.replace('## 条件\n\n',conclusion+'## 条件\n\n');}
fs.mkdirSync(path.join(__dirname,'../../doc'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../../doc/NYAKUA_THREE_STUDY_20261002.md'),md);
const hashes={};function walk(p){for(const n of fs.readdirSync(p)){const full=path.join(p,n);if(fs.statSync(full).isDirectory())walk(full);else if(n!=='SHA256.json')hashes[path.relative(dir,full)]=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');}}walk(dir);fs.writeFileSync(path.join(dir,'SHA256.json'),JSON.stringify(hashes,null,2)+'\n');
console.log(JSON.stringify({verification,rows,proof:all.proof}));
