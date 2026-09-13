import { useCallback, useMemo, useRef, useState } from 'react';
import debounce from 'lodash.debounce';
import client from '../../../api/client';

// 로컬 스토리지 복구 + 서버 저장(2초 debounce)을 함께 관리한다.
const useNoteAutosave = ({ noteId, initialData, onSaved }) => {
  const [saveStatus, setSaveStatus] = useState('synced');
  const lastSavedJson = useRef(null);
  const isInitialMount = useRef(true);

  const getInitialContent = useCallback(() => {
    const serverData = initialData?.content ? JSON.parse(initialData.content) : null;
    const localData = JSON.parse(localStorage.getItem(`note-temp-${noteId}`) || 'null');

    // 로컬 스토리지 데이터가 서버 데이터보다 최신인 경우 우선 사용
    if (localData && (!serverData || localData.timestamp > (initialData?.updatedAt || 0))) {
      return localData.content;
    }

    if (serverData) return serverData;

    // 빈 텍스트 노드 에러 방지: title이 있을 때만 text 노드 생성
    const title = initialData?.title || '';
    return {
      type: 'doc',
      content: [{
        type: 'heading',
        attrs: { level: 1 },
        content: title ? [{ type: 'text', text: title }] : [],
      }],
    };
  }, [noteId, initialData]);

  const debouncedSaveToServer = useMemo(
    // debounce가 감싼 함수가 언제 실행되는지 정적 분석으로 추적할 수 없어 발생하는
    // 오탐(false positive)이다. 실제로는 렌더링 중이 아니라 debounce 타이머가 만료될 때만
    // lastSavedJson.current를 읽고 쓴다.
    // eslint-disable-next-line react-hooks/refs
    () => debounce(async (editor, id) => {
      const jsonContent = editor.getJSON();
      const titleNode = jsonContent.content[0];
      const title = titleNode?.content?.[0]?.text || '제목 없음';
      const plainText = editor.getText();
      const previewText = plainText.substring(title.length, title.length + 200).trim();

      if (JSON.stringify(jsonContent) === JSON.stringify(lastSavedJson.current)) return;

      setSaveStatus('saving');
      try {
        await client.put(`/notes/${id}`, {
          title: title,
          content: JSON.stringify(jsonContent),
          previewText: previewText,
          searchContent: plainText,
        });
        lastSavedJson.current = jsonContent;
        setSaveStatus('synced');
        if (onSaved) onSaved();
      } catch (error) {
        console.error('서버 저장 실패:', error);
        setSaveStatus('error');
      }
    }, 2000),
    [onSaved]
  );

  const handleEditorUpdate = useCallback((editor) => {
    const json = editor.getJSON();
    localStorage.setItem(`note-temp-${noteId}`, JSON.stringify({ content: json, timestamp: Date.now() }));
    if (!isInitialMount.current) debouncedSaveToServer(editor, noteId);
  }, [noteId, debouncedSaveToServer]);

  // noteId가 바뀔 때 에디터 인스턴스는 유지하되 내용만 초기화해야 할 경우를 위해 남겨둠
  // 단, 부모에서 <NotionEditor key={noteId} />를 사용한다면 이 호출은 사실상 no-op
  const syncEditor = useCallback((editor) => {
    if (!editor) return;

    const currentContent = editor.getJSON();
    const initialContent = getInitialContent();

    if (JSON.stringify(currentContent) !== JSON.stringify(initialContent)) {
      editor.commands.setContent(initialContent, false); // emitUpdate: false로 불필요한 저장 방지
    }

    lastSavedJson.current = initialContent;
    isInitialMount.current = false;
  }, [getInitialContent]);

  const cancelPendingSave = useCallback(() => {
    debouncedSaveToServer.cancel();
  }, [debouncedSaveToServer]);

  return { saveStatus, getInitialContent, handleEditorUpdate, syncEditor, cancelPendingSave };
};

export default useNoteAutosave;
