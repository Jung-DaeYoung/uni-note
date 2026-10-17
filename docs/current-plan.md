# 자동 저장 로컬 복구 버그 수정 (PLANS.md 단계 0-1, P1-1)

## 문제

1. **비교 형식 불일치:** `useNoteAutosave.getInitialContent`가 로컬 백업의 `timestamp`(숫자 ms)와 서버 `updatedAt`(ISO 문자열, `LocalDateTime`)을 `>`로 비교한다. 숫자와 문자열 비교는 항상 false라서, 서버에 내용이 있는 노트는 로컬 백업이 복구되지 않는다. 서버 저장(2초 debounce) 전에 탭을 닫거나 저장에 실패하면 입력이 사라진다.
   - 기존 테스트는 `updatedAt: 100`처럼 숫자를 넣어 이 버그를 가렸다.
2. **복구 후 재저장 누락:** 복구에 성공하더라도 `syncEditor`가 저장 기준점(`lastSavedJson`)을 복구한 내용으로 잡는다. 그래서 서버에 없는 내용이 다시 저장되지 않는다.
3. **저장 응답의 시각:** `PUT /api/notes/{id}` 응답의 `updatedAt`이 저장 전 값이다. `@UpdateTimestamp`는 flush 시점에 채워지는데, 응답은 flush 전에 만들어진다(실측: PUT 응답 21:30:57, 이어서 GET 21:30:58).

## 접근: 시계를 비교하지 않고 "어느 서버 버전 위의 편집인가"로 판단

- 브라우저 시계와 서버 `LocalDateTime`(시간대 없음, JVM 기본 시간대)을 비교하지 않는다. 시간대가 어긋나면 오래된 로컬 내용이 최신 서버 내용을 덮어쓸 수 있기 때문이다.
- **로컬 백업 형식:** `{ content, timestamp, baseUpdatedAt }`. `baseUpdatedAt`은 편집의 기준이 된 서버 `updatedAt` 문자열이다.
- **기준 버전 기록:** `useNoteAutosave`는 처음에 `initialData.updatedAt`을 기준 버전으로 잡는다. 서버 저장이 성공하면 응답의 `updatedAt`으로 바꾼다.
- **저장 성공 후 정리:** 로컬 백업이 방금 저장한 내용과 같으면 지운다. 저장하는 사이에 더 입력한 내용은 지우지 않는다.
- **복구 규칙:** 로컬 백업이 있고, 그 `baseUpdatedAt`이 지금 서버의 `updatedAt`과 같으면 복구한다. 서버 내용이 없을 때도 복구한다(기존과 같음).
  - 기준 버전이 다르면 다른 곳에서 서버 내용이 바뀐 것이므로 서버 내용을 쓴다.
  - `baseUpdatedAt`이 없는 옛 형식 백업은 복구하지 않는다. 지금도 사실상 복구되지 않던 것이다.
  - 충돌을 사용자가 고르게 하는 UI는 P1-1의 다음 작업으로 남긴다.
- **복구 후 저장:** `syncEditor`의 저장 기준점을 서버 내용으로 잡는다. 그러면 복구한 내용이 서버와 다를 때 자동 저장이 예약된다.
- **백엔드:** `NoteService.saveNote`를 `saveAndFlush`로 바꿔 응답의 `updatedAt`이 실제 저장 시각이 되게 한다. 응답 필드는 그대로이고 값만 정확해진다.

## 검증

- **vitest `useNoteAutosave`:**
  - 기준 버전이 같으면 복구하고, 다르면 서버 내용을 쓴다.
  - 옛 형식 백업은 무시한다.
  - 복구하면 서버 저장이 예약된다.
  - 저장이 성공하면 같은 내용의 백업을 지우고, 기준 버전을 응답 값으로 갱신한다.
  - 저장 실패 시 백업이 남는다.
- **`NoteServiceTest`:** `saveAndFlush`를 쓰는지 확인한다.
- **명령:** `backend\gradlew.bat test`, `npm run lint`, `npm run build`, `npm run test`
- **실제 앱:** 입력 직후(2초 안) 새로고침하면 입력이 복구되고 이어서 서버에 저장되는지, 저장된 뒤 새로고침하면 백업이 남지 않는지 확인한다.
