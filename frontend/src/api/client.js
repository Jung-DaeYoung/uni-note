import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:8080/api',
});

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
      // 2. 인증 만료 처리 (401 Unauthorized)
      else if (status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
