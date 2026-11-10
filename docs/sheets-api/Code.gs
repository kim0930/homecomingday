/**
 * 건축공학인의 밤 API (Google Apps Script)
 *
 * - 참석 회신 / 집계
 * - 행사 안내·식순 콘텐츠
 * - 관리자 저장·명단 내보내기
 * - 행사 당일 QR 출석(체크인)
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
  "체크인시각",
  "테이블",
];

var COL = {
  updated_at: 0,
  name: 1,
  affiliation: 2,
  student_year: 3,
  grad_year: 4,
  workplace: 5,
  title: 6,
  phone: 7,
  email: 8,
  attendance: 9,
  message: 10,
  consent: 11,
  phone_key: 12,
  attendance_key: 13,
  checked_in_at: 14,
  table_no: 15,
};

var SEATING_BY_NAME = {
  "박범준": 1,
  "성시우": 1,
  "송주연": 1,
  "오민혁": 1,
  "오상근": 1,
  "유현주": 1,
  "이지원": 1,
  "이채영": 1,
  "최서연": 1,
  "최현정": 1,
  "김아현": 2,
  "김영찬": 2,
  "김웅기": 2,
  "맹재영": 2,
  "박신영": 2,
  "박채혁": 2,
  "손인혁": 2,
  "윤지호": 2,
  "이민우": 2,
  "전진호": 2,
  "권준혁": 3,
  "김채련": 3,
  "노영숙": 3,
  "백종범": 3,
  "솬뻿쏜": 3,
  "이종현": 3,
  "조민준": 3,
  "조병성": 3,
  "조영우": 3,
  "주은채": 3,
  "MYAT THIRI KHAING": 4,
  "권태현": 4,
  "김광덕": 4,
  "김유리": 4,
  "남준현": 4,
  "박경희": 4,
  "박종혁": 4,
  "이상헌": 4,
  "이승현": 4,
  "이육현": 4,
  "강건": 5,
  "김요한": 5,
  "김진현": 5,
  "손영서": 5,
  "이동준": 5,
  "이두환": 5,
  "이소은": 5,
  "임종민": 5,
  "장현승": 5,
  "조아진": 5,
  "김명진": 6,
  "김용현": 6,
  "박동현": 6,
  "박민우": 6,
  "우수인": 6,
  "유정한": 6,
  "이지윤": 6,
  "이호현": 6,
  "전윤재": 6,
  "최국진": 6,
  "강희준": 7,
  "고강희": 7,
  "구철회": 7,
  "김선혜": 7,
  "성준": 7,
  "에찬 흘라잉": 7,
  "우태훈": 7,
  "윤지섭": 7,
  "이건수": 7,
  "황인하": 7,
  "권순호": 8,
  "김민준": 8,
  "김병일": 8,
  "김주은": 8,
  "류선혜": 8,
  "문서진": 8,
  "서승훈": 8,
  "원동국": 8,
  "이경민": 8,
  "이태준": 8,
  "Wesam Hashim": 9,
  "강성미": 9,
  "김경순": 9,
  "김재혁": 9,
  "김태훈": 9,
  "송대영": 9,
  "이한세": 9,
  "조유진": 9,
  "한주호": 9,
  "황선욱": 9,
  "강수진": 10,
  "김도현": 10,
  "김현호": 10,
  "박유빈": 10,
  "위승환": 10,
  "이나라": 10,
  "이신학": 10,
  "임상영": 10,
  "조형석": 10,
  "한상우": 10,
  "강석영": 11,
  "김동우": 11,
  "박성현": 11,
  "박종현": 11,
  "박준현": 11,
  "박효신": 11,
  "박효준": 11,
  "배상진": 11,
  "송준기": 11,
  "안시은": 11,
  "김이한": 12,
  "김태윤": 12,
  "이찬민": 12,
  "이현준": 12,
  "정정길": 12,
  "조은산": 12,
  "최라희": 12,
  "최우형": 12,
  "홍영우": 12,
  "황선호": 12,
  "강나영": 13,
  "김영우": 13,
  "김화랑": 13,
  "내튀": 13,
  "박현수": 13,
  "배강민": 13,
  "백성현": 13,
  "유창재": 13,
  "이상민": 13,
  "현지섭": 13,
  "김샛별": 14,
  "김태연": 14,
  "김혜승": 14,
  "박종준": 14,
  "박준형": 14,
  "성재은": 14,
  "유민혁": 14,
  "이도영": 14,
  "장예승": 14,
  "정재헌": 14,
  "Thin Sandi Kyaw": 15,
  "김은수": 15,
  "박연재": 15,
  "반홍준": 15,
  "송성희": 15,
  "송지해": 15,
  "이수현": 15,
  "임재영": 15,
  "조희진": 15,
  "최군주": 15,
  "강희성": 16,
  "박치헌": 16,
  "성명제": 16,
  "신재윤": 16,
  "양재혁": 16,
  "이수연": 16,
  "이지희": 16,
  "임민경": 16,
  "추교진": 16,
  "강유빈": 17,
  "김동혁": 17,
  "김민서": 17,
  "박원희": 17,
  "이재훈": 17,
  "이해준": 17,
  "임재원": 17,
  "정연우": 17,
  "차우진": 17,
  "김지민": 18,
  "박한나": 18,
  "안슬기": 18,
  "오동근": 18,
  "유은서": 18,
  "정문형": 18,
  "정민우": 18,
  "처유난다": 18,
  "한희승": 18,
  "고지우": 19,
  "김건": 19,
  "김준희": 19,
  "유동민": 19,
  "이성민": 19,
  "이회호": 19,
  "장세헌": 19,
  "전승민": 19,
  "차민승": 19,
  "김수민": 20,
  "김지헌": 20,
  "김진형": 20,
  "서형민": 20,
  "성강비": 20,
  "우지민": 20,
  "운드람 에르대느": 20,
  "유호준": 20,
  "장우영": 20
};

var DEFAULT_CONTENT = {
  date: "2026년 11월 11일(수)",
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
    if (action === "checkin") {
      return json_(checkin_(param_(e, "phone")));
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

    if (action === "admin_apply_seating") {
      if (!checkPassword_(data.password)) {
        return json_({ ok: false, error: "비밀번호가 맞지 않습니다." });
      }
      var seating = applySeating_();
      seating.stats = stats_();
      seating.rows = listRsvps_();
      return json_(seating);
    }

    if (action === "checkin") {
      return json_(checkin_(data.phone));
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
  } else {
    ensureRsvpHeaders_(sheet);
  }
  return sheet;
}

function ensureRsvpHeaders_(sheet) {
  var width = Math.max(sheet.getLastColumn(), HEADERS.length);
  var current = sheet.getRange(1, 1, 1, width).getValues()[0];
  for (var i = 0; i < HEADERS.length; i++) {
    if (String(current[i] || "") !== HEADERS[i]) {
      sheet.getRange(1, i + 1).setValue(HEADERS[i]);
    }
  }
}

function normalizeName_(value) {
  return String(value || "")
    .split(/\r?\n/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function lookupTableNo_(name) {
  var key = normalizeName_(name);
  if (!key) return "";
  if (SEATING_BY_NAME[key] != null) return String(SEATING_BY_NAME[key]);
  // 공백 차이 등 느슨한 매칭
  var compact = key.replace(/\s+/g, "");
  var names = Object.keys(SEATING_BY_NAME);
  for (var i = 0; i < names.length; i++) {
    if (names[i].replace(/\s+/g, "") === compact) return String(SEATING_BY_NAME[names[i]]);
  }
  return "";
}

function resolveTableNo_(rowValues) {
  var existing = cellText_(rowValues[COL.table_no]);
  if (existing) return existing;
  return lookupTableNo_(rowValues[COL.name]);
}

function cellText_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "Asia/Seoul", "yyyy-MM-dd HH:mm");
  }
  return String(value == null ? "" : value).trim();
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

function formatContentValue_(key, value) {
  var days = ["일", "월", "화", "수", "목", "금", "토"];
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    if (key === "date") {
      return (
        Utilities.formatDate(value, "Asia/Seoul", "yyyy년 M월 d일") +
        "(" +
        days[value.getDay()] +
        ")"
      );
    }
    if (key === "time") {
      return Utilities.formatDate(value, "Asia/Seoul", "HH:mm");
    }
    return Utilities.formatDate(value, "Asia/Seoul", "yyyy년 M월 d일 HH:mm");
  }
  var text = String(value == null ? "" : value).trim();
  if (key === "date") {
    text = text
      .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, "")
      .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    text = text.replace(/\s*\(([일월화수목금토])\)\s*/g, "($1)");
  }
  if (key === "time") {
    var tm = text.match(/^(\d{1,2}):(\d{2})/);
    if (tm) {
      text =
        (tm[1].length === 1 ? "0" + tm[1] : tm[1]) + ":" + tm[2];
    }
  }
  return text;
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
    if (key) content[key] = formatContentValue_(key, values[i][1]);
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
    merged[key] = formatContentValue_(key, incoming[key]);
  });
  Object.keys(merged).forEach(function (key) {
    sheet.appendRow([key, merged[key]]);
  });
  // 날짜·시간이 시트에서 영어 Date로 바뀌지 않도록 텍스트 서식 고정
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).setNumberFormat("@");
  }
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
      updated_at: cellText_(values[i][COL.updated_at]),
      name: String(values[i][COL.name] || ""),
      affiliation: String(values[i][COL.affiliation] || ""),
      student_year: String(values[i][COL.student_year] || ""),
      grad_year: String(values[i][COL.grad_year] || ""),
      workplace: String(values[i][COL.workplace] || ""),
      title: String(values[i][COL.title] || ""),
      phone: String(values[i][COL.phone] || ""),
      email: String(values[i][COL.email] || ""),
      attendance: String(values[i][COL.attendance] || ""),
      message: String(values[i][COL.message] || ""),
      consent: String(values[i][COL.consent] || ""),
      checked_in_at: cellText_(values[i][COL.checked_in_at]),
      table_no: cellText_(values[i][COL.table_no]) || lookupTableNo_(values[i][COL.name]),
    });
  }
  return rows;
}

