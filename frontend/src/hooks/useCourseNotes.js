import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';

// 노트 트리 조회/생성/삭제와 현재 노트 조회, 최초 진입 시 노트 이동/생성을 담당한다.
const useCourseNotes = ({ courseId, noteId, navigate, searchParams }) => {
  const [noteTree, setNoteTree] = useState([]);
  const [noteData, setNoteData] = useState(null);

  const fetchTree = useCallback(async () => {
    try {
      const res = await client.get(`/courses/${courseId}/notes/tree`);
      setNoteTree(res.data || []);
      return res.data;
    } catch (error) {
      console.error("트리 로딩 실패", error);
      return [];
    }
  }, [courseId]);

  // 최초 진입 시: 트리 로딩 후 노트가 없으면 이동/생성
  useEffect(() => {
    const fetchData = async () => {
      try {
        const treeData = await fetchTree();

        if (!noteId) {
          if (treeData && treeData.length > 0) {
            navigate(`/course/${courseId}/note/${treeData[0].noteId}${searchParams}`, { replace: true });
          } else {
            const createRes = await client.post(`/courses/${courseId}/notes`);
            navigate(`/course/${courseId}/note/${createRes.data.noteId}${searchParams}`, { replace: true });
          }
        }
      } catch (error) {
        console.error("데이터 로딩 실패", error);
      }
    };
    fetchData();
  }, [courseId, noteId, navigate, fetchTree, searchParams]);

  // 현재 노트 조회
  useEffect(() => {
    if (!noteId) return;
    const fetchNote = async () => {
      try {
        const res = await client.get(`/notes/${noteId}`);
        setNoteData(res.data);
      } catch (error) {
        console.error("노트 로딩 실패", error);
      }
    };
    fetchNote();
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
        if (updatedTree.length > 0) {
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
