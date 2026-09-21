# 🎓 UniNote 코드 과외 — 6강: 파일 업로드 (이미지 & PDF) 및 보안 서빙 (Magic Bytes & 서명 URL)

---

## 1. 이 기능이 무엇인가?

강의 노트를 작성할 때 **도표 이미지(PNG/JPG)를 드래그 앤 드롭하거나 강의 자료 PDF를 첨부하고, 이를 본문에서 바로 보거나 안전하게 다운로드하는 기능**입니다.  
겉보기에는 단순한 파일 첨부 같지만, 내부에는 **악성 위장 파일 침투 방지(Magic Bytes), 서버 디렉터리 탈출 방지(Path Traversal), 남의 시험 자료 무단 열람 차단(HMAC 서명 URL)**이라는 견고한 3중 보안 요새가 구축되어 있습니다.

---

## 2. 왜 필요한가?

파일 업로드/다운로드는 웹 애플리케이션 해킹 시도 중 **가장 위험하고 빈번한 공격 경로(Attack Vector)**입니다.
1. **웹셸(WebShell) 공격**: 해커가 `evil.php`나 `malicious.exe` 파일을 `photo.png`로 이름만 바꿔서 업로드한 뒤 서버 권한을 탈취할 수 있습니다.
2. **경로 조작(Path Traversal)**: 파일명에 `../../etc/passwd`나 `../../Windows/System32` 같은 경로를 실어 보내 서버의 중요 설정 파일을 덮어쓰거나 탈취할 수 있습니다.
3. **비인가 접근(IDOR)**: 학생 A가 비공개로 올린 과제나 시험 족보 PDF의 URL(`http://.../uploads/assignment.pdf`)을 학생 B가 주소창에서 유추하여 무단으로 열람/다운로드할 수 있습니다.

UniNote는 이러한 위협을 사전에 차단하기 위해 **실제 엔터프라이즈급 파일 보안 아키텍처**를 설계했습니다.

---

## 3. 전체 동작 흐름

```
[업로드 흐름]
1. 사용자가 에디터에 이미지 드래그&드롭 또는 슬래시 메뉴에서 파일 선택
  ↓
2. useNoteUploads.js (프론트 1차 검사):
   - 10MB 크기 제한, 화이트리스트 확장자(.png, .jpg, .pdf 등) 사전 체크
  ↓
3. POST /api/upload/image 또는 /api/upload/file 요청 전송 (FormData)
  ↓
4. ImageUploadController (백엔드 2차 검사):
   - JWT 토큰으로부터 업로더 학번(studentNum) 식별
   - 파일의 첫 바이트들을 직접 뜯어보는 "매직 바이트(Magic Bytes)" 검사 (확장자 위장 차단!)
  ↓
5. 파일 물리 저장:
   - 원본 파일명을 버리고 서버가 무작위 "UUID + 검증된 확장자"로 파일명 생성
   - 정규화된 uploads 디렉터리에 물리 파일 기록
  ↓
6. HMAC-SHA256 기반 보안 서명 발급:
   - FileAccessSigner: (UUID파일명 + "|" + 업로더학번)을 서버 비밀키로 서명(Signature)
   - 서명 URL 생성: /api/upload/view/{UUID}?owner={학번}&sig={서명값}
  ↓
7. 프론트엔드 에디터 본문에 <img src="..." /> 또는 <pdfBlock src="..." /> 삽입

-------------------------------------------------------------------------
[서빙 & 다운로드 흐름]
1. 브라우저가 본문의 <img src="/api/upload/view/{UUID}?owner=...&sig=..."> 요청
  ↓
2. ImageUploadController.viewFile() 수신:
   - 파일명 경로 조작("../", "/", "\\") 포함 여부 즉시 차단
   - FileAccessSigner.isValid(): 요청된 owner와 sig가 조작되지 않은 본인 서명인지 검증
   - 서명이 일치하지 않거나 없으면 즉시 403 Forbidden 거부!
  ↓
3. 검증 성공 시: 파일 바이너리를 브라우저로 안전하게 스트리밍 응답 (200 OK)
```

---

## 4. 실제 코드 위치

**Backend:**
- `backend/.../controller/ImageUploadController.java` — 파일 업로드, 매직 바이트 검증, 경로 조작 검증, 인라인 서빙 및 다운로드
- `backend/.../security/FileAccessSigner.java` — `HmacSHA256` 기반 파일 접근 서명 생성 및 검증 컴포넌트

