# Bao Nakakamado

Bao la Kiswahili の実装を出発点に、NYAKUA（ニャクア、ハンド奪取）を追加したBaoです。

**現行は試作v0.7.0：各人の前列・後列16穴、循環種まき、ハンド22個。NYAKUAの最後の1個保護と一穴全投入を現行仕様として固定しています。**

## 遊べる試作

[`prototype/`](prototype/) を静的サイトとして配信すると遊べます。2人対戦と簡易コンピューター対戦に対応します。

- 前列・後列を使う4列32穴へ戻しました。前列6・2・2、後列は空、ハンド22個ずつ、総KETE64個。
- 自分の前後列16穴を循環して蒔きます。捕獲するのは相手の前列です。
- NAMUAの一着手で捕獲2回以上、相手ハンド2個以上ならNYAKUAで1個奪います。**最後の1個は奪いません。**
- 相手ハンド0なら、残り全部を通常の合法な開始穴へ**一度に全投入**し、通常の捕獲・種まきを続けます。
- 両者ハンド0で共通MTAJIへ移行。相手前列全空または相手の合法手なしで勝ちです。

[ルールブック](doc/RULEBOOK.md)、[起動・棋譜・テスト](prototype/README.md)、[今回の変更と検証](doc/FOUR_ROW_NYAKUA_FIXED_20261002.md)を参照してください。

## 検証と履歴

現行条件の400局はすべて通常終局しました。40組の南北交換、40局の棋譜再構築、8,873候補遷移の照合も一致しました。[確認コード](tools/four-row-nyakua-check.cjs)と[結果](tools/four-row-nyakua-results.json)を保存しています。先後均衡、人間同士の操作感、全局面の停止を証明した結果ではありません。

過去の調査は、その文書が指定する盤・ハンド・NYAKUA条件に限る履歴です。新条件へ勝率や必勝手順を引き継ぎません。

- 旧4列盤：[先後比較](doc/FIRST_PLAYER_BALANCE_20260929.md)、[一穴全投入](doc/FIXED_PIT_BULK_STUDY_20260930.md)、[ハンド枯渇3案](doc/HAND_EXHAUSTION_OPTIONS_REVIEW_20260930.md)。最後の1個を奪える条件での記録です。
- 旧1列折り返しv0.6.0：[進行調査](doc/ONE_ROW_BOUNCE_STUDY_20261001.md)、[ハンド12・8個](doc/HAND12_VS_HAND8_BALANCE_20261001.md)、[ハンド6個](doc/HAND6_BALANCE_20261001.md)、[初期条件の改善候補](doc/BALANCE_OPTIONS_STUDY_20261001.md)。6個の先手必勝証明も当時の条件に限定します。
- 旧1列折り返しv0.6.1：[最後の1個保護](doc/NYAKUA_PROTECT_LAST_20261001.md)、[先後比較29,000局](doc/CURRENT_FIRST_PLAYER_BALANCE_20261001.md)、[6・2配置](doc/PLACEMENT62_BALANCE_20261001.md)。方針を通じた均衡は確認できませんでした。
- [NYUMBA残数による連続捕獲上限](doc/NYUMBA_CAPTURE_CAP_STUDY_20261001.md)は採用を見送り、現在も毎回全捕獲です。

## 設計・実装の基準

[元ゲーム](https://github.com/nkkmd/bao-la-kiswahili-game)と[採用ルール基準](https://github.com/nkkmd/bao-la-kiswahili-game/blob/main/doc/RULES_BASELINE.md)を出発点に、変更点を明記します。takasia未実装、連続種まきの安全上限など、保存済みエンジンの実装範囲を引き継ぎます。

元ゲームの公開AIの強さや研究結果を、今回の試作へそのまま適用しません。片側だけ先にMTAJIへ入る案は採用していません。勝負宣言・抽選・追加手番は削除済みで、運要素の検討は凍結しています。
