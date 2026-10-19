"""CC BY-SA 4.0 report generator; code MIT. No search or games."""
from pathlib import Path
import json,collections
R=Path(__file__).resolve().parents[2];D=R/'doc/v010-balance019'
a=json.loads((D/'results-analysis.json').read_text());f=json.loads((D/'loss-frontier.json').read_text());m=json.loads((R/'tools/v010-balance019/manifest.json').read_text())
assert a['status']=='INDEPENDENT-PYTHON-RAW-REAGGREGATION-MATCH' and a['games']==1248 and a['normalGames']==1248 and a['unresolved']==a['depthZero']==0
cells={c['cellId']:c for c in a['cells']}
def short(move):return str(move['index']+1)+('右' if move['direction']=='right' else '左')
def line(s=''):out.append(s)
out=[]
line('# v0.10.0 調査019：早期の別合法手・全応手探索の結果')
line();line('記録日：2026年10月20日（Asia/Tokyo）。[固定計画](V010_BALANCE019_PLAN_20261019.md)／[起動記録](V010_BALANCE019_LAUNCH_20261019.md)／[manifest](../tools/v010-balance019/manifest.json)／[原記録](v010-balance019/completed/)／[独立Python集計](v010-balance019/results-analysis.json)。')
line();line('**実戦上のゲーム全体の破綻は判断保留。初期配置の理論値は未確定（UNKNOWN）。** 6右でも先攻勝利を観測したが、6左・6右と先攻base／mobilityの4固定候補はいずれも、全後攻条件で先攻勝利を1組以上観測する探索上の優先候補基準を満たさなかった。これは指定AIと4 seedの探索結果であり、対抗策不存在・6右の必敗・ゲーム全体の破綻の証明ではない。')
line();line('## 完了と独立監査')
line();line('[正式run 39241595646](https://github.com/nkkmd/bao-nakakamado/actions/runs/39241595646)は初回attemptで全54 job成功。2026年10月20日1時23分51秒（日本時間）に集計・保存jobが完了した。APIのrun更新時刻1時39分45秒とは区別する。624交換組・1,248局、全156セル・全13根を完了し、すべて通常終局。未終局・循環・安全停止・400手上限・深度0は0。')
line();line('正式source `bf6e7724b663c2918866b5c9637f6547efe7e484`、結果commit `5015ee1f968a3ced31a83648524b9ac0132e3369`、digest `'+a['manifestDigest']+'`。起動記録・結果PR・将来の統合commitを計測sourceと混同しない。')
line();line('原ZIP・summary・preservation receiptの3ファイルを固定結果commitと同一Git blobで保存。原1,353ファイルのSHA・source/run/manifest・全局の通常エンジン再生・再生成summaryのbyte一致を確認した。[独立再監査receipt](v010-balance019/independent-reaudit.json)。別実装Pythonも全156セルの勝敗・停止・seed・交換対応・探索量・深度・重複・同時区間を原gzipから再集計して一致。新規対局・証明探索0。')
line();line('全54 jobの実測合計は約20.97 runner時間で、96時間上限内。[job時刻と成功の監査](v010-balance019/formal-run-audit.json)。')
line();line('原ZIP SHA-256：`'+a['archiveSha256']['original-records-001.zip']+'`。試走312局・旧研究を正式標本へ合算していない。公開ルール・初期配置・公開AI・旧固定sourceと原記録は保持する。')
line();line('## 読み方と標本の限界')
line();line('共通prefixは7左→5左。3手目6左／6右を強制した2根では4手目以降をAIが選び、4手目まで強制した11根では5手目以降をAIが選ぶ。前者も初期配置からの自然対局ではない。両群を合算しない。')
line();line('B＝base、M＝mobility。順序は先攻→後攻。B→B／M→Mは同方針の条件付き先後比較、B→M／M→Bは相手方針変更の診断で、純粋な手番効果と呼ばない。各表の数値は先攻勝利局数／8局。8は先攻全勝、0は後攻全勝。座席交換2局は同じseed・同じ正規化棋譜・同じ先後勝者で、独立標本単位は4交換組。')
line();line('固有seedは全条件で共有した4個。156セルや1,248局を独立標本数へ水増ししない。156セル同時95%Hoeffding区間の半幅は約104.52ポイントで、全セルの切詰め区間は0〜100%。4組全勝でも対抗策の有効性を統計確認できない。未知・停止を0.5点にする集計は行っていない。')
for group,title in [('third-only','3手目まで強制：4手目はAIが選ぶ'),('fourth-forced','4手目まで強制：後攻の全11応手を別々に比較')]:
 line();line('## '+title);line();line('| 3手目 | 強制4手目 | 訪問上限（双方） | B→B | B→M | M→B | M→M |');line('|---|---|---:|---:|---:|---:|---:|')
 for opening in [c['opening'] for c in m['cells'][::12] if c['opening']['group']==group]:
  for nodes in [2048,8192,32768]:
   vals=[str(cells[opening['id']+'-'+p+'-'+q+'-'+str(nodes)]['firstWins'])+'/8' for p,q in [('base','base'),('base','mobility'),('mobility','base'),('mobility','mobility')]]
   line('| '+short(opening['moves'][2])+' | '+('AI選択' if group=='third-only' else short(opening['moves'][3]))+' | '+f'{nodes:,}'+' | '+' | '.join(vals)+' |')
