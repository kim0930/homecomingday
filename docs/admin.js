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
  var panelReady = false;

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
      "<h2>참석 회신 미리보기</h2>" +
      '<div class="table-wrap"><table><thead><tr>' +
      "<th>수정시각</th><th>이름</th><th>소속학과</th><th>학번</th><th>졸업연도</th>" +
      "<th>현직장</th><th>직책</th><th>연락처</th><th>이메일</th><th>참석</th><th>체크인</th><th>메시지</th>" +
      "</tr></thead><tbody id=\"rsvp-body\"></tbody></table></div>" +
      "</section>";

    saveStatus = document.getElementById("save-status");
    saveError = document.getElementById("save-error");
    contentFields = document.getElementById("content-fields");
    programEditor = document.getElementById("program-editor");
    rsvpBody = document.getElementById("rsvp-body");
    adminStats = document.getElementById("admin-stats");

    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("save-btn").addEventListener("click", save);
    document.getElementById("export-btn").addEventListener("click", exportExcel);
    document.getElementById("add-program").addEventListener("click", function () {
      programEditor.appendChild(makeProgramRow({ title: "", remark: [] }));
    });
    renderCheckinQr();

    panelReady = true;
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

  function renderRows(rows) {
    rsvpBody.innerHTML = "";
    if (!rows || !rows.length) {
      var empty = document.createElement("tr");
      empty.innerHTML = '<td colspan="12">아직 회신이 없습니다.</td>';
      rsvpBody.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
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
