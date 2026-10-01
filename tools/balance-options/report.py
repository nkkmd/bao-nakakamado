"""Generate the Japanese report from the completed checkpoint JSON files."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESULTS = Path(__file__).resolve().parent / 'results'
LABELS = {'random':'無作為','noisy':'単純評価＋揺らぎ','greedy':'単純評価','reply':'1手応答','search3':'3手先','search4':'4手先','search6':'6手先','search4-mobility':'4手先・別評価'}
STAGES = [
 ('同数ハンド', ['equal-9','equal-10','equal-11','equal-12']),
 ('先後のハンド差', ['asym-11-13','asym-13-11','asym-9-10','asym-10-9','asym-9-11','asym-11-9']),
 ('NYUMBAと配置', ['threshold4-12','spread433-threshold6-12','spread433-threshold4-12','reduced422-threshold4-12','spread631-threshold6-12','spread613-threshold6-12']),
 ('改善傾向のある項目の組合せ', ['combined-equal10-613','combined-9-11-613','combined-11-9-613'])]
FORMAL = ['equal-12','equal-10','asym-9-11','spread613-threshold6-12','combined-equal10-613']
SHORT = {'equal-12':'現行12／12','equal-10':'同数10／10','asym-9-11':'先9／後11','spread613-threshold6-12':'6・1・3／12個','combined-equal10-613':'6・1・3／10個'}

def load(profile, name):
    return json.loads((RESULTS/profile/name/'summary.json').read_text())

def offset(d):
    rows = [r for r in d['self'] if r['policy']=='reply' or r['policy'].startswith('search')] + d['cross']
    return max(abs(r['firstWinPct']-50) for r in rows)

def pct(n):
    return f'{n:.2f}%'

def table(headers, rows):
    return '\n'.join(['| '+' | '.join(headers)+' |','|'+'|'.join(['---']+['---:']*(len(headers)-1))+'|']+['| '+' | '.join(map(str,r))+' |' for r in rows])

def generate():
    screen = {name:load('screen',name) for _,names in STAGES for name in names}
    formal = {name:load('formal',name) for name in FORMAL}
    assert len(screen)==19 and len(formal)==5
    for d in [*screen.values(),*formal.values()]:
        assert d['completed']
        assert d['proof']['records'][-1]['result']=='BUDGET_STOP', 'Report text must adapt to a conclusive proof result'
        for row in d['self']+d['cross']:
            assert sum(row['reasons'].values()) == row['n']
            assert set(row['reasons']) <= {'front-empty','no-move'}
        assert all(row['mismatches']==0 for row in d['mirrors'])
    total = sum(sum(r['n'] for r in d['self']+d['cross']) for d in [*screen.values(),*formal.values()])
    best = min(FORMAL,key=lambda name:offset(formal[name]))
    mirror_pairs = sum(sum(r['pairs'] for r in d['mirrors']) for d in [*screen.values(),*formal.values()])
    parts = [f'''# Bao Nakakamado：先後バランス改善候補の段階比較

2026年10月1日。基準：試作v0.6.0、`4e38478828319d664575dbbbfbb90e1df17eaf7f`。調査状態：完了。製品ルールへの採用は行わない。

## 結論

**同数9・10・11個、先後のハンド差、NYUMBA4個基準、配置分散を順に調べたが、今回の試験方針を通じて先後の偏りが小さいと判断できる案は得られなかった。初期条件の小さな調整だけでバランスを取れたとは言えない。**

今回の比較指標で追加確認の偏りが最も小さかったのは **{SHORT[best]}**、50%からの最大偏差は **{offset(formal[best]):.2f}ポイント** だった。これは均衡の確認や採用推奨ではなく、試験した方針群の中での相対的な改善候補である。

19条件の探索的比較110,200局と、5条件の別seed確認145,000局、合計 **{total:,}局** を実行した。すべて通常終局し、連続種まき安全上限・反復局面・400手番打切りによる停止はなかった。座席交換は別に{mirror_pairs:,}組、途中の局面・手・勝者の不一致0件。

先後で1個ずらす9／10は、一部の単純方針では先手勝率を下げたが、3手先探索では200局すべて先手勝ちだった。9／11には改善傾向があったが、別seedの追加確認でも偏りが残った。

現行の6・2・2配置でNYUMBAの機能閾値だけ6から4へ変えた条件は、探索的比較の自己対局・先後交代の全集計が現行対照と一致した。初期NYUMBAを4へ減らす4・3・3、4・2・2の条件は、複数の探索方針で0%または100%へ偏った。4個基準化をバランス改善策として採用する根拠は得られていない。

6・1・3への配置分散には改善傾向があった。一方、これとハンド差を組み合わせた3条件では改善が重ならず、いずれも最大偏差50ポイントだった。単独で有望に見える調整でも、組合せの効果は再試験する必要がある。

試作本体の初期ハンド12個、6・2・2配置、NYUMBA6個基準、NYAKUA、一穴全投入、画面と棋譜形式を維持する。

## 方法と比較指標

[事前計画](BALANCE_OPTIONS_PLAN_20261001.md)と[再現コード](../tools/balance-options/README.md)に条件・seed・探索予算を固定した。SOUTHとNORTHの交換時も、非対称ハンドは先手・後手に結びつける。ハンドの先後配分を逆にする試験とは別の確認である。

探索的比較は条件ごとに、無作為・揺らぎ・単純評価・1手応答を各1,000局、3・4・6手先と4手先別評価を各200局。5種類の異方針組合せで各100組の先後交代を追加し、計5,800局／条件。座席交換は8方針各10組。

追加確認は選んだ条件と現行対照について、単純4方針各5,000局、探索4方針各1,000局、異方針5組合せ各500組、計29,000局／条件。座席交換は8方針各100組。自己対局seed索引10,000、先後交代30,000から開始し、候補選びの索引1,000・20,000と分けた。

評価は先行比較と同じ材料評価、捕獲手の加点、合法手数・占有穴数を加えた別評価。終局を優先する固定深さミニマックスとαβ探索。同点手を擬似乱数で選ぶ。新ルールに十分調整した強いAIではない。

表の「最大偏差」は、1手応答・4探索方針・5先後交代組合せの先手勝率について、50%からの偏差の最大値。方針の勝率を合算した値ではない。条件選びの比較指標として使い、人間や最善プレイの偏差とは扱わない。追加確認の5条件は各段階の選択、現行対照、組合せの同点条件から選んだ。組合せは同数ハンドを維持する条件を優先した。

## 探索的比較

以下の自己対局は1手応答1,000局、各探索200局。無作為・揺らぎ・単純評価の値、5種類の先後交代の個別値、ブロック別集計は各条件の結果JSONに保存する。最大偏差には先後交代の値も含む。
''']
    for title,names in STAGES:
        rows=[]
        for name in names:
            d=screen[name];c=d['config'];h=c['hands'];p=c['pits'];desc=f'{h[0]}／{h[1]}、{p[4]}・{p[5]}・{p[6]}、閾値{c["threshold"]}'
            rates={r['policy']:r['firstWinPct'] for r in d['self']}
            rows.append([desc,*[pct(rates[k]) for k in ['reply','search3','search4','search6','search4-mobility']],f'{offset(d):.2f}pt'])
        parts.append('\n### '+title+'\n\n'+table(['先／後、盤上の5〜7番、NYUMBA閾値','1手応答','3手先','4手先','6手先','4手先・別評価','最大偏差'],rows)+'\n')
    parts.append('''
ハンド11／13と13／11は現行12／12と同じ総KETE44個。9／11・11／9は同数10／10と同じ40個。9／10・10／9は39個であり、同数9・10個の条件とは総数が異なる。NYUMBA4・3・3配置は盤上10個を保持する一方、4・2・2配置は盤上8個となり、ハンド12／12で総数40個。

4・3・3配置では、異方針の先後交代が50%に近い組合せが多い一方、自己対局では探索方針により0%または100%へ偏った。異方針の先後交代だけを見て「均衡」と判定しない。

## 別seedでの追加確認

### 自己対局の先手勝率
''')
    rows=[]
    for key,label in LABELS.items():
        row=[label+'（'+('5,000局' if not key.startswith('search') else '1,000局')+'）']
        for name in FORMAL:
            r=next(r for r in formal[name]['self'] if r['policy']==key)
            row.append(f'{pct(r["firstWinPct"])}（{r["firstWins"]:,}勝）')
        rows.append(row)
    parts.append(table(['方針',*[SHORT[n] for n in FORMAL]],rows))
    rows=[]
    for i in range(5):
        r=formal[FORMAL[0]]['cross'][i];rows.append([LABELS[r['a']]+'／'+LABELS[r['b']],*[pct(formal[n]['cross'][i]['firstWinPct']) for n in FORMAL]])
    parts.append('\n\n### 異方針の先後交代\n\n各セル1,000局（500組）。対の2局を独立標本とは扱わない。\n\n'+table(['方針A／方針B',*[SHORT[n] for n in FORMAL]],rows))
    rows=[]
    for name in FORMAL:
        d=formal[name];r=next(r for r in d['self'] if r['policy']=='reply')
        rows.append([SHORT[name],f'{offset(d):.2f}pt',f'{r["avgPlies"]:.2f}',pct(r['bulkPct']),pct(r['mtajiPlayedPct']),pct(r['nyakuaPct'])])
    parts.append('\n\n### 偏りと対局の進行\n\n進行の各数値は1手応答の5,000局に限る。全方針共通の値ではない。MTAJI移行直後に終局した対局は「MTAJIで実際に着手」に含めない。\n\n'+table(['条件','最大偏差','平均手番','全投入あり','MTAJIで実際に着手','NYAKUAあり'],rows))
    parts.append('''

## NYUMBAの閾値だけを下げても集計が変わらなかった点

6・2・2配置／ハンド12個で閾値6と4を比較した探索的結果は、勝率だけでなく手番数、発生率、終局理由、探索ノード数、先後交代のseed別結果も一致した。さらに8方針の代表240局を両エンジンで再生し、途中局面と選んだ手の不一致0件だった。これらの着手終了局面には、NAMUAで所有中のNYUMBAが4個または5個になる例はなかった。

これは観測した経路についての確認で、閾値変更がすべての到達局面で無意味という証明ではない。閾値4では、所有中4個のNYUMBAからの通常takata開始を禁止し、種まきの終点で4個になったNYUMBAで停止することを別の規則チェックで確認した。機能の変更自体は実際に反映されている。

## 必勝探索と限界

探索的比較では最大16手番・各深さ30万ノード、追加確認では最大18手番・各深さ100万ノードを上限とした。今回の全条件は短期必勝を判定する前にノード予算で停止した。各条件で完了した深さと停止深さを結果JSONへ保存する。UNKNOWNや予算打切りは、引き分け・均衡・必勝手順なしの証明ではない。

必勝判定後の別のAND/OR探索・全防御応手検証のコードも用意した。今回の候補では適用対象となる必勝判定はなかった。この検証器は、既知のハンド6個の先手必勝証明で両座席514ノード・519辺を再検証し、3種の改変証明を拒否した。

同じ初期配置と固定方針からの計算結果であり、強い人間同士や最善プレイの勝率には外挿しない。自己対局JSONのWilson95%区間は固定方針と擬似乱数を仮定した参考値に限る。NYAKUA、パス、一穴全投入、共通MTAJI移行のどれが偏りの主因かを分離した試験ではない。

初期条件の調整に改善傾向はあるが、今回の結果をもって仕様を変更しない。次に調べるなら、初期条件だけの微調整を続ける前に、NYAKUAによる枯渇からパス・全投入へ至る手順や、序盤の捕獲経路を対照条件で分ける価値がある。これらの新しいルール変更は本調査では実施していない。

## 実装・実行の確認

- 製品の既存23テストが成功。
- 現行条件の379候補遷移・40通りの手選びが元のコードと一致。
- 19条件、2・3・4手、材料・別評価、開局・中盤・終盤のαβ選択を全幅ミニマックスと342条件で比較し、不一致0件。
- 各実行着手でKETE総数保存、整数・非負、合法手なし終局の整合を確認。
- 座席交換で途中の局面・手・勝者・手番数の対応を確認。
- 閾値4の開始制限・停止、NYUMBAの2個蒔き、非対称ハンドの座席交換を確認。
- 同じ署名の途中結果を再利用して完了できることを確認。

長めの試験はGitHub Actionsで実行し、条件ごとに途中結果をartifactへ保存した。Node.js v24.19.0、GitHubのUbuntu runnerを使用。実行コミット、run、artifactと内容の署名・SHA256を[実行記録](../tools/balance-options/results/provenance.json)に保存する。正式結果はリポジトリにも保存するため、artifactの30日保持期間後も参照できる。

[試験コードと再現方法](../tools/balance-options/README.md)、[探索的比較の索引](../tools/balance-options/results/screen-index.json)、各条件のチェックポイントJSONを参照。今後エンジンを変更して再現する場合は、冒頭の基準コミットのエンジンを使用する。
''')
    report='\n'.join(parts)
    (ROOT/'doc/BALANCE_OPTIONS_STUDY_20261001.md').write_text(report)
    index={'reference':'4e38478828319d664575dbbbfbb90e1df17eaf7f','totalGames':total,'screenConditions':19,'formalConditions':5,'mirrorPairs':mirror_pairs,'bestByMetric':best,'balancedConfirmed':False,'formal':[{'id':n,'maxDeviationPoints':round(offset(formal[n]),2)} for n in FORMAL]}
    (RESULTS/'study-index.json').write_text(json.dumps(index,indent=2)+'\n')
    print(json.dumps(index))

if __name__=='__main__':
    generate()
