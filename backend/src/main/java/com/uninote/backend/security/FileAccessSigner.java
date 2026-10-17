package com.uninote.backend.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

// 업로드 파일(이미지 <img>, PDF 새 탭 열기·다운로드)은 브라우저가 직접 요청을 보내므로
// Authorization 헤더를 붙일 수 없다. 업로드 시 (파일명, 업로더 학번)에 대한 서명을 발급해
// URL에 실어 보내고, 파일 서빙 시 이 서명만으로 인가한다(별도 헤더·쿠키·세션 불필요).
// 파일명과 학번 조합이 하나라도 다르면 검증에 실패한다.
// 키는 file.signing-secret이고, 없으면 jwt.secret을 쓴다. 서명된 URL이 노트 본문에 저장되므로
// JWT secret을 교체할 때는 이 값을 이전 secret으로 두어야 기존 이미지·PDF가 깨지지 않는다
// (파일 키 교체는 "응답 시 서명" 재설계(PLANS.md P0-2) 때 한다).
@Component
public class FileAccessSigner {

    private final byte[] secretKey;

    public FileAccessSigner(@Value("${file.signing-secret:${jwt.secret}}") String signingSecret) {
        this.secretKey = signingSecret.getBytes(StandardCharsets.UTF_8);
    }

    public String sign(String fileName, String owner) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKey, "HmacSHA256"));
            byte[] raw = mac.doFinal((fileName + "|" + owner).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception e) {
            throw new IllegalStateException("파일 접근 서명 생성에 실패했습니다.", e);
        }
    }

    public boolean isValid(String fileName, String owner, String signature) {
        if (owner == null || signature == null) {
            return false;
        }
        // 비교 시간으로 서명을 한 글자씩 맞혀 보지 못하게 상수 시간으로 비교한다.
        return MessageDigest.isEqual(sign(fileName, owner).getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }
}