line();line('6右を強制して4手目をAIに任せると、同方針では2,048が両方後攻全勝、8,192／32,768は両方先攻全勝だった。しかしM→Bは全3予算で後攻全勝、B→Mも先攻勝利は32,768の1交換組のみ。6右は勝つ継続を含む一方、相手変更への耐性が確認された単一対抗策ではない。')
line();line('6左の3手強制条件は018の対応条件と勝者方向が一致したが、新しい4 seedの探索であり、018の64組条件と同じ証拠の強さにはしない。4手目を全数強制すると勝敗が反転する条件があり、AIが自然に選んだ応手だけでは後攻の防御集合を代表できない。')
line();line('## 固定候補の探索上の優先基準')
line();line('各3手目と先攻方針を固定し、3手強制の比較と、その後攻全応手・両方針・全予算を含む全表を保持する。以下は条件数であり、条件をプールした勝率ではない。6左と6右は後攻合法応手数も異なるため、23／36と16／42などの単純な優劣比較をしない。')
line();line('| 固定3手目 | 先攻方針 | 全条件 | 先攻勝利を観測した条件 | 全条件で1組以上か |');line('|---|---|---:|---:|---|')
for row in a['candidateRobustness']:
 cs=[c for c in a['cells'] if c['openingId'].startswith('third-'+row['third']) and c['profiles'][0].startswith(row['firstPolicy']+'-')]
 line('| '+('6左' if row['third']=='left' else '6右')+' | '+row['firstPolicy']+' | '+str(row['conditions'])+' | '+str(sum(c['firstWins']>0 for c in cs))+' | 不成立 |')
line();line('4候補すべてに0勝の条件が残り、事前の「全条件で通常先攻勝利が1組以上」の探索上の優先候補は残らなかった。これは候補選定の観測基準で、確認試験の成功・失敗や必敗の証明ではない。0勝でも合法な未選択継続が残り得る。都合のよいセルごとに先攻方針を取り替えて耐性成功とは数えない。')
line();line('## 敗局の残る選択肢と多様性')
line();line('[読取り専用の敗局frontier](v010-balance019/loss-frontier.json)では、先攻敗北を観測した93セルについて最初の敗局seedを固定し、最初の先攻自由着手の状態・全合法手・既選択手を保存した。79セルはその時点で複数合法手、14セルは1合法手だった。1合法手の14セルも同じ敗局の後続に複数合法手の局面があり、同じ原棋譜内の最初の複数選択局面を追加保存した。')
line();line('したがって、93セルの観測敗局には先攻が別手を選べる地点がある。ただし、その別手で勝てるか、相手の他応手に耐えるかは未調査。最初の自由着手と最初の複数合法手局面を混同せず、追加対局・証明探索は起動していない。')
line();line('先頭12手prefixは140セルで1種類、14セルで2種類、2セルで4種類。多くの条件で開幕の多様性は限定的だった。座席交換や後半の棋譜差を独立した戦略の多様性としない。')
line();line('## 総合判定・残る工程')
line();line('**実戦全体：判断保留。** 早い別合法手6右にも勝つ条件があり、指定した4固定候補はいずれも相手変更と全応手に対する探索上の優先基準を満たさなかった。これだけで、ゲーム全体の公平・破綻・対抗策不存在のいずれも確定しない。全初手からの自然な選択、別系列の強いAI、人間の技能水準、5手目以降の他の合法継続は未確認。旧全4初手・14応手の被覆表も[017結果](V010_BALANCE017_RESULTS_20261018.md)として保持する。')
line();line('**初期配置の理論値：未確定（UNKNOWN）。** 新規証明探索0。既存の52着手／43着手局所証明・未証明親・有限手数の結果は従来の範囲で保持し、019の対局を無期限の理論証明に昇格しない。')
line();line('019は全設計セルの保存・独立再監査・別実装集計・報告整理を完了。当初はユーザー指定でmain統合前に停止し、その後の2026年10月20日の追加指示で統合・統合後監査が許可された。統合状態は[PR #61](https://github.com/nkkmd/bao-nakakamado/pull/61)を基準とする。次の候補探索・独立確認は未計画・未起動であり、実施するなら別ID・別seed・別manifestとし、019の結果から有利な条件だけを選んで独立確認済みとしない。')
line();line('## 読取り専用の再現')
line();line('```sh');line('python3 tools/v010-balance019/reaudit.py doc/v010-balance019/completed 5015ee1f968a3ced31a83648524b9ac0132e3369 bf6e7724b663c2918866b5c9637f6547efe7e484 39241595646');line('python3 tools/v010-balance019-results/analyse.py');line('node tools/v010-balance019-results/frontier.cjs');line('python3 tools/v010-balance019-results/report.py');line('git diff --exit-code -- doc/v010-balance019/results-analysis.json doc/v010-balance019/loss-frontier.json doc/V010_BALANCE019_RESULTS_20261020.md');line('```')
line();line('本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。')
(R/'doc/V010_BALANCE019_RESULTS_20261020.md').write_text('\n'.join(out)+'\n')
print(json.dumps({'report':'doc/V010_BALANCE019_RESULTS_20261020.md','cells':len(cells),'newGames':0,'newProofSearches':0}))
