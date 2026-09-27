# PRO-CTCAE 한국어 설문 웹사이트

외래기반 항체-약물 접합체(ADC) 치료를 받는 암 환자의 증상 부담 연구용 온라인 설문입니다.
Next.js(App Router) + Neon Postgres, Vercel 배포.

## 기능

- **참여신청** (`/register`): 신청 저장 후 연구팀에 솔라피 문자 알림. 발송 성공/실패는 관리자 화면에 표시
- **본인확인** (`/`): 이름 + 생년월일로 참여자번호 조회 (관리자가 번호를 배정한 신청자만 통과)
- **설문 선택** (`/select`): PRO-CTCAE / EORTC QLQ-C30 / W0 기본정보
- **PRO-CTCAE** (`/survey`): 80개 증상 항목·124문항을 영역별로 표시
  - 선택할 때마다 자동 저장, 중간에 나가도 다시 들어오면 이어서 진행 (미완료 세션 재사용, 기한 없음)
  - "이 영역 증상이 모두 없었어요" 버튼, 미응답 문항 표시
  - 고령 환자용 UI (큰 글씨·큰 버튼·고대비). 문항·선택지 문구와 증상별 묶음은 NCI 원문 그대로 유지
- **문의 버튼**: 설문 중 연구팀에 메시지 전송
- **관리자** (`/admin`, 비밀번호 로그인): 설문 응답·CSV, 참여신청(번호 배정·문자알림 상태), 환자 문의, 환자별 등급 대시보드

## 구조

- 모든 DB 접근은 서버 액션에서만 실행됩니다. 브라우저에는 DB 접속 정보가 전달되지 않습니다.
  - `src/lib/actions.ts` — 환자용 (입력값 검증 포함, 세션 UUID가 해당 세션 쓰기 권한 역할)
  - `src/lib/adminActions.ts` — 관리자용 (각 액션이 관리자 쿠키를 직접 확인)
  - `src/lib/db.ts` — Neon 클라이언트 (서버 전용)
- `db/schema.sql` — 전체 스키마 (재실행 가능)

## 시작하기

```bash
npm install
cp .env.local.example .env.local   # 값 채우기
npm run dev
```

스키마는 Neon 콘솔 SQL Editor에서 `db/schema.sql`을 실행해 만듭니다.

## 환경변수

| 이름 | 용도 |
|---|---|
| `DATABASE_URL` | Neon 접속 (Vercel Neon 연동이 자동 등록) |
| `ADMIN_PASSWORD` | `/admin` 로그인 비밀번호 |
| `SOLAPI_API`, `SOLAPI_SECRET` | 참여신청 문자 알림 |
| `SMS_NOTIFY_TO` | (선택) 알림 수신번호 덮어쓰기, 쉼표 구분 |

## 배포

`main` 브랜치에 push하면 Vercel이 자동 배포합니다.

## 라이선스

PRO-CTCAE™ 문항은 미국 국립암연구소(NCI)가 개발한 도구입니다. NCI의 이용약관을 따릅니다.