**Frontend:**
- `frontend/src/components/editor/hooks/useNoteUploads.js` — 클라이언트 1차 검증(용량 10MB, 확장자, MIME), 업로드 상태 관리, 허용 URL 검증(`isAllowedFileUrl`)
- `frontend/src/components/editor/extensions/PdfBlock.jsx` — PDF 커스텀 Tiptap 블록, 서명 보존 다운로드 핸들러
- `frontend/src/components/editor/NotionEditor.jsx` — BaseImage 확장(허용되지 않은 파일 스킴 차단), 드래그 앤 드롭 핸들러

**Storage:**
- 서버 로컬 디렉터리: `uploads/{UUID}.png` (UUID로 난수화되어 디스크에 저장됨)

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. 프론트엔드 1차 검증 및 안전한 URL 필터링

`useNoteUploads.js`:

```javascript
// 10MB 초과 파일은 네트워크 통신도 하지 않고 클라이언트에서 즉시 차단!
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// 악의적으로 조작된 javascript:나 외부 피싱 URL이 에디터에 렌더링되는 것 방지
export const isAllowedFileUrl = (url) => {
  if (!url) return false;
  try {
    const serverOrigin = new URL(SERVER_URL).origin;
    const parsed = new URL(url, SERVER_URL);
    if (parsed.origin !== serverOrigin) return false; // 외부 도메인 차단
    return ['/api/upload/view/', '/api/upload/download/', '/uploads/']
      .some((prefix) => parsed.pathname.startsWith(prefix));
  } catch {
    return false;
  }
};
```

> 💬 **쉽게 말하면**: 프론트엔드 단계에서 10MB가 넘는 파일은 서버로 보내지도 않고 입구 컷하며, 해커가 본문 JSON을 조작해 악성 링크를 띄우려는 시도(`javascript:alert()`)도 도메인 검사로 완벽히 걸러냅니다.

---

### 🔵 STEP 2. 백엔드 매직 바이트(Magic Bytes) 위장 파일 차단

사용자가 `malicious.exe` 파일의 이름만 `cute_cat.png`로 바꿔서 올리면 일반 확장자 검사는 뚫립니다.  
이를 막기 위해 파일의 가장 첫 번째 바이트(고유 파일 시그니처)를 직접 비교합니다.

`ImageUploadController.java`:

```java
// 파일 포맷별 세계 표준 시그니처 (바이트 배열)
private static final byte[] PNG_MAGIC = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

private boolean matchesDeclaredType(byte[] content, String extension) {
    return switch (extension) {
        case ".png" -> startsWith(content, PNG_MAGIC);
        case ".jpg", ".jpeg" -> startsWith(content, JPEG_MAGIC);
        case ".pdf" -> startsWith(content, PDF_MAGIC);
        ...
        default -> false;
    };
}
```

> **매직 바이트(Magic Bytes)가 뭔가요?**  
> 모든 디지털 파일은 사람이 보는 확장자와 상관없이, 파일의 맨 앞 2~8바이트에 **"나는 진짜 PNG 파일이다"**를 증명하는 주민등록번호 같은 고유한 바이트 코드를 가지고 태어납니다.  
> 예를 들어 PDF 파일은 메모장으로 열어보면 무조건 맨 첫 글자가 `%PDF-`로 시작합니다. 실행 파일(`exe`)의 이름을 `.png`로 바꿔도 이 첫 바이트는 바뀌지 않으므로 서버가 즉시 가짜 파일임을 적발할 수 있습니다.

> 💬 **쉽게 말하면**: "겉포장(확장자)만 명품으로 바꾼 짝퉁인지, 내용물(첫 바이트)을 직접 뜯어보고 진짜 PNG/PDF가 아니면 즉시 쓰레기통에 버리는 검사"입니다.

---

### 🔵 STEP 3. 경로 조작(Path Traversal) 공격 방어 및 UUID 파일명

클라이언트가 올린 파일명을 서버 저장 경로에 그대로 사용하면 치명적인 보안 사고가 납니다.

`ImageUploadController.java`:

