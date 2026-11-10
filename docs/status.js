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

  function peopleByField(rows, field, value) {
    rows = rows || [];
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]) continue;
      if (String(rows[i][field]) === String(value)) return rows[i].people || 0;
    }
    return 0;
  }

  function makeItem(count, label, rsvpCount) {
    var li = document.createElement("li");
    var strong = document.createElement("strong");
    strong.textContent = String(count == null ? 0 : count);
    li.appendChild(strong);
    var sub = document.createElement("em");
    sub.className = "tally-subcount";
    sub.title = "참석 회신";
    sub.textContent = String(rsvpCount == null ? 0 : rsvpCount);
    li.appendChild(sub);
    var span = document.createElement("span");
    span.textContent = label;
    li.appendChild(span);
    return li;
  }

  function renderCheckedBreakdown(stats, mode) {
    if (!checkedList) return;
    checkedList.innerHTML = "";
    if (mode === "dept") {
      ((stats && stats.checked_by_dept) || []).forEach(function (row) {
        if (!row) return;
        if (!row.people && row.key === "other") return;
        checkedList.appendChild(
          makeItem(
            row.people || 0,
            row.label || "",
            peopleByField(stats.by_dept, "key", row.key)
          )
        );
      });
      return;
    }
    if (mode === "status") {
      ((stats && stats.checked_by_status) || []).forEach(function (row) {
        if (!row) return;
        if (!row.people && row.key === "other") return;
        checkedList.appendChild(
          makeItem(
            row.people || 0,
            row.label || "",
            peopleByField(stats.by_status, "key", row.key)
          )
        );
      });
      return;
    }
    var rows = ((stats && stats.checked_by_year) || []).slice().sort(function (a, b) {
      return cohortSortKey(a.year) - cohortSortKey(b.year);
    });
    rows.forEach(function (row) {
      if (!row || !row.people) return;
      checkedList.appendChild(
        makeItem(
          row.people,
          row.label || row.year + "학번",
          peopleByField(stats.by_year, "year", row.year)
        )
      );
    });
    var other = stats && typeof stats.checked_other === "number" ? stats.checked_other : 0;
    if (other > 0) {
      checkedList.appendChild(
        makeItem(other, "기타", stats && typeof stats.other === "number" ? stats.other : 0)
      );
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
      var assigned = row.assigned || 0;
      var checked = row.checked_in || 0;
      card.className = "table-status-card" + (assigned && checked >= assigned ? " is-full" : "");

      var strong = document.createElement("strong");
      strong.textContent = String(checked);
      card.appendChild(strong);

      var sub = document.createElement("em");
      sub.className = "tally-subcount";
      sub.title = "참석 회신";
      sub.textContent = String(assigned);
      card.appendChild(sub);

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
      checkedCount.textContent = String(
        typeof latestStats.checked_in === "number" ? latestStats.checked_in : 0
      );
    }
    if (checkedRsvpCount) {
      checkedRsvpCount.textContent = String(
        typeof latestStats.attend === "number" ? latestStats.attend : 0
      );
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
