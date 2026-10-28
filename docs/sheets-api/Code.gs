/**
 * 건축공학인의 밤 참석 회신 API (Google Apps Script)
 *
 * 설정:
 * 1. 새 Google 스프레드시트를 만듭니다.
 * 2. 확장 프로그램 → Apps Script 에서 이 파일을 붙여 넣습니다.
 * 3. 알림 메일이 필요하면 NOTIFY_EMAIL 에 주소를 넣습니다. (기본값은 비활성)
 * 4. 배포 → 새 배포 → 유형: 웹 앱
 *    - 실행 계정: 나
 *    - 액세스 권한: 모든 사용자
 * 5. 배포된 웹 앱 URL 을 docs/rsvp-config.js 의 API_URL 에 넣습니다.
 */

// 알림 메일을 끄려면 빈 문자열로 두세요. (회신 데이터는 시트에만 저장됩니다.)
var NOTIFY_EMAIL = "";
var SHEET_NAME = "RSVPs";

var AFFILIATIONS = {
  ae_student: "건축공학전공 재학생",
  ae_alumni: "건축공학전공 졸업생",
  me_student: "건축기계설비공학과 재학생",
  me_alumni: "건축기계설비공학과 졸업생",
  sc_student: "스마트시티공학과 재학생",
  sc_alumni: "스마트시티공학과 졸업생",
  faculty: "교직원",
  alumni: "동문",
  other: "기타",
};

var ATTENDANCE = {
  attend: "참석",
  decline: "불참",
};

var HEADERS = [
  "수정시각",
  "이름",
  "소속학과",
  "학번",
  "졸업연도",
  "현직장",
  "직책",
  "연락처",
  "이메일",
  "참석여부",
  "메시지",
  "동의",
  "phone_key",
  "attendance_key",
];

function doGet() {
  return json_(stats_());
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);
    var cleaned = validate_(data);
    if (cleaned.error) {
      return json_({ ok: false, error: cleaned.error, stats: stats_() });
    }
    upsert_(cleaned);
    notify_(cleaned);
    return json_({
      ok: true,
      updated: cleaned.updated,
      attendance: cleaned.attendance_label,
      stats: stats_(),
    });
  } catch (err) {
    return json_({ ok: false, error: String(err), stats: stats_() });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function stats_() {
  var sheet = sheet_();
  var values = sheet.getDataRange().getValues();
  var attend = 0;
  var decline = 0;
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][13] || "");
    if (key === "attend") attend++;
    else if (key === "decline") decline++;
  }
  return { attend: attend, decline: decline, total: attend + decline };
}

function digits_(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatPhone_(digits) {
  if (digits.length === 11) {
    return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
  }
  if (digits.length === 10) {
    return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
  }
  return digits;
}

function validate_(data) {
  if (!data || data.consent !== "yes") {
    return { error: "개인정보 수집·이용에 동의해 주세요." };
  }
  if (!data.attendance || !ATTENDANCE[data.attendance]) {
    return { error: "참석 여부를 선택해 주세요." };
  }
  var name = String(data.name || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name.length > 40 || !/[가-힣A-Za-z]/.test(name)) {
    return { error: "이름을 입력해 주세요." };
  }
  if (!AFFILIATIONS[data.affiliation]) {
    return { error: "소속학과를 선택해 주세요." };
  }
  var studentYear = String(data.student_year || "");
  if (!/^\d{2}$/.test(studentYear)) {
    return { error: "학번을 선택해 주세요." };
  }
  var phoneKey = digits_(data.phone);
  if (!/^0\d{8,10}$/.test(phoneKey)) {
    return { error: "연락처를 숫자로 입력해 주세요." };
  }
  var email = String(data.email || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(email) || email.length > 80) {
    return { error: "이메일 주소를 올바르게 입력해 주세요." };
  }
  var message = String(data.message || "");
  if (message.length > 200) {
    return { error: "메시지는 200자 안으로 입력해 주세요." };
  }
  return {
    name: name,
    affiliation: data.affiliation,
    affiliation_label: AFFILIATIONS[data.affiliation],
    student_year: studentYear,
    student_year_label: studentYear + "학번",
    grad_year: String(data.grad_year || ""),
    grad_year_label: data.grad_year ? String(data.grad_year) + "년 졸업" : "",
    workplace: String(data.workplace || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60),
    title: String(data.title || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40),
    phone_key: phoneKey,
    phone: formatPhone_(phoneKey),
    email: email,
    attendance: data.attendance,
    attendance_label: ATTENDANCE[data.attendance],
    message: message,
    consent: "동의",
  };
}

function upsert_(row) {
  var sheet = sheet_();
  var values = sheet.getDataRange().getValues();
  var stamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm");
  var line = [
    stamp,
    row.name,
    row.affiliation_label,
    row.student_year_label,
    row.grad_year_label,
    row.workplace,
    row.title,
    row.phone,
    row.email,
    row.attendance_label,
    row.message,
    row.consent,
    row.phone_key,
    row.attendance,
  ];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][12]) === row.phone_key) {
      sheet.getRange(i + 1, 1, 1, HEADERS.length).setValues([line]);
      row.updated = true;
      return;
    }
  }
  sheet.appendRow(line);
  row.updated = false;
}

function notify_(row) {
  if (!NOTIFY_EMAIL) return;
  var subject = "[건축공학인의 밤] 참석 회신 · " + row.attendance_label;
  var body = [
    "이름: " + row.name,
    "소속학과: " + row.affiliation_label,
    "학번: " + row.student_year_label,
    "졸업연도: " + (row.grad_year_label || "-"),
    "현직장: " + (row.workplace || "-"),
    "직책: " + (row.title || "-"),
    "연락처: " + row.phone,
    "이메일: " + row.email,
    "참석 여부: " + row.attendance_label,
    "메시지: " + (row.message || "-"),
    "동의: " + row.consent,
    row.updated ? "(동일 연락처 응답 수정)" : "(신규 회신)",
  ].join("\n");
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: subject,
    body: body,
  });
}
