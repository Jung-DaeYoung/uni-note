package com.uninote.backend.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/upload")
public class ImageUploadController {

    private final String uploadDir = "uploads";

    @PostMapping("/image")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        return processUpload(file, true);
    }

    @PostMapping("/file")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        log.info("파일 업로드 요청 수신: {}, 크기: {} bytes", file.getOriginalFilename(), file.getSize());
        return processUpload(file, false);
    }

    private ResponseEntity<?> processUpload(MultipartFile file, boolean isImage) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("파일이 비어있습니다.");
        }

        try {
            // 디렉토리 생성
            Path copyLocation = Paths.get(uploadDir);
            if (!Files.exists(copyLocation)) {
                Files.createDirectories(copyLocation);
            }

            // UUID를 사용하여 파일명 생성
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String fileName = UUID.randomUUID().toString() + extension;

            // 파일 저장
            Path targetPath = copyLocation.resolve(fileName);
            Files.copy(file.getInputStream(), targetPath);

            // 반환할 URL 생성
            String fileUrl = "/uploads/" + fileName;

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
}
