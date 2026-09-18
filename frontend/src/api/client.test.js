import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// client.js는 모듈 로드 시점에 axios.create()를 호출해 인터셉터를 등록하므로,
// 실제 axios 대신 interceptors.use()에 전달된 콜백을 붙잡아두는 가짜 인스턴스로 대체한다.
// 이렇게 하면 실제 HTTP 요청 없이 응답 인터셉터의 에러 처리 분기만 직접 검증할 수 있다.
// vi.mock은 파일 최상단으로 호이스팅되므로, 붙잡아둘 상태는 vi.hoisted()로 선언해야
// "초기화 전 접근" 오류를 피할 수 있다.
const captured = vi.hoisted(() => ({ responseErrorHandler: null }));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: {
          use: vi.fn((_onSuccess, onError) => {
            captured.responseErrorHandler = onError;
          }),
        },
      },
    })),
  },
}));

import { registerLogoutHandler } from './client.js';

describe('api client 응답 인터셉터', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('401 응답은 기본 logoutHandler(localStorage 정리 + /login 이동)를 호출한다', async () => {
    localStorage.setItem('token', 'abc');
    const error = { response: { status: 401, data: {} } };

    await expect(captured.responseErrorHandler(error)).rejects.toBe(error);

    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('registerLogoutHandler로 등록한 커스텀 핸들러가 401에서 호출된다', async () => {
    const customLogout = vi.fn();
    registerLogoutHandler(customLogout);
    const error = { response: { status: 401, data: {} } };

    await expect(captured.responseErrorHandler(error)).rejects.toBe(error);

    expect(customLogout).toHaveBeenCalledTimes(1);

    // 이후 테스트에 영향이 없도록 기본 핸들러로 복원한다(모듈 스코프 상태 공유).
    registerLogoutHandler(() => {
      localStorage.removeItem('token');
      window.location.href = '/login';
    });
  });

  it('403 + FORBIDDEN_COURSE_ACCESS는 alert 후 /dashboard로 이동한다', async () => {
    const error = {
      response: { status: 403, data: { errorCode: 'FORBIDDEN_COURSE_ACCESS', message: '권한 없음' } },
    };

    await expect(captured.responseErrorHandler(error)).rejects.toBe(error);

    expect(window.alert).toHaveBeenCalledWith('권한 없음');
    expect(window.location.href).toBe('/dashboard');
  });

  // 발견된 버그를 고정하는 회귀 테스트: 인증되지 않은 요청(토큰 없음/만료)에 대해 실제
  // 백엔드(SecurityConfig에 커스텀 AuthenticationEntryPoint가 없음)는 401이 아니라 403을
  // 내려주고, 본문도 우리 ErrorResponse 형식(errorCode 포함)이 아니다. 아래 두 분기
  // 중 어느 것도 매칭하지 않으므로 로그아웃도 리다이렉트도 일어나지 않는다 — 토큰이
  // 만료돼도 사용자가 로그인 화면으로 보내지지 않는 실제 버그. 이 테스트는 "고쳐야 할
  // 목표"가 아니라 현재 동작을 고정해, 나중에 백엔드가 수정되면 이 테스트도 같이
  // 업데이트해야 한다는 신호를 남기기 위한 것이다.
  it('errorCode 없는 403(인증되지 않은 요청)은 로그아웃도 리다이렉트도 하지 않는다', async () => {
    const error = { response: { status: 403, data: {} } };

    await expect(captured.responseErrorHandler(error)).rejects.toBe(error);

    expect(window.alert).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('처리 후에도 오류는 항상 reject되어 호출자가 이어서 처리할 수 있다', async () => {
    const error = { response: { status: 500, data: {} } };

    await expect(captured.responseErrorHandler(error)).rejects.toBe(error);
  });
});
