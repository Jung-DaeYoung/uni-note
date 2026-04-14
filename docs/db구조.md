# [Uni Note] 데이터베이스 구조 설계 (DB Structure)

본 문서는 프로젝트의 ERD를 바탕으로 한 상세 테이블 명세 및 관계 정의서입니다.

---

## 1. 논리적 ERD 요약
- **사용자 관리**: 학생(students)과 교수(professors) 정보를 별도로 관리합니다.
- **강의 및 수강**: 강의(courses)는 교수와 연결되며, 수강(enrollments) 테이블을 통해 학생과 강의가 다대다(N:M) 관계로 연결됩니다.
- **커뮤니티 및 필기**: 각 강의는 하나의 게시판(boards)과 1:1로 대응하며, 게시판 내에 여러 개의 노트/게시글(notes)이 작성됩니다.

---

## 2. 테이블 상세 정의

### 2.1. students (학생)
| 컬럼명 | 타입 | 제약사항 | 설명 |
| :--- | :--- | :--- | :--- |
| `stud_id` | INT | PK, AI | 시스템 내부 관리용 학생 고유 ID |
| `student_num` | VARCHAR | UNIQUE, NOT NULL | 실제 학번 (로그인 시 사용) |
| `name` | VARCHAR | NOT NULL | 성명 |
| `major` | VARCHAR | - | 전공 학과 |

### 2.2. professors (교수)
| 컬럼명 | 타입 | 제약사항 | 설명 |
| :--- | :--- | :--- | :--- |
| `prof_id` | INT | PK, AI | 교수 고유 ID |
| `name` | VARCHAR | NOT NULL | 성명 |
| `department` | VARCHAR | - | 소속 학과 |

### 2.3. courses (강의)
| 컬럼명 | 타입 | 제약사항 | 설명 |
| :--- | :--- | :--- | :--- |
| `course_id` | INT | PK, AI | 강의 고유 ID |
| `course_name` | VARCHAR | NOT NULL | 강의명 |
| `course_code` | VARCHAR | UNIQUE | 학수 번호 |
| `prof_id` | INT | FK | 담당 교수 ID (professors.prof_id) |

### 2.4. enrollments (수강 내역)
| 컬럼명 | 타입 | 제약사항 | 설명 |
| :--- | :--- | :--- | :--- |
| `enroll_id` | INT | PK, AI | 수강 데이터 고유 ID |
| `stud_id` | INT | FK | 학생 ID (students.stud_id) |
| `course_id` | INT | FK | 강의 ID (courses.course_id) |

### 2.5. boards (강의별 게시판)
| 컬럼명 | 타입 | 제약사항 | 설명 |
| :--- | :--- | :--- | :--- |
| `board_id` | INT | PK, AI | 게시판 고유 ID |
| `board_type` | VARCHAR | - | 게시판 유형 (익명, 일반 등) |
| `course_id` | INT | FK, UNIQUE | 연결된 강의 ID (courses.course_id) |

### 2.6. notes (노트 및 게시글)
| 컬럼명 | 타입 | 제약사항 | 설명 |
| :--- | :--- | :--- | :--- |
| `note_id` | INT | PK, AI | 노트/게시글 고유 ID |
| `title` | VARCHAR | NOT NULL | 제목 |
| `content` | TEXT | NOT NULL | 내용 (Smart Note 데이터 포함) |
| `stud_id` | INT | FK | 작성자 학생 ID (students.stud_id) |
| `board_id` | INT | FK | 소속 게시판 ID (boards.board_id) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 작성 일시 |

---

## 3. 테이블 간 관계 (Relationships)

1.  **Professor : Course (1 : N)**
    - 한 명의 교수는 여러 강의를 담당할 수 있습니다.
2.  **Student : Enrollment (1 : N)**
    - 한 명의 학생은 여러 강의를 수강(Enroll)할 수 있습니다.
3.  **Course : Enrollment (1 : N)**
    - 하나의 강의에는 여러 명의 학생이 수강 등록될 수 있습니다.
4.  **Course : Board (1 : 1)**
    - 각 강의는 독립된 하나의 익명 게시판을 가집니다.
5.  **Student : Note (1 : N)**
    - 한 명의 학생은 여러 개의 노트를 작성할 수 있습니다.
6.  **Board : Note (1 : N)**
    - 하나의 게시판에는 여러 개의 게시글/노트가 포함됩니다.
