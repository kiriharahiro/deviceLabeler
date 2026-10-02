# Print Relay Server（ラベル印刷サーバー）仕様書およびトラブルシューティング手順書

## 1. システム仕様

### 概要
本システムは、スマートフォンなどの外部端末からネットワーク経由で印刷リクエスト（JSONデータ）を受け取り、Windowsパソコンに接続されたBrother製ラベルプリンターから自動でラベルを発行するための中継サーバーです。

### 構成ファイル・使用技術
* **サーバー本体**: `print_server.ps1` (PowerShellスクリプト)
* **ラベルテンプレート**: `C:\KiriPlayPark\PcRepairLabel.lbx` (P-touch Editor テンプレートファイル)
* **使用ライブラリ**: Brother b-PAC SDK (COMオブジェクト `bpac.Document`)
* **待ち受けポート**: 8080ポート (`http://<PCのIPアドレス>:8080/`)

### 処理の流れ
1. `print_server.ps1` を起動すると、8080ポートでリクエストの待ち受けを開始する。
2. スマホ等からPOSTリクエスト（JSON形式）を受け取る。
3. `C:\KiriPlayPark\PcRepairLabel.lbx` をプログラム裏側で開く。
4. 受け取ったデータ（Lot, SN, ID, 症状など）をテンプレートの各テキスト枠に流し込む。
5. 指定されたプリンター名（例:`Brother QL-820NWB (2 コピー)`）を指定し、印刷を実行する。

---

## 2. 印刷ができない（出ない）場合のトラブルシューティング手順

「黒い画面（サーバー）では `Print SUCCESS` と出るのに、ラベルが印刷されない」という現象が起きた場合の解決手順です。
これは主に **「プリンターのIPアドレス変更などにより、Windows上で同じプリンターが複数（コピー1、コピー2など）作成され、プログラムが迷子になっている」** ことが原因です。

### 手順①：正しいプリンター名の特定（P-touch Editorでの確認）
1. `C:\KiriPlayPark\PcRepairLabel.lbx` をダブルクリックし、**P-touch Editor** を開きます。
2. P-touch Editor の印刷画面を開き、プリンターの選択欄を確認します。
3. リストの中から「現在実際に印刷できるプリンター（例: `Brother QL-820NWB (2 コピー)` や `Brother QL-820NWB - 3` など）」を選び、テスト印刷を行います。
4. 印刷に成功したら、その **プリンターの正確な名前** をメモします。
5. **重要：** P-touch Editor の画面を完全に（×ボタンで）閉じます。画面が開いたままだとプログラムから操作できずエラーになります。

### 手順②：プログラムの修正（プリンター名の強制指定）
プログラムが常に「正しいプリンター」を使うように、コードを書き換えます。

1. `g:\共有ドライブ\KiriPlayPark\Tool\Antigravity\kiriplaypark-projects\KiriPlayPark\PcRepairer\print_server.ps1` をエディタで開きます。
2. **77行目付近** にある `$bpac.SetPrinter` の行を探します。
   ```powershell
   # ↓ P-touch Editorを使わずに、直接プリンターを指定します
   $bpac.SetPrinter("Brother QL-820NWB (2 コピー)", $false) | Out-Null
   ```
3. `"` の中身を、手順①でメモした「正しいプリンター名」に書き換えて、上書き保存（Ctrl + S）します。

### 手順③：サーバーの再起動
1. 起動している黒い画面（Print Relay Server）を選択し、右上の「×」ボタンで閉じます。（または `Ctrl + C` で終了）
2. 再度 `print_server.ps1` を「管理者として実行」などで起動し直します。
3. スマホから再度実行し、ラベルが発行されることを確認してください。
