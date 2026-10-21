# PRO-CTCAE 한국어 설문 웹사이트

외래기반 항체-약물 접합체(ADC) 치료를 받는 암 환자의 증상 부담 연구용 온라인 설문입니다.
Next.js(App Router) + Neon Postgres, Vercel 배포.

## 기능

- **참여신청** (`/register`): 신청 저장 후 연구팀에 솔라피 문자 알림. 발송 성공/실패는 관리자 화면에 표시
- **본인확인** (`/`): 이름 + 생년월일로 참여자번호 조회 (관리자가 번호를 배정한 신청자만 통과)
- **설문 선택** (`/select`): 1. 기본정보(W0) → 2. 증상(PRO-CTCAE) → 3. 삶의 질(EORTC QLQ-C30) 순서
  - 기본정보: 처음 한 번만. 제출하면 비활성화
  - 증상: 처음엔 자유롭게, 이후 직전 완료일 + 6일부터 다시 열림
  - 삶의 질: 연구참여시작일부터 12주째가 속한 주(월~일)에 열리고 이후 12주마다 반복, 창마다 1회
  - 첫 설문을 시작하면 연구참여시작일이 자동 지정됨 (관리자 화면에서 수정 가능)
- **환자별 링크** (`/s/<토큰>/<w0|pro|qlq>`): 관리자 화면에서 환자·설문별 링크를 복사해 전달. 본인확인 없이 바로 해당 설문이 시작됨 (토큰은 64자 무작위, 링크 소지자 = 해당 환자)
- **안내 문자** (Vercel Cron, 매일 10시 KST): 연구참여 확인된 참여자에게 마지막 증상 설문 완료 7일 뒤 설문 링크·적립금 안내 문자 발송. 같은 완료분에는 한 번만 발송
- **PRO-CTCAE** (`/survey`): 80개 증상 항목·124문항을 영역별로 표시
  - 선택할 때마다 자동 저장, 중간에 나가도 다시 들어오면 이어서 진행 (미완료 세션 재사용, 기한 없음)
  - "이 영역 증상이 모두 없었어요" 버튼, 미응답 문항 표시
  - 고령 환자용 UI (큰 글씨·큰 버튼·고대비). 문항·선택지 문구와 증상별 묶음은 NCI 원문 그대로 유지
- **문의 버튼**: 설문 중 연구팀에 메시지 전송
- **관리자** (`/admin`, 아이디+비밀번호 로그인): 환자 선택(001 (이름) 형식) → 환자 대시보드(Composite grading / 전체 124문항 토글, CSV), 참여신청(번호 배정·문자알림 상태·연구참여 확인·연구참여시작일·설문 링크 복사), 환자 문의

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
| `ADMIN_USERNAME` | `/admin` 로그인 아이디 (기본값 `admin`) |
| `ADMIN_PASSWORD` | `/admin` 로그인 비밀번호 |
| `SOLAPI_API`, `SOLAPI_SECRET` | 참여신청 문자 알림 |
| `SMS_SENDER` | 솔라피에 등록된 발신번호 |
| `SMS_NOTIFY_TO` | 참여신청 알림 수신번호(쉼표 구분) |
| `CRON_SECRET` | Vercel Cron이 `/api/cron/reminders`를 호출할 때 쓰는 비밀값 (미설정 시 호출 거부) |
| `SITE_URL` | (선택) 안내 문자 링크의 기준 주소. 기본값 `https://cancerpatient.vercel.app` |

안내 문자 대상 확인: `GET /api/cron/reminders?dry=1` (`Authorization: Bearer $CRON_SECRET`) — 발송 없이 대상만 조회합니다.

## 배포

`main` 브랜치에 push하면 Vercel이 자동 배포합니다.

## 라이선스

PRO-CTCAE™ 문항은 미국 국립암연구소(NCI)가 개발한 도구입니다. NCI의 이용약관을 따릅니다.
