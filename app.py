"""2026 건축공학인의 밤 안내 및 참석 회신.

실행: python app.py
관리 화면: /admin  (비밀번호는 ADMIN_PASSWORD, 기본값 ae-night-2026)
"""

import csv
import hmac
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path

from flask import (
    Flask,
    Response,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "rsvp.db"
SECRET_PATH = DATA_DIR / ".secret"
KST = timezone(timedelta(hours=9))

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "ae-night-2026")

AFFILIATIONS = {
    "ae_student": "건축공학전공 재학생",
    "ae_alumni": "건축공학전공 졸업생",
    "me_student": "건축기계설비공학과 재학생",
    "me_alumni": "건축기계설비공학과 졸업생",
    "sc_student": "스마트시티공학과 재학생",
    "sc_alumni": "스마트시티공학과 졸업생",
    "faculty": "교직원",
    "alumni": "동문",
    "other": "기타",
}
ATTENDANCE = {
    "attend": "참석",
}
STUDENT_YEARS = {f"{y % 100:02d}": f"{y % 100:02d}학번" for y in range(2026, 1979, -1)}
GRAD_YEARS = {str(y): f"{y}년 졸업" for y in range(2026, 1989, -1)}

EVENT = {
    "year": "2026",
    "title": "건축공학인의 밤",
    "date": "2026년 11월 11일 (수)",
    "time": "18:00",
    "place": "100주년기념관 3층 목산갤러리",
    "campus": "서울과학기술대학교",
    "address": "서울 노원구 공릉로 232",
    "host": "건축학부 건축공학전공",
    "invite_title": "시간을 넘어 함께, 건축공학의 인연을 다시 만나다.",
    "invite_body": (
        "건축공학전공의 발전을 위해 늘 관심과 성원을 보내주시는 동문 여러분께 "
        "뜻깊은 만남의 자리를 준비하고 있습니다. "
        "바쁘시더라도 참석하셔서 자리를 빛내주시길 부탁드립니다."
    ),
    "audience": "건축공학전공, 건축기계설비공학과, 스마트시티공학과 재학생·동문·교직원",
    "sponsors": "건축기계설비공학과, 스마트시티공학과, 계룡건설",
    "meal": "뷔페",
    "benefit": "현장에 참여한 학생에게 EPiC 점수 100점",
    "raffle": "에어팟, 스피커, 쿠폰 등",
    "contact": "02-970-6551",
    "notice_url": (
        "https://architecture.seoultech.ac.kr/bachelor_of_information/notice"
        "?do=view&profboardidx=0&bnum=570&bidx=896360&cate=7&allboard=false&nowpage=1"
    ),
    "map_url": "https://map.naver.com/p/search/서울과학기술대학교%20100주년기념관",
    "program": [
        {"title": "우수 작품 전시회", "remark": "학술대회 수상자"},
        {"title": "참석자 등록 및 기념품 배부", "remark": ""},
        {"title": "뷔페 식사", "remark": ""},
        {"title": "개회사 및 축사", "remark": ""},
        {"title": "교직원 및 내·외빈 소개", "remark": "사회자"},
        {"title": "전공동아리 및 연구실 소개", "remark": ""},
        {
            "title": "졸업작품 우수 시상 및 장학금 수여",
            "remark": "캡스톤디자인(졸업작품), 학술발표대회, 지건 홍상일, 대한전문건설협회, 덕신EPC",
        },
        {"title": "학생회 활동 보고", "remark": ""},
        {"title": "Cross-Year 활동 보고", "remark": ""},
        {"title": "북경 냉동공조 엑스포 참관기", "remark": "건축기계설비공학과"},
        {
            "title": "부대행사",
            "remark": "경품 및 추첨 퀴즈 행사 (에어팟, 스피커, 쿠폰 등)",
        },
        {"title": "폐회", "remark": ""},
    ],
    "note": "상세 일정은 추후 업데이트 예정이며 일정이 변경될 수 있습니다.",
}


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = load_secret()
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024

    init_db()

    @app.context_processor
    def inject_labels():
        return {
            "affiliations": AFFILIATIONS,
            "attendance_labels": ATTENDANCE,
            "student_years": STUDENT_YEARS,
            "grad_years": GRAD_YEARS,
            "csrf": csrf_token(),
        }

    @app.get("/")
    def index():
        flash = session.pop("flash", None)
        form_error = session.pop("form_error", None) or {}
        return render_template(
            "index.html",
            event=EVENT,
            stats=attendance_stats(),
            form=form_error.get("form") or empty_form(),
            errors=form_error.get("errors") or [],
            flash=flash,
            csrf=csrf_token(),
        )

    @app.post("/rsvp")
    def rsvp():
        if not valid_csrf(request.form.get("csrf")):
            session["form_error"] = {
                "errors": ["페이지를 새로고침한 뒤 다시 보내 주세요."],
                "form": form_from(request.form),
            }
            return redirect(url_for("index") + "#reply")
        if request.form.get("website"):
            session["flash"] = {"kind": "ok", "text": "회신을 남겼습니다."}
            return redirect(url_for("index") + "#reply")

        cleaned, errors = validate_rsvp(request.form)
        if errors:
            session["form_error"] = {"errors": errors, "form": form_from(request.form)}
            return redirect(url_for("index") + "#reply")

        updated = save_rsvp(cleaned)
        text = f"{cleaned['name']} 님, 참석으로 등록했습니다."
        if updated:
            text += " 같은 연락처의 이전 응답을 수정했습니다."
        else:
            text += " 같은 연락처로 다시 보내면 응답을 고칠 수 있습니다."
        session["flash"] = {"kind": "ok", "text": text}
        return redirect(url_for("index") + "#reply")

    @app.route("/admin", methods=["GET", "POST"])
    def admin():
        if request.method == "POST":
            password = request.form.get("password", "")
            if hmac.compare_digest(password, ADMIN_PASSWORD):
                session["admin"] = True
                return redirect(url_for("admin"))
            return render_template("admin.html", event=EVENT, error="비밀번호가 맞지 않습니다.", rows=None)
        if not session.get("admin"):
            return render_template("admin.html", event=EVENT, error=None, rows=None)
        return render_template(
            "admin.html",
            event=EVENT,
            error=None,
            rows=list_rsvps(),
            stats=attendance_stats(),
            by_affiliation=affiliation_stats(),
        )

    @app.post("/admin/logout")
    def admin_logout():
        if valid_csrf(request.form.get("csrf")):
            session.pop("admin", None)
        return redirect(url_for("admin"))

    @app.post("/admin/delete/<int:row_id>")
    def admin_delete(row_id):
        if not session.get("admin") or not valid_csrf(request.form.get("csrf")):
            return redirect(url_for("admin"))
        with connect() as conn:
            conn.execute("DELETE FROM rsvps WHERE id = ?", (row_id,))
        return redirect(url_for("admin"))

    @app.get("/admin/export.csv")
    def admin_export():
        if not session.get("admin"):
            return redirect(url_for("admin"))
        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["이름", "소속학과", "학번·졸업연도", "현직장", "직책", "연락처", "메시지", "최초 회신", "수정"])
        for row in list_rsvps():
            writer.writerow([
                row["name"],
                AFFILIATIONS.get(row["affiliation"], row["affiliation"]),
                row["detail"],
                row["workplace"],
                row["title"],
                row["phone_display"],
                row["message"],
                row["created_at"],
                row["updated_at"],
            ])
        payload = "\ufeff" + buffer.getvalue()
        return Response(
            payload,
            mimetype="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=architectural-night-rsvp.csv"},
        )

    return app


