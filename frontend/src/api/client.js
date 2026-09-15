import axios from 'axios';

// 배포 환경에서는 VITE_API_BASE_URL로 실제 백엔드 origin을 지정한다.
// 값이 없으면(로컬 개발) 기존과 동일하게 localhost:8080을 사용한다.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const client = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// 401 처리를 AuthContext의 logout()으로 위임하기 위한 등록 지점.
// AuthProvider가 마운트되면 실제 상태 기반 logout으로 교체되며, 그 전까지는
// 기존과 동일하게 localStorage 정리 + 강제 이동으로 동작한다(단일 진입점 유지).
let logoutHandler = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};

export const registerLogoutHandler = (handler) => {
  logoutHandler = handler;
};

// 요청 인터셉터: localStorage에서 토큰을 꺼내 헤더에 추가
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 에러 발생 시 처리
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // 1. 수강 권한 에러 처리 (403 Forbidden)
      if (status === 403 && data.errorCode === 'FORBIDDEN_COURSE_ACCESS') {
        alert(data.message || '해당 강의에 접근할 권한이 없습니다.');
        window.location.href = '/dashboard';
      } 
      // 2. 인증 만료 처리 (401 Unauthorized) - AuthContext와 동일한 로그아웃 경로 사용
      else if (status === 401) {
        logoutHandler();
      }
    }
    return Promise.reject(error);
  }
);

export default client;
