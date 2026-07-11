# 쏙쏙이 CCheck 웹 대시보드

관리자 웹 대시보드와 실시간 분류 화면을 포함한 React + TypeScript + Vite 프론트엔드입니다.

## 실행

```bash
npm install
npm run dev
```

기본 주소는 `http://127.0.0.1:5174`입니다.

## 환경변수

`.env.example`을 참고해 `.env`를 만들 수 있습니다.

- `VITE_API_BASE_URL`: 백엔드 API 주소. 기본값은 `http://localhost:8000`
- `VITE_USE_MOCK`: `true`이면 더미 데이터로 동작, `false`이면 실제 API 호출
- `VITE_SHOW_TEST_PANEL`: `true`이면 개발용 시나리오 버튼 표시
- `VITE_POLL_INTERVAL_MS`: 최신 상태와 적재량 polling 간격

## 경로

- `/dashboard`: 관리자 메인 대시보드
- `/display`: 실시간 분류 화면
- `/logs`: 전체 분리배출 로그
- `/carbon`: 탄소 감축 분석
- `/bins`: 수거함 적재량
- `/alerts`: 알림 목록

Mock 모드에서는 테스트 패널 버튼으로 실시간 분류 상태, 로그, 요약 카드, 차트가 함께 갱신됩니다.
