# v0.10.0先後差・必勝調査：調査016完了時点の引き継ぎ

整理日・正式完了日：2026年10月18日（Asia/Tokyo）。現行v0.10.0・標準初期配置を固定。[README](../README.md)／[索引](RULE_VERSIONS_AND_TESTS.md)／[AGENTS.md](../AGENTS.md)／[015時点](V010_RESEARCH_HANDOFF_20261018_STUDY015.md)／[012までの履歴](V010_RESEARCH_HANDOFF_20261015_STUDY012.md)。

正式10,240局と追加調査001〜016が完了。全応答を覆う最も早い局所証明は主経路15手目直前・後攻52着手以内。13手目は既知2／6親、残る4親・13手目全体・初期配置の必勝側・強制到達・公平性はUNKNOWN。013の既知3子（後攻3・47・19着手以内）を保持する。

016は17手目の全合法6／2分岐を18手目直前8局面へ分割し、両勝者16目標を探索した。**新証明1件：後攻43着手以内。** ID `primary-before-13-move-3-reply-0-move-1-reply-0-move-3`、対象経路の16手目「1番・右」→17手目「6番・右」の後。通常エンジンで先攻全合法応答と通常勝利末端を検証する。追い出し0の目標で得た証明なのでFIFOの効果へ帰属しない。

停止内訳はPROVED1・WALL_BUDGET14・UNKNOWN1、30,823,776訪問、追い出し741,481、探索実測625,799.394365ms（段階間GCを含む約10.43分）。根index3の先攻目標は45／75着手、index2・7の先攻目標は13着手の有限範囲反証であり、無期限の結論ではない。今回全体が75着手まで完全解析済みではない。

17手目前2根の後攻証明充足は1／6・0／2。全先攻分岐が揃わず、16手目前・15手目前の対象・13手目終了後・13手目全体へ新たな結論は合成できない。元根の充足1／2・0／2・2／4、13手目前2／6のまま。

[016結果](V010_PARTITION016_RESULTS_20261018.md)／[固定計画](V010_PARTITION016_PLAN_20261018.md)／[起動記録](V010_PARTITION016_LAUNCH_20261018.md)／[manifest](../tools/v010-partition016/manifest.json)／[原ZIP・summary・receipt](v010-partition016/completed/)／[独立再監査](v010-partition016/independent-reaudit.json)。全130原ファイルをGit blob・SHA・固定入力・全合法応答・通常勝利・再集計summary／再生成証明bytesについて読取り専用で再監査し、一致を確認した。新規対局・新規証明探索0。

source `d69eeeab2db780a9a3522fce02c37925151e6420`、結果commit `e6cdfac8627df8e94ce81465ee6169bf600185a8`、正式run `39075132061`（全31job成功）。実際の監査完了はreceipt、統合SHA・日時・最終CI・統合後監査は[PR #53](https://github.com/nkkmd/bao-nakakamado/pull/53)を基準とする。公開規則・初期配置・公開AI・旧原記録・固定ソースは変更しない。

## 読取り専用の全14監査

全履歴を取得したcheckout、Node 24、Python 3を使う。最初の監査は正式10,240局・001〜003・26チェックポイント、後続13監査は004〜016の4,208原ファイルを扱う。新規対局・証明jobを起動しない。

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
python3 tools/v010-partition016/reaudit.py doc/v010-partition016/completed e6cdfac8627df8e94ce81465ee6169bf600185a8 d69eeeab2db780a9a3522fce02c37925151e6420 39075132061
```

[main／PR CI](../.github/workflows/v010-research-integration-check.yml)に全14監査を登録。016専用CIは8検証・manifest・比較104ファイル・独立再監査・固定source／bytes保持を確認する。011の監査は修正版を使う。既存job・matrix・shardは新規計測の入口なので再監査に使わない。

## 次の工程

1. 最新main・AGENTS.md・本書・016結果・固定manifestを照合し、未完run・未マージPR・ID重複を確認。全14読取り専用監査を実行し、完了した正式対局・証明jobは再実行しない。
2. 次ID017は候補で正式未起動・計画未固定。残る7分割子（5＋2）の段階ログ・既知43着手証明を読取り専用で分析し、全合法応手の追加分割・深度配分・証明再利用を比較する。単純なFIFO採用継続・予算増量を先に決めない。
3. 保留4子・18原根、初期4初手／14応手の直接解析も比較する。初期先攻勝ちは勝つ初手1つの全後攻応手、後攻勝ちは全4初手それぞれに勝つ応手が必要。その先も相手全合法応答を覆い、一本道の到達例を初期全体の証明にしない。
4. 新分割・方法・予算は通常全探索との浅い一致、全合法分割・応答欠落／改ざん拒否、資源／安全停止UNKNOWN、有限範囲反証の保持を検証してから固定。長い試験は隔離branch・PR・Actionsを第一候補とし、原記録・summary・receipt・source SHAを保存、独立再監査後に文書更新・最終CI・main統合を行う。

未解決13手目4親は1番・右（8応手）、3番・左（7応手）、5番・右（3応手）、5番・左（4応手）。5番・左→6番・右の先攻1着手証明は、その親全体の先攻必勝ではない。既知3子・2親・固定応手と保留を保持する。016準備の旧13監査・最終8検証・比較104原gzipと独立照合を保持し、探索的pilotを正式book・集計へ混ぜない。

局所必勝・初期理論値・AI条件付き先後差を区別する。公平性は最善応答の手番優位、同能力・同予算の交換対局の頑健性、循環・終了条件を含む機会差を分ける。50%勝率・未証明・有限手数反証・予算停止を公平・引き分け・無期限の勝敗・必勝不在へ昇格しない。循環・安全停止を通常勝利にしない。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。コードと実行可能例はMIT。
