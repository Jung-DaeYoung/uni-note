import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

export default Extension.create({
  name: 'slashCommand',

  // CustomHeading/CustomParagraph 등 다른 extension의 Enter 커스텀 keymap이 기본
  // priority(100)로 이 Suggestion보다 먼저 keymap 플러그인을 등록해, 메뉴가 열려
  // 있어도 Enter가 항상 그쪽에서 먼저 소비되어 메뉴 선택이 전혀 실행되지 않았다.
  // priority를 높여 Suggestion의 Enter 처리가 다른 extension보다 먼저 시도되도록 한다.
  priority: 1000,

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          // props는 SuggestionList에서 넘겨준 item 객체임
          props.command({
            editor, // suggestion에서 제공하는 editor 인스턴스 사용
            range
          });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
