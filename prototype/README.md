# Bao Nakakamado：遊べる試作v0.10.0

Bao la Kiswahiliをベースに独自ルールNYAKUAを採用したオリジナルのBaoです。v0.10.0では、原型側で正式採用されたtakasiaも基礎規則として採用しました。Bao Nakakamado・NYAKUAの考案者nkkmd、初公開日2026年9月30日を保持します。[ルールブック](RULEBOOK.md)・[v0.9.0採用記録](https://github.com/nkkmd/bao-nakakamado/blob/main/doc/NYAKUA_V090_ADOPTION_20261007.md)・[v0.10.0実装記録](https://github.com/nkkmd/bao-nakakamado/blob/main/doc/TAKASIA_V010_IMPLEMENTATION_20261009.md)を参照してください。

## 起動・配布

index.htmlをブラウザーで開くか、このフォルダーを静的サイトとして配信してください。2人対戦・簡易コンピューター、着手アニメーション、サウンド、高速表示、棋譜JSON保存に対応します。探索コンピューターは後続工程です。

```sh
cd prototype
python3 -m http.server 8000
```

配布ZIPは次の13ファイルを直下に置きます。旧探索モデル・Workerは同梱しません。

```text
index.html
app.js
style.css
end-pit-engine.js
end-pit-rules.js
rules.html
RULEBOOK.md
README.md
licenses.html
LICENSE
LICENSE-CC-BY-SA-4.0.txt
ENGINE_LICENSE.txt
manifest.json
```

プログラム・画面構造はMIT、説明文はCC BY-SA 4.0。元資料・変更内容は[ライセンス案内](licenses.html)に記載し、ルートと同一の条文を同梱します。実際のサイト配信日・URLは未記録です。配信確認後に[変更履歴](https://github.com/nkkmd/bao-nakakamado/blob/main/doc/ORIGIN_AND_HISTORY.md)へ追記してください。

## 現行規則と棋譜

4列32穴、各人の初期ハンド22個、合計64個。NYAKUAはNAMUAの通常処理完了後、捕獲2回以上・自分のハンド1個以上・相手2個以上なら、双方から1個ずつ終点へ追加します。一手に一度、追加後の再判定なし。相手最後の1個を保護し、即時終局・安全停止では追加しません。別確保・次手3個投入は使いません。

takasiaはMTAJIのtakata終了後に原型Bao la Kiswahiliと同じ条件で判定します。防御側に初回捕獲手がなく、攻撃側の初回捕獲対象が異なる穴として1穴だけで、例外に該当しないとき、防御側の次の1手にだけ対象穴を設定します。対象穴からtakataを開始できません。種まき途中で通過する場合は通常どおり1個置いて続行し、最後の1個が対象穴へ入った場合はそこでrelay sowingを停止します。制約はその1手で失効し、その手自身が新しいtakasiaを成立させた場合だけ反対側へ新しい対象を設定します。

読み込み順はend-pit-engine.js → end-pit-rules.js → app.jsです。簡易コンピューターは現行遷移による一手後評価を使うため、takasiaの合法手制約・停止を同じエンジンで処理します。takasia成立局面には小さい評価加点を行います。旧next-turn-engine.js・steal.js・探索モジュールは過去条件の再現用に保持し、現行画面では読み込みません。

棋譜formatはbao-nakakamado-prototype、version 9、rulesVersion 0.10.0、variantRule takasia-namua-end-pit-two-protect-last-two-row-ring-hand22、publicAdopted true、baseRulesRevision BAO-RULES-V0.2.0-TAKASIA-001です。各手にtakasiaBefore・takasiaAfterを記録し、最終局面にもtakasia状態を保持します。旧v0.9.0棋譜version 8以前を現行棋譜として受理せず、旧棋譜へtakasiaを自動適用しません。

循環時はadjudication safety-stop・outcome.winner nullで通常勝敗と区別し、再現用のfinal.winnerはエンジン内部値を保持します。

## 検証・保存版

```sh
node --test prototype/takasia.test.cjs
node tools/end-pit-live-check.cjs /tmp/end-pit-results.json
# 開発用Playwright・Chromiumがある環境
node tools/end-pit-browser-check.cjs
python3 tools/package-v010.py /tmp/bao-v010
```

E30固定局面でtakasia成立・開始穴禁止・relay停止・1手失効を確認し、NYAKUAの既存研究用実装との物理遷移比較、総数保存、棋譜再構築、既知循環を継続確認します。実ブラウザーではデスクトップと320/390/432px、takasia対象表示、簡易AIの先後、棋譜保存、説明とライセンスを確認します。旧v0.8.0の画面テスト・探索AIテストは原bytesのtrials/v0.8.0/を対象に継続します。

旧公開版・学習済みAIは[保存フォルダー](https://github.com/nkkmd/bao-nakakamado/tree/main/trials/v0.8.0)と保存ブランチpreserve/v0.8.0-public-20261007に保持しています。研究・モデル・原棋譜の数値を新規則へ書き換えません。v0.9.0の採用記録も当時の仕様として保持します。
