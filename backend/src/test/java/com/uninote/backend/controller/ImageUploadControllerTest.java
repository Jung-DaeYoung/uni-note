package com.uninote.backend.controller;

import com.uninote.backend.security.FileAccessSigner;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// ImageUploadController는 저장소 계층 없이 파일 시스템(uploadDir="uploads")을 직접 다루므로,
// 실제 애플리케이션이 쓰는 것과 같은 backend/uploads 디렉터리에 테스트 파일을 만들고
// 끝나면 지운다(테스트 전용 파일만 생성·삭제하며 기존 업로드 파일은 건드리지 않는다).
class ImageUploadControllerTest {

    private static final String SECRET = "test_jwt_secret_key_minimum_32_bytes_long";

    private final FileAccessSigner signer = new FileAccessSigner(SECRET);
    private final ImageUploadController controller = new ImageUploadController(signer);

    private Path createdFile;

    @AfterEach
    void cleanUp() throws IOException {
        if (createdFile != null && Files.exists(createdFile)) {
            Files.delete(createdFile);
        }
    }

    @Test
    void uploadImageRejectsUnauthenticatedRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", "data".getBytes());

        ResponseEntity<?> response = controller.uploadImage(file, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void uploadFileRejectsUnauthenticatedRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "a.pdf", "application/pdf", "data".getBytes());

        ResponseEntity<?> response = controller.uploadFile(file, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void authenticatedUploadSucceedsAndReturnsSignedUrl() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", "hello".getBytes());

        ResponseEntity<?> response = controller.uploadImage(file, "owner-num");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) response.getBody();
        String url = body.get("url");
        assertThat(url).startsWith("/api/upload/view/");
        assertThat(url).contains("owner=owner-num").contains("sig=");

        String fileName = url.substring("/api/upload/view/".length(), url.indexOf('?'));
        createdFile = Paths.get("uploads").resolve(fileName);
        assertThat(Files.exists(createdFile)).isTrue();
    }

    @Test
    void ownerCanViewOwnUploadedFile() throws IOException {
        String fileName = writeTestFile("hello-view");
        String sig = signer.sign(fileName, "owner-num");

        ResponseEntity<Resource> response = controller.viewFile(fileName, "owner-num", sig);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    void otherUserCannotViewSomeoneElsesFileByGuessingOwnerParam() throws IOException {
        String fileName = writeTestFile("hello-view-2");
        String sigForOwner = signer.sign(fileName, "owner-num");

        // 서명은 owner-num용으로 발급되었는데, 다른 학번(other-num)을 자기 것인 양 붙여서 접근 시도
        ResponseEntity<Resource> response = controller.viewFile(fileName, "other-num", sigForOwner);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void viewRejectsTamperedSignature() throws IOException {
        String fileName = writeTestFile("hello-view-3");

        ResponseEntity<Resource> response = controller.viewFile(fileName, "owner-num", "not-a-real-signature");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void unsignedRequestForNonWhitelistedFileIsRejected() throws IOException {
        // 화이트리스트 도입 이후, 서명도 없고 목록에도 없는 파일은 더 이상 허용되지 않는다.
        String fileName = writeTestFile("hello-legacy");

        ResponseEntity<Resource> response = controller.viewFile(fileName, null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void unsignedRequestForWhitelistedLegacyFileStillWorks() throws IOException {
        String fileName = writeTestFile("hello-legacy-whitelisted");
        ReflectionTestUtils.setField(controller, "legacyAllowedFilesRaw", "other-file.png," + fileName);

        ResponseEntity<Resource> response = controller.viewFile(fileName, null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void legacyStaticPathEndpointServesWhitelistedFile() throws IOException {
        String fileName = writeTestFile("hello-uploads-path");
        ReflectionTestUtils.setField(controller, "legacyAllowedFilesRaw", fileName);

        ResponseEntity<Resource> response = controller.viewLegacyFile(fileName);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void legacyStaticPathEndpointRejectsNonWhitelistedFile() throws IOException {
        String fileName = writeTestFile("hello-uploads-path-2");

        ResponseEntity<Resource> response = controller.viewLegacyFile(fileName);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void ownerCanDownloadOwnFile() throws IOException {
        String fileName = writeTestFile("hello-download");
        String sig = signer.sign(fileName, "owner-num");

        ResponseEntity<Resource> response = controller.downloadFile(fileName, "원본.txt", "owner-num", sig);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst("Content-Disposition")).contains("attachment");
    }

    @Test
    void otherUserCannotDownloadSomeoneElsesFile() throws IOException {
        String fileName = writeTestFile("hello-download-2");
        String sigForOwner = signer.sign(fileName, "owner-num");

        ResponseEntity<Resource> response = controller.downloadFile(fileName, "원본.txt", "other-num", sigForOwner);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void viewRejectsPathTraversalWithSlashes() {
        // 레거시(서명 없음) 경로여도 경로 조작 자체는 막혀야 한다.
        ResponseEntity<Resource> response = controller.viewFile("../../application.yaml", null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void viewRejectsPathTraversalWithBackslashes() {
        ResponseEntity<Resource> response = controller.viewFile("..\\..\\application.yaml", null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void viewRejectsPureParentDirectoryToken() {
        // 슬래시가 없어도 normalize() 이후 기준 디렉터리를 벗어나면 막혀야 한다.
        ResponseEntity<Resource> response = controller.viewFile("..", null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void downloadRejectsPathTraversal() {
        ResponseEntity<Resource> response = controller.downloadFile("../../secret.txt", "x.txt", null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void uploadImageRejectsDisallowedExtension() {
        MockMultipartFile file = new MockMultipartFile("file", "malicious.php", "image/png", "data".getBytes());

        ResponseEntity<?> response = controller.uploadImage(file, "owner-num");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void uploadImageRejectsDoubleExtensionTrick() {
        // 마지막 확장자(.php)만 실제로 검사되므로 이런 위장도 막힌다.
        MockMultipartFile file = new MockMultipartFile("file", "photo.png.php", "image/png", "data".getBytes());

        ResponseEntity<?> response = controller.uploadImage(file, "owner-num");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void uploadFileRejectsDisallowedExtension() {
        MockMultipartFile file = new MockMultipartFile("file", "malicious.exe", "application/pdf", "data".getBytes());

        ResponseEntity<?> response = controller.uploadFile(file, "owner-num");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void uploadImageRejectsPdfExtension() {
        // 이미지 업로드 엔드포인트는 이미지 확장자만 허용한다(PDF는 /upload/file 전용).
        MockMultipartFile file = new MockMultipartFile("file", "doc.pdf", "application/pdf", "data".getBytes());

        ResponseEntity<?> response = controller.uploadImage(file, "owner-num");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private String writeTestFile(String content) throws IOException {
        Path dir = Paths.get("uploads");
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
        }
        String fileName = "test-" + UUID.randomUUID() + ".txt";
        createdFile = dir.resolve(fileName);
        Files.writeString(createdFile, content, StandardCharsets.UTF_8);
        return fileName;
    }
}
