package com.uninote.backend.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.WeakKeyException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey secretKey;
    private final long expiration;

    public JwtUtil(@Value("${jwt.secret}") String secret, @Value("${jwt.expiration}") long expiration) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("jwt.secret이 설정되지 않았습니다.");
        }
        if (expiration <= 0) {
            throw new IllegalStateException("jwt.expiration은 0보다 커야 합니다.");
        }
        try {
            this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        } catch (WeakKeyException e) {
            throw new IllegalStateException("jwt.secret 길이가 HMAC-SHA 서명에 필요한 최소 길이를 충족하지 않습니다.", e);
        }
        this.expiration = expiration;
    }

    public String generateToken(String studentNum) {
        return Jwts.builder()
                .subject(studentNum)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(secretKey)
                .compact();
    }

    // 서명·만료 검증을 통과하면 토큰의 학번(subject)을, 실패하면 null을 반환한다.
    public String parseSubject(String token) {
        try {
            return Jwts.parser().verifyWith(secretKey).build().parseSignedClaims(token).getPayload().getSubject();
        } catch (Exception e) {
            return null;
        }
    }
}