function applySeating_() {
  var sheet = sheet_();
  var values = sheet.getDataRange().getValues();
  var updated = 0;
  var missing = [];
  for (var i = 1; i < values.length; i++) {
    var name = normalizeName_(values[i][COL.name]);
    var tableNo = lookupTableNo_(name);
    if (!tableNo) {
      if (name) missing.push(name);
      continue;
    }
    var current = cellText_(values[i][COL.table_no]);
    if (current !== tableNo) {
      sheet.getRange(i + 1, COL.table_no + 1).setValue(Number(tableNo) || tableNo);
      updated++;
    }
  }
  return { ok: true, updated: updated, missing: missing, total: values.length - 1 };
}

function checkin_(phoneRaw) {
  var phoneKey = normalizePhoneKey_(phoneRaw);
  if (!/^0\d{8,10}$/.test(phoneKey)) {
    return { ok: false, error: "회신에 사용한 연락처를 숫자로 입력해 주세요." };
  }
  var sheet = sheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (rowPhoneKey_(values[i]) !== phoneKey) continue;
    var name = String(values[i][COL.name] || "");
    var affiliation = String(values[i][COL.affiliation] || "");
    var attendance = String(values[i][COL.attendance] || "");
    var tableNo = resolveTableNo_(values[i]);
    if (tableNo && cellText_(values[i][COL.table_no]) !== tableNo) {
      sheet.getRange(i + 1, COL.table_no + 1).setValue(Number(tableNo) || tableNo);
    }
    var existing = cellText_(values[i][COL.checked_in_at]);
    if (existing) {
      return {
        ok: true,
        already: true,
        name: name,
        affiliation: affiliation,
        attendance: attendance,
        table_no: tableNo,
        checked_in_at: existing,
        stats: stats_(),
      };
    }
    var stamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm");
    sheet.getRange(i + 1, COL.checked_in_at + 1).setValue(stamp);
    // phone_key가 비어 있거나 선행 0이 빠진 경우 보정
    sheet.getRange(i + 1, COL.phone_key + 1).setNumberFormat("@");
    sheet.getRange(i + 1, COL.phone_key + 1).setValue(phoneKey);
    return {
      ok: true,
      already: false,
      name: name,
      affiliation: affiliation,
      attendance: attendance,
      table_no: tableNo,
      checked_in_at: stamp,
      stats: stats_(),
    };
  }
  return {
    ok: false,
    error: "사전 등록된 연락처가 없습니다. 현장 스태프에게 문의해 주세요.",
  };
}

