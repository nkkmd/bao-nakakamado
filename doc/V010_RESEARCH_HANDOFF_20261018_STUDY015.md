# v0.10.0先後差・必勝調査：調査015完了時点の引き継ぎ

整理日・正式完了日：2026年10月18日（Asia/Tokyo）。015の準備・起動は17日。現行v0.10.0・標準初期配置を固定。[README](../README.md)／[索引](RULE_VERSIONS_AND_TESTS.md)／[AGENTS.md](../AGENTS.md)／[014時点の引き継ぎ](V010_RESEARCH_HANDOFF_20261017_STUDY014.md)／[012までの全履歴](V010_RESEARCH_HANDOFF_20261015_STUDY012.md)。

正式10,240局と追加調査001〜015が完了。全応答を覆う最も早い局所証明は主経路15手目直前から後攻52着手以内。13手目は既知2／6親、残る4親・13手目全体・初期配置の必勝側・強制到達・公平性はUNKNOWN。013の既知3子（後攻3・47・19着手以内）を保持する。

015は014と同じ17手目直前2局面×両勝者4目標へFIFO常駐キャッシュを使った新方式の新規探索。新証明0、全4件WALL_BUDGET。28,355,096訪問、探索elapsed合計約11.59分（固定scheduleの実測で段階間GCを含む）、新規対局0。全段階14/18/22/30/46/76を試みたが完全反証段階0で、76着手までの完全解析ではない。

追い出しは1番・右後の後攻目標で2,962回（深度46：2,450、76：512）。他3目標は常駐100万項目未満で停止しており、停止理由の変化をFIFOの改善へ帰属しない。速度・証明能力の改善は確認できない。分割2局面・16手目直前・元根・親はUNKNOWN、元根の後攻証明充足は1／2・0／2・2／4、13手目2／6のまま。

全35原ファイルをGit blob・全SHA・固定manifest・段階入力・policy／追い出し数・通常エンジンの既知証明と全合法応答・summaryと再生成証明bytesについて独立再監査し、新規対局・新規探索0で一致を確認。[015結果](V010_TABLE015_RESULTS_20261018.md)／[固定計画](V010_TABLE015_PLAN_20261017.md)／[起動記録](V010_TABLE015_LAUNCH_20261017.md)／[manifest](../tools/v010-table015/manifest.json)／[原ZIP・summary・receipt](v010-table015/completed/)／[独立監査](v010-table015/independent-reaudit.json)。

source `a5c671ad0e37eaf85dc1b8e1b2d9afcf775161de`、結果commit `63edba242e87a5fee3dff225e464b7cd9adce739`、run `39042654147`。[PR #52](https://github.com/nkkmd/bao-nakakamado/pull/52)とmain Actionsを実際の統合SHA・日時・最終CI・統合後監査の基準とする。FIFOは旧007の研究用コピーで、状態キー・閾値再帰・証明保存・通常勝利条件を維持した。常駐Map容量を全メモリ上限と混同しない。

## 読取り専用の全13監査

全履歴を取得したcheckout、Node 24、Python 3を使う。最初の監査は正式10,240局・001〜003・26チェックポイント、後続12監査は004〜015の4,078原ファイルを扱う。新規対局・証明jobを起動しない。

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
python3 tools/v010-table015/reaudit.py doc/v010-table015/completed 63edba242e87a5fee3dff225e464b7cd9adce739 a5c671ad0e37eaf85dc1b8e1b2d9afcf775161de 39042654147
```

[main／PR CI](../.github/workflows/v010-research-integration-check.yml)に全13監査を登録。015専用CIは8検証・manifest・pilot80ファイル・独立再監査・固定source／bytes保持を確認する。011の監査は修正版を使い、旧補助器は原形保持。既存job・matrix・shardは新規計測の入口なので再監査に使わない。

## 次の工程

1. 最新main・AGENTS.md・この引き継ぎ・015結果・固定manifestを照合し、未完run・未マージPR・ID重複を確認。全13監査を通し、完了jobを再実行しない。
2. 次ID016は候補で正式未起動・計画未固定。FIFOの正式寄与は1目標のみで全目標の時間制約が残るため、単純な採用継続・時間／table増量を先に決めない。保存済み段階ログを読取り専用で分析し、訪問・時間・table・追い出しの状況と全合法分割の根数・重複・合計費用を比較する。
3. 今回2局面をさらに進めると1手先6／2の8局面、2手先27／14の41局面。先攻手番なので後攻勝ちには全先攻分岐が必要。013で保留した他4子・18原根も比較対象とする。新分割・時間配分・方法は、浅い通常全探索一致・欠落／改ざん拒否・安全停止UNKNOWN・有限範囲反証保持を検証後に固定する。
4. 初期4合法初手・14応手も比較対象。015のpilotは初期stop28／FIFO28とも新証明0。先攻勝ちは勝つ初手1つの全後攻応手、後攻勝ちは全4初手に勝つ応手、その先も相手全合法応答が必要。一本道の到達例を初期全体の証明にしない。
5. 未解決13手目4親は1番・右（8応手）、3番・左（7応手）、5番・右（3応手）、5番・左（4応手）。5番・左→6番・右は先攻1着手の既知証明だが親全体の先攻必勝ではない。既知3子・2親・3固定応手と保留を保持する。長い試験は隔離branch・PR・Actionsを第一候補にし、原記録・summary・receipt・source SHAを保存、独立再監査後に文書更新・最終CI・main統合を行う。

015準備の全12旧記録監査・SHA付き8検証・pilot80原gzip・選択と独立照合を保持。stopの直接4／分割16／初期28は全TABLE_BUDGET、FIFO直接は時間停止3／訪問停止1、初期FIFOは時間停止2／訪問停止26で新証明0。実訪問数は一致せず速度優位を主張しない。未検証の分割＋FIFO等も否定しない。開発jobやpilot証明は正式集計へ混ぜない。

局所必勝・初期理論値・AI条件付き先後差を区別する。公平性は最善応答での手番優位、同能力・同予算の交換対局の頑健性、循環・終了条件を含む機会差を分ける。50%勝率・未証明・有限手数反証・予算停止を公平・引き分け・無期限の勝敗・必勝不在へ昇格しない。旧原記録・固定manifest・計画・起動記録・ソース、013／014の予備除外記録も保持し、公開規則・初期配置・公開AIを変更しない。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。調査コードと実行可能なコード例はMIT。
