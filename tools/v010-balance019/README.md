# 調査019の研究基盤

v0.10.0の早期別合法手・全応手の探索。公開実装と過去の固定ソースを変更しない。
[事前計画](../../doc/V010_BALANCE019_PLAN_20261019.md)の13根・156条件・4交換組を実装する。
3手強制と4手強制、同方針と異方針を別集計し、未終局・深度0をHOLDとする。

`coverage.py` は保存済み原ZIPと入力を読み、座席交換した完全状態・手数を除いた局面・完全経路を別に索引化する。新しい対局・証明探索は行わない。
`study.cjs` の正式入口は、試走監査と封印済みmanifestを必須とする。未完started markerは消さずHOLDとする。
`pilot.cjs` は別seed domainの運用試走専用。各156セル1交換組で、正式成績へ混ぜない。

現時点では正式manifest未封印・正式試験未起動。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../../LICENSE-CC-BY-SA-4.0.txt)。
