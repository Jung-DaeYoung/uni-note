# [Uni Note] REST API 설계서

## 1. 개요
본 문서는 'Uni Note' 서비스의 프론트엔드(React)와 백엔드(Spring Boot) 간의 데이터 통신을 위한 RESTful API 규격을 정의합니다.

---

## 2. 기본 정보
- **Base URL**: `http://localhost:8080/api` (개발 환경 기준)
- **인증 방식**: JWT (JSON Web Token)
    - 로그인 성공 시 발급받은 토큰을 모든 요청의 헤더에 포함 (`Authorization: Bearer {token}`)
- **응답 형식**: JSON

---

## 3. 공통 응답 구조
```json
{
  "status": 200,
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": { ... }
}
```

---

## 4. 상세 API 규격

### 4.1. 인증 (Authentication)
| 기능 | 메서드 | 엔드포인트 | 설명 |
| :--- | :--- | :--- | :--- |
| 로그인 | `POST` | `/auth/login` | 학번(studentId)과 비밀번호로 로그인하여 JWT 토큰을 발급받습니다. |

### 4.2. 메인 대시보드 (Dashboard)
| 기능 | 메서드 | 엔드포인트 | 설명 |
| :--- | :--- | :--- | :--- |
| 수강 강의 목록 조회 | `GET` | `/dashboard/courses` | 현재 로그인한 학생이 수강 중인 강의 리스트를 조회합니다. |
| 활동 히트맵 조회 | `GET` | `/dashboard/heatmap` | 최근 1년간의 일자별 활동(노트, 게시글, 댓글) 카운트를 조회합니다. |
| 전체 최신글 피드 | `GET` | `/dashboard/latest-posts` | 수강 중인 모든 강의 게시판의 최신글 상위 10개를 조회합니다. |

### 4.3. 스마트 필기 노트 (Notes)
| 기능 | 메서드 | 엔드포인트 | 설명 |
| :--- | :--- | :--- | :--- |
| 강의별 노트 목록 조회 | `GET` | `/courses/{courseId}/notes` | 특정 강의의 날짜별/주차별 노트 목록을 조회합니다. |
| 특정 노트 상세 조회 | `GET` | `/notes/{noteId}` | 특정 노트의 상세 내용(섹션별 데이터)을 조회합니다. |
| 노트 생성 및 자동 저장 | `POST` | `/courses/{courseId}/notes` | 새 노트를 생성하거나 기존 내용을 자동 저장(Update)합니다. (Debounce 적용) |
| 노트 삭제 | `DELETE` | `/notes/{noteId}` | 특정 노트를 삭제합니다. |

### 4.4. 익명 게시판 (Board)
| 기능 | 메서드 | 엔드포인트 | 설명 |
| :--- | :--- | :--- | :--- |
| 강의별 게시글 목록 조회 | `GET` | `/courses/{courseId}/posts` | 특정 강의 전용 게시판의 게시글 목록을 조회합니다. |
| 게시글 상세 조회 | `GET` | `/posts/{postId}` | 게시글 상세 내용 및 댓글 목록을 조회합니다. |
| 게시글 작성 | `POST` | `/courses/{courseId}/posts` | 특정 강의 게시판에 새 글을 작성합니다. |
| 게시글 수정 | `PUT` | `/posts/{postId}` | 본인이 작성한 게시글을 수정합니다. |
| 게시글 삭제 | `DELETE` | `/posts/{postId}` | 본인이 작성한 게시글을 삭제합니다. |
| 게시글 좋아요 | `POST` | `/posts/{postId}/like` | 게시글의 좋아요 수를 증가/감소(Toggle) 시킵니다. |

### 4.5. 댓글 (Comments)
| 기능 | 메서드 | 엔드포인트 | 설명 |
| :--- | :--- | :--- | :--- |
| 댓글 작성 | `POST` | `/posts/{postId}/comments` | 특정 게시글에 익명으로 댓글을 작성합니다. |
| 댓글 수정 | `PUT` | `/comments/{commentId}` | 본인이 작성한 댓글을 수정합니다. |
| 댓글 삭제 | `DELETE` | `/comments/{commentId}` | 본인이 작성한 댓글을 삭제합니다. |

---

## 5. 주요 데이터 모델 (Response DTO 예시)

### 5.1. 게시글 응답 (Post Response)
```json
{
  "postId": 1,
  "courseId": 101,
  "title": "이번 과제 너무 어렵지 않나요?",
  "content": "공업수학 3번 문제 풀이 아시는 분...",
  "author": "익명",
  "isAuthor": true, 
  "likeCount": 12,
  "createdAt": "2024-03-31T14:30:00",
  "comments": [
    {
      "commentId": 1,
      "content": "저도 그거 2시간째 고민 중이에요 ㅠㅠ",
      "author": "익명",
      "isAuthor": false,
      "createdAt": "2024-03-31T15:00:00"
    }
  ]
}
```
- `author`: 클라이언트에게는 항상 `"익명"`으로 전달하여 익명성을 보장합니다.
- `isAuthor`: 현재 로그인한 사용자가 작성자인지 여부를 `boolean`으로 전달하여 수정/삭제 버튼 노출 여부를 결정합니다.

---

## 6. 에러 코드 정의
| 코드 | 메시지 | 설명 |
| :--- | :--- | :--- |
| 400 | Bad Request | 잘못된 요청 파라미터 또는 본문 데이터 |
| 401 | Unauthorized | 유효하지 않거나 만료된 토큰 |
| 403 | Forbidden | 해당 리소스(강의, 노트, 게시글)에 대한 접근 권한 없음 |
| 404 | Not Found | 요청한 리소스를 찾을 수 없음 |
| 500 | Internal Server Error | 서버 내부 오류 |
