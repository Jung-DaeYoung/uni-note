import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, MessageSquare, Clock, FileText } from 'lucide-react';
import client from '../api/client';
import AppLayout from '../components/layout/AppLayout';

const DashboardPage = () => {
  const [courses, setCourses] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]); // 신규
  const [studentName, setStudentName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await client.get('/dashboard/courses');
        const { courses, recentPosts, recentNotes, studentName } = response.data;
        setCourses(courses || []);
        setRecentPosts(recentPosts || []);
        setRecentNotes(recentNotes || []); // 신규
        setStudentName(studentName || '사용자');
      } catch (error) {
        console.error("대시보드 데이터 로딩 실패", error);
      }
    };
    fetchDashboardData();
  }, []);

  const formatTime = (dateStr) => {
    const now = new Date();
    const past = new Date(dateStr);
    const diff = Math.floor((now - past) / (1000 * 60)); // 분 단위

    if (diff < 1) return '방금 전';
    if (diff < 60) return `${diff}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return `${Math.floor(diff / 1440)}일 전`;
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8 font-sans">
        {/* Header Section */}
        <div className="mb-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">반갑습니다, {studentName}님! 👋</h2>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-[0.2em]">Learning Hub Overview</p>
        </div>

        {/* Main Row: Courses (1/3) & Recent Notes (2/3) - Compact Courses Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Courses List - Left 1/3 (Narrow List) */}
          <div className="lg:w-1/3 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest border-b-2 border-blue-100 pb-1">
                <BookOpen size={18} className="text-blue-600" />
                수강 중인 강의
              </h3>
            </div>
            <div className="space-y-4">
              {courses.length === 0 ? (
                <p className="py-12 text-center text-slate-400 text-sm font-bold border-2 border-dashed border-slate-100 rounded-3xl">수강 중인 강의가 없습니다.</p>
              ) : (
                courses.map((course) => (
                  <div 
                    key={course.courseId} 
                    className="group bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-500/40 hover:shadow-md transition-all cursor-pointer flex items-center gap-4"
                    onClick={() => navigate(`/course/${course.courseId}`)}
                  >
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 text-blue-600 transition-transform group-hover:scale-105">
                      <BookOpen size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{course.courseCode}</p>
                      <h4 className="text-[15px] font-black text-slate-900 truncate group-hover:text-blue-600 transition-colors leading-tight">{course.courseName}</h4>
                      <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1">
                        <span className="opacity-60">👤</span> {course.professorName} 교수
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-slate-200 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column - 2/3 Width (Recent Notes + Community) */}
          <div className="lg:w-2/3 space-y-12">
            {/* Recent Notes (3x2 Grid) */}
            <div className="space-y-5">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest border-b-2 border-sky-100 pb-1">
                <Clock size={18} className="text-sky-500" />
                최근 노트 기록
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {recentNotes.length === 0 ? (
                  <div className="col-span-full bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-3xl h-[240px] flex flex-col items-center justify-center p-6 text-center">
                    <FileText size={32} className="text-slate-200 mb-4 opacity-50" />
                    <p className="text-xs font-bold text-slate-300 leading-relaxed uppercase tracking-tighter">최근 수정한<br/>노트가 없습니다.</p>
                  </div>
                ) : (
                  recentNotes.map((note) => (
                    <div 
                      key={note.noteId} 
                      className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-sky-400/40 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between h-[140px]"
                      onClick={() => navigate(`/course/${note.courseId}/note/${note.noteId}`)}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="p-1.5 bg-sky-50 rounded-lg">
                            <FileText size={14} className="text-sky-500" />
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate max-w-[80%]">{note.courseName}</span>
                        </div>
                        <h4 className="text-[14px] font-black text-slate-800 line-clamp-2 leading-snug group-hover:text-sky-600 transition-colors">{note.title}</h4>
                      </div>
                      <div className="text-[10px] font-bold text-slate-300 text-right uppercase tracking-tighter pt-3 border-t border-slate-50">
                        {formatTime(note.updatedAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Community Posts (Under Notes) */}
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b-2 border-purple-100 pb-1">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                  <MessageSquare size={18} className="text-purple-600" />
                  최신 커뮤니티 게시글
                </h3>
                {recentPosts.length > 0 && (
                  <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">View All</button>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {recentPosts.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 text-sm font-bold border-2 border-dashed border-slate-100 rounded-3xl">새로운 게시글이 없습니다.</div>
                ) : (
                  recentPosts.slice(0, 5).map((post) => (
                    <div 
                      key={post.postId} 
                      className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-purple-500/40 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full"
                      onClick={() => navigate(`/course/${post.courseId}?postId=${post.postId}`)}
                    >
                      <div className="mb-2.5">
                        <span className="inline-block text-[9px] font-black px-2 py-1 bg-purple-50 text-purple-600 rounded-md uppercase tracking-tighter truncate max-w-full">
                          {post.courseName}
                        </span>
                      </div>
                      <h4 className="text-[12px] font-black text-slate-900 mb-3 group-hover:text-purple-600 transition-colors line-clamp-2 leading-tight uppercase tracking-tight flex-1">
                        {post.title}
                      </h4>
                      <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-slate-50">
                        <span className="text-[10px] font-bold text-slate-400 truncate max-w-[60%]">{post.authorName}</span>
                        <span className="text-[9px] font-bold text-slate-300 shrink-0">
                          {new Date(post.createdAt).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'})}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
