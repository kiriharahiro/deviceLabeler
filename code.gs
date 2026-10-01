// ==========================================
// PC Repairer バックエンド (GAS)
// ==========================================

// Webアプリ表示 または GET API リクエスト時
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  // action パラメータがある場合、または mode=json の場合は JSON API として応答
  if (params.action || params.mode === "json") {
    try {
      const result = handleApiRequest(params);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // それ以外（ブラウザで直接URLを開いた場合など）は HTML を配信
  try {
    return HtmlService.createHtmlOutputFromFile("index")
      .setTitle("PC Repairer - Device Manager")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "PC Repairer GAS Web App is running.",
      data: getMasterSettings(ss)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 外部 fetch からの POST 通信
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = JSON.parse(e.postData.contents);
    const result = handleApiRequest(data);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// google.script.run から直接呼び出せるAPI関数群
// ==========================================
function apiInit() {
  return handleApiRequest({ action: "init" });
}

function apiStart(params) {
  return handleApiRequest({ action: "start", customer: params.customer, siteCode: params.siteCode });
}

function apiFinish(params) {
  return handleApiRequest({
    action: "finish",
    customer: params.customer,
    siteCode: params.siteCode,
    finalOrderCount: params.finalOrderCount,
    finalLotCount: params.finalLotCount,
    records: params.records
  });
}

// ==========================================
// 共通ロジック処理
// ==========================================
function handleApiRequest(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 0. 初期化
  if (data.action === "init") {
    return { status: "success", data: getMasterSettings(ss) };
  }

  // 1. 作業開始
  if (data.action === "start") {
    const sheet = ss.getSheetByName("管理");
    const values = sheet.getDataRange().getValues();
    const todayStr = Utilities.formatDate(new Date(), "JST", "yyyyMMdd");

    let lastOrderCount = 0;
    let lastLotCount = 0;

    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.customer && values[i][1] === data.siteCode) {
        lastOrderCount = Number(values[i][3]) || 0;
        
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

    const settings = getMasterSettings(ss);

    return {
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
    };
  }

  // 2. 作業終了
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

    const targetSs = SpreadsheetApp.openById(targetSpreadsheetId);
    const targetSheet = targetSs.getSheets()[0];
    const appendRows = data.records.map(r => [
      r.timestamp || Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss"),
      r.lotSeqNumber,
      r.orderNumber,
      r.qrData || "",
      r.sn,
      r.mo || "",
      r.deviceId || "",
      r.symptom || ""
    ]);

    if (appendRows.length > 0) {
      targetSheet.getRange(targetSheet.getLastRow() + 1, 1, appendRows.length, appendRows[0].length).setValues(appendRows);
    }

    const todayStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd");
    adminSheet.getRange(targetRowIndex, 4).setValue(data.finalOrderCount);
    adminSheet.getRange(targetRowIndex, 5).setValue(todayStr);
    adminSheet.getRange(targetRowIndex, 6).setValue(data.finalLotCount);

    return { status: "success", message: "更新完了" };
  }

  return { status: "error", message: "Invalid action" };
}

// ==========================================
// スプレッドシートからマスター設定を読み込む共通関数
// ==========================================
function getMasterSettings(ss) {
  // 1. 「管理」シートから顧客名リスト・サイトコードリスト・顧客別サイトコードマップを抽出
  const adminSheet = ss.getSheetByName("管理");
  const adminValues = adminSheet ? adminSheet.getDataRange().getValues() : [];
  const customerSet = new Set();
  const siteCodeSet = new Set();
  const customerSiteMap = {}; // { "久喜市": ["CRB_01", "CRB_02"], "加須市": ["CRB_01", "CRB_02"] }

  for (let i = 1; i < adminValues.length; i++) {
    const cust = String(adminValues[i][0] || "").trim();
    const site = String(adminValues[i][1] || "").trim();
    if (cust) {
      customerSet.add(cust);
      if (!customerSiteMap[cust]) customerSiteMap[cust] = [];
      if (site && !customerSiteMap[cust].includes(site)) {
        customerSiteMap[cust].push(site);
      }
    }
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

    // 設定表シート内に「PRINTER_IP」の記述があればその右隣の値を採用
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
    customerSiteMap: customerSiteMap,
    failureParts: failureParts,
    printerIp: printerIp
  };
}
