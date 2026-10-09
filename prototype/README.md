# Bao Nakakamado：遊べる試作v0.10.0

Bao la Kiswahiliをベースに独自ルールNYAKUAを採用したオリジナルのBaoです。v0.10.0では、原型側で正式採用されたtakasiaも基礎規則として採用しました。Bao Nakakamado・NYAKUAの考案者nkkmd、初公開日2026年9月30日を保持します。[ルールブック](RULEBOOK.md)・[v0.9.0採用記録](https://github.com/nkkmd/bao-nakakamado/blob/main/doc/NYAKUA_V090_ADOPTION_20261007.md)・[v0.10.0実装記録](https://github.com/nkkmd/bao-nakakamado/blob/main/doc/TAKASIA_V010_IMPLEMENTATION_20261009.md)を参照してください。

## 起動・配布

index.htmlをブラウザーで開くか、このフォルダーを静的サイトとして配信してください。2人対戦・簡易コンピューター・探索コンピューター、着手アニメーション、サウンド、高速表示、棋譜JSON保存に対応します。独立512局比較・ブラウザー検証と管理者の実機確認報告を経て探索方式を正式採用しました。既定は探索・強い（150ms）です。

```sh
cd prototype
python3 -m http.server 8000
```

配布ZIPは次の19ファイルを直下に置きます。現行v0.10.0専用Workerを同梱し、旧探索モデル・旧Workerは同梱しません。

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
end-pit-search-transition.js
end-pit-simple-ai.js
end-pit-computer-client.js
end-pit-computer-worker.js
end-pit-search-ai.js
end-pit-search-evaluator.js
manifest.json
```

プログラム・画面構造はMIT、説明文はCC BY-SA 4.0。元資料・変更内容は[ライセンス案内](licenses.html)に記載し、ルートと同一の条文を同梱します。実際のサイト配信日・URLは未記録です。配信確認後に[変更履歴](https://github.com/nkkmd/bao-nakakamado/blob/main/doc/ORIGIN_AND_HISTORY.md)へ追記してください。

## 現行規則と棋譜

4列32穴、各人の初期ハンド22個、合計64個。NYAKUAはNAMUAの通常処理完了後、捕獲2回以上・自分のハンド1個以上・相手2個以上なら、双方から1個ずつ終点へ追加します。一手に一度、追加後の再判定なし。相手最後の1個を保護し、即時終局・安全停止では追加しません。別確保・次手3個投入は使いません。

takasiaはMTAJIのtakata終了後に原型Bao la Kiswahiliと同じ条件で判定します。防御側に初回捕獲手がなく、攻撃側の初回捕獲対象が異なる穴として1穴だけで、例外に該当しないとき、防御側の次の1手にだけ対象穴を設定します。対象穴からtakataを開始できません。種まき途中で通過する場合は通常どおり1個置いて続行し、最後の1個が対象穴へ入った場合はそこでrelay sowingを停止します。制約はその1手で失効し、その手自身が新しいtakasiaを成立させた場合だけ反対側へ新しい対象を設定します。

読み込み順はend-pit-engine.js → end-pit-rules.js → end-pit-search-transition.js → end-pit-simple-ai.js → end-pit-computer-client.js → app.jsです。Worker内で現行探索・手作り評価器を読み込みます。簡易コンピューターは現行遷移による一手後評価を使うため、takasiaの合法手制約・停止を同じエンジンで処理します。takasia成立局面には小さい評価加点を行います。旧next-turn-engine.js・steal.js・探索モジュールは過去条件の再現用に保持し、現行画面では読み込みません。

棋譜formatはbao-nakakamado-prototype、version 9、rulesVersion 0.10.0、variantRule takasia-namua-end-pit-two-protect-last-two-row-ring-hand22、publicAdopted true、baseRulesRevision BAO-RULES-V0.2.0-TAKASIA-001です。各手にtakasiaBefore・takasiaAfterを記録し、最終局面にもtakasia状態を保持します。旧v0.9.0棋譜version 8以前を現行棋譜として受理せず、旧棋譜へtakasiaを自動適用しません。

循環時はadjudication safety-stop・outcome.winner nullで通常勝敗と区別し、再現用のfinal.winnerはエンジン内部値を保持します。

## 検証・保存版

```sh
node --test prototype/takasia.test.cjs
node tools/end-pit-live-check.cjs /tmp/end-pit-results.json
# 開発用Playwright・Chromiumがある環境
node tools/end-pit-browser-check.cjs
node --test prototype/end-pit-search.test.cjs prototype/end-pit-computer-client.test.cjs prototype/end-pit-app.test.cjs
node tools/end-pit-search-check.cjs /tmp/end-pit-search-check.json
python3 tools/package-v010.py /tmp/bao-v010
```

E30固定局面でtakasia成立・開始穴禁止・relay停止・1手失効を確認し、NYAKUAの既存研究用実装との物理遷移比較、総数保存、棋譜再構築、既知循環を継続確認します。実ブラウザーではデスクトップと320/390/432px、takasia対象表示、簡易AIの先後、棋譜保存、説明とライセンスを確認します。旧v0.8.0の画面テスト・探索AIテストは原bytesのtrials/v0.8.0/を対象に継続します。

旧公開版・学習済みAIは[保存フォルダー](https://github.com/nkkmd/bao-nakakamado/tree/main/trials/v0.8.0)と保存ブランチpreserve/v0.8.0-public-20261007に保持しています。研究・モデル・原棋譜の数値を新規則へ書き換えません。v0.9.0の採用記録も当時の仕様として保持します。

## 探索コンピューター

2026年10月9日、管理者の実機確認報告「問題なさそうです」を受け、現行NYAKUA案A・takasiaに対応する探索コンピューターを正式採用しました。既定は探索コンピューター・強い（150ms）です。2人対戦と簡易コンピューターも選べます。

ルールと棋譜本体の版はv0.10.0／9を維持します。AIはNAKAKAMADO-AI-V010-v1、採用識別子はNAKAKAMADO-AI-V010-RELEASE-001、評価器はNAKAKAMADO-HANDCRAFT-V010-v1、学習済みモデルなし、AIの公開採用状態はtrueです。探索は反復深化・Alpha-Beta・PVS・置換表・捕獲の静止探索を用い、全遷移で現行NYAKUAとtakasiaを処理します。

予算はやさしい25ms／ふつう75ms／強い150ms、最大深度32。独立512局の正式比較は150msで現行簡易AIに対して487勝・25敗でした。25／75msの相対棋力は未確定です。Worker起動・通信を探索予算に含めず、着手計算は協調的な時間制限のため超過し得ます。要求ID・局面key・対局世代・合法variantを照合し、新しい対局でWorkerを終了します。失敗時は現行簡易AIへ代替し、表示と棋譜computer.diagnosticsに理由を記録します。深度0の時間切れ代替は別に記録します。

HTTP localhostまたはHTTPSで利用してください。file URLやWorker/CSP制限で起動できない場合は簡易方式へ代替します。試験AI識別子を持つ既存v0.10.0棋譜も同じ規則で再生できます。検証と採用は[実装記録](https://github.com/nkkmd/bao-nakakamado/blob/main/doc/AI_V010_SEARCH_IMPLEMENTATION_20261009.md)、main統合状態は[PR #34](https://github.com/nkkmd/bao-nakakamado/pull/34)を参照してください。実際のサイト配信日・URLは未記録です。