```java
// 1. 원본 파일명은 버리고, 무작위 UUID로 새 파일명을 부여한다!
String fileName = UUID.randomUUID().toString() + extension;

// 2. 파일 접근 시 절대 상위 디렉터리로 빠져나가지 못하도록 강제 검증!
private Path resolveWithinUploadDir(String fileName) {
    if (fileName == null || fileName.contains("/") || fileName.contains("\\")) {
        throw new IllegalArgumentException("허용되지 않은 파일명입니다: " + fileName);
    }
    // 상대 경로(../)를 모두 계산(normalize)한 결과가 uploads 폴더 안에 있는가?
    Path resolved = uploadBaseDir.resolve(fileName).normalize();
    if (!resolved.startsWith(uploadBaseDir)) {
        throw new IllegalArgumentException("기준 디렉터리를 벗어난 경로입니다: " + fileName);
    }
    return resolved;
}
```

> 💬 **쉽게 말하면**: 파일 이름을 `../../windows/system.ini`라고 장난쳐서 보내도, 서버는 그 이름을 무시하고 `c8f1e2d4-3a5b...png`라는 무작위 영어+숫자로 새로 이름을 지어버립니다. 또한 주소에 슬래시(`/`, `\`)가 한 글자라도 섞여 있으면 단칼에 거절합니다.

---

### 🔵 STEP 4. HMAC-SHA256 기반 서명 URL 발급 (`FileAccessSigner.java`)

웹 브라우저의 `<img src="...">` 태그나 새 탭에서 열리는 PDF 다운로드 링크는 브라우저 네이티브 동작이므로 `Authorization: Bearer <토큰>` 헤더를 실어 보낼 수 없습니다. 그렇다면 비인가자가 URL을 알아내서 다운받는 것을 어떻게 막을까요?  
바로 **서명 URL(Signed URL)** 방식입니다.

`FileAccessSigner.java`:

```java
@Component
public class FileAccessSigner {
    private final byte[] secretKey;

    public FileAccessSigner(@Value("${jwt.secret}") String jwtSecret) {
        this.secretKey = jwtSecret.getBytes(StandardCharsets.UTF_8);
    }

    // 파일명과 소유자 학번을 조합해 서버 비밀키로 위조 불가능한 해시 서명을 만든다
    public String sign(String fileName, String owner) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKey, "HmacSHA256"));
            byte[] raw = mac.doFinal((fileName + "|" + owner).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception e) {
            throw new IllegalStateException("파일 접근 서명 생성 실패", e);
        }
    }

    public boolean isValid(String fileName, String owner, String signature) {
        if (owner == null || signature == null) return false;
        return sign(fileName, owner).equals(signature); // 재계산한 서명과 일치하는가?
    }
}
```

> 💬 **쉽게 말하면**: 백화점 영수증에 찍힌 바코드와 같습니다. 서버가 "이 파일(fileName)은 이 학생(owner)이 올린 게 맞음"이라는 도장을 서버 비밀키로 쾅 찍어서 URL 꼬리표(`?owner=20211234&sig=Xk9...`)에 달아줍니다. 해커는 비밀키를 모르기 때문에 서명을 위조할 수 없습니다.

---

### 🔵 STEP 5. 인가된 서명 검증 및 한글 파일명 다운로드 처리

파일을 열람하거나 다운로드할 때 백엔드는 반드시 서명이 진짜인지 검사합니다.

`ImageUploadController.java`:

```java
@GetMapping("/api/upload/view/{fileName}")
public ResponseEntity<Resource> viewFile(
        @PathVariable String fileName,
        @RequestParam(required = false) String owner,
        @RequestParam(required = false) String sig) {

    // 1. 서명이 없거나 유효하지 않으면 403 Forbidden!
    if (!fileAccessSigner.isValid(fileName, owner, sig)) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    // 2. 안전한 파일 스트리밍
    return serveFile(fileName, null);
}

