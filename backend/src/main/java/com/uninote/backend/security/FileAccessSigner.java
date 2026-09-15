package com.uninote.backend.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

// 업로드 파일(이미지 <img>, PDF 새 탭 열기·다운로드)은 브라우저가 직접 요청을 보내므로
// Authorization 헤더를 붙일 수 없다. 업로드 시 (파일명, 업로더 학번)에 대한 서명을 발급해
// URL에 실어 보내고, 파일 서빙 시 이 서명만으로 인가한다(별도 헤더·쿠키·세션 불필요).
// jwt.secret을 그대로 재사용하며, 파일명과 학번 조합이 하나라도 다르면 검증에 실패한다.
@Component
public class FileAccessSigner {

    private final byte[] secretKey;

    public FileAccessSigner(@Value("${jwt.secret}") String jwtSecret) {
        this.secretKey = jwtSecret.getBytes(StandardCharsets.UTF_8);
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
        return sign(fileName, owner).equals(signature);
    }
}
