# 2026 건축공학인의 밤

서울과학기술대학교 건축학부 건축공학전공 행사 안내·사전 등록 페이지입니다.

## GitHub Pages

공개 안내는 `docs/` 정적 사이트로 호스팅됩니다.

- 참석 회신·실시간 집계·행사 안내/식순 편집은 Google 스프레드시트 + Apps Script 웹 앱으로 처리합니다.
- 공개 페이지: https://kim0930.github.io/homecomingday/
- 관리자: https://kim0930.github.io/homecomingday/admin.html  
  비밀번호는 `Code.gs`의 `ADMIN_PASSWORD`와 동일합니다.

### 관리자에서 할 수 있는 일

- **행사 안내** / **이날의 자리** 내용 수정·저장 (공개 페이지에 즉시 반영)
- **참석 회신 상세** 미리보기 및 **엑셀(.xlsx) 내려받기**
- **당일 출석 QR** 확인·인쇄 (참석자 스캔 → 연락처 입력 → 체크인)

### 행사 당일 출석 체크

- 출석 페이지: https://kim0930.github.io/homecomingday/checkin.html
- 관리자 화면에 같은 URL의 QR이 표시됩니다. 행사장에 붙여 두면 됩니다.
- 참석자는 사전 회신에 쓴 연락처로 출석 확인합니다. 시트 `체크인시각`·`테이블` 열에 기록됩니다.
- 자리표(`docs/sheets-api/건공인밤_자리배치_r2.xlsx`) 기준으로 관리자의 **자리표 테이블 반영**을 누르면 이름에 맞는 테이블 번호가 채워집니다.
- 출석 확인 화면에 **본인 테이블 번호**가 크게 표시됩니다.

### Apps Script 배포 (최초 1회 또는 Code.gs 수정 후)

1. 사용 중인 Google 스프레드시트에서 **확장 프로그램 → Apps Script**를 엽니다.
2. `docs/sheets-api/Code.gs` 전체를 붙여 넣고 저장합니다.
3. 필요하면 `ADMIN_PASSWORD`, `NOTIFY_EMAIL`을 수정합니다.
4. **배포 → 새 배포**(또는 기존 배포의 **새 버전 관리**) → 유형: **웹 앱**
   - 실행 계정: **나**
   - 액세스 권한: **모든 사용자**
5. 웹 앱 URL을 `docs/rsvp-config.js`의 `API_URL`에 넣고 push합니다.

```js
window.RSVP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXX/exec",
};
```

6. 첫 관리자 로그인 시 `Content`, `Program` 시트가 자동 생성되며 기본 안내·식순이 채워집니다.

## 로컬 Flask

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

- 안내/회신: http://127.0.0.1:5000/
- 로컬 명단: http://127.0.0.1:5000/admin  
- 로컬 출석: http://127.0.0.1:5000/checkin  
  (SQLite 기준. 공개 사이트의 시트 데이터와는 별개입니다.)