@GetMapping("/api/upload/download/{fileName}")
public ResponseEntity<Resource> downloadFile(
        @PathVariable String fileName,
        @RequestParam String originalName,
        @RequestParam(required = false) String owner,
        @RequestParam(required = false) String sig) {

    if (!fileAccessSigner.isValid(fileName, owner, sig)) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    // 한글 원본 파일명 깨짐 방지 인코딩 + Content-Disposition 강제 다운로드 헤더
    String encodedFileName = UriUtils.encode(originalName, StandardCharsets.UTF_8);
    return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFileName + "\"")
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(resource);
}
```

> 💬 **쉽게 말하면**: 다른 학생이 URL의 파일명을 자기 마음대로 바꿔치기해서 접속하면 `403 Forbidden` 경고와 함께 문전박대당합니다. 또한 다운로드 시에는 UUID가 아니라 학생이 원래 올렸던 한글 이름(예: `1주차_강의자료.pdf`) 그대로 다운로드되도록 헤더를 세팅해 줍니다.

---

### 🔵 STEP 6. 프론트엔드 PDF 블록의 안전한 다운로드 (`PdfBlock.jsx`)

`PdfBlock.jsx`:

```jsx
const handleDownload = (e) => {
  e.preventDefault();
  if (!isSrcTrusted) return; // 허용되지 않은 출처면 차단

  const url = new URL(src, window.location.origin);
  const fileName = url.pathname.substring(url.pathname.lastIndexOf("/") + 1);
  const params = new URLSearchParams({ originalName: title });

  // 서명(owner, sig)을 그대로 유지해서 다운로드 API로 토스!
  const owner = url.searchParams.get("owner");
  const sig = url.searchParams.get("sig");
  if (owner && sig) {
    params.set("owner", owner);
    params.set("sig", sig);
  }

  window.location.href = `${API_BASE_URL}/api/upload/download/${fileName}?${params.toString()}`;
};
```

> 💬 **쉽게 말하면**: 에디터 본문에 박혀 있던 서명 파라미터를 그대로 보존하여 백엔드 다운로드 API로 전달하므로, 다운로드 순간에도 완벽한 본인 확인이 이루어집니다.

---

## 6. 데이터가 어떻게 이동하는가?

```
[클라이언트: 파일 업로드]
   file: "운영체제_정리.pdf" (내용: %PDF-1.4...)
         ↓
[useNoteUploads 훅] ─── 10MB 검사 통과 ───→ POST /api/upload/file (FormData)
                                                ↓
                                    [ImageUploadController]
                                       ├── JWT 학번: "20211234" 확인
                                       ├── extractExtension: ".pdf"
                                       └── matchesDeclaredType: 바이너리 첫 바이트 == "%PDF-" 일치!
                                                ↓
                                    [디스크 저장]: "uploads/a1b2c3d4.pdf"
                                    [FileAccessSigner]: HMAC("a1b2c3d4.pdf|20211234") → sig: "Q7mK9p..."
                                                ↓ 200 OK
                                    JSON 반환: {
                                      url: "/api/upload/view/a1b2c3d4.pdf?owner=20211234&sig=Q7mK9p...",
                                      title: "운영체제_정리.pdf"
                                    }
         ←──────────────────────────────────────┘
         ↓
[NotionEditor Tiptap 에디터]
   본문에 <pdfBlock src="..." title="..." /> 삽입
         ↓
[사용자가 브라우저에서 열람/다운로드 시]
   GET /api/upload/download/a1b2c3d4.pdf?originalName=운영체제_정리.pdf&owner=20211234&sig=Q7mK9p...
         ↓
   [서버 서명 검증 성공!] → Content-Disposition: attachment; filename="운영체제_정리.pdf" 바이너리 전송
