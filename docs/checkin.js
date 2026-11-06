(function () {
  var config = window.RSVP_CONFIG || {};
  var apiUrl = (config.API_URL || "").trim();
  var phoneInput = document.getElementById("checkin-phone");
  var errorEl = document.getElementById("checkin-error");
  var registerBox = document.getElementById("checkin-register");
  var registerLink = document.getElementById("checkin-register-link");
  var formPanel = document.getElementById("checkin-form-panel");
  var resultPanel = document.getElementById("checkin-result");
  var btn = document.getElementById("checkin-btn");

  function show(el, text) {
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function hideRegister() {
    if (registerBox) registerBox.hidden = true;
  }

  function showRegister(phone) {
    if (!registerBox || !registerLink) return;
    var formatted = formatPhone(phone || phoneInput.value);
    var href = "index.html?from=checkin";
    if (formatted) href += "&phone=" + encodeURIComponent(formatted);
    href += "#reply";
    registerLink.href = href;
    registerBox.hidden = false;
  }

  function digits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatPhone(raw) {
    var d = digits(raw).slice(0, 11);
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

  function friendlyError(error) {
    var text = String(error || "");
    if (
      text.indexOf("개인정보") >= 0 ||
      text.indexOf("참석 여부") >= 0 ||
      text.indexOf("이름을 입력") >= 0
    ) {
      return "서버 API가 예전 버전입니다. 스프레드시트 Apps Script에 docs/sheets-api/Code.gs 전체를 붙여 넣고 ‘배포 → 새 버전 관리’로 다시 배포해 주세요.";
    }
    return text || "출석 확인에 실패했습니다.";
  }

  function showResult(data) {
    formPanel.hidden = true;
    resultPanel.hidden = false;
    var status = document.getElementById("checkin-status");
    var name = document.getElementById("checkin-name");
    var meta = document.getElementById("checkin-meta");
    var time = document.getElementById("checkin-time");
    if (data.already) {
      status.textContent = "이미 출석 확인되었습니다";
      status.className = "checkin-status is-already";
    } else {
      status.textContent = "출석이 확인되었습니다";
      status.className = "checkin-status is-ok";
    }
    name.textContent = data.name || "";
    meta.textContent = [data.affiliation, data.attendance].filter(Boolean).join(" · ");
    time.textContent = data.checked_in_at ? "체크인 " + data.checked_in_at : "";
  }

  function reset() {
    resultPanel.hidden = true;
    formPanel.hidden = false;
    show(errorEl, "");
    hideRegister();
    phoneInput.value = "";
    phoneInput.focus();
  }

  function handleFailure(error, phone) {
    var message = friendlyError(error);
    show(errorEl, message);
    if (String(error || "").indexOf("사전 등록") >= 0 || String(message).indexOf("사전 등록") >= 0) {
      showRegister(phone);
    } else {
      hideRegister();
    }
  }

  function submit() {
    show(errorEl, "");
    hideRegister();
    if (!apiUrl) {
      show(errorEl, "API_URL이 설정되지 않았습니다.");
      return;
    }
    var phone = digits(phoneInput.value);
    if (!/^0\d{8,10}$/.test(phone)) {
      show(errorEl, "회신에 사용한 연락처를 입력해 주세요.");
      phoneInput.focus();
      return;
    }
    btn.disabled = true;
    btn.textContent = "확인 중…";
    var getUrl =
      apiUrl +
      (apiUrl.indexOf("?") >= 0 ? "&" : "?") +
      "action=checkin&phone=" +
      encodeURIComponent(phone);
    fetch(getUrl, { method: "GET", redirect: "follow" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        // 구버전은 checkin을 모르고 집계 JSON만 돌립니다.
        if (data && typeof data.attend === "number" && data.checked_in_at == null && data.name == null) {
          throw new Error("outdated");
        }
        return data;
      })
      .catch(function () {
        return post({ action: "checkin", phone: phone });
      })
      .then(function (data) {
        btn.disabled = false;
        btn.textContent = "출석 확인";
        if (!data || !data.ok) {
          handleFailure(data && data.error, phone);
          return;
        }
        hideRegister();
        showResult(data);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = "출석 확인";
        show(
          errorEl,
          "서버 API가 예전 버전입니다. 스프레드시트 Apps Script에 docs/sheets-api/Code.gs 전체를 붙여 넣고 ‘배포 → 새 버전 관리’로 다시 배포해 주세요."
        );
        hideRegister();
      });
  }

  phoneInput.addEventListener("input", function () {
    var next = formatPhone(phoneInput.value);
    if (phoneInput.value !== next) phoneInput.value = next;
  });
  phoneInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") submit();
  });
  btn.addEventListener("click", submit);
  phoneInput.focus();
})();
