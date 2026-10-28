# 2026 건축공학인의 밤

서울과학기술대학교 건축학부 건축공학전공 행사 안내·사전 등록 페이지입니다.

## GitHub Pages

공개 안내는 `docs/` 정적 사이트로 호스팅됩니다.

- 참석 회신·실시간 참석 인원 집계는 Google 스프레드시트 + Apps Script 웹 앱으로 처리합니다.
- 회신 시 학부 사무실(`hyeryeon@seoultech.ac.kr`)로 알림 메일이 발송되고, 시트에 명단이 쌓입니다.
- 같은 연락처로 다시 보내면 기존 행이 수정됩니다. 공개 화면에는 **참석** 인원만 표시합니다.

### Apps Script 배포 (최초 1회)

1. [새 Google 스프레드시트](https://sheets.google.com)를 만듭니다.
2. **확장 프로그램 → Apps Script**에서 `docs/sheets-api/Code.gs` 내용을 붙여 넣고 저장합니다.
3. `NOTIFY_EMAIL`이 학부 사무실 주소인지 확인합니다.
4. **배포 → 새 배포 → 유형: 웹 앱**
   - 실행 계정: **나**
   - 액세스 권한: **모든 사용자**
5. 배포된 웹 앱 URL을 복사해 `docs/rsvp-config.js`의 `API_URL`에 넣습니다.

```js
window.RSVP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXX/exec",
};
```

6. `docs/`를 GitHub Pages로 배포(또는 push)한 뒤, 페이지에서 참석 숫자가 갱신되는지 확인합니다.
7. 코드를 수정하면 Apps Script에서 **새 버전으로 다시 배포**해야 반영됩니다.

## 로컬 Flask (명단·CSV 관리)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

- 안내/회신: http://127.0.0.1:5000/
- 관리 명단: http://127.0.0.1:5000/admin  
  기본 비밀번호: `ae-night-2026` (`ADMIN_PASSWORD`로 변경 가능)
