# v0.10.0：応手分割調査005の起動記録

2026年10月12日23:46:50（Asia/Tokyo）に[正式run 38265400792](https://github.com/nkkmd/bao-nakakamado/actions/runs/38265400792)を起動した。探索・監査・保存の完了記録ではない。最終成否は正式runと結果branchを確認する。

| 項目 | 固定値 |
|---|---|
| 調査ID | `NAKAKAMADO-V010-REPLY-PROOF-STUDY-005` |
| 研究基準HEAD | `efcf80f499de46a41122333e64736700416f0b35`（004完了、PR #41） |
| 開始main | `024ef96712a0851daaa23c6a34d7b0e80004eaa5` |
| 正式source SHA | `975e1a8188dbe43fda1c39b3b97e8858db8a97e3` |
| manifest digest | `76b15cf8e75eec82db9b4b4489d1aeae418a675e0bc107f4407aa08c444c2686` |
| 計画 | [固定計画](V010_REPLY_PROOF_PLAN_20261012.md) |
| 研究branch | `research/v010-reply-proof-005-20261012` |
| 結果branch | `results/v010-reply-proof-study-005`（起動前に正式sourceへ作成） |
| 対象 | 19手目の3番・左、4番・左、6番・右の後攻応手7／10／9種類、合計26根×両勝者＝52目標 |
| 上限 | 各200万訪問または4分、合計1億400万訪問・208探索分、同時最大8job |

004の保存1,167原ファイルを[読取り専用で再監査](v010-reply/preflight-reaudit.json)し、Git blob・SHA・全証明・段階入力・再集計bytes一致を確認してから計画を固定した。旧原記録・旧manifest・公開規則・公開AIのbytesは保持した。

新しい4検証テストは全54旧記録・6証明の保持、26応手の合法遷移、二段合成と独立全探索の一致、応答欠落・入力改ざん拒否、予算停止UNKNOWN、途中停止HOLD、完了記録の再利用で新規探索0を確認した。[探索的pilot](v010-reply/pilot.json)では、既知21手目の3応答を訪問0で復元して後攻18着手以内・7,721ノードの証明を合成。未解決各親の先頭応手を両目標で試した6件は各10万訪問でNODE_BUDGETだった。pilotを正式52目標へ合算しない。

20手目直前の3親と19手目全体への量化合成を行うが、初期配置への強制可能性は別の問題。005は17手目・全14開幕・対局を再実行せず、未証明を公平・引き分け・勝ち戦略不在と扱わない。

結果branchがsource SHAのままなら原記録保存は未完了。探索jobの成功は、予算内未証明の記録を正常に保存した場合を含み、必勝証明の獲得を意味しない。全件監査後に原ZIP・summary・receiptを`doc/v010-reply/completed/`へ保存する。

完了後は以下を結果commitを含む全履歴checkoutで実行する。保存済み完了jobを再実行しない。中断jobはHOLDとし、部分原記録を保持した別の固定計画なしに再探索しない。

```sh
python3 tools/v010-reply/reaudit.py doc/v010-reply/completed <results-commit> 975e1a8188dbe43fda1c39b3b97e8858db8a97e3 38265400792
```

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。調査コードはMIT。
