import { describe, it, expect } from 'vitest';
import { API_BASE_URL } from '../../../api/client';
import { resolveFileUrl, isAllowedFileUrl } from './useNoteUploads';

const server = new URL(API_BASE_URL).origin;
const path = '/api/upload/view/a.png?owner=20231234&sig=abc';

describe('resolveFileUrl', () => {
  it('다른 origin으로 저장된 업로드 URL을 현재 서버 주소로 바꾼다', () => {
    expect(resolveFileUrl(`http://localhost:8080${path}`)).toBe(server + path);
    expect(resolveFileUrl(`https://old.ngrok-free.app${path}`)).toBe(server + path);
  });

  it('상대 경로와 레거시 경로도 현재 서버 주소로 만든다', () => {
    expect(resolveFileUrl(path)).toBe(server + path);
    expect(resolveFileUrl('/uploads/a.pdf')).toBe(server + '/uploads/a.pdf');
  });

  it('허용되지 않은 스킴과 경로는 거부한다', () => {
    expect(resolveFileUrl('javascript:alert(1)')).toBeNull();
    expect(resolveFileUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(resolveFileUrl('https://evil.example.com/steal.png')).toBeNull();
    expect(resolveFileUrl('/api/notes/1')).toBeNull();
    expect(resolveFileUrl(null)).toBeNull();
    expect(isAllowedFileUrl('https://evil.example.com/x')).toBe(false);
  });
});
