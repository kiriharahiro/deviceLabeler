# PC Repairer - Device Manager システム仕様書

> ※ 最新・完全版の日本語仕様書は [仕様書：PC修理デバイス管理システム.md](file:///g:/共有ドライブ/KiriPlayPark/Tool/Antigravity/kiriplaypark-projects/KiriPlayPark/PcRepairer/仕様書：PC修理デバイス管理システム.md) および [操作手順書：PC修理デバイス管理システム.md](file:///g:/共有ドライブ/KiriPlayPark/Tool/Antigravity/kiriplaypark-projects/KiriPlayPark/PcRepairer/操作手順書：PC修理デバイス管理システム.md) をご参照ください。

## 1. システム概要
PC Repairerのデバイス管理業務において、スマートフォンのカメラ/写真読取/手入力を用いてQRコード・端末情報を読み取り、スプレッドシートへのデータ一括記録とBrother製ラベルプリンターへの印刷を連携して行うWebアプリケーションシステム。

## 2. システム構成
- **フロントエンド:** `index.html` (Vanilla JS / Glassmorphism UI)
  - QR読み取りライブラリ: `html5-qrcode@2.3.8` (動的qrbox、フォールバック、ミラー反転)
  - マルチモーダルフィードバック: Web Audio API 電子音 ＆ Vibration API
- **バックエンド:** Google Apps Script (`code.gs`)
  - マスター管理スプレッドシート（ID: `1nRrNfpDFNNoTeieRHUBCUrnOzlgXmvObA-atewPhi4o`）
  - LockService 排他制御による一括データ更新
- **プリンター:** Brother QL-820NWB (Wi-Fi/有線LAN接続)

---

## 3. 業務フローと画面遷移

### フェーズ1: 初期設定・作業開始
1. スマホのブラウザでアプリ（index.html）を開く。
2. スプレッドシートから自動ロードされた**顧客**（例: 久喜市・加須市）を選択すると、対応する**サイトコード**（例: CRB_01, CRB_02）がプルダウンに展開され、選択する。
   ※ 選択した顧客・サイトコードはスマホのLocal Storageに保存され、次回以降自動選択される。
3. 「作業開始」ボタンを押下。
4. **GAS通信 (Action: start):** 
   - GASがマスター管理シートを参照し、対象の顧客・サイトの「最終受注番号」「本日の最終ロット追番」を取得。
   - また、「設定表」シートから「故障部位」マスター一覧を取得してアプリへ返却。
   - 取得した情報をアプリへ保持し、カメラ画面へ遷移する。

### フェーズ2: スキャン・手入力作業
- **カメラ起動:**
   - 自動起動するデフォルトカメラは**背面カメラ (environment)** とする。
1. **QRコード読み取り成功時:** 
   - QRコード（18桁）を読み取る。
   - **パースルール:** 
     - 先頭8桁 ＝ S/N (大文字化)
     - 後半10桁 ＝ MO (大文字化)
   - 読み取り成功後、自動的に「手入力画面」へ遷移する。
   - 読み取ったS/Nを大文字で自動代入した状態にし、続けて **Device ID** と **故障部位** の入力を促す。（この時、**カーソル位置は Device ID** にセットする）
2. **QRコード読み取り失敗時・未読取時（手入力）:** 
   - 読めない場合は手動で「手入力画面」へ遷移し、**S/N**、**Device ID**、**故障部位** すべての入力を促す。（この時、**カーソル位置は S/N のまま**とする）
   - 各入力項目の仕様：
     - **S/N:** 小文字入力時も自動で大文字へ変換。先頭に自動で **"PF"** を付与（MOは空欄）。
     - **Device ID:** 顧客ごとに固定値を表示し、数値のみを入力。
       - 久喜市: `"S25-"` ＋ 5桁数値 （例: `S25-12345`）
       - 加須市: `"Kazoedu"` ＋ 4桁数値 （例: `Kazoedu1234`）
     - **故障部位:** 「設定表」シートに記載の故障部位列から取得したデータを**チェックボックスで複数選択**（複合故障に対応。複数選択時はカンマ区切りで記録）。
3. **採番と印字（ローカル処理）:**
   - 読み取り・入力のたびに、アプリ内で追番をカウントアップして採番する。
     - **受注ロットシーケンス番号:** `YYYYMMDD` - `サイトコード` - `追番(3桁)` （例: 20261001-CRB_01-001）
     - **受注番号:** `サイトコード` - `基本番号` （例: CRB_01-1001）
   - 番号生成後、即座にBrotherプリンターへ印刷データを送信し、画面の「処理済みリスト」に追加する。

### フェーズ3: 作業終了（一括データ更新）
1. ユーザーが「すべての更新を終えて終了」ボタンを押下。
2. **GAS通信 (Action: finish):**
   - 溜まったデータ配列と、最終的な「受注番号」「ロット追番」をGASへ送信。
   - GASは対象の顧客用スプレッドシートを開き、データを一括で追記する。
   - その後、マスター管理シートの最終番号を最新のものに更新（上書き）する。
   - 処理中の競合を防ぐため、GAS内では `LockService` による排他制御を行う。

---

## 4. スプレッドシート設計

本システムでは、すべてのルーティングやマスター設定を管理する「マスター管理スプレッドシート」と、実際のデータが蓄積される「顧客別データシート」の2層構造とする。

### 4.1 マスター管理スプレッドシート（ID: `1nRrNfpDFNNoTeieRHUBCUrnOzlgXmvObA-atewPhi4o`）
#### (1) 管理シート (シート名: 管理)
各サイトの最終番号と書き込み先IDを管理する。

| A列 (顧客) | B列 (サイトコード) | C列 (対象スプレッドシートID) | D列 (最終受注番号) | E列 (最終作業日) | F列 (最終ロット追番) | G列 (対象スプレッドシートURL) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 久喜市 | CRB_01 | `1NK16a3wgknR2bj2rNmHd8aJobcBQGuxLYepYLHgJGuk` | 1000 | 2026/10/01 | 0 | `https://docs.google.com/...` |
| 久喜市 | CRB_02 | `1nJcwlBFyU9toT4Mwv4mE0oZixWOUuc_JM73cbHGbzgmo` | 3000 | 2026/10/01 | 0 | `https://docs.google.com/...` |
| 加須市 | CRB_01 | `1ePdQ4bl07cnvEmWXy7lnR1u-Jnrs-NA1EHKeqBpOzHw` | 1000 | 2026/10/01 | 0 | `https://docs.google.com/...` |
| 加須市 | CRB_02 | `1nz9BNMFYzj2A_TKfavb_ryRLoQHspeQ_HXp6aGsIYbk` | 3000 | 2026/10/01 | 0 | `https://docs.google.com/...` |

#### (2) 設定表シート (シート名: 設定表)
手入力時の故障部位選択肢（チェックボックス用マスター）を管理する。A列のデータがアプリへ動的配信される。

| A列 (故障部位マスター) | B列 | C列 (故障部位マスター) | D列 (分類) |
| :--- | :--- | :--- | :--- |
| 01_LCD破損 | | 01 LCD破損 | 10 |
| 02_LDCはずれ | | 02 LDCはずれ | 14 |
| 03_タッチスクリーン不良 | | 03 タッチスクリーン不良 | 18 |
| 04_LCD色調異常 | | 04 LCD色調異常 | 22 |
| 05_画像間欠異常 | | 05 画像間欠異常 | 26 |
| 06_画像写らず | | 06 画像写らず | 30 |
| ... | | ... | ... |

### 4.2 顧客別スプレッドシート（データ記録用・明細出力用）
作業終了時にGASから送られてきたデータが追記されるシート。

| A列 (Timestamp) | B列 (受注ロットシーケンス番号) | C列 (受注番号) | D列 (QR Data) | E列 (S/N) | F列 (MO) | G列 (DeviceId) | H列 (申告症状) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `2026/10/01 15:05:27` | `20261001-CRB_01-001` | `CRB_01-1001` | `123456789012345678` | `12345678` | `9012345678` | | |
| `2026/10/01 15:06:10` | `20261001-CRB_01-002` | `CRB_01-1002` | | `PF12345` | | `S25-12345` | `液晶パネル, キーボード` |

---

## 5. GAS実装サンプル (コード.gs)

```javascript
// ==========================================
// PC Repairer バックエンド (GAS)
// ==========================================

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settings = getMasterSettings(ss);
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "PC Repairer GAS Web App is running.",
      data: settings
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10秒待機
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ==========================================
    // 0. 初期設定取得 (Action: init)
    // ==========================================
    if (data.action === "init") {
      const settings = getMasterSettings(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: settings
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 1. 作業開始時 (Action: start)
    // ==========================================
    if (data.action === "start") {
      const sheet = ss.getSheetByName("管理");
      const values = sheet.getDataRange().getValues();
      const todayStr = Utilities.formatDate(new Date(), "JST", "yyyyMMdd");

      let lastOrderCount = 0;
      let lastLotCount = 0;

      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === data.customer && values[i][1] === data.siteCode) {
          lastOrderCount = Number(values[i][3]) || 0;
          
          // 日付の比較（Date型または文字列型 'YYYY/MM/DD', 'YYYYMMDD' に対応）
          let lastDateStr = "";
          if (values[i][4] instanceof Date) {
            lastDateStr = Utilities.formatDate(values[i][4], "JST", "yyyyMMdd");
          } else if (values[i][4]) {
            lastDateStr = String(values[i][4]).replace(/[\/\-]/g, "").trim();
          }

          lastLotCount = (lastDateStr === todayStr) ? (Number(values[i][5]) || 0) : 0;
          break;
        }
      }

      // マスター設定もあわせて返却
      const settings = getMasterSettings(ss);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: {
          dateString: todayStr,
          lastOrderCount: lastOrderCount,
          lastLotCount: lastLotCount,
          customers: settings.customers,
          siteCodes: settings.siteCodes,
          failureParts: settings.failureParts,
          printerIp: settings.printerIp
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 2. 作業終了・一括更新時 (Action: finish)
    // ==========================================
    if (data.action === "finish") {
      const adminSheet = ss.getSheetByName("管理");
      const adminValues = adminSheet.getDataRange().getValues();
      let targetSpreadsheetId = "";
      let targetRowIndex = -1;

      for (let i = 1; i < adminValues.length; i++) {
        if (adminValues[i][0] === data.customer && adminValues[i][1] === data.siteCode) {
          targetSpreadsheetId = adminValues[i][2];
          targetRowIndex = i + 1;
          break;
        }
      }

      if (!targetSpreadsheetId) {
        throw new Error("対象の顧客・サイトが見つかりません: " + data.customer + " / " + data.siteCode);
      }

      // 顧客別明細スプレッドシートへのデータ追記 (A〜H列)
      const targetSs = SpreadsheetApp.openById(targetSpreadsheetId);
      const targetSheet = targetSs.getSheets()[0];
      const appendRows = data.records.map(r => [
        r.timestamp || Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss"), // A列: Timestamp
        r.lotSeqNumber,  // B列: 受注ロットシーケンス番号
        r.orderNumber,   // C列: 受注番号
        r.qrData || "",  // D列: QR Data
        r.sn,            // E列: S/N
        r.mo || "",      // F列: MO
        r.deviceId || "",// G列: DeviceId
        r.symptom || ""  // H列: 申告症状
      ]);

      if (appendRows.length > 0) {
        targetSheet.getRange(targetSheet.getLastRow() + 1, 1, appendRows.length, appendRows[0].length).setValues(appendRows);
      }

      // 管理シートの最終番号を更新 (D列: 最終受注番号, E列: 最終作業日, F列: 最終ロット追番)
      const todayStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd");
      adminSheet.getRange(targetRowIndex, 4).setValue(data.finalOrderCount);
      adminSheet.getRange(targetRowIndex, 5).setValue(todayStr);
      adminSheet.getRange(targetRowIndex, 6).setValue(data.finalLotCount);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "更新完了"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// スプレッドシートからマスター設定を読み込む共通関数
// ==========================================
function getMasterSettings(ss) {
  // 1. 「管理」シートから顧客名リスト・サイトコードリストを抽出
  const adminSheet = ss.getSheetByName("管理");
  const adminValues = adminSheet ? adminSheet.getDataRange().getValues() : [];
  const customerSet = new Set();
  const siteCodeSet = new Set();

  for (let i = 1; i < adminValues.length; i++) {
    const cust = String(adminValues[i][0] || "").trim();
    const site = String(adminValues[i][1] || "").trim();
    if (cust) customerSet.add(cust);
    if (site) siteCodeSet.add(site);
  }

  // 2. 「設定表」シートから故障部位マスターおよび各種設定を取得
  const configSheet = ss.getSheetByName("設定表");
  let failureParts = [];
  let printerIp = "192.168.11.50"; // デフォルト値

  if (configSheet) {
    const lastRow = configSheet.getLastRow();
    // A列: 故障部位マスター
    if (lastRow >= 2) {
      const partsRange = configSheet.getRange("A2:A" + lastRow).getValues();
      failureParts = partsRange
        .map(row => String(row[0] || "").trim())
        .filter(val => val !== "" && val !== "undefined");
    }

    // F列・G列等に設定キー＆値がある場合（例: F列「PRINTER_IP」, G列「192.168.1.100」）
    const allConfigValues = configSheet.getDataRange().getValues();
    for (let r = 0; r < allConfigValues.length; r++) {
      for (let c = 0; c < allConfigValues[r].length; c++) {
        const cellVal = String(allConfigValues[r][c] || "").trim();
        if (cellVal.toUpperCase() === "PRINTER_IP" && allConfigValues[r][c + 1]) {
          printerIp = String(allConfigValues[r][c + 1]).trim();
        }
      }
    }
  }

    return {
    customers: Array.from(customerSet),
    siteCodes: Array.from(siteCodeSet),
    failureParts: failureParts,
    printerIp: printerIp
  };
}
```

---

## 6. 今後の残タスク
- [ ] 各種スプレッドシート（マスター管理：管理・設定表、顧客別）の作成と設定。
- [ ] GAS（コード.gs）のデプロイとURLの発行、`index.html` へのURL設定。
- [ ] Brother QL-820NWB への具体的な印刷コマンド（HTTP POST / b-PAC / ESC/P等）の組み込み。


