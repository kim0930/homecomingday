(function () {
  var config = window.RSVP_CONFIG || {};
  var apiUrl = (config.API_URL || "").trim();
  var form = document.getElementById("rsvp-form");
  var attendEl = document.getElementById("attend-count");
  var sectionHead = document.querySelector(".reply-card .section-head");

  function showWarn(messages) {
    var warn = document.querySelector(".form-warn");
    if (!warn) {
      warn = document.createElement("div");
      warn.className = "banner warn form-warn";
      warn.setAttribute("role", "alert");
      if (form) form.insertAdjacentElement("beforebegin", warn);
    }
    warn.textContent = "";
    messages.forEach(function (text) {
      var note = document.createElement("p");
      note.textContent = text;
      warn.appendChild(note);
    });
  }

  function clearWarn() {
    var warn = document.querySelector(".form-warn");
    if (warn) warn.remove();
  }

  function showOk(text) {
    var old = document.querySelector(".reply-card .banner.ok");
    if (old) old.remove();
    var box = document.createElement("p");
    box.className = "banner ok";
    box.setAttribute("role", "status");
    box.textContent = text;
    if (sectionHead) sectionHead.insertAdjacentElement("afterend", box);
  }

  function setAttend(count) {
    if (attendEl) attendEl.textContent = String(count == null ? 0 : count);
  }

  function selectedLabel(select) {
    if (!select || !select.selectedOptions || !select.selectedOptions[0]) return "";
    return select.selectedOptions[0].textContent.trim();
  }

  function loadStats() {
    if (!apiUrl || !attendEl) return;
    fetch(apiUrl, { method: "GET" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && typeof data.attend === "number") setAttend(data.attend);
      })
      .catch(function () {
        /* 집계 API가 아직 없으면 0 유지 */
      });
  }

  function validate(formEl) {
    var messages = [];
    var consent = formEl.querySelector('[name="consent"]');
    if (!consent || !consent.checked) messages.push("개인정보 수집·이용에 동의해 주세요.");
    var att = formEl.querySelector('[name="attendance"]:checked');
    if (!att) messages.push("참석 여부를 선택해 주세요.");
    var name = (formEl.querySelector('[name="name"]') || {}).value || "";
    if (!name.trim()) messages.push("이름을 입력해 주세요.");
    var affiliation = formEl.querySelector('[name="affiliation"]');
    if (!affiliation || !affiliation.value) messages.push("소속학과를 선택해 주세요.");
    var sy = formEl.querySelector('[name="student_year"]');
    if (!sy || !sy.value) messages.push("학번을 선택해 주세요.");
    var phone = (formEl.querySelector('[name="phone"]') || {}).value || "";
    if (!/^0\d{8,10}$/.test(String(phone).replace(/\D/g, ""))) {
      messages.push("연락처를 숫자로 입력해 주세요.");
    }
    var email = ((formEl.querySelector('[name="email"]') || {}).value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      messages.push("이메일 주소를 올바르게 입력해 주세요.");
    }
    return messages;
  }

  function payloadFrom(formEl) {
    var att = formEl.querySelector('[name="attendance"]:checked');
    return {
      consent: formEl.querySelector('[name="consent"]').checked ? "yes" : "",
      attendance: att ? att.value : "",
      name: formEl.querySelector('[name="name"]').value,
      affiliation: formEl.querySelector('[name="affiliation"]').value,
      student_year: formEl.querySelector('[name="student_year"]').value,
      grad_year: formEl.querySelector('[name="grad_year"]').value,
      workplace: formEl.querySelector('[name="workplace"]').value,
      title: formEl.querySelector('[name="title"]').value,
      phone: formEl.querySelector('[name="phone"]').value,
      email: formEl.querySelector('[name="email"]').value,
      message: formEl.querySelector('[name="message"]').value,
      affiliation_label: selectedLabel(formEl.querySelector('[name="affiliation"]')),
      student_year_label: selectedLabel(formEl.querySelector('[name="student_year"]')),
      grad_year_label: selectedLabel(formEl.querySelector('[name="grad_year"]')),
    };
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearWarn();
      var messages = validate(form);
      if (!apiUrl) {
        messages.push("회신 API가 아직 연결되지 않았습니다. 관리자에게 문의해 주세요.");
      }
      if (messages.length) {
        showWarn(messages);
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "보내는 중…";
      }

      fetch(apiUrl, {
        method: "POST",
        // text/plain 으로 보내 CORS preflight 를 피합니다.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payloadFrom(form)),
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (!data || !data.ok) {
            showWarn([(data && data.error) || "회신 전송에 실패했습니다. 잠시 후 다시 시도해 주세요."]);
            return;
          }
          if (data.stats && typeof data.stats.attend === "number") {
            setAttend(data.stats.attend);
          }
          var status = data.attendance || "회신";
          var text = status + "으로 회신했습니다. 확인해 주셔서 감사합니다.";
          if (data.updated) text += " 같은 연락처의 이전 응답을 수정했습니다.";
          showOk(text);
          form.reset();
          var phone = document.getElementById("phone");
          if (phone) phone.dispatchEvent(new Event("input"));
        })
        .catch(function () {
          showWarn(["회신 전송에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."]);
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "회신하기";
          }
        });
    });
  }

  loadStats();
})();
