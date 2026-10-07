# Bao Nakakamado：遊べる試作v0.9.0

Bao la Kiswahiliをベースに独自ルールNYAKUAを採用したオリジナルのBaoです。2026年10月7日に案Aを正式採用しました。考案者nkkmd、初公開日2026年9月30日を保持します。[ルールブック](../doc/RULEBOOK.md)・[採用記録](../doc/NYAKUA_V090_ADOPTION_20261007.md)を参照してください。

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

プログラム・画面構造はMIT、説明文はCC BY-SA 4.0。元資料・変更内容は[ライセンス案内](licenses.html)に記載し、ルートと同一の条文を同梱します。実際のサイト配信日・URLは未記録です。配信の確認後に[変更履歴](../doc/ORIGIN_AND_HISTORY.md)へ追記してください。

## 現行規則と棋譜

4列32穴、各人の初期ハンド22個、合計64個。NAMUAの通常処理が完了し、捕獲2回以上・自分のハンド1個以上・相手2個以上なら、双方から1個ずつ終点へ追加します。一手に一度、追加後の再判定なし。相手最後の1個を保護し、即時終局・安全停止では追加しません。別確保・次手3個投入は使いません。

読み込み順はend-pit-engine.js → end-pit-rules.js → app.jsです。簡易AIは現行遷移による一手後の評価を使います。旧next-turn-engine.js・steal.js・探索モジュールは過去条件の再現用に保持し、現行画面では読み込みません。

棋譜formatはbao-nakakamado-prototype、version 8、rulesVersion 0.9.0、variantRule namua-end-pit-two-protect-last-two-row-ring-hand22、publicAdopted true。placedは開始時投入数、capturesは捕獲回数、stolenは相手ハンドから取った数、addedは終点への追加数、ownAdded・opponentAddedは各ハンドから追加した数、endpointは追加先です。nyakuaReserveは互換用の[0,0]、pendingは即時終局時の捕獲保留数。画面での棋譜読み込みは未実装です。

専用replayはv0.8.0棋譜version 7と案A試験棋譜version 1を現行棋譜として受理しません。循環時はadjudication safety-stop・outcome.winner nullで通常勝敗と区別し、再現用のfinal.winnerは元エンジンの内部値を保持します。

## 検証・保存版

```sh
node tools/end-pit-live-check.cjs /tmp/end-pit-results.json
node --test prototype/next-turn.test.cjs prototype/app.test.cjs prototype/search-transition.test.cjs
# 開発用Playwright・Chromiumがある環境
node tools/end-pit-browser-check.cjs
python3 tools/package-v090.py /tmp/bao-v090
```

研究用案Aとの遷移・残数境界・総数保存・棋譜再構築・既知循環を照合します。実ブラウザーでは通常終局と安全停止、デスクトップと320/390/432px、簡易AIの先後、棋譜保存、説明とライセンスを確認します。旧v0.8.0の画面テスト・探索AIテストは原bytesのtrials/v0.8.0/を対象に継続します。

旧公開版・学習済みAIは[保存フォルダー](../trials/v0.8.0/)と保存ブランチpreserve/v0.8.0-public-20261007に保持しています。研究・モデル・原棋譜の数値を新規則へ書き換えません。共通MTAJIの循環、takasia未実装など、元エンジンの実装範囲は引き継ぎます。
