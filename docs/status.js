(function () {
  var checkinBoard = document.getElementById("checkin-tally");
  var checkedCount = document.getElementById("checked-count");
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

  function makeItem(count, label) {
    var li = document.createElement("li");
    var strong = document.createElement("strong");
    strong.textContent = String(count == null ? 0 : count);
    var span = document.createElement("span");
    span.textContent = label;
    li.appendChild(strong);
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
        checkedList.appendChild(makeItem(row.people || 0, row.label || ""));
      });
      return;
    }
    if (mode === "status") {
      ((stats && stats.checked_by_status) || []).forEach(function (row) {
        if (!row) return;
        if (!row.people && row.key === "other") return;
        checkedList.appendChild(makeItem(row.people || 0, row.label || ""));
      });
      return;
    }
    var rows = ((stats && stats.checked_by_year) || []).slice().sort(function (a, b) {
      return cohortSortKey(a.year) - cohortSortKey(b.year);
    });
    rows.forEach(function (row) {
      if (!row || !row.people) return;
      checkedList.appendChild(makeItem(row.people, row.label || row.year + "학번"));
    });
    var other = stats && typeof stats.checked_other === "number" ? stats.checked_other : 0;
    if (other > 0) checkedList.appendChild(makeItem(other, "기타"));
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
      card.innerHTML =
        "<strong>" +
        (row.table || "") +
        "</strong>" +
        '<div class="table-label">번 테이블</div>' +
        '<div class="table-count">' +
        checked +
        " / " +
        assigned +
        "명</div>";
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
