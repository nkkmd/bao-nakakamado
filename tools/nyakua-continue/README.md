# 案Bの隔離調査

2026年10月6日（Asia/Tokyo）の未採用案の試験です。原提案はnkkmd、細則の研究用固定・コード・解析はAI支援。[提案記録](../../doc/NYAKUA_END_PIT_PROPOSALS_20261006.md)にある追加時点の曖昧さを、B-early（2回目の捕獲分を蒔いた直後）とB-end（通常なら着手を終了する終点まで待つ）に分けます。どちらも自分1個＋相手1個を一着手1回だけ追加し、空穴終点を占有穴として再判定します。詳細と結論は[調査報告](../../doc/NYAKUA_CONTINUE_B_STUDY_20261006.md)。公開規則・UI・AIの変更ではありません。

## 再現

Node v24.19.0を使い、リポジトリのルートから実行します。

```bash
node tools/nyakua-continue/check.cjs
node tools/nyakua-continue/run.cjs random
node tools/nyakua-continue/run.cjs noisy
node tools/nyakua-continue/run.cjs greedy
node tools/nyakua-continue/run.cjs reply
node tools/nyakua-continue/run.cjs search3
node tools/nyakua-continue/run.cjs search4
node tools/nyakua-continue/run.cjs search6
node tools/nyakua-continue/run.cjs mobility
node tools/nyakua-continue/run.cjs cross-0
node tools/nyakua-continue/run.cjs cross-1
node tools/nyakua-continue/run.cjs proof
node tools/nyakua-continue/report.cjs
```

`run.cjs`は20 seed組ごとの原子的チェックポイントで再開できます。各組2局、先後担当と乱数列を交換し、4条件に同じseed群を使います。ソースSHA-256・設定署名が一致しない記録を混ぜません。既存結果を含むディレクトリを再実行すると一致する記録を再利用するため、新規計測には第3引数で別の出力先を指定してください。初期局面の必勝探索は各深さ300,000ノード、各条件480秒、最大16手。予算内のUNKNOWNは必勝不在の証明ではありません。

方針・探索・乱数・評価は[案Aの固定コード](../nyakua-end-pit/README.md)をそのまま使用します。`core.cjs`は実行時にB用エンジンを追加し、統計の非有限値をJSONのnullへ正規化する薄いラッパーです。過去のAソースや原記録を書き換えません。4条件はB-early・B-end・A・currentで、10方針、6,520局ずつ、計26,080局です。

`engine.cjs`は歴史的エンジンの文字列を一致回数でガードしてVM内で変換します。参照照合器は別の着手状態機械ですが、種まき・捕獲・合法手・手番終了の基本関数を共有し、Bao全規則の独立実装ではありません。追加後の再捕獲・リレー、空穴、後列、NYUMBA、残数不足と一着手1回を検査します。

表示用安全上限512を勝ちの証拠に使いません。異常局は初期配置から全棋譜を保存・再生し、該当手を65,536まで延長します。周期を証明するキーは盤・ハンド・捕獲回数の閾値・追加済みフラグ・種まき位置・方向・捕獲モードなどを含みます。MTAJIで4条件が一致する循環と、BのNAMUA追加に関係する異常を区別します。

`.github/workflows/nyakua-continue.yml`は専用の実験ブランチへのソース更新でのみ起動します。検査、比較10条件＋必勝探索、原記録の監査、異常診断の順で実行し、全処理が通った結果を同じ実験ブランチに保存します。文書や結果の追記は再計測を起動しません。保存したSHA-256と実行commitで測定時ソースを特定できます。

説明文は © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../../LICENSE-CC-BY-SA-4.0.txt)。調査コード・設定は[MIT](../../LICENSE)。元エンジンの権利表示は[ENGINE_LICENSE.txt](../../prototype/ENGINE_LICENSE.txt)を保持しています。
