# 정부지원사업 관리 시스템 - 프로젝트 컨텍스트

## 프로젝트 개요
정부지원사업 공고 관리 + 사업비 예산 관리 웹사이트
- 사용자: 내부 담당자 3명 (윤진성, 박철우, 정민혁)
- 배포: https://govmanager.vercel.app
- 스택: Next.js 14 + Supabase + shadcn/ui + Tailwind CSS

## 컬러 시스템
- 메인: #1e2c33 (다크 네이비)
- 서브: #384e5d, #707d89, #adbac9, #ced7df, #ecf0f4

## DB (Supabase)
- projects 테이블: 공고 전체 데이터
- budget_items 테이블: 비목별 예산 (미완성)
- expenses 테이블: 집행내역 (미완성)

## 주요 파일
- app/page.tsx: 메인 대시보드
- components/ProjectGrouped.tsx: 상태별 섹션 공고 목록 (현재 메인)
- components/ProjectTable.tsx: 테이블 뷰 (보조)
- components/ProjectDetailModal.tsx: 공고 상세/수정 모달
- components/AddEditProjectModal.tsx: 공고 추가/수정 폼
- components/StatusBadge.tsx: 상태 뱃지
- types/project.ts: Project 타입 + 상태 목록
- lib/supabase.ts: Supabase 클라이언트

## 완성된 기능
- [x] 공고 상태별 섹션 뷰 (접기/펼치기)
- [x] 공고 추가/수정/삭제
- [x] 상태 변경 (모달에서)
- [x] D-day 카운터 (7일 이내 빨강, 14일 이내 주황)
- [x] 담당자 필터
- [x] 검색 (사업명/부처/담당자)
- [x] 미선정 사유 입력/수정
- [x] 구글 드라이브 링크 연동 (제안서/발표자료)
- [x] 요약 카드 (최종선정/서류통과/제출완료/지원예정)

## 회사 프로필 (핏투게더)
- 회사명: 주식회사 핏투게더
- 기업유형: 중소기업, 벤처기업
- 설립: 2017.03.31 (업력 약 9년)
- 직원수: 30명
- 연매출: 32.4억원
- 소재지: 서울 용산구 한강대로98길 3, 3층
- 주요사업: EPTS, 웨어러블기기, 스포츠 팀/선수 데이터 관리 솔루션, 생체데이터 AI 분석, 경기력 향상, 제조업, SW개발업, 전자장비개발업
- 보유인증: 벤처기업, 이노비즈, 기업부설연구소, ISO9001, FIFA Quality인증, World Rugby인증, WCA인증
- 주요고객: B2B, 프로/아마추어팀, 스포츠기관

## 남은 작업 (우선순위)
- [ ] 2순위: 사업비 예산 관리 (budget_items, expenses 테이블 활용)
- [ ] 3순위: 마감 임박 이메일 알림
- [ ] 3순위: 엑셀 내보내기

## 상태 목록
최종 선정 / 서류 통과 / 제출 완료 / 지원예정 / 공고 예정 / 검토중 / 미선정 / 지원취소

## GSD 원칙
- 기능 하나씩 작은 단위로 작업
- 새 대화 시작 시 이 파일 먼저 읽기
- 완성된 기능은 체크 표시로 업데이트
