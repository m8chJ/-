#!/bin/bash

# 핏투게더 정부공고 자동 수집 (평일 오전 8시)
cd /Users/fitogether1/Desktop/gov-project-manager

# Node.js 경로 설정 (nvm 등 사용 시)
export PATH="/usr/local/bin:/usr/bin:/opt/homebrew/bin:$PATH"

# 스크립트 실행 및 출력 캡처
OUTPUT=$(node scripts/fetch-announcements.mjs 2>&1)

# 저장된 개수 파싱
SAVED=$(echo "$OUTPUT" | grep -o '[0-9]*개 신규 공고 저장' | grep -o '[0-9]*' | head -1)
MATCHED=$(echo "$OUTPUT" | grep -o '[0-9]*개 매칭' | grep -o '[0-9]*' | head -1)

# 결과 메시지 구성
if [ -z "$SAVED" ]; then
  MSG="오류 발생 - 터미널에서 확인 필요"
  TITLE="⚠️ 공고 수집 실패"
elif [ "$SAVED" = "0" ]; then
  MSG="새 공고 없음 (${MATCHED}개 분석됨)"
  TITLE="정부공고 수집 완료"
else
  MSG="신규 ${SAVED}개 저장 완료 (${MATCHED}개 매칭)"
  TITLE="🎯 새 공고 ${SAVED}개 발견!"
fi

# macOS 알림 전송
osascript -e "display notification \"$MSG\" with title \"$TITLE\" subtitle \"govmanager.vercel.app\" sound name \"Glass\""

# 로그 저장
LOG_FILE="/Users/fitogether1/Desktop/gov-project-manager/scripts/run.log"
echo "$(date '+%Y-%m-%d %H:%M') | $TITLE | $MSG" >> "$LOG_FILE"
echo "$OUTPUT" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"
