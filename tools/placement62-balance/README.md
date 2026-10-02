# 初期配置6・2と当時の6・2・2の先後比較

> v0.6.1の履歴再現用です。以下の「現行」・対照・製品は記録当時の1列盤を指します。現行v0.8.0の4列盤・次手3個投入の確認は[試作README](../../prototype/README.md)を参照してください。

対象：main `482ac28b8be2df11df873441196be53fc505df46` のv0.6.1。候補は各人 `0,0,0,0,6,2,0,0`、ハンド12個。NYUMBAに6個、隣の6番穴に2個を置き、7番穴は空にする。盤上各8個、合計40個。配置以外は、毎回全捕獲、NYAKUAの最後の1個保護、一穴全投入、共通MTAJI移行などの現行規則を維持する。製品エンジン・画面は変更しない。

## v0.8.0から履歴を再現する準備

v0.8.0の `steal.js` をそのまま使うと `reference-sources.json` の署名検査が拒否します。保存済みの試験コード・結果を含むHEADから別の作業ツリーを作り、指定した4ソースだけを対照コミットから復元してから、以下の実行・データ展開・検証を行ってください。

```sh
git worktree add --detach /tmp/bao-placement62-replay HEAD
git -C /tmp/bao-placement62-replay restore --source=482ac28b8be2df11df873441196be53fc505df46 -- prototype/bounce-engine.js prototype/steal.js tools/balance-options/core.cjs tools/balance-options/variant-engine.cjs
cd /tmp/bao-placement62-replay
```

`results/SHA256.json` は研究記録を配置した時点の署名です。READMEの今回の説明更新に合わせて原記録の署名を変更しません。

## 対照と実行条件

対照は[現行6・2・2の29,000局](../../doc/CURRENT_FIRST_PLAYER_BALANCE_20261001.md)。候補にも同じ着手方針・局数・seedを用いる。対照のソース4ファイルはSHA-256で現行と同一と確認し、その記録を再利用する。候補と対照の独立した局数を任意に合算してゲーム固有の勝率にはしない。

- 自己対局：無作為・評価差許容・一手評価・一手応答を各5,000局、3手・4手・6手探索・可動性評価4手探索を各1,000局、計24,000局。seed index 10,000から。
- 異方針の先後交代：既存と同じ5組合せ、各500組・1,000局、計5,000局。seed index 30,000から。同じ個体の乱数列を先後交代で引き継ぐ。
- 座席交換：8方針各100組、追加1,600局。全手後の局面・手・勝敗・手番数を照合し、主勝率には加えない。
- 短期必勝探索：最大18手番、各深さ100万ノード。UNKNOWNと予算停止は均衡の証明として扱わない。必勝判定時は全防御応手を別に検証する。

試験前に候補の到達局面を現行エンジンへ入力して全合法応手と遷移を照合し、探索選択を独立した全幅ミニマックスと比較する。通常終局、KETE40個保存、非負整数、400手番以内、安全上限未到達、反復異常なし、パス0を要求する。失敗した対局を除外して勝率を計算しない。

自己対局には固定方針・seed群の参考Wilson95%区間を付ける。先後交代は組単位の平均得点に対する参考95%区間を用い、2局を独立標本とは扱わない。単純方針だけで均衡と結論づけず、評価・探索深さで傾向が変わる可能性を確認する。

## 実行と再開

GitHub Actions **Placement 6-2 first-player balance** を使用する。最大4ジョブ同時、14タスク。各100局または100組を原子的なブロックJSONに保存し、失敗時もartifact取得を試みる。途中結果からの再開は同じ署名のブロックだけを復元して利用する。Actionsの単純な再実行では自動復元しない。

```sh
node tools/placement62-balance/check.cjs
node tools/placement62-balance/run.cjs self-random /tmp/placement62/self-random
node tools/placement62-balance/run.cjs self-search6 /tmp/placement62/self-search6
node tools/placement62-balance/run.cjs proof /tmp/placement62/proof
node tools/placement62-balance/certify.cjs /tmp/placement62/proof
node tools/placement62-balance/verify.cjs /tmp/placement62
```

`run.cjs` の第4引数は準備確認用の局数・組数、proofではノード予算の上書き。準備確認は正式対局数に加えない。`metadata.json` に対象ルール・総KETE・ソースSHA-256・実行commit・run IDを保存する。基準ソースの不一致では実行を停止する。

今回の比較では盤上とハンドを合わせた総数も44個から40個へ変わる。差を「位置だけを変えた効果」とは扱わない。画面の簡易コンピューターの固定一局、人間同士、最善プレイの勝率へは外挿しない。採用判断は試験結果を確認してから別に行う。


## 完了した記録

[報告書](../../doc/PLACEMENT62_BALANCE_20261001.md)、[集計](results/summary.json)、[検証](results/verification.json)、[実行・取得記録](results/provenance.json)を保存した。主試験29,000局と追加座席交換1,600局が通常終局し、方針によって先手・後手への偏りが変わった。初期配置は製品へ採用していない。

対局ごとのmetadata・summary・全ブロックと必勝探索の記録は `records.json.gz` に保存した。以下で展開して再集計・代表54局の再現検証を実行できる。

```sh
python3 tools/placement62-balance/data.py unpack /tmp/placement62-restored tools/placement62-balance/results/records.json.gz
node tools/placement62-balance/verify.cjs /tmp/placement62-restored
```

`build-report.py` は検証済みチェックポイントと現行の対照集計から報告書・候補集計を作成する。保存済みファイルのSHA-256は [results/SHA256.json](results/SHA256.json) に保存する。artifactのSHA-256も取得時に照合済み。
