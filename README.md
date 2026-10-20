# 2026 건축공학인의 밤

서울과학기술대학교 건축학부 건축공학전공 행사 안내·참석 회신 페이지입니다.

## GitHub Pages

공개 안내는 `docs/` 정적 사이트로 호스팅됩니다.

- 참석 등록은 [FormSubmit](https://formsubmit.co)을 통해 학부 사무실 이메일로 전달됩니다.
- 최초 1회 FormSubmit 확인 메일의 Activate 링크를 눌러야 접수가 시작됩니다.

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
