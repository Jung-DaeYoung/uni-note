import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import client from '../api/client';

// 노트 트리 조회/생성/삭제와 현재 노트 조회, 최초 진입 시 노트 이동/생성을 담당한다.
const useCourseNotes = ({ courseId, noteId, navigate, searchParams }) => {
  const [noteTree, setNoteTree] = useState([]);
  const [noteData, setNoteData] = useState(null);

  const fetchTree = useCallback(async () => {
    try {
      const res = await client.get(`/courses/${courseId}/notes/tree`);
      const tree = res.data || [];
      setNoteTree(tree);
      return tree;
    } catch (error) {
      console.error("트리 로딩 실패", error);
      // 조회 실패를 "노트 없음"과 구분하기 위해 null을 반환한다. 여기서 빈 배열을
      // 반환하면 호출부(최초 진입 로직)가 일시적인 네트워크 오류를 "노트가 없다"로
      // 오인해 불필요한 루트 노트를 자동 생성할 수 있다.
      return null;
    }
  }, [courseId]);

  // 최초 진입 시: 트리 로딩 후 노트가 없으면 이동/생성
  useEffect(() => {
    // React StrictMode의 mount→cleanup→remount(개발 모드) 이중 실행이나, 의존성이
    // 바뀌어 effect가 재실행될 때 이전 실행의 비동기 흐름이 계속 진행되어 루트 노트
    // 생성 POST가 중복 발생하지 않도록, 이 실행이 여전히 유효한지 표시하는 플래그.
    let isActive = true;

    const fetchData = async () => {
      try {
        const treeData = await fetchTree();
        if (!isActive) return;
        // 트리 조회 자체가 실패한 경우(treeData === null) "노트 없음"으로 오인해
        // 새 노트를 자동 생성하지 않는다. 실패는 fetchTree 내부에서 이미 로깅된다.
        if (treeData === null) return;

        if (!noteId) {
          if (treeData.length > 0) {
            navigate(`/course/${courseId}/note/${treeData[0].noteId}${searchParams}`, { replace: true });
          } else {
            const createRes = await client.post(`/courses/${courseId}/notes`);
            if (!isActive) return;
            navigate(`/course/${courseId}/note/${createRes.data.noteId}${searchParams}`, { replace: true });
          }
        }
      } catch (error) {
        console.error("데이터 로딩 실패", error);
      }
    };
    fetchData();

    return () => {
      isActive = false;
    };
  }, [courseId, noteId, navigate, fetchTree, searchParams]);

  // 현재 노트 조회 - 빠른 노트 전환 시 이전 요청을 취소해 늦게 도착한 응답이
  // 현재 noteId의 상태를 덮어쓰지 않도록 한다.
  useEffect(() => {
    if (!noteId) return;
    const controller = new AbortController();
    const fetchNote = async () => {
      try {
        const res = await client.get(`/notes/${noteId}`, { signal: controller.signal });
        setNoteData(res.data);
      } catch (error) {
        if (axios.isCancel(error)) return;
        console.error("노트 로딩 실패", error);
      }
    };
    fetchNote();
    return () => controller.abort();
  }, [noteId]);

  const handleCreateRootNote = async () => {
    try {
      const res = await client.post(`/courses/${courseId}/notes`);
      fetchTree();
      navigate(`/course/${courseId}/note/${res.data.noteId}`);
    } catch {
      alert("노트 생성 실패");
    }
  };

  const handleDeleteNote = async (targetId, title) => {
    if (!window.confirm(`'${title}' 노트를 삭제하시겠습니까? 하위 노트도 모두 삭제됩니다.`)) return;
    try {
      await client.delete(`/notes/${targetId}`);
      const updatedTree = await fetchTree();

      // 현재 보고 있는 노트가 삭제되었다면 다른 노트로 이동
      if (parseInt(noteId) === targetId) {
        if (updatedTree && updatedTree.length > 0) {
          navigate(`/course/${courseId}/note/${updatedTree[0].noteId}`);
        } else {
          // 남은 노트가 없으면 대시보드로 이동하거나 새 노트 생성
          navigate(`/course/${courseId}`);
        }
      }
    } catch {
      alert("노트 삭제 실패");
    }
  };

  return { noteTree, noteData, fetchTree, handleCreateRootNote, handleDeleteNote };
};

export default useCourseNotes;
