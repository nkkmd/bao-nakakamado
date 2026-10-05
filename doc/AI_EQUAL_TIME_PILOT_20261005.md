# 同時間対局の運用試走と正式比較の事前条件

2026年10月5日（日本時間）。Bao Nakakamado v0.8.0、棋譜version 7。考案者nkkmd、初公開日2026年9月30日を維持する。基準mainは `985c3844fcee5f5aa01da4ee78231d1faf52c863`。

[探索接続](AI_MODEL_SEARCH_CONNECTION_20261005.md)を完了した凍結線形seed 2026100401と、元の手作り評価器を同じ探索coreで対局させる基盤を追加した。この工程は運用試走と独立した正式比較条件の固定までを対象とする。正式な棋力比較、スマートフォン実機試験、公開AI採用は後続工程。正式finalを再開封しない。

## 同じ探索条件で担当を交換する

両評価器を `prototype/model-search-ai.js` に注入し、反復深化・PVS・表・cache・手順序・静止探索を共通化する。元の `search-ai.js`、手作り評価器、モデルbytes、入力・学習条件、最終評価記録は変更しない。凍結モデルSHA-256は `f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d`。

[仕様](../tools/ai-integration/equal-time-spec.json)では深度上限32・静止探索1・表50000件・評価cache2048件を固定した。PVS・両cacheは有効、TT先頭化・静止探索捕獲順序変更・history・aspirationは無効。唯一変更する変数は両者に同じ値を渡す1手あたり時間予算である。手数上限は開幕12手の後に400手。初期化の契約照合とモデル読込みは別途計測し、各 `analyzeMove` の壁時計にはその呼出し内部の準備・評価・遷移を含める。Nodeのmonotonic clockを使う。協調的な締切であり、OSによる厳密な強制停止ではない。

同一の開始局面からモデルをSOUTH、NORTHへ割り当てた2局を1ペアとする。局面の初手担当は元のseed-indexの偶奇を維持し、ペア内の実行順はpair-indexの偶奇で交換する。比較の単位は局数ではなく開幕ペアであり、512局を独立した512標本とは扱わない。探索cacheは手ごとに初期化し、片方だけの候補初期化を対局時間へ加えない。

## 試走と予算選択

試走の4開幕はrandom/700000、noisy/700001、greedy/700002、reply/700003。すべて旧開発除外registryに所属することを検査する。25・75・150msの3予算で各4ペア・8局、合計24局を実行する。候補の勝率は集計せず、完走・停止理由、所要時間、fallback率、到達深度、安全停止数を測る。棋譜の通常終局のwinnerは再生監査のために保持するが、予算選択には参照しない。

試走前に固定した運用条件は、各予算8局、技術的失敗0、1局最大65秒、各評価器の深度未完了fallback率2%以下、時間予算超過のp99が40ms以下、単一の超過が500ms以下。この条件を通る最大の予算を選ぶ。条件を満たす予算がなければHOLDとし、正式条件を作らない。3予算のうち棋力が高かったものを選ぶ手順ではない。タイミングはhost負荷に左右されるため、各artifactにNode・CPU・runner imageとrun/attempt/headを保存する。

[Actions](../.github/workflows/equal-time-pilot.yml)はcontents readだけを使い、12件のprotocolテスト後に3予算を別jobで試走し、完成局ごとにcheckpointをartifactへ保存する。鍵・正式ZIPの取得・Gitへの受付作成は行わない。artifactの保存期間は30日であり、観測したZIPのdigestと公開棋譜を別途保存して証拠を維持する。

## 記録・監査・再開

[対局器](../tools/ai-integration/equal-time-match.cjs)は、各手の担当、合法手、前後の状態hash、通常棋譜のハンド投入・確保分・捕獲・ニャクア、探索識別、深度・score・時間、最終状態と停止理由を記録する。通常遷移 `steal.js` と探索遷移の一致、64 KETEの保存、入力不変、整数値、評価器IDを各手で検査する。checkpointはbindingとchecksumを持ち、完成後にatomic renameで保存する。

通常終局、反復、400手上限、relay-limitによる安全停止、技術的失敗を区別する。安全停止はwinnerが入っていても通常勝敗と扱わない。反復のキーは手数turnを除き、pending・通常ハンド・確保分・nyumba・担当・phaseを含める。違法手・入力変更・探索例外などは元の失敗を保存し、負けや通常時間切れへ変換しない。

