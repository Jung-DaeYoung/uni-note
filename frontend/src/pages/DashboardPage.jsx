import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, MessageSquare, Clock, FileText } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useCourses } from '../context/CourseContext';

const DashboardPage = () => {
  // 사이드바(AppLayout)가 이미 같은 /dashboard/courses 응답을 CourseContext로 불러오므로,
  // 대시보드 페이지에서 동일한 요청을 다시 보내지 않고 그대로 재사용한다.
  const { courses, recentPosts, recentNotes, studentName } = useCourses();
  const navigate = useNavigate();

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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">반갑습니다, {studentName || '사용자'}님! 👋</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">오늘의 학습 현황을 확인해보세요.</p>
        </div>

        {/* Main Row: Courses (1/3) & Recent Notes (2/3) - Compact Courses Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Courses List - Left 1/3 (Narrow List) */}
          <div className="lg:w-1/3 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800 w-full">
                <BookOpen size={16} className="text-blue-600 dark:text-blue-400" />
                수강 중인 강의
              </h3>
            </div>
            <div className="space-y-3">
              {courses.length === 0 ? (
                <p className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm font-medium border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">수강 중인 강의가 없습니다.</p>
              ) : (
                courses.map((course) => (
                  <div
                    key={course.courseId}
                    className="group bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-500/50 transition-colors cursor-pointer flex items-center gap-4"
                    onClick={() => navigate(`/course/${course.courseId}`)}
                  >
                    <div className="w-11 h-11 bg-blue-50 dark:bg-blue-500/10 rounded-lg flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                      <BookOpen size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-blue-500 dark:text-blue-400 mb-0.5">{course.courseCode}</p>
                      <h4 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">{course.courseName}</h4>
                      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                        <span className="opacity-60">👤</span> {course.professorName} 교수
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-slate-300 dark:text-slate-700 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column - 2/3 Width (Recent Notes + Community) */}
          <div className="lg:w-2/3 space-y-12">
            {/* Recent Notes (3x2 Grid) */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <Clock size={16} className="text-slate-500 dark:text-slate-400" />
                최근 노트 기록
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentNotes.length === 0 ? (
                  <div className="col-span-full bg-slate-50/50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl h-[200px] flex flex-col items-center justify-center p-6 text-center">
                    <FileText size={28} className="text-slate-300 dark:text-slate-700 mb-3 opacity-70" />
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 leading-relaxed">최근 수정한 노트가 없습니다.</p>
                  </div>
                ) : (
                  recentNotes.map((note) => (
                    <div
                      key={note.noteId}
                      className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 transition-colors cursor-pointer group flex flex-col justify-between h-[130px]"
                      onClick={() => navigate(`/course/${note.courseId}/note/${note.noteId}`)}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 truncate">{note.courseName}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{note.title}</h4>
                      </div>
                      <div className="text-[11px] font-medium text-slate-400 dark:text-slate-600 text-right pt-2 border-t border-slate-100 dark:border-slate-800">
                        {formatTime(note.updatedAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Community Posts (Under Notes) */}
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <MessageSquare size={16} className="text-purple-600 dark:text-purple-400" />
                  최신 커뮤니티 게시글
                </h3>
                {recentPosts.length > 0 && (
                  <button className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">전체 보기</button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {recentPosts.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500 text-sm font-medium border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">새로운 게시글이 없습니다.</div>
                ) : (
                  recentPosts.slice(0, 5).map((post) => (
                    <div
                      key={post.postId}
                      className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500/50 transition-colors cursor-pointer group flex flex-col h-full"
                      onClick={() => navigate(`/course/${post.courseId}?postId=${post.postId}`)}
                    >
                      <div className="mb-2">
                        <span className="inline-block text-[11px] font-medium px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-md truncate max-w-full">
                          {post.courseName}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2 leading-tight flex-1">
                        {post.title}
                      </h4>
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 truncate max-w-[60%]">{post.authorName}</span>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-600 shrink-0">
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