```

---

## 7. 왜 이렇게 설계했는가?

1. **왜 `Authorization: Bearer` 헤더 대신 URL 서명(`?sig=...`)을 사용하는가?**
   - 브라우저의 `<img src="...">` 태그, `<iframe src="...">`, `window.location.href` 다운로드는 브라우저 네이티브 HTTP 호출이므로 **자바스크립트로 커스텀 HTTP 헤더를 실을 수 없습니다.**
   - 따라서 AWS S3의 Presigned URL처럼 **URL 파라미터 자체에 암호학적 서명을 담는 방식(Signed URL)**이 웹 표준에서 가장 안전하고 현실적인 해결책입니다.

2. **왜 원본 파일명을 버리고 서버가 무작위 UUID로 저장하는가?**
   - 사용자가 올린 원본 파일명에는 `../../` 같은 경로 조작 문자, 특수문자, 윈도우/리눅스 예약어(`CON`, `PRN`), 이스케이프 문자 등이 포함될 수 있습니다.
   - 서버가 UUID로 파일명을 새로 지어버리면 파일명 충돌(덮어쓰기)도 방지되고 경로 조작 공격을 원천 무력화할 수 있습니다.

3. **왜 `Files.write()` 전에 매직 바이트를 검증하는가?**
   - 디스크에 파일을 먼저 쓰고 나서 나중에 검사하면, 검사 실패 시 디스크에 생성된 쓰레기 파일을 삭제해야 하는 부수적인 디스크 I/O와 예외 처리가 필요합니다.
   - 메모리 상의 `byte[]` 바이트 배열에서 첫 몇 바이트만 즉시 검사한 뒤 일치할 때만 디스크에 기록하면 서버 리소스를 극도로 아낄 수 있습니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 동작 |
|---|---|
| MIME 타입 검사만으로 안전한가요? | **전혀 안전하지 않습니다.** `Content-Type: image/png` 헤더는 브라우저나 해커가 프록시 툴로 얼마든지 조작해서 보낼 수 있습니다. 반드시 파일의 실제 바이너리(Magic Bytes)를 확인해야 합니다. |
| 서명(`sig`)은 누구나 만들 수 있나요? | **불가능합니다.** `FileAccessSigner`는 서버 내부의 `jwt.secret` 비밀키를 사용해 단방향 해시(`HmacSHA256`)를 생성하므로 서버 관리자가 아닌 이상 절대 같은 서명을 위조할 수 없습니다. |
| `Content-Disposition: inline` vs `attachment` | `inline`은 브라우저 화면 안에서 바로 이미지/PDF를 열어서 보여주는 방식이고, `attachment`는 브라우저가 화면을 열지 않고 사용자 PC의 '다운로드' 폴더로 파일을 내려받게 강제하는 방식입니다. |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"파일 업로드 및 다운로드 기능을 구현할 때 고려해야 하는 웹 보안 취약점과 UniNote의 대응 방식을 설명해 보세요."**

✅ 이렇게 설명할 수 있습니다:
> "파일 업로드에서는 크게 세 가지 보안 위협을 고려해야 합니다.  
> 첫째는 악성 실행 파일의 확장자 위장 공격이며, UniNote는 확장자 검사에 그치지 않고 파일 바이너리의 시작 바이트인 **매직 바이트(Magic Bytes)**를 검사해 실제 PNG, JPEG, PDF 시그니처와 일치할 때만 저장을 허용했습니다.  
> 둘째는 시스템 디렉터리를 훼손하는 **경로 조작(Path Traversal)** 공격이며, 원본 파일명을 일체 배제하고 무작위 **UUID**로 파일명을 생성하며 `uploadBaseDir.normalize()` 검증을 통해 지정된 디렉터리를 벗어나지 못하게 격리했습니다.  
> 셋째는 비인가 파일 탈취(IDOR) 문제인데, 브라우저 `<img>` 태그는 JWT 헤더를 실을 수 없으므로 AWS S3의 Presigned URL 원리와 유사하게 **`HmacSHA256` 서명 URL(`?owner={학번}&sig={서명}`)**을 발급하여 파일명과 소유자 정보가 위조되지 않은 요청에 대해서만 서빙되도록 완벽히 통제했습니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**  
파일의 확장자를 텍스트로만 믿지 않고, 파일 바이너리의 고유한 시작 바이트 코드를 직접 비교하는 검사 방식을 무엇이라고 부르나요?

**Q2. (흐름 문제)**  
학생이 `과제.pdf`를 업로드했을 때, 서버 디스크에 저장되는 실제 파일명과 브라우저에 반환되는 URL에 포함되는 쿼리스트링 파라미터 2가지는 무엇인가요?

**Q3. (코드 이해)**  
`FileAccessSigner.java`의 `isValid(fileName, owner, signature)` 메서드는 어떤 원리로 서명의 유효성을 검증하나요?

**Q4. (설계 이해)**  
일반 API 요청은 `Authorization: Bearer <토큰>` 헤더를 사용하는데, 파일 서빙(`/api/upload/view/...`)에서는 왜 헤더 대신 URL 파라미터 기반 서명(Signed URL) 방식을 채택했나요?

**Q5. (면접형)**  
사용자가 업로드한 원본 파일명을 디스크 저장 파일명으로 그대로 쓰지 않고 UUID로 치환해야 하는 보안상의 이유를 2가지 이상 설명해 보세요.
