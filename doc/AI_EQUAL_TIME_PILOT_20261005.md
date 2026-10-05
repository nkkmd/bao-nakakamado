# 同時間対局の運用試走と正式比較の事前条件

2026年10月5日（日本時間）。Bao Nakakamado v0.8.0、棋譜version 7。考案者nkkmd、初公開日2026年9月30日を維持する。基準mainは `985c3844fcee5f5aa01da4ee78231d1faf52c863`。

[探索接続](AI_MODEL_SEARCH_CONNECTION_20261005.md)を完了した凍結線形seed 2026100401と、元の手作り評価器を同じ探索coreで対局させる基盤を追加した。この工程は運用試走と独立した正式比較条件の固定までを対象とする。正式な棋力比較、スマートフォン実機試験、公開AI採用は後続工程。正式finalを再開封しない。

現在の正式条件は後段の **v2：150ms・random/noisyの256ペア（512局）** である。最初の4policy案v1は独立開幕不足でHOLDとして保存し、仕様の原記録と現行contractを区別する。

## 同じ探索条件で担当を交換する

両評価器を `prototype/model-search-ai.js` に注入し、反復深化・PVS・表・cache・手順序・静止探索を共通化する。元の `search-ai.js`、手作り評価器、モデルbytes、入力・学習条件、最終評価記録は変更しない。凍結モデルSHA-256は `f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d`。

[仕様](../tools/ai-integration/equal-time-spec.json)では深度上限32・静止探索1・表50000件・評価cache2048件を固定した。PVS・両cacheは有効、TT先頭化・静止探索捕獲順序変更・history・aspirationは無効。唯一変更する変数は両者に同じ値を渡す1手あたり時間予算である。手数上限は開幕12手の後に400手。初期化の契約照合とモデル読込みは別途計測し、各 `analyzeMove` の壁時計にはその呼出し内部の準備・評価・遷移を含める。Nodeのmonotonic clockを使う。協調的な締切であり、OSによる厳密な強制停止ではない。

同一の開始局面からモデルをSOUTH、NORTHへ割り当てた2局を1ペアとする。局面の初手担当は元のseed-indexの偶奇を維持し、ペア内の実行順はpair-indexの偶奇で交換する。比較の単位は局数ではなく開幕ペアであり、512局を独立した512標本とは扱わない。探索cacheは手ごとに初期化し、片方だけの候補初期化を対局時間へ加えない。

## 試走と予算選択

試走の4開幕はrandom/700000、noisy/700001、greedy/700002、reply/700003。すべて旧開発除外registryに所属することを検査する。25・75・150msの3予算で各4ペア・8局、合計24局を実行する。候補の勝率は集計せず、完走・停止理由、所要時間、fallback率、到達深度、安全停止数を測る。棋譜の通常終局のwinnerは再生監査のために保持するが、予算選択には参照しない。

試走前に固定した運用条件は、各予算8局、技術的失敗0、1局最大65秒、各評価器の深度未完了fallback率2%以下、時間予算超過のp99が40ms以下、単一の超過が500ms以下。この条件を通る最大の予算を選ぶ。条件を満たす予算がなければHOLDとし、正式条件を作らない。3予算のうち棋力が高かったものを選ぶ手順ではない。タイミングはhost負荷に左右されるため、各artifactにNode・CPU・runner imageとrun/attempt/headを保存する。

[Actions](../.github/workflows/equal-time-pilot.yml)はcontents readだけを使う。初回は12件のprotocolテスト後に3予算を別jobで試走し、完成局ごとにcheckpointをartifactへ保存した。v2では計16テストと固定開幕の再生成監査を追加した。mainへのpushは検証だけを行い、試走はPR／手動実行で行う。鍵・正式ZIPの取得・Gitへの受付作成は行わない。artifactの保存期間は30日であり、観測したZIPのdigestと公開棋譜を別途保存して証拠を維持する。

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

## 最初の正式開幕案v1と継承する判定条件

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

### 最初の試走と原artifact

