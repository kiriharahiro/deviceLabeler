# deviceLabeler (PC Repairer - Device Manager)

PC修理・受入業務における端末受入管理、QRコード読み取り、写真読取・手入力、自治体別Device IDフォーマット、故障部位マスター選択、Brother製ラベルプリンターへの即時印字、およびGoogleスプレッドシートへの一括記録を連携して行うWebアプリケーションシステムです。

---

## 🌟 主な特徴

1. **自治体（顧客）・サイトコードの動的連動**:
   - スプレッドシートの「管理」シートから、稼働中の顧客（久喜市、加須市 等）および対応サイトコード（CRB_01, CRB_02 等）を自動取得。
2. **高精度QRコード解析 (18桁対応)**:
   - QRコード（18桁）を検知すると、先頭8桁（S/N）と後半10桁（MO）に自動パース。
3. **柔軟な手入力モーダル ＆ 複合故障部位選択**:
   - S/Nへの自動 `PF` 付与、自治体ごとのDevice ID自動フォーマット（久喜市: `S25-` + 5桁 / 加須市: `Kazoedu` + 4桁）、「設定表」シートから動的取得された故障部位マスターをチェックボックスで複数選択可能。
4. **現場に最適化されたカメラシステム (`nfcQrWriter_v01` 準拠)**:
   - `html5-qrcode@2.3.8` 採用、動的 `qrbox` 計算、背面/前面カメラ自動フォールバック、ワンタップ左右反転（ミラー表示）、カメラON/OFFトグル。
5. **マルチ入力フォールバック（写真読取対応）**:
   - 端末標準のカメラアプリで撮影してアップロード解析する「写真読取」を搭載。
6. **音と振動のマルチモーダル演出**:
   - Web Audio API 電子音（ピッ・ピピッ・ブー）とスマホの振動（Vibration API）による作業フィードバック。
7. **連番・受注番号の自動採番**:
   - 受注ロットシーケンス番号: `YYYYMMDD-サイトコード-追番(3桁)` （例: `20261001-CRB_01-001`）
   - 受注番号: `サイトコード-基本番号` （例: `CRB_01-1001`）
8. **Brother QL-820NWB ラベル印刷連携**:
   - 登録完了時にネットワーク経由でラベルプリンターへ即時印字。
9. **排他制御（LockService）による一括データ更新**:
   - 作業終了時にGAS経由で対象顧客スプレッドシートへ全レコードを一括保存。

---

## 📂 フォルダ構成

- **[index.html](file:///g:/共有ドライブ/KiriPlayPark/Tool/Antigravity/kiriplaypark-projects/KiriPlayPark/PcRepairer/index.html)**: アプリケーション画面（Vanilla JS / Glassmorphism UI）
- **[code.gs](file:///g:/共有ドライブ/KiriPlayPark/Tool/Antigravity/kiriplaypark-projects/KiriPlayPark/PcRepairer/code.gs)**: Google Apps Script バックエンド（API / 排他制御 / スプレッドシート連携）
- **[仕様書：PC修理デバイス管理システム.md](file:///g:/共有ドライブ/KiriPlayPark/Tool/Antigravity/kiriplaypark-projects/KiriPlayPark/PcRepairer/仕様書：PC修理デバイス管理システム.md)**: 詳細なシステム設計仕様書
- **[操作手順書：PC修理デバイス管理システム.md](file:///g:/共有ドライブ/KiriPlayPark/Tool/Antigravity/kiriplaypark-projects/KiriPlayPark/PcRepairer/操作手順書：PC修理デバイス管理システム.md)**: 現場スタッフ向けの実務操作マニュアル
- **[System_Specification.md](file:///g:/共有ドライブ/KiriPlayPark/Tool/Antigravity/kiriplaypark-projects/KiriPlayPark/PcRepairer/System_Specification.md)**: システム仕様サマリー

---

## 🚀 デプロイ ＆ 公開手順（GitHub Pages 推奨）

ブラウザのカメラ権限をスムーズに動作させるため、本リポジトリを **GitHub Pages** で公開することを推奨します。

1. **GitHub Pages の有効化**:
   - GitHubリポジトリの **Settings ＞ Pages** を開きます。
   - **Source** で `Deploy from a branch` を選択し、Branch を `main` / `root` に設定して **Save** します。
   - 発行されたURL（`https://kiriharahiro.github.io/deviceLabeler/`）にアクセスすれば、スマホ・PCのカメラが完全に動作します！

2. **GAS（Google Apps Script）の設定**:
   - マスター管理スプレッドシートの **拡張機能 ＞ Apps Script** に `code.gs` を貼り付けます。
   - **デプロイ ＞ 新しいデプロイ** で「ウェブアプリ」を選択し、アクセスできるユーザーを **「全員」** に設定してデプロイします。
   - 発行されたURLを `index.html` の `GAS_URL` に設定します（設定済み）。

---

## 📄 ライセンス

Copyright (c) 2026 KiriPlayPark
