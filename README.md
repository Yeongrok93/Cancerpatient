# PRO-CTCAE 한국어 설문 웹사이트

NCI PRO-CTCAE™ (Patient-Reported Outcomes version of the Common Terminology Criteria for Adverse Events) 한국어 설문을 온라인으로 조사할 수 있는 Next.js 웹 애플리케이션입니다.

## 기능

- 80개 증상 항목, 총 124개 문항을 카테고리별로 분할 표시
- 4가지 응답 유형: 빈도, 심각도, 일상생활 영향, 유무
- 카테고리별 진행 자동 저장 (Supabase)
- 완료된 설문 확인 및 CSV 내보내기 (관리자 페이지)
- Vercel 원클릭 배포 지원

## 설문 구조

| 카테고리 | 항목 수 |
|---------|--------|
| 구강 및 소화기계 | 18개 |
| 호흡기 및 심혈관계 | 5개 |
| 피부, 모발 및 손발톱 | 15개 |
| 신경계 및 감각기계 | 9개 |
| 통증 | 4개 |
| 수면, 피로 및 정서 | 5개 |
| 생식기계 | 4개 |
| 비뇨기계 | 5개 |
| 성기능 | 6개 |
| 기타 전신 증상 | 9개 |

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Settings > API에서 URL과 anon key 복사

### 3. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일에 Supabase 정보 입력:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## Vercel 배포

1. GitHub에 레포지토리 push
2. [vercel.com](https://vercel.com)에서 레포지토리 import
3. Environment Variables에 `.env.local` 내용 입력
4. Deploy

또는 Vercel CLI 사용:

```bash
npx vercel
```

## 관리자 페이지

`/admin` 경로에서 모든 응답을 확인할 수 있습니다.

> **보안 주의**: 실제 배포 시에는 `/admin` 페이지를 인증으로 보호하는 것을 권장합니다.

## 라이선스

PRO-CTCAE™ 문항은 미국 국립암연구소(NCI)가 개발한 도구입니다. NCI의 이용약관을 따릅니다.
