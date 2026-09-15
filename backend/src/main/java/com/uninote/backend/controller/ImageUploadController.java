package com.uninote.backend.controller;

import com.uninote.backend.security.FileAccessSigner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
public class ImageUploadController {

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(".png", ".jpg", ".jpeg", ".gif", ".webp");
    private static final Set<String> ALLOWED_FILE_EXTENSIONS = Set.of(".pdf");

    private final String uploadDir = "uploads";
    // 기준 디렉터리(절대 경로, 정규화됨). 서빙 요청의 파일명이 이 밑을 벗어나면 거부한다.
    private final Path uploadBaseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
    private final FileAccessSigner fileAccessSigner;

    // 서명 도입(P1-1) 이전에 "/uploads/{fileName}" 정적 경로로 발급된 파일 중,
    // 실제로 저장된 노트가 여전히 참조하고 있어 계속 서빙해야 하는 파일만 콤마로 나열한다.
    // 새로 업로드되는 파일은 전부 서명이 있으므로 이 목록에 추가할 필요가 없다.
    @Value("${file-access.legacy-allowed-files:}")
    private String legacyAllowedFilesRaw;

    // 새로 업로드된 파일(서명 있음)을 화면에 표시하기 위한 인라인 서빙.
    @GetMapping("/api/upload/view/{fileName}")
    public ResponseEntity<Resource> viewFile(
            @PathVariable String fileName,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String sig) {
        if (!isValidFileName(fileName)) {
            return ResponseEntity.badRequest().build();
        }
        if (!isAuthorized(fileName, owner, sig)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return serveFile(fileName, null);
    }

    @GetMapping("/api/upload/download/{fileName}")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable String fileName,
            @RequestParam String originalName,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String sig) {
        if (!isValidFileName(fileName)) {
            return ResponseEntity.badRequest().build();
        }
        if (!isAuthorized(fileName, owner, sig)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return serveFile(fileName, originalName);
    }

    // P1-1 이전 "/uploads/{fileName}" 정적 경로를 대체하는 좁은 경로. Spring의 범용 정적
    // 리소스 매핑(모든 업로드 파일을 무조건 공개)과 달리, 화이트리스트에 등록된 파일만 서빙한다.
    @GetMapping("/uploads/{fileName}")
    public ResponseEntity<Resource> viewLegacyFile(@PathVariable String fileName) {
        if (!isValidFileName(fileName)) {
            return ResponseEntity.badRequest().build();
        }
        if (!isAuthorized(fileName, null, null)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return serveFile(fileName, null);
    }

    // 경로 조작 문자열(traversal)은 인가 여부와 무관하게 항상 먼저 거부되어야 하므로,
    // serveFile() 내부의 검증과 별개로 인가 판단 전에 파일명 형식만 미리 검사한다.
    private boolean isValidFileName(String fileName) {
        try {
            resolveWithinUploadDir(fileName);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private boolean isAuthorized(String fileName, String owner, String sig) {
        // owner/sig가 모두 없으면 서명 검증 대상이 아니라, 화이트리스트에 등록된
        // 레거시 파일인지만 확인한다(신규 파일은 항상 서명이 있으므로 여기 걸리지 않는다).
        if (owner == null && sig == null) {
            return isLegacyAllowedFile(fileName);
        }
        return fileAccessSigner.isValid(fileName, owner, sig);
    }

    private boolean isLegacyAllowedFile(String fileName) {
        if (legacyAllowedFilesRaw == null || legacyAllowedFilesRaw.isBlank()) {
            return false;
        }
        return Arrays.stream(legacyAllowedFilesRaw.split(","))
                .map(String::trim)
                .anyMatch(allowed -> allowed.equals(fileName));
    }

    private ResponseEntity<Resource> serveFile(String fileName, String originalNameForDownload) {
        Path filePath;
        try {
            filePath = resolveWithinUploadDir(fileName);
        } catch (IllegalArgumentException e) {
            log.warn("허용되지 않은 파일 경로 접근 시도: {}", fileName);
            return ResponseEntity.badRequest().build();
        }

        try {
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            ResponseEntity.BodyBuilder response = ResponseEntity.ok();

            if (originalNameForDownload != null) {
                // 한글 파일명 깨짐 방지를 위한 인코딩 + 브라우저에게 다운로드를 강제하는 헤더
                String encodedFileName = UriUtils.encode(originalNameForDownload, StandardCharsets.UTF_8);
                response.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFileName + "\"")
                        .contentType(MediaType.APPLICATION_OCTET_STREAM);
            } else {
                response.contentType(resolveContentType(filePath));
            }

            return response.body(resource);
        } catch (IOException e) {
            log.error("파일 서빙 오류: {}", fileName, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // 파일명을 기준 디렉터리 하위 경로로만 해석되도록 강제한다. "/", "\\"가 섞여 있거나
    // normalize() 이후 기준 디렉터리를 벗어나면(예: "../"로 상위 이동) 거부한다.
    private Path resolveWithinUploadDir(String fileName) {
        if (fileName == null || fileName.isBlank() || fileName.contains("/") || fileName.contains("\\")) {
            throw new IllegalArgumentException("허용되지 않은 파일명입니다: " + fileName);
        }
        Path resolved = uploadBaseDir.resolve(fileName).normalize();
        if (!resolved.startsWith(uploadBaseDir)) {
            throw new IllegalArgumentException("기준 디렉터리를 벗어난 경로입니다: " + fileName);
        }
        return resolved;
    }

    // Files.probeContentType()은 OS의 파일 형식 연결 설정에 의존해 환경에 따라 null을
    // 반환할 수 있다. 이 앱이 실제로 다루는 확장자만 최소한으로 직접 보정한다.
    private MediaType resolveContentType(Path filePath) throws IOException {
        String probed = Files.probeContentType(filePath);
        if (probed != null) {
            return MediaType.parseMediaType(probed);
        }
        String fileName = filePath.getFileName().toString().toLowerCase();
        if (fileName.endsWith(".pdf")) return MediaType.APPLICATION_PDF;
        if (fileName.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
        if (fileName.endsWith(".gif")) return MediaType.IMAGE_GIF;
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    @PostMapping("/api/upload/image")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file,
                                          @AuthenticationPrincipal String studentNum) {
        if (studentNum == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return processUpload(file, true, studentNum);
    }

    @PostMapping("/api/upload/file")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file,
                                         @AuthenticationPrincipal String studentNum) {
        log.info("파일 업로드 요청 수신: {}, 크기: {} bytes", file.getOriginalFilename(), file.getSize());
        if (studentNum == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return processUpload(file, false, studentNum);
    }

    private ResponseEntity<?> processUpload(MultipartFile file, boolean isImage, String studentNum) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("파일이 비어있습니다.");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = extractExtension(originalFilename);
        Set<String> allowedExtensions = isImage ? ALLOWED_IMAGE_EXTENSIONS : ALLOWED_FILE_EXTENSIONS;
        if (!allowedExtensions.contains(extension)) {
            return ResponseEntity.badRequest().body("허용되지 않는 파일 형식입니다.");
        }

        try {
            // 디렉토리 생성
            Path copyLocation = Paths.get(uploadDir);
            if (!Files.exists(copyLocation)) {
                Files.createDirectories(copyLocation);
            }

            // 서버가 UUID + 검증된 확장자로 저장 파일명을 직접 결정한다.
            // (원본 파일명은 저장 경로에 전혀 쓰이지 않는다)
            String fileName = UUID.randomUUID().toString() + extension;

            // 파일 저장
            Path targetPath = copyLocation.resolve(fileName);
            Files.copy(file.getInputStream(), targetPath);

            // 업로더 본인만 접근 가능하도록 서명을 실어 URL 생성
            String signature = fileAccessSigner.sign(fileName, studentNum);
            String encodedOwner = UriUtils.encode(studentNum, StandardCharsets.UTF_8);
            String fileUrl = "/api/upload/view/" + fileName + "?owner=" + encodedOwner + "&sig=" + signature;

            log.info("업로드 성공: {} (원본명: {})", fileUrl, originalFilename);

            if (isImage) {
                return ResponseEntity.ok(Map.of("url", fileUrl));
            } else {
                return ResponseEntity.ok(Map.of(
                    "url", fileUrl,
                    "title", originalFilename != null ? originalFilename : "이름 없는 파일"
                ));
            }

        } catch (IOException e) {
            log.error("업로드 실패", e);
            return ResponseEntity.internalServerError().body("파일 저장 중 오류가 발생했습니다.");
        }
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null || !originalFilename.contains(".")) {
            return "";
        }
        return originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
    }
}
