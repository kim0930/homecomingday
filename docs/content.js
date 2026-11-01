(function () {
  var config = window.RSVP_CONFIG || {};
  var apiUrl = (config.API_URL || "").trim();
  if (!apiUrl) return;

  function pad(num) {
    return (num < 10 ? "0" : "") + num;
  }

  function weekdayKo(day) {
    return ["일", "월", "화", "수", "목", "금", "토"][day] || "";
  }

  function normalizeDate(dateStr) {
    var s = String(dateStr || "").trim();
    if (!s) return "";

    // 이미 한국어 일자면 요일 표기만 정리
    var ko = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (ko) {
      var y = ko[1];
      var m = String(parseInt(ko[2], 10));
      var d = String(parseInt(ko[3], 10));
      var week = "";
      var weekMatch = s.match(/\(([일월화수목금토])\)/);
      if (weekMatch) week = weekMatch[1];
      else {
        var dt = new Date(Number(y), Number(m) - 1, Number(d));
        if (!isNaN(dt.getTime())) week = weekdayKo(dt.getDay());
      }
      return y + "년 " + m + "월 " + d + "일" + (week ? "(" + week + ")" : "");
    }

    // 시트 Date가 영어로 넘어온 경우 (Wed Nov 11 2026 …)
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return (
        parsed.getFullYear() +
        "년 " +
        (parsed.getMonth() + 1) +
        "월 " +
        parsed.getDate() +
        "일(" +
        weekdayKo(parsed.getDay()) +
        ")"
      );
    }
    return s
      .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, "")
      .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTime(timeStr) {
    var s = String(timeStr || "").trim();
    if (!s) return "";

    var ampm = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)/i);
    if (ampm) {
      var h = parseInt(ampm[1], 10);
      var min = ampm[2];
      var ap = ampm[3].toUpperCase();
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
      return pad(h) + ":" + min;
    }

    var hm = s.match(/^(\d{1,2}):(\d{2})/);
    if (hm) return pad(parseInt(hm[1], 10)) + ":" + hm[2];

    var asDate = new Date(s);
    if (!isNaN(asDate.getTime()) && /[A-Za-z]/.test(s)) {
      return pad(asDate.getHours()) + ":" + pad(asDate.getMinutes());
    }
    return s;
  }

  function formatDateTime(dateStr, timeStr) {
    return [normalizeDate(dateStr), normalizeTime(timeStr)].filter(Boolean).join(" ");
  }

  function applyContent(content) {
    if (!content) return;
    var when = formatDateTime(content.date, content.time);
    var dateEl = document.querySelector('[data-field="datetime"]');
    if (dateEl) dateEl.textContent = when;
    var topDate = document.querySelector('[data-field="top_date"]');
    if (topDate) topDate.textContent = when;

    var placeEl = document.querySelector('[data-field="place"]');
    if (placeEl) {
      var map = content.map_url
        ? ' <a href="' + content.map_url + '" target="_blank" rel="noopener">지도</a>'
        : "";
      placeEl.innerHTML =
        (content.campus || "") +
        (content.campus && content.place ? " " : "") +
        (content.place || "") +
        map;
    }
    ["audience", "sponsors", "meal_benefit", "raffle_contact", "note", "invite_title", "invite_body"].forEach(
      function (key) {
        var el = document.querySelector('[data-field="' + key + '"]');
        if (!el) return;
        if (key === "meal_benefit") {
          el.textContent = [content.meal, content.benefit].filter(Boolean).join(" · ");
        } else if (key === "raffle_contact") {
          var phone = content.contact || "";
          var tel = phone.replace(/\D/g, "");
          el.innerHTML =
            (content.raffle || "") +
            (content.raffle && phone ? " · " : "") +
            (phone ? '<a href="tel:' + tel + '">' + phone + "</a>" : "");
        } else {
          el.textContent = content[key] || "";
        }
      }
    );
  }

  function applyProgram(program) {
    var list = document.querySelector(".program-list");
    if (!list || !program || !program.length) return;
    list.innerHTML = "";
    program.forEach(function (item, index) {
      var li = document.createElement("li");
      var num = document.createElement("span");
      num.textContent = pad(index + 1);
      var body = document.createElement("div");
      var title = document.createElement("p");
      title.textContent = item.title || "";
      body.appendChild(title);
      var remarks = item.remark || [];
      if (Object.prototype.toString.call(remarks) !== "[object Array]") {
        remarks = remarks ? [String(remarks)] : [];
      }
      if (!remarks.length) {
        var empty = document.createElement("p");
        empty.className = "program-remark";
        empty.innerHTML = "&nbsp;";
        body.appendChild(empty);
      } else {
        remarks.forEach(function (line) {
          var remark = document.createElement("p");
          remark.className = "program-remark";
          remark.textContent = line;
          body.appendChild(remark);
        });
      }
      li.appendChild(num);
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  fetch(apiUrl + "?action=content")
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.ok) return;
      applyContent(data.content || {});
      applyProgram(data.program || []);
    })
    .catch(function () {
      /* 기본 HTML 유지 */
    });
})();
