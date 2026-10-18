# 調査018の研究用基盤

コードはMIT。公開ルール・AIと旧固定ソースを変更せず、7左から全2応手・4方針組合せ・3予算を比較する。

- `pilot.cjs pair` は正式とは別domainの運用計測。`collect` と `verify` は原bytesの通常再生だけ。
- `freeze.cjs` は試走48局と事前監査のreceiptを照合して初回のみmanifestを生成し、既存sealは変更しない。
- `study.cjs manifest` と `aggregate` は読取り専用。`shard` は完成pairを再利用し、startedだけの未完pairはHOLD。
- `reaudit.py` はGit blob・原SHA・通常再生・summary bytesを独立照合し、新規対局・証明探索をしない。

正式起動は封印・PR検証後の固定commitのみ。試走は正式標本に合算しない。