function deptKey_(label) {
  var text = String(label || "");
  if (text.indexOf("건축공학전공") >= 0) return "ae";
  if (text.indexOf("건축기계설비") >= 0) return "me";
  if (text.indexOf("스마트시티") >= 0) return "sc";
  return "other";
}

function statusKey_(label) {
  var text = String(label || "");
  if (text.indexOf("재학생") >= 0) return "student";
  if (text.indexOf("졸업생") >= 0 || text.indexOf("동문") >= 0) return "alumni";
  return "other";
}

function stats_() {
  var sheet = sheet_();
  var values = sheet.getDataRange().getValues();
  var attend = 0;
  var decline = 0;
  var yearCounts = {};
  var other = 0;
  var deptCounts = { ae: 0, me: 0, sc: 0, other: 0 };
  var statusCounts = { student: 0, alumni: 0, other: 0 };
  var checkedIn = 0;
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][COL.attendance_key] || "");
    if (cellText_(values[i][COL.checked_in_at])) checkedIn++;
    if (key === "attend") {
      attend++;
      var yearLabel = String(values[i][COL.student_year] || "");
      var match = yearLabel.match(/(\d{2})학번/);
      if (match) {
        var year = match[1];
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      } else {
        other++;
      }
      var affiliation = String(values[i][COL.affiliation] || "");
      var dept = deptKey_(affiliation);
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      var status = statusKey_(affiliation);
      statusCounts[status] = (statusCounts[status] || 0) + 1;
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
  var byDept = [
    { key: "ae", label: "건축공학전공", people: deptCounts.ae },
    { key: "me", label: "건축기계설비공학과", people: deptCounts.me },
    { key: "sc", label: "스마트시티공학과", people: deptCounts.sc },
    { key: "other", label: "기타", people: deptCounts.other },
  ];
  var byStatus = [
    { key: "student", label: "재학생", people: statusCounts.student },
    { key: "alumni", label: "졸업생", people: statusCounts.alumni },
    { key: "other", label: "기타", people: statusCounts.other },
  ];
  return {
    attend: attend,
    decline: decline,
    total: attend + decline,
    checked_in: checkedIn,
    by_year: byYear,
    other: other,
    by_dept: byDept,
    by_status: byStatus,
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
  // 시트가 숫자를 저장하면 앞자리 0이 사라질 수 있어 복구합니다.
  if (typeof value === "number" && isFinite(value)) {
    var asInt = String(Math.floor(Math.abs(value)));
    if (/^10\d{8}$/.test(asInt) || /^10\d{9}$/.test(asInt)) return "0" + asInt;
    return asInt;
  }
  return String(value == null ? "" : value).replace(/\D/g, "");
}

function normalizePhoneKey_(value) {
  var key = digits_(value);
  if (/^0\d{8,10}$/.test(key)) return key;
  // 010/011 등이 숫자로 저장되며 선행 0이 빠진 경우
  if (/^1[016789]\d{7,8}$/.test(key)) return "0" + key;
  return key;
}

function rowPhoneKey_(row) {
  var fromKey = normalizePhoneKey_(row[COL.phone_key]);
  if (/^0\d{8,10}$/.test(fromKey)) return fromKey;
  var fromPhone = normalizePhoneKey_(row[COL.phone]);
  if (/^0\d{8,10}$/.test(fromPhone)) return fromPhone;
  return fromKey || fromPhone;
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
  var phoneKey = normalizePhoneKey_(data.phone);
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
  for (var i = 1; i < values.length; i++) {
    if (rowPhoneKey_(values[i]) === row.phone_key) {
      var checkedIn = cellText_(values[i][COL.checked_in_at]);
      var tableNo = cellText_(values[i][COL.table_no]) || lookupTableNo_(row.name);
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
        checkedIn,
        tableNo,
      ];
      sheet.getRange(i + 1, 1, 1, HEADERS.length).setValues([line]);
      row.updated = true;
      return;
    }
  }
  var newTable = lookupTableNo_(row.name);
  sheet.appendRow([
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
    "",
    newTable,
  ]);
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
