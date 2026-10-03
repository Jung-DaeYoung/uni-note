import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizConfigModal from './QuizConfigModal';
import { NoteTreeProvider } from '../../../context/NoteTreeContext';
import client from '../../../api/client';

vi.mock('../../../api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const noteTree = [
  {
    noteId: 1,
    title: '부모 노트',
    children: [
      { noteId: 2, title: '자식 노트', children: [] },
    ],
  },
];

const renderModal = ({ currentNoteId = 1, onClose = vi.fn(), onGenerated = vi.fn() } = {}) => {
  render(
    <NoteTreeProvider noteTree={noteTree}>
      <QuizConfigModal isOpen currentNoteId={currentNoteId} onClose={onClose} onGenerated={onGenerated} />
    </NoteTreeProvider>
  );
  return { onClose, onGenerated };
};

describe('QuizConfigModal', () => {
  beforeEach(() => {
    client.post.mockReset();
    client.get.mockReset();
  });

  it('노트 트리를 렌더링하고 currentNoteId를 기본 선택한다', () => {
    renderModal({ currentNoteId: 1 });

    expect(within(screen.getByRole('list', { name: '선택 요약' })).getByText('부모 노트')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /부모 노트/ })).toBeChecked();
  });

  it('노트 선택 시 하위 노트도 함께 선택된다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 999 });

    // 이 시점엔 자식 노트가 아직 DOM에 없으므로(펼치기 전) 펼치기 버튼이 유일하게 매칭된다.
    await user.click(screen.getByRole('button', { name: '하위 노트 펼치기' }));

    const parentCheckbox = screen.getByRole('checkbox', { name: /부모 노트/ });
    expect(parentCheckbox).not.toBeChecked();

    await user.click(parentCheckbox);

    expect(parentCheckbox).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /자식 노트/ })).toBeChecked();
  });

  it('선택된 노트가 없으면 생성 버튼이 비활성화되고 이유가 표시된다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('checkbox', { name: /부모 노트/ }));

    expect(screen.getByText('노트를 하나 이상 선택하세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '문제 생성 시작' })).toBeDisabled();
  });

  it('모든 문제 유형을 비활성화하면 생성 버튼이 비활성화되고 이유가 표시된다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('checkbox', { name: /객관식/ }));
    await user.click(screen.getByRole('checkbox', { name: /OX 퀴즈/ }));
    await user.click(screen.getByRole('checkbox', { name: /주관식/ }));

    expect(screen.getByText('문제 유형을 하나 이상 선택하세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '문제 생성 시작' })).toBeDisabled();
  });

  it('문항 수 입력을 비우고 포커스를 옮기면 1로 복구된다', () => {
    renderModal({ currentNoteId: 1 });

    const input = screen.getByRole('spinbutton', { name: '객관식 문항 수' });

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input).toHaveValue(1);
  });

  it('+/- 스테퍼와 직접 입력이 1~20 범위를 벗어나지 않는다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 1 });

    const minusBtn = screen.getByRole('button', { name: '객관식 문항 수 줄이기' });
    const plusBtn = screen.getByRole('button', { name: '객관식 문항 수 늘리기' });
    const input = screen.getByRole('spinbutton', { name: '객관식 문항 수' });

    await user.click(minusBtn); // 초기값 2 -> 1
    expect(input).toHaveValue(1);
    expect(minusBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: '20' } });
    expect(input).toHaveValue(20);
    expect(plusBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: '25' } });
    expect(input).toHaveValue(20);
  });

  it('난이도를 변경하면 선택 상태가 전환된다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 1 });

    const hard = screen.getByRole('radio', { name: /상 · 심화/ });
    const normal = screen.getByRole('radio', { name: /중 · 보통/ });

    expect(normal).toHaveAttribute('aria-checked', 'true');
    expect(hard).toHaveAttribute('aria-checked', 'false');

    await user.click(hard);

    expect(hard).toHaveAttribute('aria-checked', 'true');
    expect(normal).toHaveAttribute('aria-checked', 'false');
  });

  it('생성 성공 시 payload를 전송하고 onGenerated 이후 onClose를 호출한다', async () => {
    const user = userEvent.setup();
    client.post.mockResolvedValueOnce({ data: { quizSetId: 99 } });
    const { onClose, onGenerated } = renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(client.post).toHaveBeenCalledWith('/quiz/generate', {
      noteIds: [1],
      typeCounts: { MULTIPLE_CHOICE: 2, OX: 2, SHORT_ANSWER: 1 },
      difficulty: 'NORMAL',
    });
    expect(onGenerated).toHaveBeenCalledWith({ quizSetId: 99 });
    expect(onGenerated.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it('생성 실패 시 서버가 보낸 메시지를 표시하고 모달을 닫지 않는다', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    client.post.mockRejectedValueOnce({
      response: { status: 503, data: { errorCode: 'QUIZ_VALIDATION_FAILED', message: '요청한 조건에 맞는 문제를 생성하지 못했습니다.' } },
    });
    const { onClose, onGenerated } = renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('요청한 조건에 맞는 문제를 생성하지 못했습니다.'));
    expect(onGenerated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('서버 메시지가 없으면 기본 실패 문구를 표시한다', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    client.post.mockRejectedValueOnce(new Error('Network Error'));
    renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('문제 생성 중 오류가 발생했습니다.'));
    alertSpy.mockRestore();
  });

  it('생성 중에는 닫기·취소 버튼이 비활성화되고 로딩 표시가 나타난다', async () => {
    const user = userEvent.setup();
    let resolvePost;
    client.post.mockReturnValueOnce(new Promise((resolve) => { resolvePost = resolve; }));

    renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

    expect(screen.getByText('문제 생성 중...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '문제 생성 설정 닫기' })).toBeDisabled();

    resolvePost({ data: {} });
    await waitFor(() => expect(screen.queryByText('문제 생성 중...')).not.toBeInTheDocument());
  });

  describe('노트별 블록 선택', () => {
    // 노트 1(부모): 제목(t) 다음에 h2 "개요"(p1, h3 "세부"와 p2), h2 "결론"(p3), id 없는 pdfBlock
    const parentNote = {
      noteId: 1,
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { id: 't', level: 1 }, content: [{ type: 'text', text: '노트 제목' }] },
          { type: 'heading', attrs: { id: 'h-intro', level: 2 }, content: [{ type: 'text', text: '개요' }] },
          { type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: '개요 본문' }] },
          { type: 'heading', attrs: { id: 'h-detail', level: 3 }, content: [{ type: 'text', text: '세부' }] },
          { type: 'paragraph', attrs: { id: 'p2' }, content: [{ type: 'text', text: '세부 본문' }] },
          { type: 'heading', attrs: { id: 'h-end', level: 2 }, content: [{ type: 'text', text: '결론' }] },
          { type: 'paragraph', attrs: { id: 'p3' }, content: [{ type: 'text', text: '결론 본문' }] },
          { type: 'pdfBlock', attrs: { src: 'x.pdf' } },
        ],
      }),
    };
    // 노트 2(자식): 노트 1과 같은 blockId(p1)를 가진 블록이 있다.
    const childNote = {
      noteId: 2,
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { id: 't2', level: 1 }, content: [{ type: 'text', text: '자식 제목' }] },
          { type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: '자식 첫 문단' }] },
          { type: 'paragraph', attrs: { id: 'c2' }, content: [{ type: 'text', text: '자식 둘째 문단' }] },
        ],
      }),
    };

    const openBlocks = async (user, title, note) => {
      client.get.mockResolvedValueOnce({ data: note });
      await user.click(screen.getByRole('button', { name: `${title} 블록 선택 열기` }));
      return screen.findByRole('group', { name: `${title}의 블록` });
    };

    const renderWithSaveStatus = (saveStatus) => render(
      <NoteTreeProvider noteTree={noteTree}>
        <QuizConfigModal isOpen currentNoteId={1} onClose={vi.fn()} onGenerated={vi.fn()} saveStatus={saveStatus} />
      </NoteTreeProvider>
    );

    it('노트의 "블록"을 누르면 그 노트의 저장본을 읽어 노트 아래에 제목을 제외한 블록을 보여준다', async () => {
      const user = userEvent.setup();
      renderModal({ currentNoteId: 1 });

      const panel = await openBlocks(user, '부모 노트', parentNote);

      expect(client.get).toHaveBeenCalledWith('/notes/1');
      const panelQueries = within(panel);
      await panelQueries.findByRole('checkbox', { name: /개요 본문/ });
      expect(panelQueries.queryByRole('checkbox', { name: /노트 제목/ })).not.toBeInTheDocument();
      expect(panelQueries.getAllByRole('checkbox')).toHaveLength(6);
      expect(panelQueries.getByText('PDF 등 일부 블록은 노트 전체를 선택할 때만 포함됩니다')).toBeInTheDocument();
      // 현재 노트이므로 자동 저장 안내가 보인다.
      expect(panelQueries.getByText('최근 입력은 자동 저장(약 2초) 후 목록에 반영됩니다')).toBeInTheDocument();
      expect(screen.getByText('현재 노트')).toBeInTheDocument();
    });

    it('블록을 고르면 노트가 부분 선택되고, 모두 해제하면 노트도 해제된다', async () => {
      const user = userEvent.setup();
      renderModal({ currentNoteId: 1 });
      // 기본 선택된 현재 노트를 먼저 해제해 블록 선택만 남긴다.
      await user.click(screen.getByRole('checkbox', { name: /^부모 노트$/ }));
      const panel = within(await openBlocks(user, '부모 노트', parentNote));
      const noteCheckbox = screen.getByRole('checkbox', { name: /^부모 노트$/ });

      await user.click(await panel.findByRole('checkbox', { name: /결론 본문/ }));

      expect(noteCheckbox).toBePartiallyChecked();
      expect(screen.getByText('블록 1개')).toBeInTheDocument();

      await user.click(panel.getByRole('checkbox', { name: /결론 본문/ }));

      expect(noteCheckbox).not.toBePartiallyChecked();
      expect(noteCheckbox).not.toBeChecked();
      expect(screen.getByText('노트를 하나 이상 선택하세요')).toBeInTheDocument();
    });

    it('heading을 선택하면 다음 같은 레벨 이하 heading 전까지 함께 선택·해제된다', async () => {
      const user = userEvent.setup();
      renderModal({ currentNoteId: 999 });
      const panel = within(await openBlocks(user, '부모 노트', parentNote));

      const intro = await panel.findByRole('checkbox', { name: /제목 2\s*개요$/ });
      await user.click(intro);

      expect(panel.getByRole('checkbox', { name: /개요 본문/ })).toBeChecked();
      expect(panel.getByRole('checkbox', { name: /제목 3\s*세부$/ })).toBeChecked();
      expect(panel.getByRole('checkbox', { name: /세부 본문/ })).toBeChecked();
      expect(panel.getByRole('checkbox', { name: /결론$/ })).not.toBeChecked();
      expect(panel.getByRole('checkbox', { name: /결론 본문/ })).not.toBeChecked();

      await user.click(intro);

      expect(panel.getByRole('checkbox', { name: /세부 본문/ })).not.toBeChecked();
    });

    it('노트 전체 선택 상태에서 블록 하나를 해제하면 나머지 블록만 선택된다', async () => {
      const user = userEvent.setup();
      renderModal({ currentNoteId: 1 });
      const panel = within(await openBlocks(user, '부모 노트', parentNote));

      // 전체 선택된 노트의 블록은 모두 체크되어 보인다.
      expect(await panel.findByRole('checkbox', { name: /결론 본문/ })).toBeChecked();
      await user.click(panel.getByRole('checkbox', { name: /결론 본문/ }));

      expect(screen.getByRole('checkbox', { name: /^부모 노트$/ })).toBePartiallyChecked();
      expect(screen.getByText('블록 5개')).toBeInTheDocument();
    });

    it('취약 블록 선택은 트리에 있는 노트의 HIGH 블록만, 저장본에 남은 블록만 범위로 바꾼다', async () => {
      const user = userEvent.setup();
      client.get.mockImplementation((url) => {
        if (url === '/quiz/incorrect/statistics/blocks') {
          return Promise.resolve({ data: [
            { noteId: 1, blockId: 'p3', reviewPriority: 'HIGH' },
            { noteId: 1, blockId: 'gone', reviewPriority: 'HIGH' }, // 저장본에서 사라진 블록
            { noteId: 2, blockId: 'c2', reviewPriority: 'HIGH' },
            { noteId: 2, blockId: 'p1', reviewPriority: 'LOW' },
            { noteId: 99, blockId: 'x', reviewPriority: 'HIGH' }, // 트리에 없는 노트(다른 강의 등)
          ] });
        }
        if (url === '/notes/1') return Promise.resolve({ data: parentNote });
        if (url === '/notes/2') return Promise.resolve({ data: childNote });
        return Promise.reject(new Error(`unexpected ${url}`));
      });
      client.post.mockResolvedValueOnce({ data: { quizSetId: 7 } });
      const { onClose } = renderModal({ currentNoteId: 1 });

      await user.click(screen.getByRole('button', { name: '취약 블록 선택' }));
      const generate = screen.getByRole('button', { name: '문제 생성 시작' });
      await waitFor(() => expect(generate).toBeEnabled());
      await user.click(generate);

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(client.post.mock.calls[0][1]).toMatchObject({
        noteIds: [1, 2],
        blockSelections: [
          { noteId: 1, blockIds: ['p3'] },
          { noteId: 2, blockIds: ['c2'] },
        ],
      });
    });

    it('취약 블록이 없으면 안내하고 기존 선택을 유지한다', async () => {
      const user = userEvent.setup();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      client.get.mockResolvedValueOnce({ data: [{ noteId: 1, blockId: 'p1', reviewPriority: 'LOW' }] });
      renderModal({ currentNoteId: 1 });

      await user.click(screen.getByRole('button', { name: '취약 블록 선택' }));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('이 강의의 노트에서 자주 틀린 블록이 없습니다.'));
      expect(screen.getByRole('checkbox', { name: /^부모 노트$/ })).toBeChecked();
      alertSpy.mockRestore();
    });

    it('두 노트에서 고른 블록이 요약 칩과 payload에서 노트별로 나뉜다', async () => {
      const user = userEvent.setup();
      client.post.mockResolvedValueOnce({ data: { quizSetId: 7 } });
      const { onClose } = renderModal({ currentNoteId: 1 });
      await user.click(screen.getByRole('checkbox', { name: /^부모 노트$/ }));

      const parentPanel = within(await openBlocks(user, '부모 노트', parentNote));
      await user.click(await parentPanel.findByRole('checkbox', { name: /결론 본문/ }));
      await user.click(parentPanel.getByRole('checkbox', { name: /개요 본문/ }));
      const childPanel = within(await openBlocks(user, '자식 노트', childNote));
      await user.click(await childPanel.findByRole('checkbox', { name: /자식 둘째 문단/ }));

      const summary = within(screen.getByRole('list', { name: '선택 요약' }));
      expect(summary.getByText('부모 노트')).toBeInTheDocument();
      expect(summary.getByText('· 블록 2개')).toBeInTheDocument();
      expect(summary.getByText('자식 노트')).toBeInTheDocument();
      expect(summary.getByText('· 블록 1개')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(client.post).toHaveBeenCalledWith('/quiz/generate', {
        noteIds: [1, 2],
        blockSelections: [
          { noteId: 1, blockIds: ['p1', 'p3'] },
          { noteId: 2, blockIds: ['c2'] },
        ],
        typeCounts: { MULTIPLE_CHOICE: 2, OX: 2, SHORT_ANSWER: 1 },
        difficulty: 'NORMAL',
      });
    });

    it('노트 전체 선택과 다른 노트의 블록 선택을 섞을 수 있고, 노트 체크박스를 누르면 전체로 바뀐다', async () => {
      const user = userEvent.setup();
      client.post.mockResolvedValue({ data: {} });
      const { onClose } = renderModal({ currentNoteId: 1 });
      const childPanel = within(await openBlocks(user, '자식 노트', childNote));
      await user.click(await childPanel.findByRole('checkbox', { name: /자식 첫 문단/ }));

      await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(client.post.mock.calls[0][1]).toMatchObject({
        noteIds: [1, 2],
        blockSelections: [{ noteId: 2, blockIds: ['p1'] }],
      });

      // 부분 선택된 자식 노트의 체크박스를 누르면 전체 선택으로 바뀌고 blockSelections가 사라진다.
      await user.click(screen.getByRole('checkbox', { name: /^자식 노트$/ }));
      expect(screen.getByRole('checkbox', { name: /^자식 노트$/ })).toBeChecked();
      await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));
      await waitFor(() => expect(client.post).toHaveBeenCalledTimes(2));
      expect(client.post.mock.calls[1][1]).not.toHaveProperty('blockSelections');
    });

    it('요약 칩의 ✕는 그 노트 선택만 해제한다', async () => {
      const user = userEvent.setup();
      renderModal({ currentNoteId: 1 });

      await user.click(screen.getByRole('button', { name: '부모 노트 선택 해제' }));

      expect(screen.getByRole('checkbox', { name: /^부모 노트$/ })).not.toBeChecked();
      expect(screen.getByText('선택된 노트가 없습니다.')).toBeInTheDocument();
    });

    it('현재 노트의 블록을 고른 상태에서만 자동 저장 중이면 생성을 막는다', async () => {
      const user = userEvent.setup();
      renderWithSaveStatus('saving');

      // 노트 전체 선택만 있을 때는 막지 않는다.
      expect(screen.getByRole('button', { name: '문제 생성 시작' })).toBeEnabled();

      const panel = within(await openBlocks(user, '부모 노트', parentNote));
      await user.click(await panel.findByRole('checkbox', { name: /결론 본문/ }));

      expect(screen.getByText('노트 자동 저장이 끝난 뒤 생성할 수 있습니다')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '문제 생성 시작' })).toBeDisabled();
    });

    it('내용 없는 블록은 목록에 나오지 않고, 이미지 블록은 "(이미지)"로 표시된다', async () => {
      const user = userEvent.setup();
      client.post.mockResolvedValueOnce({ data: {} });
      const { onClose } = renderModal({ currentNoteId: 1 });
      await user.click(screen.getByRole('checkbox', { name: /^부모 노트$/ }));
      const noteWithEmptyBlocks = {
        noteId: 1,
        content: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { id: 't', level: 1 }, content: [{ type: 'text', text: '노트 제목' }] },
            { type: 'heading', attrs: { id: 'h', level: 2 }, content: [{ type: 'text', text: '본론' }] },
            { type: 'paragraph', attrs: { id: 'empty1' } },
            { type: 'paragraph', attrs: { id: 'p' }, content: [{ type: 'text', text: '본론 문단' }] },
            { type: 'paragraph', attrs: { id: 'blank' }, content: [{ type: 'text', text: '   ' }] },
            { type: 'image', attrs: { id: 'img', src: 'a.png' } },
            { type: 'heading', attrs: { id: 'empty-h', level: 2 } },
          ],
        }),
      };

      const panel = within(await openBlocks(user, '부모 노트', noteWithEmptyBlocks));
      await panel.findByRole('checkbox', { name: /본론 문단/ });

      // 제목 2 "본론", 문단, 이미지 3개만 선택할 수 있다(빈 문단·공백 문단·빈 heading 제외).
      expect(panel.getAllByRole('checkbox')).toHaveLength(3);
      expect(panel.queryByText('(내용 없음)')).not.toBeInTheDocument();
      expect(panel.getByRole('checkbox', { name: /이미지\s*\(이미지\)/ })).toBeInTheDocument();

      // heading 범위 선택과 payload에 빈 블록 id가 들어가지 않는다.
      await user.click(panel.getByRole('checkbox', { name: /제목 2\s*본론$/ }));
      expect(screen.getByText('블록 3개')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(client.post.mock.calls[0][1].blockSelections).toEqual([
        { noteId: 1, blockIds: ['h', 'p', 'img'] },
      ]);
    });

    it('블록 목록을 불러오지 못하면 그 노트 아래에 사유를 표시한다', async () => {
      const user = userEvent.setup();
      client.get.mockRejectedValueOnce(new Error('Network Error'));
      renderModal({ currentNoteId: 1 });

      await user.click(screen.getByRole('button', { name: '부모 노트 블록 선택 열기' }));

      const panel = await screen.findByRole('group', { name: '부모 노트의 블록' });
      expect(await within(panel).findByText('블록 목록을 불러오지 못했습니다.')).toBeInTheDocument();
    });
  });
});
