(function () {
  var config = window.RSVP_CONFIG || {};
  var apiUrl = (config.API_URL || "").trim();
  var password = sessionStorage.getItem("ae_admin_password") || "";

  var CONTENT_FIELDS = [
    { key: "date", label: "날짜 (예: 2026년 11월 11일(수))" },
    { key: "time", label: "시간 (예: 18:00)" },
    { key: "campus", label: "캠퍼스" },
    { key: "place", label: "장소" },
    { key: "map_url", label: "지도 URL" },
    { key: "audience", label: "대상" },
    { key: "sponsors", label: "후원" },
    { key: "meal", label: "식사" },
    { key: "benefit", label: "학생 특전" },
    { key: "raffle", label: "경품" },
    { key: "contact", label: "문의 전화" },
    { key: "invite_title", label: "초대 제목" },
    { key: "invite_body", label: "초대 본문", wide: true },
    { key: "note", label: "식순 안내 문구", wide: true },
  ];

  var loginPanel = document.getElementById("login-panel");
  var adminPanel = document.getElementById("admin-panel");
  var loginError = document.getElementById("login-error");

  var saveStatus = null;
  var saveError = null;
  var contentFields = null;
  var programEditor = null;
  var rsvpBody = null;
  var adminStats = null;
  var rsvpModal = null;
  var rsvpForm = null;
  var rsvpModalError = null;
  var rsvpModalTitle = null;
  var latestRows = [];
  var rsvpFilters = { year: "", dept: "", status: "" };
  var rsvpFilterYear = null;
  var rsvpFilterDept = null;
  var rsvpFilterStatus = null;
  var rsvpFilterMeta = null;
  var panelReady = false;

  var AFFILIATION_OPTIONS = [
    ["ae_student", "건축공학전공 재학생"],
    ["ae_alumni", "건축공학전공 졸업생"],
    ["me_student", "건축기계설비공학과 재학생"],
    ["me_alumni", "건축기계설비공학과 졸업생"],
    ["sc_student", "스마트시티공학과 재학생"],
    ["sc_alumni", "스마트시티공학과 졸업생"],
    ["faculty", "교직원"],
    ["alumni", "동문"],
    ["other", "기타"],
  ];

  var STUDENT_YEARS = [];
  (function buildYears() {
    var i;
    for (i = 26; i >= 0; i--) STUDENT_YEARS.push(("0" + i).slice(-2));
    for (i = 99; i >= 80; i--) STUDENT_YEARS.push(String(i));
  })();

  var GRAD_YEARS = [];
  (function buildGrads() {
    var y;
    for (y = 2026; y >= 1988; y--) GRAD_YEARS.push(String(y));
  })();

  function post(body) {
    return fetch(apiUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json();
    });
  }

  function getAdmin(passwordValue) {
    var url =
      apiUrl +
      (apiUrl.indexOf("?") >= 0 ? "&" : "?") +
      "action=admin_ping&password=" +
      encodeURIComponent(passwordValue || "");
    return fetch(url, { method: "GET", redirect: "follow" }).then(function (res) {
      return res.json();
    });
  }

  function apiOutdatedMessage(error) {
    var text = String(error || "");
    if (
      text.indexOf("개인정보") >= 0 ||
      text.indexOf("참석 여부") >= 0 ||
      text.indexOf("이름을 입력") >= 0
    ) {
      return "서버 API가 예전 버전입니다. 스프레드시트 Apps Script에 Code.gs를 붙여 넣고 ‘배포 → 새 버전 관리’로 다시 배포해 주세요.";
    }
    return text || "요청에 실패했습니다.";
  }

  function show(el, text) {
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function ensureApi() {
    if (!apiUrl) {
      show(loginError, "API_URL이 설정되지 않았습니다. rsvp-config.js를 확인하세요.");
      return false;
    }
    return true;
  }

  function ensurePanel() {
    if (panelReady) return;
    adminPanel.innerHTML =
      '<div class="admin-actions">' +
      '<button type="button" id="export-btn" class="button">참석 회신 엑셀 내려받기</button>' +
      '<a class="button ghost" href="checkin.html" target="_blank" rel="noopener">출석 체크 페이지</a>' +
      '<button type="button" id="logout-btn" class="ghost">로그아웃</button>' +
      "</div>" +
      '<section class="admin-stats" id="admin-stats" aria-label="집계"></section>' +
      '<section class="admin-card">' +
      "<h2>당일 출석 QR</h2>" +
      '<p class="form-note">행사장에 붙여 두고 참석자가 스캔하면 출석 체크 페이지로 이동합니다.</p>' +
      '<div class="checkin-qr">' +
      '<canvas id="checkin-qr-canvas" width="240" height="240" aria-label="출석 체크 QR 코드"></canvas>' +
      '<p id="checkin-qr-url" class="form-note"></p>' +
      "</div>" +
      "</section>" +
      '<section class="admin-card">' +
      "<h2>행사 안내</h2>" +
      '<div class="fields admin-fields" id="content-fields"></div>' +
      "</section>" +
      '<section class="admin-card">' +
      '<div class="admin-card-head">' +
      "<h2>이날의 자리</h2>" +
      '<button type="button" id="add-program" class="ghost">항목 추가</button>' +
      "</div>" +
      '<p class="form-note">비고는 줄바꿈으로 여러 줄 입력할 수 있습니다.</p>' +
      '<div id="program-editor" class="program-editor"></div>' +
      "</section>" +
      '<p id="save-status" class="banner ok" hidden role="status"></p>' +
      '<p id="save-error" class="banner warn" hidden role="alert"></p>' +
      '<button type="button" id="save-btn">안내·식순 저장</button>' +
      '<section class="admin-card">' +
      '<div class="admin-card-head">' +
      "<h2>참석 회신 미리보기</h2>" +
      '<button type="button" id="add-rsvp-btn" class="ghost">회신 추가</button>' +
      "</div>" +
      '<p class="form-note">시트 DB와 바로 연동됩니다. 연락처가 고유 키입니다.</p>' +
      '<div class="admin-rsvp-filters" id="rsvp-filters">' +
      '<label><span>학번</span><select id="rsvp-filter-year"><option value="">전체</option></select></label>' +
      '<label><span>소속학과</span><select id="rsvp-filter-dept">' +
      '<option value="">전체</option>' +
      '<option value="ae">건축공학전공</option>' +
      '<option value="me">건축기계설비공학과</option>' +
      '<option value="sc">스마트시티공학과</option>' +
      '<option value="other">기타</option>' +
      "</select></label>" +
      '<label><span>재학생·졸업생</span><select id="rsvp-filter-status">' +
      '<option value="">전체</option>' +
      '<option value="student">재학생</option>' +
      '<option value="alumni">졸업생</option>' +
      '<option value="other">기타</option>' +
      "</select></label>" +
      '<button type="button" id="rsvp-filter-reset" class="ghost">필터 초기화</button>' +
      "</div>" +
      '<p id="rsvp-filter-meta" class="form-note"></p>' +
      '<p id="rsvp-status" class="banner ok" hidden role="status"></p>' +
      '<div class="table-wrap"><table><thead><tr>' +
      "<th>관리</th><th>수정시각</th><th>이름</th><th>소속학과</th><th>학번</th><th>졸업연도</th>" +
      "<th>현직장</th><th>직책</th><th>연락처</th><th>이메일</th><th>참석</th><th>테이블</th><th>체크인</th><th>메시지</th>" +
      "</tr></thead><tbody id=\"rsvp-body\"></tbody></table></div>" +
      "</section>" +
      '<div id="rsvp-modal" class="admin-modal" hidden>' +
      '<div class="admin-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="rsvp-modal-title">' +
      '<div class="admin-card-head">' +
      '<h2 id="rsvp-modal-title">회신 수정</h2>' +
      '<button type="button" id="rsvp-modal-close" class="ghost">닫기</button>' +
      "</div>" +
      '<form id="rsvp-form" class="fields admin-fields" novalidate>' +
      '<input type="hidden" name="original_phone_key" value="">' +
      '<label><span>이름</span><input name="name" required maxlength="40"></label>' +
      '<label><span>소속학과</span><select name="affiliation" required></select></label>' +
      '<label><span>학번</span><select name="student_year" required></select></label>' +
      '<label><span>졸업연도</span><select name="grad_year"></select></label>' +
      '<label><span>현직장</span><input name="workplace" maxlength="60"></label>' +
      '<label><span>직책</span><input name="title" maxlength="40"></label>' +
      '<label><span>연락처</span><input name="phone" required inputmode="tel" autocomplete="tel" maxlength="13" placeholder="010-0000-0000"></label>' +
      '<label><span>이메일</span><input name="email" type="email" required maxlength="80"></label>' +
      '<label><span>참석 여부</span><select name="attendance" required>' +
      '<option value="attend">참석</option><option value="decline">불참</option></select></label>' +
      '<label><span>테이블</span><input name="table_no" inputmode="numeric" placeholder="예: 4"></label>' +
      '<label><span>체크인 시각</span><input name="checked_in_at" placeholder="비우면 미체크인"></label>' +
      '<label class="wide"><span>메시지</span><textarea name="message" rows="3" maxlength="200"></textarea></label>' +
      "</form>" +
      '<p id="rsvp-modal-error" class="banner warn" hidden role="alert"></p>' +
      '<div class="program-row-actions">' +
      '<button type="button" id="rsvp-save-btn">저장</button>' +
      '<button type="button" id="rsvp-cancel-btn" class="ghost">취소</button>' +
      "</div></div></div>";

    saveStatus = document.getElementById("save-status");
    saveError = document.getElementById("save-error");
    contentFields = document.getElementById("content-fields");
    programEditor = document.getElementById("program-editor");
    rsvpBody = document.getElementById("rsvp-body");
    adminStats = document.getElementById("admin-stats");
    rsvpModal = document.getElementById("rsvp-modal");
    rsvpForm = document.getElementById("rsvp-form");
    rsvpModalError = document.getElementById("rsvp-modal-error");
    rsvpModalTitle = document.getElementById("rsvp-modal-title");
    rsvpFilterYear = document.getElementById("rsvp-filter-year");
    rsvpFilterDept = document.getElementById("rsvp-filter-dept");
    rsvpFilterStatus = document.getElementById("rsvp-filter-status");
    rsvpFilterMeta = document.getElementById("rsvp-filter-meta");

    fillRsvpSelects();
    bindRsvpPhoneFormat();

    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("save-btn").addEventListener("click", save);
    document.getElementById("export-btn").addEventListener("click", exportExcel);
    document.getElementById("add-program").addEventListener("click", function () {
      programEditor.appendChild(makeProgramRow({ title: "", remark: [] }));
    });
    document.getElementById("add-rsvp-btn").addEventListener("click", function () {
      openRsvpEditor(null);
    });
    document.getElementById("rsvp-modal-close").addEventListener("click", closeRsvpEditor);
    document.getElementById("rsvp-cancel-btn").addEventListener("click", closeRsvpEditor);
    document.getElementById("rsvp-save-btn").addEventListener("click", saveRsvpEditor);
    rsvpModal.addEventListener("click", function (event) {
      if (event.target === rsvpModal) closeRsvpEditor();
    });
    rsvpFilterYear.addEventListener("change", function () {
      rsvpFilters.year = rsvpFilterYear.value || "";
      paintRsvpTable();
    });
    rsvpFilterDept.addEventListener("change", function () {
      rsvpFilters.dept = rsvpFilterDept.value || "";
      paintRsvpTable();
    });
    rsvpFilterStatus.addEventListener("change", function () {
      rsvpFilters.status = rsvpFilterStatus.value || "";
      paintRsvpTable();
    });
    document.getElementById("rsvp-filter-reset").addEventListener("click", function () {
      rsvpFilters = { year: "", dept: "", status: "" };
      if (rsvpFilterYear) rsvpFilterYear.value = "";
      if (rsvpFilterDept) rsvpFilterDept.value = "";
      if (rsvpFilterStatus) rsvpFilterStatus.value = "";
      paintRsvpTable();
    });
    renderCheckinQr();

    panelReady = true;
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatPhone(raw) {
    var d = digitsOnly(raw).slice(0, 11);
    if (!d) return "";
    if (d.indexOf("02") === 0) {
      if (d.length <= 2) return d;
      if (d.length <= 5) return d.slice(0, 2) + "-" + d.slice(2);
      if (d.length <= 9) return d.slice(0, 2) + "-" + d.slice(2, 5) + "-" + d.slice(5);
      return d.slice(0, 2) + "-" + d.slice(2, 6) + "-" + d.slice(6, 10);
    }
    if (d.length <= 3) return d;
    if (d.length <= 7) return d.slice(0, 3) + "-" + d.slice(3);
    if (d.length <= 10) return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
    return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
  }

  function bindRsvpPhoneFormat() {
    if (!rsvpForm) return;
    var input = rsvpForm.elements.phone;
    if (!input || input.getAttribute("data-phone-bound") === "1") return;
    input.setAttribute("data-phone-bound", "1");
    function applyFormat() {
      var next = formatPhone(input.value);
      if (input.value !== next) input.value = next;
    }
    input.addEventListener("input", applyFormat);
    input.addEventListener("blur", applyFormat);
  }

  function fillRsvpSelects() {
    if (!rsvpForm) return;
    var aff = rsvpForm.elements.affiliation;
    var year = rsvpForm.elements.student_year;
    var grad = rsvpForm.elements.grad_year;
    aff.innerHTML = '<option value="" disabled selected>선택</option>';
    AFFILIATION_OPTIONS.forEach(function (pair) {
      var opt = document.createElement("option");
      opt.value = pair[0];
      opt.textContent = pair[1];
      aff.appendChild(opt);
    });
    year.innerHTML = '<option value="" disabled selected>선택</option>';
    STUDENT_YEARS.forEach(function (y) {
      var opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y + "학번";
      year.appendChild(opt);
    });
    grad.innerHTML = '<option value="">해당 없음</option>';
    GRAD_YEARS.forEach(function (y) {
      var opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y + "년 졸업";
      grad.appendChild(opt);
    });
  }

  function affiliationKeyFromLabel(label) {
    var text = String(label || "").trim();
    for (var i = 0; i < AFFILIATION_OPTIONS.length; i++) {
      if (AFFILIATION_OPTIONS[i][1] === text) return AFFILIATION_OPTIONS[i][0];
    }
    return "";
  }

  function extractYearCode(value) {
    var match = String(value || "").match(/(\d{2})/);
    return match ? match[1] : "";
  }

  function extractGradYear(value) {
    var match = String(value || "").match(/(20\d{2}|19\d{2})/);
    return match ? match[1] : "";
  }

  function attendanceKeyFromLabel(value) {
    var text = String(value || "").trim();
    if (text === "참석" || text === "attend") return "attend";
    if (text === "불참" || text === "decline") return "decline";
    return "attend";
  }

  function openRsvpEditor(row) {
    if (!rsvpModal || !rsvpForm) return;
    show(rsvpModalError, "");
    rsvpModalTitle.textContent = row ? "회신 수정" : "회신 추가";
    rsvpForm.reset();
    fillRsvpSelects();
    rsvpForm.elements.original_phone_key.value = row && row.phone_key ? row.phone_key : "";
    if (row) {
      rsvpForm.elements.name.value = row.name || "";
      rsvpForm.elements.affiliation.value =
        affiliationKeyFromLabel(row.affiliation) || row.affiliation || "";
      rsvpForm.elements.student_year.value = extractYearCode(row.student_year);
      rsvpForm.elements.grad_year.value = extractGradYear(row.grad_year);
      rsvpForm.elements.workplace.value = row.workplace || "";
      rsvpForm.elements.title.value = row.title || "";
      rsvpForm.elements.phone.value = formatPhone(row.phone || "");
      rsvpForm.elements.email.value = row.email || "";
      rsvpForm.elements.attendance.value = attendanceKeyFromLabel(
        row.attendance_key || row.attendance
      );
      rsvpForm.elements.table_no.value = row.table_no || "";
      rsvpForm.elements.checked_in_at.value = row.checked_in_at || "";
      rsvpForm.elements.message.value = row.message || "";
    } else {
      rsvpForm.elements.attendance.value = "attend";
    }
    rsvpModal.hidden = false;
    rsvpForm.elements.name.focus();
  }

  function closeRsvpEditor() {
    if (!rsvpModal) return;
    rsvpModal.hidden = true;
    show(rsvpModalError, "");
  }

  function readRsvpForm() {
    return {
      original_phone_key: rsvpForm.elements.original_phone_key.value || "",
      name: rsvpForm.elements.name.value || "",
      affiliation: rsvpForm.elements.affiliation.value || "",
      student_year: rsvpForm.elements.student_year.value || "",
      grad_year: rsvpForm.elements.grad_year.value || "",
      workplace: rsvpForm.elements.workplace.value || "",
      title: rsvpForm.elements.title.value || "",
      phone: rsvpForm.elements.phone.value || "",
      email: rsvpForm.elements.email.value || "",
      attendance: rsvpForm.elements.attendance.value || "",
      table_no: rsvpForm.elements.table_no.value || "",
      checked_in_at: rsvpForm.elements.checked_in_at.value || "",
      message: rsvpForm.elements.message.value || "",
    };
  }

  function saveRsvpEditor() {
    if (!password || !rsvpForm) return;
    show(rsvpModalError, "");
    var payload = readRsvpForm();
    var btn = document.getElementById("rsvp-save-btn");
    if (btn) btn.disabled = true;
    post({
      action: "admin_upsert_rsvp",
      password: password,
      original_phone_key: payload.original_phone_key,
      name: payload.name,
      affiliation: payload.affiliation,
      student_year: payload.student_year,
      grad_year: payload.grad_year,
      workplace: payload.workplace,
      title: payload.title,
      phone: payload.phone,
      email: payload.email,
      attendance: payload.attendance,
      table_no: payload.table_no,
      checked_in_at: payload.checked_in_at,
      message: payload.message,
    })
      .then(function (data) {
        if (btn) btn.disabled = false;
        if (!data || !data.ok) {
          show(rsvpModalError, apiOutdatedMessage(data && data.error) || "저장에 실패했습니다.");
          return;
        }
        closeRsvpEditor();
        renderStats(data.stats || null);
        renderRows(data.rows || []);
        var note = document.getElementById("rsvp-status");
        show(note, data.updated ? "회신을 수정했습니다." : "회신을 추가했습니다.");
      })
      .catch(function () {
        if (btn) btn.disabled = false;
        show(rsvpModalError, "저장 중 네트워크 오류가 발생했습니다.");
      });
  }

  function deleteRsvp(row) {
    if (!password || !row) return;
    var key = row.phone_key || row.phone;
    var label = (row.name || "이 회신") + (row.phone ? " (" + row.phone + ")" : "");
    if (!window.confirm(label + " 을(를) 삭제할까요? 시트에서도 삭제됩니다.")) return;
    post({
      action: "admin_delete_rsvp",
      password: password,
      phone_key: key,
    })
      .then(function (data) {
        if (!data || !data.ok) {
          show(saveError, apiOutdatedMessage(data && data.error) || "삭제에 실패했습니다.");
          return;
        }
        renderStats(data.stats || null);
        renderRows(data.rows || []);
        var note = document.getElementById("rsvp-status");
        show(note, "회신을 삭제했습니다.");
      })
      .catch(function () {
        show(saveError, "삭제 중 네트워크 오류가 발생했습니다.");
      });
  }

  function checkinPageUrl() {
    try {
      return new URL("checkin.html", window.location.href).href;
    } catch (err) {
      return "checkin.html";
    }
  }

  function renderCheckinQr() {
    var canvas = document.getElementById("checkin-qr-canvas");
    var urlEl = document.getElementById("checkin-qr-url");
    var url = checkinPageUrl();
    if (urlEl) urlEl.textContent = url;
    if (!canvas) return;
    if (typeof QRCode === "undefined") {
      canvas.replaceWith(
        Object.assign(document.createElement("img"), {
          id: "checkin-qr-canvas",
          alt: "출석 체크 QR",
          src:
            "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" +
            encodeURIComponent(url),
        })
      );
      return;
    }
    QRCode.toCanvas(canvas, url, { width: 240, margin: 1 }, function () {});
  }

  function openPanel() {
    ensurePanel();
    loginPanel.hidden = true;
    adminPanel.hidden = false;
    adminPanel.classList.add("is-open");
    adminPanel.setAttribute("aria-hidden", "false");
  }

  function closePanel() {
    adminPanel.classList.remove("is-open");
    adminPanel.hidden = true;
    adminPanel.setAttribute("aria-hidden", "true");
    adminPanel.innerHTML = "";
    panelReady = false;
    saveStatus = saveError = contentFields = programEditor = rsvpBody = adminStats = null;
    rsvpModal = rsvpForm = rsvpModalError = rsvpModalTitle = null;
    rsvpFilterYear = rsvpFilterDept = rsvpFilterStatus = rsvpFilterMeta = null;
    latestRows = [];
    rsvpFilters = { year: "", dept: "", status: "" };
    loginPanel.hidden = false;
  }

  function logout() {
    sessionStorage.removeItem("ae_admin_password");
    password = "";
    closePanel();
  }

  function renderContentFields(content) {
    contentFields.innerHTML = "";
    CONTENT_FIELDS.forEach(function (field) {
      var label = document.createElement("label");
      if (field.wide) label.className = "wide";
      var span = document.createElement("span");
      span.textContent = field.label;
      var input;
      if (field.wide) {
        input = document.createElement("textarea");
        input.rows = 3;
      } else {
        input = document.createElement("input");
      }
      input.name = field.key;
      input.value = (content && content[field.key]) || "";
      label.appendChild(span);
      label.appendChild(input);
      contentFields.appendChild(label);
    });
  }

  function readContent() {
    var content = {};
    CONTENT_FIELDS.forEach(function (field) {
      var el = contentFields.querySelector('[name="' + field.key + '"]');
      content[field.key] = el ? el.value : "";
    });
    return content;
  }

  function makeProgramRow(item) {
    var wrap = document.createElement("div");
    wrap.className = "program-row";
    wrap.innerHTML =
      '<label><span>제목</span><input name="title" /></label>' +
      '<label class="wide"><span>비고 (줄바꿈 가능)</span><textarea name="remark" rows="2"></textarea></label>' +
      '<div class="program-row-actions">' +
      '<button type="button" class="ghost move-up">위로</button>' +
      '<button type="button" class="ghost move-down">아래로</button>' +
      '<button type="button" class="text-button remove-row">삭제</button>' +
      "</div>";
    wrap.querySelector('[name="title"]').value = (item && item.title) || "";
    var remark = (item && item.remark) || [];
    if (Object.prototype.toString.call(remark) !== "[object Array]") {
      remark = remark ? [String(remark)] : [];
    }
    wrap.querySelector('[name="remark"]').value = remark.join("\n");
    wrap.querySelector(".remove-row").addEventListener("click", function () {
      wrap.remove();
    });
    wrap.querySelector(".move-up").addEventListener("click", function () {
      if (wrap.previousElementSibling) {
        programEditor.insertBefore(wrap, wrap.previousElementSibling);
      }
    });
    wrap.querySelector(".move-down").addEventListener("click", function () {
      if (wrap.nextElementSibling) {
        programEditor.insertBefore(wrap.nextElementSibling, wrap);
      }
    });
    return wrap;
  }

  function renderProgram(program) {
    programEditor.innerHTML = "";
    (program || []).forEach(function (item) {
      programEditor.appendChild(makeProgramRow(item));
    });
    if (!programEditor.children.length) {
      programEditor.appendChild(makeProgramRow({ title: "", remark: [] }));
    }
  }

  function readProgram() {
    return Array.prototype.slice
      .call(programEditor.querySelectorAll(".program-row"))
      .map(function (row) {
        var title = row.querySelector('[name="title"]').value.trim();
        var remark = row
          .querySelector('[name="remark"]')
          .value.split(/\r?\n/)
          .map(function (line) {
            return line.trim();
          })
          .filter(Boolean);
        return { title: title, remark: remark };
      })
      .filter(function (item) {
        return item.title;
      });
  }

  var adminTallyMode = "year";
  var adminLatestStats = null;

  function renderAdminBreakdown(stats, mode) {
    var list = document.getElementById("admin-tally-list");
    if (!list) return;
    list.innerHTML = "";
    function addItem(count, label) {
      var p = document.createElement("p");
      p.innerHTML = "<strong>" + (count || 0) + "</strong> " + label;
      list.appendChild(p);
    }
    if (mode === "dept") {
      (stats.by_dept || []).forEach(function (row) {
        if (!row.people && row.key === "other") return;
        addItem(row.people, row.label);
      });
      return;
    }
    if (mode === "status") {
      (stats.by_status || []).forEach(function (row) {
        if (!row.people && row.key === "other") return;
        addItem(row.people, row.label);
      });
      return;
    }
    (stats.by_year || []).forEach(function (row) {
      addItem(row.people, row.label);
    });
    if (stats.other) addItem(stats.other, "기타");
  }

  function renderStats(stats) {
    adminStats.innerHTML = "";
    if (!stats) return;
    adminLatestStats = stats;
    var total = document.createElement("p");
    total.className = "admin-tally-total";
    total.innerHTML = "<strong>" + (stats.attend || 0) + "</strong> 전체 참석";
    adminStats.appendChild(total);
    var checked = document.createElement("p");
    checked.className = "admin-tally-total";
    checked.innerHTML = "<strong>" + (stats.checked_in || 0) + "</strong> 현장 출석";
    adminStats.appendChild(checked);

    var tabs = document.createElement("div");
    tabs.className = "tally-tabs admin-tally-tabs";
    tabs.setAttribute("role", "tablist");
    [
      ["year", "학번별"],
      ["dept", "소속학과별"],
      ["status", "재학생·졸업생"],
    ].forEach(function (pair) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tally-tab" + (pair[0] === adminTallyMode ? " is-active" : "");
      btn.setAttribute("data-tally", pair[0]);
      btn.textContent = pair[1];
      btn.addEventListener("click", function () {
        adminTallyMode = pair[0];
        Array.prototype.forEach.call(tabs.querySelectorAll(".tally-tab"), function (tab) {
          var on = tab.getAttribute("data-tally") === adminTallyMode;
          tab.classList.toggle("is-active", on);
        });
        renderAdminBreakdown(adminLatestStats, adminTallyMode);
      });
      tabs.appendChild(btn);
    });
    adminStats.appendChild(tabs);

    var list = document.createElement("div");
    list.id = "admin-tally-list";
    list.className = "admin-tally-list";
    adminStats.appendChild(list);
    renderAdminBreakdown(stats, adminTallyMode);
  }

  function cohortSortKey(year) {
    var value = parseInt(year, 10);
    if (isNaN(value)) return 9999;
    if (value >= 80 && value <= 99) return 1900 + value;
    if (value >= 0 && value < 50) return 2000 + value;
    if (value >= 50 && value <= 79) return 1900 + value;
    return 2000 + value;
  }

  function rowYearCode(row) {
    return extractYearCode(row && row.student_year);
  }

  function rowDeptKey(row) {
    var text = String((row && row.affiliation) || "");
    if (text.indexOf("건축공학전공") >= 0) return "ae";
    if (text.indexOf("건축기계설비") >= 0) return "me";
    if (text.indexOf("스마트시티") >= 0) return "sc";
    return "other";
  }

  function rowStatusKey(row) {
    var text = String((row && row.affiliation) || "");
    if (text.indexOf("재학생") >= 0) return "student";
    if (text.indexOf("졸업생") >= 0 || text.indexOf("동문") >= 0) return "alumni";
    return "other";
  }

  function filteredRows() {
    return (latestRows || []).filter(function (row) {
      if (rsvpFilters.year) {
        var year = rowYearCode(row);
        if (rsvpFilters.year === "other") {
          if (year) return false;
        } else if (year !== rsvpFilters.year) {
          return false;
        }
      }
      if (rsvpFilters.dept && rowDeptKey(row) !== rsvpFilters.dept) return false;
      if (rsvpFilters.status && rowStatusKey(row) !== rsvpFilters.status) return false;
      return true;
    });
  }

  function refreshYearFilterOptions() {
    if (!rsvpFilterYear) return;
    var selected = rsvpFilters.year || "";
    var years = {};
    var hasOther = false;
    (latestRows || []).forEach(function (row) {
      var year = rowYearCode(row);
      if (year) years[year] = true;
      else hasOther = true;
    });
    var codes = Object.keys(years).sort(function (a, b) {
      return cohortSortKey(a) - cohortSortKey(b);
    });
    rsvpFilterYear.innerHTML = '<option value="">전체</option>';
    codes.forEach(function (year) {
      var opt = document.createElement("option");
      opt.value = year;
      opt.textContent = year + "학번";
      rsvpFilterYear.appendChild(opt);
    });
    if (hasOther) {
      var other = document.createElement("option");
      other.value = "other";
      other.textContent = "기타(학번 없음)";
      rsvpFilterYear.appendChild(other);
    }
    rsvpFilterYear.value = selected;
    if (rsvpFilterYear.value !== selected) {
      rsvpFilters.year = "";
      rsvpFilterYear.value = "";
    }
  }

  function syncFilterControls() {
    if (rsvpFilterYear) rsvpFilterYear.value = rsvpFilters.year || "";
    if (rsvpFilterDept) rsvpFilterDept.value = rsvpFilters.dept || "";
    if (rsvpFilterStatus) rsvpFilterStatus.value = rsvpFilters.status || "";
  }

  function paintRsvpTable() {
    if (!rsvpBody) return;
    syncFilterControls();
    var rows = filteredRows();
    rsvpBody.innerHTML = "";
    if (rsvpFilterMeta) {
      var active =
        rsvpFilters.year || rsvpFilters.dept || rsvpFilters.status
          ? " · 필터 적용 중"
          : "";
      rsvpFilterMeta.textContent =
        "표시 " + rows.length + "명 / 전체 " + (latestRows || []).length + "명" + active;
    }
    if (!latestRows.length) {
      var empty = document.createElement("tr");
      empty.innerHTML = '<td colspan="14">아직 회신이 없습니다.</td>';
      rsvpBody.appendChild(empty);
      return;
    }
    if (!rows.length) {
      var none = document.createElement("tr");
      none.innerHTML = '<td colspan="14">선택한 조건에 맞는 회신이 없습니다.</td>';
      rsvpBody.appendChild(none);
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      var actions = document.createElement("td");
      actions.className = "admin-row-actions";
      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "ghost";
      editBtn.textContent = "수정";
      editBtn.addEventListener("click", function () {
        openRsvpEditor(row);
      });
      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "ghost";
      delBtn.textContent = "삭제";
      delBtn.addEventListener("click", function () {
        deleteRsvp(row);
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      tr.appendChild(actions);
      [
        row.updated_at,
        row.name,
        row.affiliation,
        row.student_year,
        row.grad_year,
        row.workplace,
        row.title,
        row.phone,
        row.email,
        row.attendance,
        row.table_no,
        row.checked_in_at,
        row.message,
      ].forEach(function (value) {
        var td = document.createElement("td");
        td.textContent = value || "—";
        tr.appendChild(td);
      });
      rsvpBody.appendChild(tr);
    });
  }

  function renderRows(rows) {
    latestRows = rows || [];
    refreshYearFilterOptions();
    paintRsvpTable();
  }

  function enterAdmin(data) {
    password = data.password || password;
    sessionStorage.setItem("ae_admin_password", password);
    openPanel();
    renderContentFields(data.content || {});
    renderProgram(data.program || []);
    renderStats(data.stats || null);
    loadRows();
  }

  function loadRows() {
    return post({ action: "admin_list", password: password }).then(function (data) {
      if (!data || !data.ok) {
        show(saveError, (data && data.error) || "명단을 불러오지 못했습니다.");
        return;
      }
      renderStats(data.stats || null);
      renderRows(data.rows || []);
    });
  }

  function login() {
    if (!ensureApi()) return;
    var value = document.getElementById("admin-password").value;
    if (!value) {
      show(loginError, "비밀번호를 입력해 주세요.");
      return;
    }
    show(loginError, "");
    getAdmin(value)
      .then(function (data) {
        if (data && data.ok) {
          password = value;
          enterAdmin(data);
          return;
        }
        if (data && typeof data.attend === "number" && data.content == null) {
          show(
            loginError,
            "서버 API가 예전 버전입니다. 스프레드시트 Apps Script에 docs/sheets-api/Code.gs 전체를 붙여 넣고 ‘배포 → 새 버전 관리’로 다시 배포해 주세요."
          );
          return;
        }
        show(loginError, apiOutdatedMessage(data && data.error) || "로그인에 실패했습니다.");
      })
      .catch(function () {
        return post({ action: "admin_login", password: value }).then(function (data) {
          if (data && data.ok) {
            password = value;
            enterAdmin(data);
            return;
          }
          show(loginError, apiOutdatedMessage(data && data.error) || "로그인에 실패했습니다.");
        });
      })
      .catch(function () {
        show(loginError, "네트워크 오류로 로그인하지 못했습니다. Apps Script 재배포 여부를 확인하세요.");
      });
  }

  function save() {
    if (!password || !panelReady) return;
    show(saveStatus, "");
    show(saveError, "");
    post({
      action: "admin_save_content",
      password: password,
      content: readContent(),
      program: readProgram(),
    })
      .then(function (data) {
        if (!data || !data.ok) {
          show(saveError, (data && data.error) || "저장에 실패했습니다.");
          return;
        }
        renderContentFields(data.content || {});
        renderProgram(data.program || []);
        show(saveStatus, "저장했습니다. 공개 페이지를 새로고침하면 반영됩니다.");
      })
      .catch(function () {
        show(saveError, "저장 중 네트워크 오류가 발생했습니다.");
      });
  }

  function exportExcel() {
    if (!password || !panelReady) return;
    show(saveError, "");
    post({ action: "admin_list", password: password })
      .then(function (data) {
        if (!data || !data.ok) {
          show(saveError, (data && data.error) || "명단을 불러오지 못했습니다.");
          return;
        }
        var rows = data.rows || [];
        var sheetRows = [
          [
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
            "테이블",
            "체크인시각",
            "메시지",
            "동의",
          ],
        ];
        rows.forEach(function (row) {
          sheetRows.push([
            row.updated_at || "",
            row.name || "",
            row.affiliation || "",
            row.student_year || "",
            row.grad_year || "",
            row.workplace || "",
            row.title || "",
            row.phone || "",
            row.email || "",
            row.attendance || "",
            row.table_no || "",
            row.checked_in_at || "",
            row.message || "",
            row.consent || "",
          ]);
        });
        if (typeof XLSX === "undefined") {
          show(saveError, "엑셀 라이브러리를 불러오지 못했습니다.");
          return;
        }
        var workbook = XLSX.utils.book_new();
        var worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
        XLSX.utils.book_append_sheet(workbook, worksheet, "참석회신");
        XLSX.writeFile(workbook, "건축공학인의밤_참석회신.xlsx");
      })
      .catch(function () {
        show(saveError, "엑셀 내려받기에 실패했습니다.");
      });
  }

  document.getElementById("login-btn").addEventListener("click", login);
  document.getElementById("admin-password").addEventListener("keydown", function (event) {
    if (event.key === "Enter") login();
  });

  if (password && apiUrl) {
    getAdmin(password)
      .then(function (data) {
        if (data && data.ok) enterAdmin(data);
        else sessionStorage.removeItem("ae_admin_password");
      })
      .catch(function () {
        sessionStorage.removeItem("ae_admin_password");
      });
  }
})();