同じディレクトリの試走を再実行すると、ソース・条件・実行環境・元run・checksumを照合し、通常遷移で全棋譜を再現してから完成局を再利用する。部分完了では完成局を再計測しない。試走の未完成局は試走として作り直せるが、正式比較では中断をHOLDとする条件を固定する。正式の受付・artifact取得検査・shard再開workerは次の工程で実装するため、本工程だけで正式対局の重複起動防止が完成したとは扱わない。

別hostでの監査はsearchを呼ばず、保存された実行環境のbindingを維持したまま棋譜と集計を照合する。summaryだけを書き換えて条件を固定することはできない。今回の12テストはgeneratorの元処理との一致、担当交換、通常終局・安全停止・反復、改ざん検出、失敗保持、部分再開、集計のペア単位、予算選択で勝敗を使わないことを検査する。

```sh
node --test tools/ai-integration/equal-time-match.test.cjs
node tools/ai-integration/equal-time-match.cjs pilot 25 /absolute/pilot-25
node tools/ai-integration/equal-time-match.cjs pilot 75 /absolute/pilot-75
node tools/ai-integration/equal-time-match.cjs pilot 150 /absolute/pilot-150
node tools/ai-integration/equal-time-match.cjs freeze /absolute/pilot-25 /absolute/pilot-75 /absolute/pilot-150 /absolute/new-formal-contract
```

## 独立した正式比較の条件

[開幕生成](../tools/ai-integration/equal-time-openings.cjs)は旧generatorと同じ12手のprefixだけを生成する。元の900000〜904095・4policyの全16384単位を生成してopening-groupを再構成し、旧開発registryの開幕と合わせて除外する。暗号文・教師ラベル・正式splitの行を読む作業ではない。新しい候補範囲は1000000〜1004095。policy別・初手担当別に固定saltによるhash順で採用し、各層32ペア、8層で256ペア・512局を固定する。開始rootの既知position/inputも除外し、選んだ開幕groupと正規化rootの重複を排除する。不足時はHOLDとし、seedを追加しない。

この独立性は開始prefixとrootに対する監査であり、将来の探索・対局の全状態が旧データと重ならないことを保証するものではない。32shardへpair-index modulo 32で割り当て、局数と実行順を固定する。開幕manifestとcontractのhash、ソースfingerprint、モデルSHA、運用試走の元runとrecords digestを保存してから正式対局へ進む。予算以外の以下の判定条件は試走前の仕様で固定した。

- 全256ペアの固定scheduleを完了し、技術的失敗0、通常終局95%以上。
- 通常勝ちを1、通常負けを0とする。未決着は効用区間[0,1]とし、主要判定には下端0を使う。引き分けや通常負けとして件数に混ぜない。
- ペア内2局の下端効用を平均し、全ペアの平均が0.55以上。
- 独立した開幕ペア抽出を仮定した片側Hoeffding下限 `max(0, mean - sqrt(log(1/0.05)/(2*256)))` が0.5を超える。
- 途中の勝率で打ち切らず、対局の結果による時間再選択・モデル再学習・失敗局の棋力目的再試行・旧finalの再開封をしない。条件を満たさなければHOLD。

Hoeffding式は[Hoeffding (1963), DOI](https://doi.org/10.1080/01621459.1963.10500830)の有界独立変数に関する条件を使用する。[Hertz (2020), §I・III](https://arxiv.org/pdf/2012.03535)に示された元のlemmaと独立性による積の式から、値域幅1のペア平均へ適用した。コードや文章の転載はしていない。256ペアの余裕は約0.07649で、下限条件は平均が約0.57649を超えることを求める。決定的な疑似乱数scheduleそのものに無条件の独立性・信頼度保証があるとは主張せず、この生成集団に対する条件付きの保守的判定として表示する。初期化、OS負荷、エンジンの未実装範囲、実時計の手の揺れが一般化を制限する。合格しても公開AI採用とは別判定である。

## 実測・条件固定・main統合の記録

この節へ、取得した試走artifactの監査、選んだ予算、独立開幕の除外数、固定contract、CIと統合の実記録を追記する。実装時点では正式対局0局である。
