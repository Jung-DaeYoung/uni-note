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
        log.info("이미지 업로드 요청 수신: {}, 크기: {} bytes", file.getOriginalFilename(), file.getSize());
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
            String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            String fileName = UUID.randomUUID().toString() + extension;

            // 파일 저장
            Path targetPath = copyLocation.resolve(fileName);
            Files.copy(file.getInputStream(), targetPath);

            // 반환할 URL 생성
            String fileUrl = "/uploads/" + fileName;

            log.info("이미지 업로드 성공: {}", fileUrl);
            return ResponseEntity.ok(Map.of("url", fileUrl));

        } catch (IOException e) {
            log.error("이미지 업로드 실패", e);
            return ResponseEntity.internalServerError().body("이미지 저장 중 오류가 발생했습니다.");
        }
    }
}
