(function () {
  var checkinBoard = document.getElementById("checkin-tally");
  var checkedCount = document.getElementById("checked-count");
  var checkedRsvpCount = document.getElementById("checked-rsvp-count");
  var checkedList = document.getElementById("checked-breakdown");
  var tableStatus = document.getElementById("table-status");
  var activePresence = "year";
  var latestStats = null;

  function cohortSortKey(year) {
    var value = parseInt(year, 10);
    if (isNaN(value)) return 9999;
    if (value >= 80 && value <= 99) return 1900 + value;
    if (value >= 0 && value < 50) return 2000 + value;
    if (value >= 50 && value <= 79) return 1900 + value;
    return 2000 + value;
  }

  function asCount(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function peopleByField(rows, field, value) {
    rows = rows || [];
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]) continue;
      if (String(rows[i][field]) === String(value)) return asCount(rows[i].people);
    }
    return 0;
  }

  function makeItem(count, label, rsvpCount) {
    var li = document.createElement("li");
    var strong = document.createElement("strong");
    strong.className = "tally-figure";
    var main = document.createElement("span");
    main.className = "tally-main";
    main.textContent = String(asCount(count));
    var sub = document.createElement("em");
    sub.className = "tally-subcount";
    sub.title = "참석 회신";
    sub.textContent = "/" + String(asCount(rsvpCount));
    strong.appendChild(main);
    strong.appendChild(sub);
    li.appendChild(strong);
    var span = document.createElement("span");
    span.className = "tally-label";
    span.textContent = label;
    li.appendChild(span);
    return li;
  }

  function renderCheckedBreakdown(stats, mode) {
    if (!checkedList) return;
    checkedList.innerHTML = "";
    if (mode === "dept") {
      ((stats && stats.by_dept) || []).forEach(function (row) {
        if (!row) return;
        if (!row.people && row.key === "other") return;
        checkedList.appendChild(
          makeItem(
            peopleByField(stats.checked_by_dept, "key", row.key),
            row.label || "",
            row.people || 0
          )
        );
      });
      return;
    }
    if (mode === "status") {
      ((stats && stats.by_status) || []).forEach(function (row) {
        if (!row) return;
        if (!row.people && row.key === "other") return;
        checkedList.appendChild(
          makeItem(
            peopleByField(stats.checked_by_status, "key", row.key),
            row.label || "",
            row.people || 0
          )
        );
      });
      return;
    }
    var seen = {};
    var rows = ((stats && stats.by_year) || []).slice().sort(function (a, b) {
      return cohortSortKey(a.year) - cohortSortKey(b.year);
    });
    rows.forEach(function (row) {
      if (!row || !row.people) return;
      seen[String(row.year)] = true;
      checkedList.appendChild(
        makeItem(
          peopleByField(stats.checked_by_year, "year", row.year),
          row.label || row.year + "학번",
          row.people
        )
      );
    });
    ((stats && stats.checked_by_year) || []).forEach(function (row) {
      if (!row || !row.people || seen[String(row.year)]) return;
      checkedList.appendChild(
        makeItem(row.people, row.label || row.year + "학번", 0)
      );
    });
    var otherChecked = stats && typeof stats.checked_other === "number" ? stats.checked_other : 0;
    var otherRsvp = stats && typeof stats.other === "number" ? stats.other : 0;
    if (otherChecked > 0 || otherRsvp > 0) {
      checkedList.appendChild(makeItem(otherChecked, "기타", otherRsvp));
    }
  }

  function setPresenceTab(mode) {
    activePresence = mode || "year";
    if (!checkinBoard) return;
    Array.prototype.forEach.call(checkinBoard.querySelectorAll(".tally-tab"), function (tab) {
      var on = tab.getAttribute("data-presence") === activePresence;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    renderCheckedBreakdown(latestStats, activePresence);
  }

  function renderTables(stats) {
    if (!tableStatus) return;
    tableStatus.innerHTML = "";
    var rows = (stats && stats.by_table) || [];
    if (!rows.length) {
      var empty = document.createElement("p");
      empty.className = "panel-note";
      empty.textContent = "아직 테이블 배정·출석 데이터가 없습니다.";
      tableStatus.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      var card = document.createElement("div");
      var assigned = asCount(row.assigned);
      var checked = asCount(row.checked_in);
      card.className = "table-status-card" + (assigned && checked >= assigned ? " is-full" : "");

      var strong = document.createElement("strong");
      strong.className = "tally-figure";
      var main = document.createElement("span");
      main.className = "tally-main";
      main.textContent = String(checked);
      var sub = document.createElement("em");
      sub.className = "tally-subcount";
      sub.title = "참석 회신";
      sub.textContent = "/" + String(assigned);
      strong.appendChild(main);
      strong.appendChild(sub);
      card.appendChild(strong);

      var label = document.createElement("div");
      label.className = "table-label";
      label.textContent = (row.table || "") + "번 테이블";
      card.appendChild(label);

      tableStatus.appendChild(card);
    });
  }

  function renderPresenceStats(stats) {
    latestStats = stats || {};
    if (checkedCount) {
      checkedCount.textContent = String(asCount(latestStats.checked_in));
    }
    if (checkedRsvpCount) {
      checkedRsvpCount.textContent = "/" + String(asCount(latestStats.attend));
    }
    setPresenceTab(activePresence);
    renderTables(latestStats);
  }

  if (checkinBoard) {
    checkinBoard.addEventListener("click", function (event) {
      var tab = event.target.closest(".tally-tab");
      if (!tab) return;
      setPresenceTab(tab.getAttribute("data-presence"));
    });
  }

  window.renderPresenceStats = renderPresenceStats;
})();
