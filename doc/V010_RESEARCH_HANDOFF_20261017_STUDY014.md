# v0.10.0先後差・必勝調査：調査014完了時点の引き継ぎ

整理日：2026年10月17日（Asia/Tokyo）。現行v0.10.0・標準初期配置を固定。[README](../README.md)／[索引](RULE_VERSIONS_AND_TESTS.md)／[AGENTS.md](../AGENTS.md)／[013時点の引き継ぎ](V010_RESEARCH_HANDOFF_20261016_STUDY013.md)／[012までの全履歴](V010_RESEARCH_HANDOFF_20261015_STUDY012.md)。

正式10,240局と追加調査001〜014が完了。全応答を覆う最も早い局所証明は主経路15手目直前から後攻52着手以内。13手目は既知2／6親、残る4親・13手目全体・初期配置の必勝側・強制到達・公平性はUNKNOWN。013の8子中3子（後攻3・47・19着手以内）を保持する。

014は13手目5番・右→14手目5番・右後の残る未解決子を全合法16手目の2局面へ分割し、両勝者4目標を完了した。新証明0、TABLE_BUDGET3・WALL_BUDGET1。29,585,457訪問、探索elapsed合計約9.94分、新規対局0。全段階14/18/22/30/46/76を試みたが完全反証段階は0で、76着手までの完全解析ではない。分割2子・16手目直前・元根・親はUNKNOWN。013からの元根の後攻証明充足は1／2・0／2・2／4のまま、13手目2／6も増えていない。

全35原ファイルを結果commitのGit blob・全SHA・段階入力・通常エンジンの既知証明／全合法応答・再集計summaryと再生成証明bytesについて独立再監査。新規対局・新規探索0で一致した。[014結果](V010_SPLIT014_RESULTS_20261017.md)／[固定計画](V010_SPLIT014_PLAN_20261017.md)／[起動記録](V010_SPLIT014_LAUNCH_20261017.md)／[manifest](../tools/v010-split014/manifest.json)／[原ZIP・summary・receipt](v010-split014/completed/)／[独立監査](v010-split014/independent-reaudit.json)。

source `23ddc84ed40041efc1afa13920cd31d7cc1e074a`、結果commit `972f441197148d9a7a1bce910a77ac39e1049683`、run `39033955570`。[PR #51](https://github.com/nkkmd/bao-nakakamado/pull/51)とmain Actionsを実際の統合SHA・日時・最終CI・統合後監査の基準とする。

## 読取り専用の全12監査

全履歴を取得したcheckout、Node 24、Python 3で実行する。最初の監査は正式10,240局・001〜003・26チェックポイント、後続11監査は004〜014の4,043原ファイルを扱う。新規対局・証明jobを起動しない。

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
python3 tools/v010-deepen012/reaudit.py doc/v010-deepen012/completed 958bd2d512468f11fa870b432c10cf231e77c968 b389875686726125e6fb30fb899e6b813cb3ec50 38734817122
python3 tools/v010-split013/reaudit.py doc/v010-split013/completed 590780779601115cc5af4dd31307792adf846ba1 b0bdd634dc7c31b8adc29cf07cdb92969954eb97 38863188124
python3 tools/v010-split014/reaudit.py doc/v010-split014/completed 972f441197148d9a7a1bce910a77ac39e1049683 23ddc84ed40041efc1afa13920cd31d7cc1e074a 39033955570
```

[main／PR CI](../.github/workflows/v010-research-integration-check.yml)に全12監査を登録。014専用CIは小規模5検証・manifest・採用／除外pilot・独立再監査・固定source／原記録bytesの保持を確認する。011の監査は修正版を使い、旧補助器を原形保持。既存job・matrix・shardは新規計測の入口なので再監査に使わない。

## 次の工程

1. 最新main・AGENTS.md・この引き継ぎ・014結果・固定manifestを照合し、未完run・未マージPR・ID重複を確認する。全12監査を通し、完了jobを再実行しない。
2. 次IDは015候補で正式未起動・計画未固定。014の17手目直前2局面をさらに全合法手で分割するなら、先攻手番なので後攻勝ちに全先攻分岐が必要。分割数・重複・合計予算・量化条件を列挙し、013の他の保留4子・18原根と比較する。時間／table停止が続くため単純増量を即採用しない。
3. table管理の変更は独立した方法検証として、浅い通常全探索一致・欠落／改ざん応答拒否・安全停止UNKNOWN・有限手数反証の保持を先に確認する。旧失敗tableを再開せず、新入力・方法・予算・停止／成功条件を小規模検証後に固定する。
4. 初期4合法初手・14応手の直接解析も比較対象に残す。014で通常エンジン全列挙と一致を確認したがpilot28目標は全NODE_BUDGET。先攻勝ちは勝つ初手1つの全後攻応手、後攻勝ちは全4初手に勝つ応手、その先も相手全合法応答が必要。局所経路を初期全体の証明にしない。
5. 未解決13手目4親は1番・右（8応手）、3番・左（7応手）、5番・右（3応手）、5番・左（4応手）。5番・左→6番・右は先攻1着手の既知証明だが親全体の先攻必勝ではない。既知3子・2親・3固定応手と保留を保持し、長い調査は隔離branch・PR・Actionsを第一候補とする。原記録・summary・receipt・source SHAを保存し、独立再監査後に文書更新・最終CI・main統合を行う。

公平性は最善応答での手番優位、同能力・同予算の交換対局の頑健性、循環・終了条件を含む機会差を分ける。局所必勝・初期理論値・AI条件付き先後差を混同しない。50%勝率・未証明・有限手数反証・予算停止を公平・引き分け・無期限の勝敗・必勝不在へ昇格しない。

旧原記録・固定manifest・計画・起動記録・ソースを保持する。014の予備pilotはメモリ残留により比較から除外し、原34gzip・当時のソース・receiptを保存。欠落応答テストの証明選択誤りのログも元bytesをSHA付きgzipで保持し、修正後の基本4検証と初期列挙検証の成功ログを別保存した。013の予備manifest除外も原形保持する。公開規則・初期配置・公開AIは変更しない。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。調査コードと実行可能なコード例はMIT。
