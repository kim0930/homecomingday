/**
 * 건축공학인의 밤 API (Google Apps Script)
 *
 * - 참석 회신 / 집계
 * - 행사 안내·식순 콘텐츠
 * - 관리자 저장·명단 내보내기
 *
 * 배포 후 docs/rsvp-config.js 의 API_URL 에 웹 앱 URL 을 넣으세요.
 * Code.gs 를 수정하면 반드시 새 버전으로 다시 배포하세요.
 */

var NOTIFY_EMAIL = "";
var ADMIN_PASSWORD = "029706537";
var SHEET_NAME = "RSVPs";
var CONTENT_SHEET = "Content";
var PROGRAM_SHEET = "Program";

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

var DEFAULT_CONTENT = {
  date: "2026년 11월 11일 (수)",
  time: "18:00",
  place: "100주년기념관 3층 목산갤러리",
  campus: "서울과학기술대학교",
  audience: "건축공학전공, 건축기계설비공학과, 스마트시티공학과 재학생·동문·교직원",
  sponsors: "건축기계설비공학과, 스마트시티공학과, 계룡건설, 태영건설, 아이티엠건축사사무소, 동해종합기술공사",
  meal: "뷔페",
  benefit: "현장에 참여한 학생에게 EPiC 점수 100점",
  raffle: "에어팟, 스피커, 쿠폰 등",
  contact: "02-970-6551",
  map_url: "https://map.naver.com/p/search/서울과학기술대학교%20100주년기념관",
  note: "상세 일정은 추후 업데이트 예정이며 일정이 변경될 수 있습니다.",
  invite_title: "시간을 넘어 함께, 건축공학의 인연을 다시 만나다.",
  invite_body:
    "건축공학전공의 발전을 위해 늘 관심과 성원을 보내주시는 동문 여러분께 뜻깊은 만남의 자리를 준비하고 있습니다. 바쁘시더라도 참석하셔서 자리를 빛내주시길 부탁드립니다.",
};

var DEFAULT_PROGRAM = [
  { title: "우수 작품 전시회", remark: ["학술대회 수상자"] },
  { title: "참석자 등록 및 기념품 배부", remark: [] },
  { title: "뷔페 식사", remark: [] },
  { title: "개회사 및 축사", remark: [] },
  { title: "교직원 및 내·외빈 소개", remark: ["사회자"] },
  { title: "전공동아리 및 연구실 소개", remark: [] },
  {
    title: "졸업작품 우수 시상 및 장학금 수여",
    remark: [
      "캡스톤디자인(졸업작품), 공과대학 학술발표대회",
      "지건 홍상일 동문, 대한전문건설협회, 덕신EPC",
    ],
  },
  { title: "학생회 활동 보고", remark: ["제41대 깐따삐아 학생회"] },
  { title: "Cross-Year 활동 보고", remark: [] },
  { title: "북경 냉동공조 엑스포 참관기", remark: ["건축기계설비공학과"] },
  { title: "부대행사", remark: ["경품 및 추첨 퀴즈 행사 (에어팟, 스피커, 쿠폰 등)"] },
  { title: "폐회", remark: [] },
];

function doGet(e) {
  var action = param_(e, "action") || "stats";
  try {
    if (action === "content") {
      return json_({ ok: true, content: getContent_(), program: getProgram_() });
    }
    if (action === "export") {
      if (!checkPassword_(param_(e, "password"))) {
        return json_({ ok: false, error: "비밀번호가 맞지 않습니다." });
      }
      return json_({ ok: true, rows: listRsvps_(), headers: HEADERS.slice(0, 12) });
    }
    if (action === "admin_ping") {
      if (!checkPassword_(param_(e, "password"))) {
        return json_({ ok: false, error: "비밀번호가 맞지 않습니다." });
      }
      return json_({
        ok: true,
        stats: stats_(),
        content: getContent_(),
        program: getProgram_(),
      });
    }
    return json_(stats_());
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);
    var action = data.action || "rsvp";

    if (action === "admin_login") {
      if (!checkPassword_(data.password)) {
        return json_({ ok: false, error: "비밀번호가 맞지 않습니다." });
      }
      return json_({
        ok: true,
        stats: stats_(),
        content: getContent_(),
        program: getProgram_(),
      });
    }

    if (action === "admin_save_content") {
      if (!checkPassword_(data.password)) {
        return json_({ ok: false, error: "비밀번호가 맞지 않습니다." });
      }
      saveContent_(data.content || {});
      saveProgram_(data.program || []);
      return json_({
        ok: true,
        content: getContent_(),
        program: getProgram_(),
      });
    }

    if (action === "admin_list") {
      if (!checkPassword_(data.password)) {
        return json_({ ok: false, error: "비밀번호가 맞지 않습니다." });
      }
      return json_({
        ok: true,
        stats: stats_(),
        rows: listRsvps_(),
      });
    }

    if (String(action).indexOf("admin_") === 0) {
      return json_({
        ok: false,
        error: "지원하지 않는 관리자 요청입니다. Code.gs를 최신으로 다시 배포해 주세요.",
      });
    }

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

function param_(e, key) {
  return e && e.parameter && e.parameter[key] != null ? String(e.parameter[key]) : "";
}

function checkPassword_(password) {
  return String(password || "") === String(ADMIN_PASSWORD || "");
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

function contentSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONTENT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONTENT_SHEET);
    sheet.appendRow(["key", "value"]);
    Object.keys(DEFAULT_CONTENT).forEach(function (key) {
      sheet.appendRow([key, DEFAULT_CONTENT[key]]);
    });
  } else if (sheet.getLastRow() < 2) {
    Object.keys(DEFAULT_CONTENT).forEach(function (key) {
      sheet.appendRow([key, DEFAULT_CONTENT[key]]);
    });
  }
  return sheet;
}

function programSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PROGRAM_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PROGRAM_SHEET);
    sheet.appendRow(["order", "title", "remark"]);
    DEFAULT_PROGRAM.forEach(function (item, index) {
      sheet.appendRow([index + 1, item.title, (item.remark || []).join("\n")]);
    });
  } else if (sheet.getLastRow() < 2) {
    DEFAULT_PROGRAM.forEach(function (item, index) {
      sheet.appendRow([index + 1, item.title, (item.remark || []).join("\n")]);
    });
  }
  return sheet;
}

function getContent_() {
  var sheet = contentSheet_();
  var values = sheet.getDataRange().getValues();
  var content = {};
  Object.keys(DEFAULT_CONTENT).forEach(function (key) {
    content[key] = DEFAULT_CONTENT[key];
  });
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][0] || "").trim();
    if (key) content[key] = String(values[i][1] == null ? "" : values[i][1]);
  }
  return content;
}

function saveContent_(incoming) {
  var sheet = contentSheet_();
  sheet.clearContents();
  sheet.appendRow(["key", "value"]);
  var merged = {};
  Object.keys(DEFAULT_CONTENT).forEach(function (key) {
    merged[key] = DEFAULT_CONTENT[key];
  });
  Object.keys(incoming || {}).forEach(function (key) {
    merged[key] = String(incoming[key] == null ? "" : incoming[key]);
  });
  Object.keys(merged).forEach(function (key) {
    sheet.appendRow([key, merged[key]]);
  });
}

function getProgram_() {
  var sheet = programSheet_();
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var title = String(values[i][1] || "").trim();
    if (!title) continue;
    var remarkRaw = String(values[i][2] == null ? "" : values[i][2]);
    var remark = remarkRaw
      ? remarkRaw.split(/\r?\n/).map(function (line) {
          return line.trim();
        }).filter(Boolean)
      : [];
    rows.push({
      order: Number(values[i][0]) || rows.length + 1,
      title: title,
      remark: remark,
    });
  }
  rows.sort(function (a, b) {
    return a.order - b.order;
  });
  if (!rows.length) return DEFAULT_PROGRAM.slice();
  return rows.map(function (row) {
    return { title: row.title, remark: row.remark };
  });
}

function saveProgram_(program) {
  var sheet = programSheet_();
  sheet.clearContents();
  sheet.appendRow(["order", "title", "remark"]);
  (program || []).forEach(function (item, index) {
    var title = String((item && item.title) || "").trim();
    if (!title) return;
    var remark = item.remark;
    if (Object.prototype.toString.call(remark) !== "[object Array]") {
      remark = remark ? [String(remark)] : [];
    }
    remark = remark
      .map(function (line) {
        return String(line || "").trim();
      })
      .filter(Boolean);
    sheet.appendRow([index + 1, title, remark.join("\n")]);
  });
}

function listRsvps_() {
  var sheet = sheet_();
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    rows.push({
      updated_at: String(values[i][0] || ""),
      name: String(values[i][1] || ""),
      affiliation: String(values[i][2] || ""),
      student_year: String(values[i][3] || ""),
      grad_year: String(values[i][4] || ""),
      workplace: String(values[i][5] || ""),
      title: String(values[i][6] || ""),
      phone: String(values[i][7] || ""),
      email: String(values[i][8] || ""),
      attendance: String(values[i][9] || ""),
      message: String(values[i][10] || ""),
      consent: String(values[i][11] || ""),
    });
  }
  return rows;
}

function stats_() {
  var sheet = sheet_();
  var values = sheet.getDataRange().getValues();
  var attend = 0;
  var decline = 0;
  var yearCounts = {};
  var other = 0;
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][13] || "");
    if (key === "attend") {
      attend++;
      var yearLabel = String(values[i][3] || "");
      var match = yearLabel.match(/(\d{2})학번/);
      if (match) {
        var year = match[1];
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      } else {
        other++;
      }
    } else if (key === "decline") {
      decline++;
    }
  }
  var byYear = Object.keys(yearCounts)
    .sort(function (a, b) {
      return cohortSortKey_(a) - cohortSortKey_(b);
    })
    .map(function (year) {
      return {
        year: year,
        label: year + "학번",
        people: yearCounts[year],
      };
    });
  return {
    attend: attend,
    decline: decline,
    total: attend + decline,
    by_year: byYear,
    other: other,
  };
}

/** 80~99 → 1980~1999, 00~49 → 2000~2049 */
function cohortSortKey_(year) {
  var value = parseInt(year, 10);
  if (isNaN(value)) return 9999;
  if (value >= 80 && value <= 99) return 1900 + value;
  if (value >= 0 && value < 50) return 2000 + value;
  if (value >= 50 && value <= 79) return 1900 + value;
  return 2000 + value;
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
