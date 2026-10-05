# 正式validationのゼロ符号検証の修正

2026年10月5日（日本時間）。対象はBao Nakakamado v0.8.0・棋譜version 7。

PR #18をmainの `ae32c7c8906d6b94768bf8e453a5a0613d4c56af` へ統合し、[正式学習run 37253040070](https://github.com/nkkmd/bao-nakakamado/actions/runs/37253040070)（attempt 1、10:51:00 JST）を `resume_receipts: []` で起動した。prepareと9学習workerは成功し、MLP・論理ゲート全6候補は固定150epoch・23,550更新を完了した。validation job 111585207610は10:55:52 JSTに停止し、判定報告は生成されなかった。workflowの失敗はモデルの数値基準不合格（HOLD）とは区別する。

原因は検証コードでの `0` と `-0` の比較だった。整数評価器はゼロを `0` に正規化するが、反対側の期待値を単に符号反転したため、Nodeのstrict assertionが `0` と `-0` を異なる値として停止した。実装の事前smokeには、このゼロ出力の検証が不足していた。

元runのvalidation artifact 11322225896と線形seed 2026100401のartifact 11321586505を、固定ZIP SHA-256・ファイル名・CRCを照合して診断用に取得した。入力契約・モデルmetadataを確認し、1,517行の線形Python/Node整数出力は不一致0。ゼロ出力が3行あり、元の反対称性assertionで `ERR_ASSERTION`（actual 0、expected -0）を再現した。数学的な符号反転の不一致は0。精度指標・候補順位は計算せず、finalは取得・展開・復号しなかった。

正式validatorと開発smokeの反対側期待値を、ゼロの場合は0、その他は符号反転にした。実際のゼロ重み評価器による両観点の0、非ゼロの正しい反対称性、非ゼロおよびゼロに対する実際の不一致を回帰テストで確認する。新規Nodeテストは9/9成功。学習器・評価器・数値基準・モデル集合・seed・epoch・元dataset・収集ソースは変更しない。

修正後の学習fingerprintは `872a4690be9cd686ace800052e01b4afda5488c2cae60fb41cbc458a2958045c`。旧成果のfingerprintを書き換えたり新しいソースの証拠として流用したりせず、CI通過・修正commitの固定後に同じ学習仕様で新規runを起動する。旧run・artifact・開発検証記録は原記録として保持する。判定基準は元の [正式学習仕様](AI_FORMAL_LEARNING_DESIGN_20261005.md)のままであり、収集鍵とfinal開封用gateは使用しない。

説明文はCC BY-SA 4.0。コード・設定・保護対象の機械可読記録はMIT。[出典と利用条件](../LICENSES.md)を維持する。