PR [#23](https://github.com/nkkmd/bao-nakakamado/pull/23) の初期head `d3dc43d711a2466d9c48b0b6f38eeed1e2fd366b` から [run 37284277883](https://github.com/nkkmd/bao-nakakamado/actions/runs/37284277883)（attempt 1）を実行した。checkoutはPRの検査用merge `2ae1007671c36112f30432ac7649c3faffad9393`。Gitの親2つが基準mainと当該headで、tree `7b3bd8eb848d298ea3174b0cbdf5c98ae8868741` がローカル・API treeと一致することを確認した。prototype回帰・旧final準備・モデル探索接続も当該headで成功した。

| 予算 | 通常終局 | モデル／手作りの手数 | モデル／手作りのp99超過ms | 最大1局秒 | 運用判定 |
|---|---:|---:|---:|---:|---|
| 25ms | 8/8 | 103 / 104 | 0.324 / 0.294 | 0.756 | PASS |
| 75ms | 8/8 | 146 / 145 | 0.474 / 0.688 | 4.964 | PASS |
| 150ms | 8/8 | 130 / 128 | 0.604 / 0.778 | 5.860 | PASS |

全24局・756手の再生と64 KETE保存を監査した。技術的失敗、違法手、入力変更、深度未完了fallback、対局中の安全停止は0件。勝率を集計せず、事前の「合格した最大予算」で150msを採用した。初回の試走だけで予算を決め、後続CIの試走値で選び直さない。

原ZIPを取得したbytesのまま [25ms](equal-time-pilot/pilot-25.zip)、[75ms](equal-time-pilot/pilot-75.zip)、[150ms](equal-time-pilot/pilot-150.zip) に保存する。各10ファイルの名前・サイズ・CRC、artifact/run/head、ZIP SHA-256、各局のchecksum・元runと全棋譜を照合した。id・digest・bytesは[v2仕様](../tools/ai-integration/equal-time-formal-v2-spec.json)と[正式contract](equal-time-formal-v2/contract.json)に固定してある。期限後にも同じ公開棋譜を監査できる。試走fingerprintは `3ff632e8cae71f4d7077b3b3e341977299d3e036656c29424e8205c1d1da53d6`。

環境はNode v24.21.0、Linux x64、runner image 20260927.320.1。25/150msのhostはAMD EPYC 7763、75msはAMD EPYC 9V74。各ペア内は同じhostで両担当を交換するが、host間の時間差があるため到達深度や予算間の数値を棋力差と解釈しない。

### v1のHOLDと正式開幕v2

上記の4policy・各32ペアの最初の案v1は、独立開幕の監査でHOLDとなった。旧16384単位のprefixは16160単位が12手を完了し、224単位は短い／停止した。完了prefixのunique groupは3842。旧開発と合計3909 groupを除外した。v1のgreedy・初手SOUTHの候補2048件は、22件が短く、2026件が既知groupで、独立開幕0件だった。要求32件を満たさないため、元の仕様を変更せず [v1-HOLD原記録](equal-time-formal-v2/v1-hold.json) を残した。

正式対局0局・試走の棋力成績未使用の段階で、別識別名のv2へ改訂した。v2はrandom/noisy×初手SOUTH/NORTHの4層に各64ペアを割り当てる。新seed範囲1000000〜1004095、開幕12手、既知group/root除外、256ペア・512局・32shard、探索・時間選択・未決着の効用・主要判定条件を維持した。greedy/replyは対象集団から外したが、過去の4policyすべての開幕を引き続き除外する。比較結果の適用先もrandom/noisy生成の独立開幕集団に限定し、全policyの代表性を主張しない。

固定順の候補から、短い37件、旧group 1219件、既知root 3件、既選groupの重複24件を除外し、重複のない256 group・256正規化rootを確保した。[開始局面manifest](equal-time-formal-v2/openings.json) は全開幕が通常遷移で再生でき、4層各64件・交互のscheduleを検査した。別hostで元の公開試走24局・すべてのcontract fieldを監査し、旧全開幕の除外と新manifestを再生成して完全一致を確認した。

- 正式ID：`NAKAKAMADO-EQUAL-TIME-FORMAL-20261005-v2`。
- contract SHA-256（読込み後の `JSON.stringify`、末尾改行なし）：`b34680435b7f0a27da165d638de0b957afcd0b202e0cd2ce1835e28efd083119`。
- opening manifest SHA-256（同じJSON直列化）：`5edf510a6f75f9029905d4b8bb775fdc30d5a98ae908f3b1739fe223caf83f8f`。
- 正式生成fingerprint：`f3e25220de4c40025e5943d618638a01be98d042c7c90f1aac1cab83fe8f7c0f`。

正式実行環境はcontractにNode・image・登録CPUの2種類を固定した。各ペアは同一hostで測定し、未登録の環境はHOLDとする。実機の性能保証ではない。v2専用4テストは初回試走の原ZIP、全24棋譜、契約全field、256開幕、v1のHOLDと閾値継承を検査する。新規計16テストは通過した。

```sh
node --test tools/ai-integration/equal-time-match.test.cjs tools/ai-integration/equal-time-formal-v2.test.cjs
node tools/ai-integration/verify-equal-time-formal-v2.cjs doc/equal-time-formal-v2
```

v1の `equal-time-match.cjs freeze` は原契約のHOLDを維持する。後続の正式実行は上記v2 contractを使用する。CIでも原ZIP・契約全field・開幕manifestを検査し、正式行読取り0・正式対局0を報告する。正式受付、32shard実行、artifactの再開と集約workerを実装することが次の工程である。

### 最終CIとmain統合

PR #23の最終head `938935a11773dd75ddeac9f1dc5a890b4bff4302`（全run attempt 1）で、[同時間対局CI 37285969819](https://github.com/nkkmd/bao-nakakamado/actions/runs/37285969819) の16テスト・固定開幕監査・3予算試走の全5ジョブ、[既存回帰CI 37285969802](https://github.com/nkkmd/bao-nakakamado/actions/runs/37285969802) の全8ジョブ、[探索接続CI 37285969864](https://github.com/nkkmd/bao-nakakamado/actions/runs/37285969864)、[旧準備CI 37285969817](https://github.com/nkkmd/bao-nakakamado/actions/runs/37285969817) が成功した。

既存prototypeの89テストが成功し、Chromium 151.0.7922.34で64手の盤面・棋譜再生、コンピューターとリセット、安全停止、320/390/432px幅、ライセンス案内が通過し、page errorは0。moto g52j 5G実機の結果ではない。変更文書の相対リンク138件・ライセンス条文コピーの一致、原教師・モデルbytes・最終評価記録に差分がないことも確認した。

固定条件のCI artifactは11334810171、874 bytes、ZIP digest `sha256:b5357012b562a2230f8c6b7bc7baf17f02843e6e51ef59f69825fc7aead6e549`。単一JSONとCRCを検査し、[原報告](AI_EQUAL_TIME_FORMAL_V2_CI_REPORT_20261005.json)を取得したbytesで保存した（SHA-256 `3d88082423235b32948b097dd7312964d395ca88a889e9959cf900ceeba5ae17`）。contract／manifest／fingerprintと全256開幕の再生成、原試走24局のauditがローカルとCIで一致した。

2026年10月5日17:53:02 JSTにPR #23をmainへ統合した。merge `5a69bde97d6ed7e8619c66afbff9968e5932ebb0`。実run・job・artifact・統合後のCIは[CI記録](AI_EQUAL_TIME_PILOT_CI_20261005.json)に保存する。正式比較はまだ0局。次はこの固定contractから正式受付・分割実行・中断の記録・検査済みartifactの再利用・固定集約を行うworkerを整備する。

統合後のmain pushでも [既存回帰37286422794](https://github.com/nkkmd/bao-nakakamado/actions/runs/37286422794)、[探索接続37286422738](https://github.com/nkkmd/bao-nakakamado/actions/runs/37286422738)、[旧準備37286422755](https://github.com/nkkmd/bao-nakakamado/actions/runs/37286422755)、[固定条件監査37286422747](https://github.com/nkkmd/bao-nakakamado/actions/runs/37286422747) がすべて成功した。pushでの教師再試走・artifact復元・対局試走のskipはworkflow条件どおりであり、PR時の全8ジョブ通過と区別して記録する。

証拠追記後の相対リンクは140件で欠落0。後続の文書保存commitは記録とREADMEだけを更新し、モデル・探索・試走仕様・v1-HOLD・v2 contract／manifestのbytesを変更しない。
