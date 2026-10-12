# 初期配置の分割必勝探索002：正式起動記録

記録日：2026年10月12日（Asia/Tokyo）、13:34時点。[固定計画](V010_INITIAL_PROOF_PLAN_20261012.md)と[前回結果](V010_OPENING_PROOF_RESULTS_20261012.md)に基づく追加探索を実際に起動した。この文書は起動時点の記録であり、結果ではない。

[正式run 38204293817](https://github.com/nkkmd/bao-nakakamado/actions/runs/38204293817)、source commit `1d70facc20c217e48c14d3ed243b329220dc5771`、manifest `a62374153e312544d0fe31fa118750ba211f6034b601c95c613bb8c40cb87b19`。[Draft PR #37](https://github.com/nkkmd/bao-nakakamado/pull/37)にコードと計画を保存した。

準備push CI [38204210619](https://github.com/nkkmd/bao-nakakamado/actions/runs/38204210619)と準備PR CI [38204233759](https://github.com/nkkmd/bao-nakakamado/actions/runs/38204233759)は成功した。新規6検査、公開16検査、旧新manifest、過去の実装と原記録の変更なしを確認した。正式preflightも成功し、8証明jobが計算中、残り30jobは待機中となった。

全14開幕2手後と主経路の17・19・21・23・25手目の19局面を双方から調べる38job。各最大1,000万訪問ノード・20分、初期配置への合成後の最大80着手（開幕2手後は残り78）。予算内に80手まで必ず完了するわけではない。以前の420棋譜は順序ヒント、1,424の検証済み勝ち部分局面は証明再利用に使い、新しいAI対戦は行わない。

初期配置の勝者はまだ未確定。先攻の証明には、ある初手の後の全後攻応手を網羅する必要がある。後攻には、全4初手それぞれに勝つ応手が必要。部分証明の開始状態の一致、相手の全合法応答、通常勝利の末端を再検証してから合成する。

結果branch `results/v010-initial-proof-study-002` はsource commitから事前作成し、preflightで一致を確認した。全38jobの監査後に原bytes・証明木・summary・checksumを追記する。通常pushや再実行で重複探索を起動しない。完成job再呼出しは新規探索0、技術的中断はHOLD。予算停止は未証明で、公平・互角・必勝不在の証拠ではない。

[機械可読開始記録](v010-certainty/launch-receipt.json)にrun・source・CI・予算・起動時件数を保存した。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。調査コードはMIT。
