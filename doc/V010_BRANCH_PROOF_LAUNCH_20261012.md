# v0.10.0：調査004の起動記録

2026年10月12日19:16:46（Asia/Tokyo）に[正式run 38235313813](https://github.com/nkkmd/bao-nakakamado/actions/runs/38235313813)を起動した。起動済みという記録であり、全探索・監査・保存の完了記録ではない。最終状態はrunと結果branchを確認する。

| 項目 | 固定値 |
|---|---|
| 調査ID | `NAKAKAMADO-V010-BRANCH-PROOF-STUDY-004` |
| 開始main | `024ef96712a0851daaa23c6a34d7b0e80004eaa5` |
| 正式source SHA | `d574fbac091de4d6c43f92581720952589764332` |
| manifest digest | `bc6ba381019b403151692b661f0650e8ddbd497db01e4d2faa5b665103bf2b68` |
| 計画 | [固定計画](V010_BRANCH_PROOF_PLAN_20261012.md) |
| 研究branch | `research/v010-branch-proof-004-20261012` |
| 結果branch | `results/v010-branch-proof-study-004`：起動前にsource SHAへ作成 |
| 正式探索 | 19手目の9分岐×両目標、17手目の4分岐×両目標、14開幕×両目標＝54目標 |
| 最大訪問数 | 3億1,600万 |
| 探索時間上限 | 合計632分。各分岐20分・各開幕4分。同時最大8job |
| 保存 | 全件監査後、`doc/v010-branch/completed/`の原ZIP・summary・receiptを結果branchへ保存 |

起動前に、[旧記録の読取り専用再監査](v010-branch/preflight-reaudit.json)と既存54テスト、新しい分割・合成検証4テスト、workflow YAML・全段階54目標、旧記録・公開実装の差分なし、空白差分を確認した。[pilot](v010-branch/pilot.json)は既知21手目の全3合法手を再接続し後攻18着手以内・7,721証明ノードを確認。19手目の全9後続状態は各10万訪問で未証明。探索的pilotは正式54目標や勝率標本へ合算しない。

結果branchの先頭がsourceのままなら、原記録保存はまだ完了していない。Actions上の探索job成功も必勝証明獲得を意味せず、NODE_BUDGET等の記録を正常に保存した場合を含む。初期配置・公平性の判断は全件監査後の証明の量化条件で行う。

再開時は正式runの成否・各job・artifact・結果branchを確認し、完了jobを再実行しない。全件が完了して保存できたら、原ZIPを一時展開してSHA・全証明・段階入力・再集計summary bytesを再監査する。探索が中断したjobは自動再開せずHOLDとし、完了原記録を保持した追加計画を別途固定する。

完了後の読取り専用再監査には[004再監査器](../tools/v010-branch/reaudit.py)を用意した。結果commitのGit blob、全ZIP片と原ファイルのSHA、通常遷移による全証明・段階入力、再集計summaryと合成証明のbytes一致を確認する。原ファイルを一時展開して終了時に削除し、`job`を呼ばない。結果commitの`doc/v010-branch/completed/`を取得したcheckoutで実行する。

```sh
python3 tools/v010-branch/reaudit.py doc/v010-branch/completed <results-commit>
```

この再監査器は正式起動後に追加した読取り専用補助で、正式探索のsource・manifest・条件には含めない。正式結果が未完了の時点で全件再監査成功とは記録しない。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。調査コードはMIT。
