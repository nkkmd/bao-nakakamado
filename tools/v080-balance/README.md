# v0.8.0の先攻・後攻比較

調査ID：V080-BALANCE-20261003-R2。現行製品の `prototype/next-turn-engine.js` と `prototype/steal.js` を直接使用する。製品規則と公開画面は変更しない。

正式設計は自己対戦10方針15,600局、交差対戦4組×250組＝2,000局、4初手×250局×2方針＝2,000局、計19,600局。各条件のseed集合を分離。6手探索は一着手30,000ノード、その他の探索は指定深さまで完了させる。評価は総KETE・前列数の基本評価と、合法手数・前列占有数を加えた別評価。NYUMBAのstop/useは結果が違う場合に両方を列挙する。

GitHub Actions **v0.8.0 balance with independent random streams** を第一候補とする。最大8ジョブ同時実行、20局／20組ごとの原子的チェックポイントと失敗時artifact。ソースSHA-256と条件署名が一致する完了ブロックだけ再利用する。Actionsを単に再実行しても自動復元しない。過去artifactを同じ出力ディレクトリへ展開してから再開する。

```sh
node tools/v080-balance/check.cjs /tmp/v080-checks.json
node tools/v080-balance/run.cjs self-search4 /tmp/v080/self-search4
node tools/v080-balance/run.cjs cross-2 /tmp/v080/cross-2
node tools/v080-balance/run.cjs open-search6 /tmp/v080/open-search6
node tools/v080-balance/run.cjs proof /tmp/v080/proof
```

第4引数で準備用局数／proofノード予算を変えられる。正式条件と別ディレクトリへ保存する。正式Node v24.19.0。全taskが完了したら以下を実行する。

```sh
node tools/v080-balance/verify.cjs
python3 tools/v080-balance/report.py
```

全着手で総KETE64個・非負整数を検査。全ブロックの署名・ソース・seed・局数・集計を照合し、各taskの先頭・中央・末尾と全未決着局を再実行する。代表棋譜は製品のreplayで再構築し、南北交換した全着手も照合。探索準備確認では3手探索と枝刈りなし計算を照合する。盤上種まき自体の独立再実装による検証ではない。

`results/checkpoints.json.gz` はファイル名→JSONテキストの原記録。再検証するときは別の同一commit作業ツリーで、gzip内の `files` を `tools/v080-balance/results/` 相対に展開し、verify/reportを実行する。任意の外部アーカイブを展開するときは絶対パスと `..` を拒否する。ソースが変わったら記録された実行commitとSHA-256へ復元する。

勝率の分母は通常終局。安全上限・反復・400手は未決着として分離。先後均衡は勝率50%を含むだけでは確認できない。ゲーム理論的な最善結果の証明と、確率的な指定方針の勝率を区別する。初期局面の3値AND/OR探索は各深さ1,000万ノード・総900秒。UNKNOWNや未完了を必勝の不在と扱わない。強制勝ち結果が出た場合は独立証明書の検証が済むまで報告工程を停止する。

[詳細報告](../../doc/V080_FIRST_PLAYER_BALANCE_20261003.md)、[集約結果](results/summary.json)、[再現検証](results/verification.json)を参照。MITのコード・設定とCC BY-SA 4.0の説明文の区分は[LICENSES.md](../../LICENSES.md)に従う。

## 乱数方式の修正（R2）

初回実行は[Actions 37112608419](https://github.com/nkkmd/bao-nakakamado/actions/runs/37112608419)と `experiment/v080-balance-20261003` に保存する参考記録。旧xorshift方式では `seed XOR 定数A/B` から作った2人の乱数列にseedに依存しない固定XOR関係があり、先後交換でも消えない選択相関が残る。初手固定時に乱数消費を省略した問題もあるため、その数値を正式判断に使用しない。

R2ではseed・主体A/B・呼出番号を区別したSHA-256のカウンター方式を使用し、上位48ビットから[0,1)へ変換する。固定XOR関係を持たない擬似乱数であり、数学的な独立性の証明を主張しない。交差対戦では主体の列を交換する。初手を強制するときも通常と同じ1回分の乱数を消費し、自然に選ばれた初手を同じseedで強制した場合、その後の全棋譜が一致することを40局で検査する。
