# v0.10.0先後差・必勝調査：調査013完了時点の引き継ぎ

整理日：2026年10月16日（Asia/Tokyo）。現行v0.10.0・標準初期配置を固定。[README](../README.md)／[索引](RULE_VERSIONS_AND_TESTS.md)／[AGENTS.md](../AGENTS.md)／[012時点の全履歴](V010_RESEARCH_HANDOFF_20261015_STUDY012.md)。

正式10,240局と追加調査001〜013が完了。全応答を覆う最も早い局所証明は主経路15手目直前から後攻52着手以内。13手目は既知2／6親、残る4親・13手目全体・初期配置の必勝側・強制到達・公平性はUNKNOWN。

013は13手目5番・右の全3後攻応手を全合法15手目の8子へ分割し、両勝者16目標を完了した。後攻証明3（3・47・19着手以内）、有限範囲UNKNOWN3、時間停止9、table停止1。87,165,005訪問、探索elapsed合計約30.85分、新規対局0。3着手はpilotの正式再確認、47・19着手は追加証明。元根は1／2・0／2・2／4しか後攻証明を覆えず、3元根すべてUNKNOWN。全121原ファイルを独立再監査した。全相手合法応答・通常勝利末端・summaryと再生成証明bytesの一致を確認し、新規探索0。

[013結果](V010_SPLIT013_RESULTS_20261016.md)／[固定計画](V010_SPLIT013_PLAN_20261016.md)／[起動記録](V010_SPLIT013_LAUNCH_20261016.md)／[manifest](../tools/v010-split013/manifest.json)／[原記録・summary・receipt](v010-split013/completed/)／[独立監査](v010-split013/independent-reaudit.json)。source `b0bdd634dc7c31b8adc29cf07cdb92969954eb97`、結果commit `590780779601115cc5af4dd31307792adf846ba1`、run `38863188124`。[PR #50](https://github.com/nkkmd/bao-nakakamado/pull/50)とmain Actionsを実際の統合SHA・日時・最終CIの基準とする。

## 読取り専用の全11監査

全履歴を取得したcheckout、Node 24、Python 3で実行する。最初の監査は正式10,240局・001〜003と26チェックポイント、後続10監査は004〜013の4,008原ファイルを扱う。新規対局・証明jobを起動しない。

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
```

[main／PR CI](../.github/workflows/v010-research-integration-check.yml)に全11監査を登録した。013専用CIは小規模検証5件・manifest・pilot・独立再監査・固定source／結果bytes保持を確認する。既存job・matrix・shardは新規計測の入口なので再監査に使わない。011は修正版の監査器を使い、旧補助器は原形保持する。

## 次の工程

1. 最新main・管理ルール・この引き継ぎ・013結果・固定manifestを照合し、未完run・未マージPR・新ID重複を確認。上の全11監査を通す。完了jobを再実行しない。
2. 次IDは014候補で正式未起動。013の未解決5子を全合法手でさらに分割する案を列挙し、根数・重複状態・手数差・存在／全称条件・table使用量を確認する。証明済み3子は通常エンジンで入力検証する。
3. 未解決13手目4親は1番・右（8応手）、3番・左（7応手）、5番・右（3応手）、5番・左（4応手）。5番・左→6番・右は先攻1着手以内の既知証明だが親全体の先攻勝ちではない。今回の3根以外に18未証明原根を保留。直接深化・全合法分割・table管理の別方式を小規模比較し、旧失敗tableをそのまま継続しない。
4. 初期4初手・14応手の直接解析も比較対象とする。012のpilotは未証明で正式結論なし。先攻勝ちは1初手の全後攻応手、後攻勝ちは全4初手に勝つ応手、その先でも全相手合法応答が必要。一本道で全体を証明しない。
5. 新入力・分割・方法・予算・停止／成功条件を小規模検証後に固定し、隔離branch・PRからActionsを第一候補に起動する。原記録・summary・receipt・source SHAを保存し、独立再監査後に報告書と索引を更新する。

公平性は最善応答での手番優位、同能力・同予算での交換対局の頑健性、循環・終了条件を含む機会差を区別する。局所必勝・初期理論値・AI条件付き先後差を混同しない。50%勝率・未証明・有限手数反証・予算停止を公平・引き分け・無期限の勝敗・必勝不在へ昇格しない。

旧試験・原ZIP・固定manifest・計画・起動記録・source SHAを保持する。013の600 job分の予備候補は正式未採用・正式job0として保存し、最終830 job分のmanifestと区別する。公開規則・初期配置・公開AIは変更しない。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。調査コードと実行可能なコード例はMIT。
