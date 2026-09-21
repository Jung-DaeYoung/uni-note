import { useCallback, useMemo, useRef, useState } from 'react';
import debounce from 'lodash.debounce';
import axios from 'axios';
import client from '../../../api/client';

// 손상된 JSON이 에디터를 통째로 멈추게 하지 않도록 파싱을 보호한다.
const safeParseJson = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('노트 콘텐츠 JSON 파싱 실패', error);
    return null;
  }
};

// Tiptap이 렌더링 가능한 최소한의 문서 구조인지 확인한다.
const isValidTiptapDoc = (value) =>
  !!value && typeof value === 'object' && value.type === 'doc' && Array.isArray(value.content);

// 로컬 스토리지 항목: { content: <Tiptap 문서>, timestamp: <number> } 형태만 유효로 인정한다.
const isValidLocalEntry = (value) =>
  !!value && typeof value === 'object' && isValidTiptapDoc(value.content) && typeof value.timestamp === 'number';

// 로컬 스토리지 복구 + 서버 저장(2초 debounce)을 함께 관리한다.
const useNoteAutosave = ({ noteId, initialData, onSaved }) => {
  const [saveStatus, setSaveStatus] = useState('synced');
  const lastSavedJson = useRef(null);
  const isInitialMount = useRef(true);
  // 노트 전환(NotionEditor 재마운트) 시 아직 응답이 오지 않은 저장 요청을 취소해,
  // 늦게 도착한 응답이 현재 화면의 saveStatus/onSaved를 건드리지 않도록 막는다.
  const activeRequestControllerRef = useRef(null);
  // 이 훅 인스턴스(=노트 하나)당 최초 1회만 에디터 콘텐츠를 서버/로컬 데이터와 동기화한다.
  // NotionEditor는 <NotionEditor key={noteId} />로 노트마다 새로 마운트되므로,
  // 최초 동기화 이후에는 initialData/editor 참조가 바뀌어 effect가 다시 실행되더라도
  // 사용자가 편집 중인(아직 저장 전인) 내용을 오래된 서버 콘텐츠로 덮어써서는 안 된다.
  const hasSyncedRef = useRef(false);

  const getInitialContent = useCallback(() => {
    const parsedServerData = safeParseJson(initialData?.content);
    const serverData = isValidTiptapDoc(parsedServerData) ? parsedServerData : null;

    const parsedLocalEntry = safeParseJson(localStorage.getItem(`note-temp-${noteId}`));
    const localData = isValidLocalEntry(parsedLocalEntry) ? parsedLocalEntry : null;

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

  // debounce/재시도 양쪽에서 공유하는 실제 저장 로직.
  const performSave = useCallback(async (editor, id) => {
    const jsonContent = editor.getJSON();
    const titleNode = jsonContent.content[0];
    const title = titleNode?.content?.[0]?.text || '제목 없음';
    const plainText = editor.getText();
    const previewText = plainText.substring(title.length, title.length + 200).trim();

    if (JSON.stringify(jsonContent) === JSON.stringify(lastSavedJson.current)) return;

    const controller = new AbortController();
    activeRequestControllerRef.current = controller;

    setSaveStatus('saving');
    try {
      await client.put(`/notes/${id}`, {
        title: title,
        content: JSON.stringify(jsonContent),
        previewText: previewText,
        searchContent: plainText,
      }, { signal: controller.signal });
      lastSavedJson.current = jsonContent;
      setSaveStatus('synced');
      if (onSaved) onSaved();
    } catch (error) {
      if (axios.isCancel(error)) return; // 노트 전환으로 취소된 요청은 오류로 취급하지 않음
      console.error('서버 저장 실패:', error);
      setSaveStatus('error');
    } finally {
      if (activeRequestControllerRef.current === controller) {
        activeRequestControllerRef.current = null;
      }
    }
  }, [onSaved]);

  const debouncedSaveToServer = useMemo(
    // performSave가 ref를 다루지만 실제 실행은 debounce 타이머가 만료된 뒤 일어난다는 것을
    // 정적 분석기가 알 수 없어 발생하는 오탐(false positive)이다.
    // eslint-disable-next-line react-hooks/refs
    () => debounce(performSave, 2000),
    [performSave]
  );

  const saveDraftToLocalStorage = useCallback((id, json) => {
    localStorage.setItem(`note-temp-${id}`, JSON.stringify({ content: json, timestamp: Date.now() }));
  }, []);

  // 서버 저장(2000ms)과는 별개로, 키 입력마다 즉시 실행되던 localStorage 기록만 짧게 debounce해
  // 대형 문서에서 매 입력마다 JSON.stringify + setItem이 동기 실행되는 지연을 줄인다.
  const debouncedSaveToLocalStorage = useMemo(
    () => debounce(saveDraftToLocalStorage, 300),
    [saveDraftToLocalStorage]
  );

  const handleEditorUpdate = useCallback((editor) => {
    const json = editor.getJSON();
    debouncedSaveToLocalStorage(noteId, json);
    if (!isInitialMount.current) debouncedSaveToServer(editor, noteId);
  }, [noteId, debouncedSaveToLocalStorage, debouncedSaveToServer]);

  // 저장 실패(saveStatus === 'error') 후 사용자가 즉시 재시도할 수 있게 한다.
  // 대기 중인 debounce를 취소하고 현재 에디터 내용으로 바로 저장을 시도한다.
  const retrySave = useCallback((editor) => {
    if (!editor) return;
    debouncedSaveToServer.cancel();
    performSave(editor, noteId);
  }, [debouncedSaveToServer, performSave, noteId]);

  // noteId가 바뀔 때 에디터 인스턴스는 유지하되 내용만 초기화해야 할 경우를 위해 남겨둠
  // 단, 부모에서 <NotionEditor key={noteId} />를 사용한다면 이 호출은 사실상 no-op.
  // hasSyncedRef로 노트당 최초 1회만 실행되도록 막아, effect 재실행(예: React
  // StrictMode의 이중 호출, initialData/editor 참조 변경 등)으로 인해 사용자가
  // 이미 입력 중인 내용이 뒤늦게 오래된 initialData로 덮어써지는 것을 방지한다.
  const syncEditor = useCallback((editor) => {
    if (!editor || hasSyncedRef.current) return;
    hasSyncedRef.current = true;

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
    debouncedSaveToLocalStorage.cancel();
    activeRequestControllerRef.current?.abort();
  }, [debouncedSaveToServer, debouncedSaveToLocalStorage]);

  return { saveStatus, getInitialContent, handleEditorUpdate, syncEditor, cancelPendingSave, retrySave };
};

export default useNoteAutosave;
