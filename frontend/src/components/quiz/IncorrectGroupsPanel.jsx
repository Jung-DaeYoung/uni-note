import React from 'react';
import { PenLine, Trash2 } from 'lucide-react';

const IncorrectGroupsPanel = ({ incorrectGroups, isLoading, onPracticeIncorrect, onDeleteGroup, onRenameGroup }) => {
  if (isLoading) {
    return (
      <p className="lib-loading">
        <span className="lib-spinner" aria-hidden="true" />
        오답노트를 불러오는 중…
      </p>
    );
  }

  if (incorrectGroups.length === 0) {
    return (
      <p className="lib-empty">
        아직 생성된 오답노트가 없습니다.
        <span className="inc-empty-hint">퀴즈 풀이 결과에서 틀린 문제를 담아보세요!</span>
      </p>
    );
  }

  return (
    <ul className="lib-list inc-groups">
      {incorrectGroups.map(group => (
        <li key={group.id} className="lib-quiz">
          <div className="lib-quiz-body">
            <h2 className="lib-item-title">{group.title}</h2>
            <p className="lib-meta">
              <span>{group.itemCount}개의 문항 저장됨</span>
            </p>
          </div>
          <div className="lib-actions">
            <div className="lib-icons">
              <button
                onClick={(e) => onRenameGroup(e, group)}
                title="이름 변경"
                aria-label={`${group.title} 이름 변경`}
                className="lib-icon"
              >
                <PenLine size={16} />
              </button>
              <button
                onClick={(e) => onDeleteGroup(e, group.id)}
                title="오답노트 삭제"
                aria-label={`${group.title} 삭제`}
                className="lib-icon lib-icon-danger"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <button onClick={() => onPracticeIncorrect(group)} className="lib-btn lib-btn-primary">
              다시 풀기
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default IncorrectGroupsPanel;
