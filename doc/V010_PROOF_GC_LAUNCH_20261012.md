# 証明データ整理・遡及探索003：正式起動記録

記録日：2026年10月12日（Asia/Tokyo）。15:30に[固定計画](V010_PROOF_GC_PLAN_20261012.md)に従う正式探索を起動した。この文書は起動時点の記録であり、結果ではない。

[正式run 38212885592](https://github.com/nkkmd/bao-nakakamado/actions/runs/38212885592)、source commit `b2da2e60c834d0c771306987bd8a6e3ae56671c6`、manifest `8b24cd382bb08d2e9bbae157696b936a2f56af24017f3803ee6d511bd6277ca4`。[Draft PR #38](https://github.com/nkkmd/bao-nakakamado/pull/38)に実装と計画を保存した。

準備push CI [38212748407](https://github.com/nkkmd/bao-nakakamado/actions/runs/38212748407)と準備PR CI [38212790341](https://github.com/nkkmd/bao-nakakamado/actions/runs/38212790341)が成功した。新規6検査、公開16検査、旧新manifest、過去の実装・原記録の不変を確認した。正式preflightも成功し、21手目直前の両目標の2jobが実際の探索工程に入った。

計34job、21→19→17手目の両目標、その後に全14開幕の両目標を調べる。前段階が完了してから、新しい証明を再検証して次へ引き継ぐ。依存する全原記録のSHAを照合し、勝ち証明だけをbookへ加える。基礎bookは27,169の検証済み勝ち部分局面。新しいAI対局は0局。

各最大1,000万訪問ノード・20分・80着手（開幕2手後78）、保存ノード50万・heap1.5GiBの目安は002と同じ。探索中の証明を保持し、不要な部分木を整理する。80着手まで必ず探索できるという意味ではない。予算停止は未証明であり、公平・互角・必勝不在の証拠ではない。

初期配置の必勝側はまだ未確定。相手の全合法応答と開始状態の一致を検証できた部分証明だけを初期配置へ合成する。結果branch `results/v010-proof-gc-study-003` はsourceから事前作成し、preflightで一致を確認した。全34jobの監査後に原bytes・証明木・summary・SHA receiptを保存する。通常pushと再実行で重複探索しない。完成jobは新規探索0で再利用し、中断はHOLD。

[機械可読開始記録](v010-gc/launch-receipt.json)にsource・run・CI・段階・予算を保存した。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。調査コードはMIT。
