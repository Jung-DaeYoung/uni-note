package com.uninote.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FileAccessSignerTest {

    private final FileAccessSigner signer = new FileAccessSigner("test_jwt_secret_key_minimum_32_bytes_long");

    @Test
    void signatureIsValidForTheExactFileNameAndOwnerItWasIssuedFor() {
        String sig = signer.sign("abc.png", "owner-num");

        assertThat(signer.isValid("abc.png", "owner-num", sig)).isTrue();
    }

    @Test
    void signatureIsRejectedWhenOwnerIsSwapped() {
        String sig = signer.sign("abc.png", "owner-num");

        // 다른 사용자가 소유자만 자기 학번으로 바꿔서 접근을 시도하는 경우
        assertThat(signer.isValid("abc.png", "other-num", sig)).isFalse();
    }

    @Test
    void signatureIsRejectedWhenFileNameIsSwapped() {
        String sig = signer.sign("abc.png", "owner-num");

        assertThat(signer.isValid("different.png", "owner-num", sig)).isFalse();
    }

    @Test
    void signatureIsRejectedWhenTampered() {
        String sig = signer.sign("abc.png", "owner-num");

        assertThat(signer.isValid("abc.png", "owner-num", sig + "x")).isFalse();
    }

    @Test
    void missingOwnerOrSignatureIsInvalid() {
        assertThat(signer.isValid("abc.png", null, "sig")).isFalse();
        assertThat(signer.isValid("abc.png", "owner-num", null)).isFalse();
    }
}
