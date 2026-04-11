import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, MessageSquare, Clock } from 'lucide-react';
import client from '../api/client';
import AppLayout from '../components/layout/AppLayout';

const DashboardPage = () => {
  const [courses, setCourses] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [studentName, setStudentName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await client.get('/dashboard/courses');
        const { courses, recentPosts, studentName } = response.data;
        setCourses(courses || []);
        setRecentPosts(recentPosts || []);
        setStudentName(studentName || '사용자');
      } catch (error) {
        console.error("대시보드 데이터 로딩 실패", error);
      }
    };
    fetchDashboardData();
  }, []);

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 font-sans">
        {/* Header Section */}
        <div className="mb-6">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">반갑습니다, {studentName}님! 👋</h2>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-[0.2em]">Learning Overview</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Courses List */}
          <div className="flex-[1.5] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                <BookOpen size={16} className="text-blue-600" />
                수강 중인 강의
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {courses.length === 0 ? (
                <p className="col-span-full py-8 text-center text-slate-400 text-xs font-bold border-2 border-dashed border-slate-100 rounded-2xl">수강 중인 강의가 없습니다.</p>
              ) : (
                courses.map((course) => (
                  <div 
                    key={course.courseId} 
                    className="group bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-500/40 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                    onClick={() => navigate(`/course/${course.courseId}`)}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 text-blue-600 transition-transform group-hover:scale-105">
                        <BookOpen size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-0.5">{course.courseCode}</p>
                        <h4 className="text-base font-black text-slate-900 mb-2 truncate group-hover:text-blue-600 transition-colors">{course.courseName}</h4>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                          <span className="px-2 py-0.5 bg-slate-50 rounded-md">👤 {course.professorName} 교수</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Community Posts */}
          <div className="flex-1 space-y-4">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
              <MessageSquare size={16} className="text-purple-600" />
              최신 커뮤니티 게시글
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-50">
                {recentPosts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold italic">새로운 게시글이 없습니다.</div>
                ) : (
                  recentPosts.map((post) => (
                    <div 
                      key={post.postId} 
                      className="p-4 hover:bg-slate-50 transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-purple-500"
                      onClick={() => navigate(`/course/${post.courseId}?postId=${post.postId}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black px-2 py-1 bg-blue-600 text-white rounded-lg uppercase tracking-tight shadow-sm shadow-blue-200">
                            {post.courseName}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {post.authorName}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-300">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight uppercase tracking-tight">
                        {post.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1 font-medium italic opacity-80">{post.content}</p>
                    </div>
                  ))
                )}
              </div>
              {recentPosts.length > 0 && (
                <div className="p-3 bg-slate-50/50 text-center border-t border-slate-50">
                  <button className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">View All Activities</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