def load_secret():
    DATA_DIR.mkdir(exist_ok=True)
    if SECRET_PATH.exists():
        return SECRET_PATH.read_text().strip()
    value = secrets.token_hex(32)
    SECRET_PATH.write_text(value)
    return value


def csrf_token():
    token = session.get("csrf")
    if not token:
        token = secrets.token_hex(16)
        session["csrf"] = token
    return token


def valid_csrf(value):
    expected = session.get("csrf", "")
    return bool(value) and hmac.compare_digest(value, expected)


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    DATA_DIR.mkdir(exist_ok=True)
    with connect() as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rsvps (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                affiliation TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                workplace TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL UNIQUE,
                attendance TEXT NOT NULL,
                guests INTEGER NOT NULL DEFAULT 0,
                message TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        existing = {row[1] for row in conn.execute("PRAGMA table_info(rsvps)").fetchall()}
        if "workplace" not in existing:
            conn.execute("ALTER TABLE rsvps ADD COLUMN workplace TEXT NOT NULL DEFAULT ''")
        if "title" not in existing:
            conn.execute("ALTER TABLE rsvps ADD COLUMN title TEXT NOT NULL DEFAULT ''")


def now_kst():
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M")


def empty_form():
    return {
        "name": "",
        "affiliation": "",
        "student_year": "",
        "grad_year": "",
        "workplace": "",
        "title": "",
        "phone": "",
        "message": "",
    }


def form_from(source):
    form = empty_form()
    for key in form:
        form[key] = (source.get(key) or "").strip()
    return form


def detail_label(student_year, grad_year):
    parts = []
    if student_year in STUDENT_YEARS:
        parts.append(STUDENT_YEARS[student_year])
    if grad_year in GRAD_YEARS:
        parts.append(GRAD_YEARS[grad_year])
    return " · ".join(parts)


def digits_only(value):
    return re.sub(r"\D", "", value or "")


def format_phone(digits):
    if len(digits) == 11:
        return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    if len(digits) == 9:
        return f"{digits[:2]}-{digits[2:5]}-{digits[5:]}"
    return digits


def validate_rsvp(source):
    form = form_from(source)
    errors = []
    name = re.sub(r"\s+", " ", form["name"]).strip()
    if not name or len(name) > 40 or not re.search(r"[가-힣A-Za-z]", name):
        errors.append("이름을 입력해 주세요.")
    if form["affiliation"] not in AFFILIATIONS:
        errors.append("소속학과를 선택해 주세요.")
    if form["student_year"] and form["student_year"] not in STUDENT_YEARS:
        errors.append("학번을 목록에서 선택해 주세요.")
    if form["grad_year"] and form["grad_year"] not in GRAD_YEARS:
        errors.append("졸업연도를 목록에서 선택해 주세요.")
    workplace = re.sub(r"\s+", " ", form["workplace"]).strip()
    if len(workplace) > 60:
        errors.append("현직장은 60자 안으로 입력해 주세요.")
    title = re.sub(r"\s+", " ", form["title"]).strip()
    if len(title) > 40:
        errors.append("직책은 40자 안으로 입력해 주세요.")
    phone_digits = digits_only(form["phone"])
    if not re.fullmatch(r"0\d{8,10}", phone_digits):
        errors.append("연락처를 숫자로 입력해 주세요.")
    message = form["message"]
    if len(message) > 200:
        errors.append("메시지는 200자 안으로 입력해 주세요.")

    cleaned = {
        "name": name,
        "affiliation": form["affiliation"],
        "detail": detail_label(form["student_year"], form["grad_year"]),
        "workplace": workplace,
        "title": title,
        "phone": format_phone(phone_digits),
        "phone_key": phone_digits,
        "attendance": "attend",
        "guests": 0,
        "message": message,
    }
    return cleaned, errors


def save_rsvp(cleaned):
    stamp = now_kst()
    with connect() as conn:
        existing = conn.execute(
            "SELECT id FROM rsvps WHERE phone = ?",
            (cleaned["phone_key"],),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE rsvps
                SET name = ?, affiliation = ?, detail = ?, workplace = ?, title = ?,
                    attendance = ?, guests = ?, message = ?, updated_at = ?
                WHERE phone = ?
                """,
                (
                    cleaned["name"],
                    cleaned["affiliation"],
                    cleaned["detail"],
                    cleaned["workplace"],
                    cleaned["title"],
                    cleaned["attendance"],
                    cleaned["guests"],
                    cleaned["message"],
                    stamp,
                    cleaned["phone_key"],
                ),
            )
            return True
        conn.execute(
            """
            INSERT INTO rsvps
                (name, affiliation, detail, workplace, title, phone, attendance, guests, message, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cleaned["name"],
                cleaned["affiliation"],
                cleaned["detail"],
                cleaned["workplace"],
                cleaned["title"],
                cleaned["phone_key"],
                cleaned["attendance"],
                cleaned["guests"],
                cleaned["message"],
                stamp,
                stamp,
            ),
        )
        return False


def list_rsvps():
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM rsvps ORDER BY updated_at DESC, id DESC"
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["phone_display"] = format_phone(item["phone"])
        result.append(item)
    return result


def attendance_stats():
    with connect() as conn:
        attend = conn.execute(
            "SELECT COUNT(*) FROM rsvps WHERE attendance = 'attend'"
        ).fetchone()[0]
    return {
        "attend": attend,
        "headcount": attend,
        "total": attend,
    }


def affiliation_stats():
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT affiliation, COUNT(*) AS people
            FROM rsvps
            WHERE attendance = 'attend'
            GROUP BY affiliation
            ORDER BY people DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=os.environ.get("FLASK_DEBUG") == "1")
