import client from '../../../api/client';

const SERVER_URL = 'http://localhost:8080';

const useNoteUploads = () => {
  const handleImageUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await client.post('/upload/image', formData);
      return SERVER_URL + response.data.url;
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      return null;
    }
  };

  const handlePdfUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await client.post('/upload/file', formData);
      return {
        url: SERVER_URL + response.data.url,
        title: response.data.title,
      };
    } catch (error) {
      console.error('PDF 업로드 실패:', error);
      return null;
    }
  };

  return { handleImageUpload, handlePdfUpload };
};

export default useNoteUploads;
