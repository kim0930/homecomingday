(function () {
  var config = window.RSVP_CONFIG || {};
  var apiUrl = (config.API_URL || "").trim();
  if (!apiUrl) return;

  function pad(num) {
    return (num < 10 ? "0" : "") + num;
  }

  function applyContent(content) {
    if (!content) return;
    var dateEl = document.querySelector('[data-field="datetime"]');
    if (dateEl) {
      dateEl.textContent = [content.date, content.time].filter(Boolean).join(" ");
    }
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
    var topDate = document.querySelector('[data-field="top_date"]');
    if (topDate) topDate.textContent = [content.date, content.time].filter(Boolean).join(" ");
  }

  function applyProgram(program) {
    var list = document.querySelector(".program-list");
    var note = document.querySelector('[data-field="note"]');
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
    if (note && note.getAttribute("data-field") === "note") {
      /* note already applied in applyContent */
    }
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
