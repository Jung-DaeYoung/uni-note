import { useState } from 'react';
import client, { API_BASE_URL } from '../../../api/client';

const SERVER_URL = API_BASE_URL;

// 서버(ImageUploadController)와 동일한 확장자 화이트리스트, 크기 제한(application.yaml
// max-file-size: 10MB)을 클라이언트에서도 미리 확인해 불필요한 업로드 요청을 막는다.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const ALLOWED_PDF_EXTENSIONS = ['.pdf'];
const ALLOWED_PDF_MIME_TYPES = ['application/pdf'];

// 문서에 저장된 이미지/PDF URL이 실제로 우리 서버가 서빙하는 경로인지 확인한다.
// javascript:/data: 스킴이나 임의의 외부 origin으로 조작된 URL은 렌더링하지 않기 위함.
const ALLOWED_FILE_PATH_PREFIXES = ['/api/upload/view/', '/api/upload/download/', '/uploads/'];

export const isAllowedFileUrl = (url) => {
  if (!url) return false;
  try {
    const serverOrigin = new URL(SERVER_URL).origin;
    const parsed = new URL(url, SERVER_URL);
    if (parsed.origin !== serverOrigin) return false;
    return ALLOWED_FILE_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix));
  } catch {
    return false;
  }
};

const getExtension = (filename) => {
  if (!filename || !filename.includes('.')) return '';
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
};

// 서버는 확장자만 검사하고 MIME은 보지 않으므로, MIME은 브라우저가 값을 채워준 경우에만
// 참고 삼아 추가로 확인한다(값이 비어 있으면 확장자 통과만으로 충분한 것으로 본다).
const validateFile = (file, { allowedExtensions, allowedMimeTypes }) => {
  if (!file) return '파일을 선택해주세요.';
  if (file.size > MAX_FILE_SIZE_BYTES) return '파일 크기는 10MB를 초과할 수 없습니다.';
  if (!allowedExtensions.includes(getExtension(file.name))) return '허용되지 않는 파일 형식입니다.';
  if (file.type && !allowedMimeTypes.includes(file.type)) return '허용되지 않는 파일 형식입니다.';
  return null;
};

// 업로드 진행/실패 상태를 사용자에게 보여주기 위해 훅에서 상태로 노출한다.
const useNoteUploads = () => {
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | error
  const [uploadError, setUploadError] = useState(null);

  const clearUploadError = () => {
    setUploadStatus('idle');
    setUploadError(null);
  };

  const handleImageUpload = async (file) => {
    const validationError = validateFile(file, {
      allowedExtensions: ALLOWED_IMAGE_EXTENSIONS,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    });
    if (validationError) {
      setUploadStatus('error');
      setUploadError(validationError);
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    setUploadStatus('uploading');
    setUploadError(null);
    try {
      const response = await client.post('/upload/image', formData);
      setUploadStatus('idle');
      return SERVER_URL + response.data.url;
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      setUploadStatus('error');
      setUploadError('이미지 업로드에 실패했습니다.');
      return null;
    }
  };

  const handlePdfUpload = async (file) => {
    const validationError = validateFile(file, {
      allowedExtensions: ALLOWED_PDF_EXTENSIONS,
      allowedMimeTypes: ALLOWED_PDF_MIME_TYPES,
    });
    if (validationError) {
      setUploadStatus('error');
      setUploadError(validationError);
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    setUploadStatus('uploading');
    setUploadError(null);
    try {
      const response = await client.post('/upload/file', formData);
      setUploadStatus('idle');
      return {
        url: SERVER_URL + response.data.url,
        title: response.data.title,
      };
    } catch (error) {
      console.error('PDF 업로드 실패:', error);
      setUploadStatus('error');
      setUploadError('PDF 업로드에 실패했습니다.');
      return null;
    }
  };

  return { handleImageUpload, handlePdfUpload, uploadStatus, uploadError, clearUploadError };
};

export default useNoteUploads;
