package com.uninote.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PostRequest {
    @NotBlank
    @Size(max = 200)
    private String title;
    @NotBlank
    @Size(max = 10_000)
    private String content;
}
