import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import client from '../api/client';
import { BookOpen, BrainCircuit, Trash2 } from 'lucide-react';
import CBTPlayer from '../components/editor/components/CBTPlayer';

const QuizLibraryPage = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const fetchQuizzes = () => {
    client.get('/quiz/my').then(res => setQuizzes(res.data)).catch(err => console.error(err));
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleRetake = async (quizSetId) => {
    try {
      const res = await client.get(`/quiz/${quizSetId}`);
      setSelectedQuiz(res.data);
    } catch (err) {
      alert('퀴즈 정보를 불러오는 데 실패했습니다.');
    }
  };

  const handleDelete = async (e, quizSetId) => {
    e.stopPropagation();
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await client.delete(`/quiz/${quizSetId}`);
      setQuizzes(quizzes.filter(q => q.quizSetId !== quizSetId));
    } catch (err) {
      alert('삭제 실패');
    }
  };

  return (
    <AppLayout>
      {selectedQuiz && (
        <CBTPlayer 
          quizData={selectedQuiz} 
          onClose={() => setSelectedQuiz(null)} 
        />
      )}

      <div className="p-8 max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">생성 문제 모음</h1>
          <p className="text-sm text-slate-500 font-medium">생성한 퀴즈를 다시 풀어보고 실력을 점검하세요.</p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.length === 0 ? (
            <div className="col-span-2 text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <BrainCircuit size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="font-bold text-slate-400">아직 생성된 퀴즈가 없습니다.</p>
            </div>
          ) : (
            quizzes.map(quiz => (
              <div key={quiz.quizSetId} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-slate-900">{quiz.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">{quiz.difficulty}</span>
                    <button onClick={(e) => handleDelete(e, quiz.quizSetId)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-6">생성일: {new Date(quiz.createdAt).toLocaleDateString()}</p>
                <button 
                  onClick={() => handleRetake(quiz.quizSetId)}
                  className="w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  다시 풀기
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default QuizLibraryPage;
