# v0.10.0先後差・必勝調査：調査011完了時点の引き継ぎ

整理日：2026年10月15日（Asia/Tokyo）。対象は現行v0.10.0、標準初期配置（前列6・2・2、普通ハンド22個ずつ）。開始main `f4da2a3d5c0c5f28250294da708cba97e570af8f`。正式source `682ad7e0f9dd997348c8766c073c2fe18b9005ca`、結果commit `68ba0b43ec2b6761fbb3d2a75667776a497432cd`。[PR #48](https://github.com/nkkmd/bao-nakakamado/pull/48)とmain Actionsを実際の統合SHA・日時・CIの基準とする。

[README](../README.md)／[索引](RULE_VERSIONS_AND_TESTS.md)／[管理ルール](../AGENTS.md)／[010時点の引き継ぎ](V010_RESEARCH_HANDOFF_20261015.md)

## 最新の確認範囲

**正式10,240局と追加調査001〜011が完了。全応答を覆う最も早い局所証明は、主経路15手目直前から後攻52着手以内の通常勝利。011で13手目3番・右の親を後攻51着手以内と新規証明し、既知8番・左の親53着手以内と合わせ全6先攻分岐の2分岐を確認した。残る4分岐・13手目全体・初期配置の必勝側・強制到達・ルール全体の公平性はUNKNOWN。**

011の全54目標はPROVED 2（後攻1、先攻1）、NODE_BUDGET 50、有限手数反証のみのUNKNOWN 2。先攻証明は「13手目5番・左→後攻14手目6番・右」の後から先攻1着手以内であり、後攻が別応手を選べる親の先攻必勝ではない。新証明2件を後攻の新規必勝親2件と混同しない。13手目の全6手・33応手を保持し、既知親の不要5応手は新規探索しなかった。102,564,239訪問、探索elapsed合計約33.08分、新規対局0。376原ファイルのGit blob・SHA・段階入力・全証明とsummary／合成証明bytesの独立再監査を完了した。

固定011監査器のパス誤記で最初の再監査は停止したため、固定ソースを保持して別の修正版 `tools/v010-retro011-integration/reaudit.py` を追加した。下記011監査では必ず修正版を使う。正式探索・集計・保存の原記録やmanifestを修正していない。詳細は[011結果](V010_RETRO011_RESULTS_20261015.md)。

初期4合法初手・14応手の直接解析は未起動。通常エンジンの全合法列挙と規模比較は011計画に保存した。公平性は初期配置の理論値、能力・探索予算をそろえた交換対局の実用的先後差、循環・終了条件を含む手番の機会差を区別し、勝率50%だけで公平としない。局所必勝と初期配置の理論値、特定AIの成績を区別する。

## 完了した調査と原記録

各行の未解決事項はその調査の完了時点の記録。後続調査の成果で原数値・原判断を書き換えない。

| 調査 | 完了量 | 完了時点の主な結果 | 報告書・保存先 |
|---|---|---|---|
| 正式自己対戦 | 10,240局・5,120交換ペア | 勝つ側はAI方針・探索量に依存。初期配置の理論値は未確定 | [診断](V010_FIRST_PLAYER_BALANCE_DIAGNOSIS_20261012.md)／[原記録](v010-balance/formal-original-artifacts.zip) |
| 001 | 420局・26証明job・976原ファイル | 主経路27手目直前から後攻14着手以内 | [結果](V010_OPENING_PROOF_RESULTS_20261012.md)／[保存先](v010-research-completed/study-001/) |
| 002 | 38証明job・863原ファイル | 23手目直前から後攻20着手以内、25手目から18着手以内 | [結果](V010_INITIAL_PROOF_RESULTS_20261012.md)／[保存先](v010-research-completed/study-002/) |
| 003 | 34証明job・771原ファイル | 21手目直前から後攻18着手以内 | [結果](V010_PROOF_GC_RESULTS_20261012.md)／[保存先](v010-research-completed/study-003/) |
| 004 | 54証明job・1,167原ファイル | 19手目の6／9分岐を証明 | [結果](V010_BRANCH_PROOF_RESULTS_20261012.md)／[保存先](v010-branch/completed/) |
| 005 | 52証明job・938原ファイル | 19手目の7／9分岐へ拡張 | [結果](V010_REPLY_PROOF_RESULTS_20261013.md)／[保存先](v010-reply/completed/) |
| 006 | 34証明job・698原ファイル | 新証明0、19手目の7／9を保持 | [結果](V010_REPLY_DEEPEN_RESULTS_20261013.md)／[保存先](v010-deepen/completed/) |
| 007 | 34証明job・268原ファイル | 全9分岐を合成し19手目直前から後攻48着手以内 | [結果](V010_PN007_PROOF_RESULTS_20261013.md)／[保存先](v010-pn007/completed/) |
| 008 | 32証明job・256原ファイル | 17手目の3／4分岐を証明 | [結果](V010_RETRO008_RESULTS_20261013.md)／[保存先](v010-retro008/completed/) |
| 009 | 8証明job・66原ファイル | 全4分岐を合成し17手目直前から後攻50着手以内 | [結果](V010_DEEPEN009_RESULTS_20261014.md)／[保存先](v010-deepen009/completed/) |
| 010 | 2証明job・19原ファイル | 全2分岐を合成し15手目直前から後攻52着手以内 | [結果](V010_RETRO010_RESULTS_20261015.md)／[保存先](v010-retro010/completed/) |
| 011 | 54証明job・376原ファイル | 13手目の全6分岐中2分岐で後攻必勝を確認。13手目全体はUNKNOWN、15手目52着手以内を保持 | [結果](V010_RETRO011_RESULTS_20261015.md)／[保存先](v010-retro011/completed/) |

正式対局の探索的35局、各pilot・方法比較、26件の証明専用チェックポイントは別分類として原記録に保持する。新規対局は001の420局以外、002〜010では各0。初回保存失敗と保存専用runでの復旧は[旧引き継ぎ](V010_RESEARCH_HANDOFF_20261012.md)と001の原報告書に保持する。010の採用pilot2件と、ソースfingerprint不一致による予備2件のHOLD除外は[010結果](V010_RETRO010_RESULTS_20261015.md)に別分類で保持する。各保存先のZIP・summary・receiptは元結果commitのGit blobと同じbytesであり、数値を更新した複製ではない。

## 読取り専用の全件再監査

全履歴を取得したcheckout、Node 24、Python 3を使う。次は原記録を一時展開し、全SHA・通常エンジンの全棋譜／証明・段階入力・再集計summary・合成証明bytesを検証する。新規対局・証明探索は起動しない。

```sh
git fetch origin
python3 tools/v010-research-integration/audit.py
python3 tools/v010-branch/reaudit.py doc/v010-branch/completed b1e9bdbcab21760c1bd1017c685e0842d02bb85c
python3 tools/v010-reply/reaudit.py doc/v010-reply/completed 428cf47b3d27a18e82fef28fa66c66e6cad1c628 975e1a8188dbe43fda1c39b3b97e8858db8a97e3 38265400792
python3 tools/v010-deepen/reaudit.py doc/v010-deepen/completed 02335fc03e9ee2ef226c8b226c03d3f8e919456f d4163c3c171117b1fce7dd30b39faad733605418 38271005778
python3 tools/v010-pn007/reaudit.py doc/v010-pn007/completed 5f44f34a3a279b232d3045b5b3edaad48096ac0d ce52d57f4a25d40664f1e12de8559691577af1c0 38313259149
python3 tools/v010-retro008/reaudit.py doc/v010-retro008/completed 6de6bcdbf5a315f33f19114608d78700b341992c c19aca2d13e7a2306096ef151f418fcc6ba6e2d8 38415683995
python3 tools/v010-deepen009/reaudit.py doc/v010-deepen009/completed 0b220daec7762254eb38a72019dc44f62c9f5a62 6f29c2bce728cba617ee2b72aa1733468891e28c 38423055308
python3 tools/v010-retro010/reaudit.py doc/v010-retro010/completed 536a62cb876760afcda2720b37617f1340817691 2ac3e0da431f8e88a7b7f7317aa53d29c108a12c 38667352032
python3 tools/v010-retro011-integration/reaudit.py doc/v010-retro011/completed 68ba0b43ec2b6761fbb3d2a75667776a497432cd 682ad7e0f9dd997348c8766c073c2fe18b9005ca 38679332213
```

最初の監査は正式10,240局・001〜003・26件の証明チェックポイントを扱い、続く8監査は004〜011の計3,788原ファイルを扱う。後者は結果commitとのGit blob照合と合成証明のbytes再生成一致も確認する。[mainとPRの読取り専用CI](../.github/workflows/v010-research-integration-check.yml)へ全9監査を登録した。各研究のPR CIでは追加検証・manifest・pilotと原記録の保持も確認する。既存 `job`・`matrix`・`shard` は新規計測の入口なので再監査に使わない。

固定manifest・旧source・計画・起動記録・結果commit・原ZIPを保持する。調査006の短縮結果SHAはここでは完全SHAへ展開して案内するが、当時の監査JSONは原形を保持する。調査008の正式完了・独立再監査は10月13日、旧引き継ぎへの完了追記は14日であり、別の日時である。

## 次に再開する手順

1. 最新main・AGENTS.md・この引き継ぎ・011結果・固定manifestを読み、未マージPRと未完runを確認する。完了jobを再探索しない。
2. 上の全9監査を実行する。011では修正版監査器を使う。原記録・固定source・全SHA・通常勝利証明・再集計を確認する。
3. 13手目の未解決4親は1番・右（8応手）、3番・左（7応手）、5番・右（3応手）、5番・左（4応手）。計22応手中、5番・左→6番・右は先攻証明済み、残る21応手が未証明。少ない応手の2親をpilotで比較する案と、初期14応手の直接解析を比較して選ぶ。
4. 次IDは012候補。まだ正式起動していない。履歴で重複を確認し、新しい入力・分割・予算・停止／成功条件を小規模検証後に固定する。旧失敗tableの継続と同じ根の再探索は別に記録する。
5. 後攻勝ちは全先攻手それぞれに勝つ応手、先攻勝ちは1先攻手で全後攻応手が必要。その先でも相手全合法応答を通常エンジンで検証する。一本道の到達例、循環、安全停止、有限手数反証、予算停止を無期限の勝利・引き分け・公平・必勝不在へ昇格しない。

旧試験・原記録・計画・manifest・起動記録・source SHAを保持し、公開規則・初期配置・公開AIを研究のために変更しない。長い調査はGitHub Actionsを第一候補にし、中断後は完成原記録を監査して未完目標だけを別の再開計画で扱う。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。調査コードと実行可能なコード例はMIT。
