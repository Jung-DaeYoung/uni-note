import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

export default Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          console.log('slash command 실행됨', props);
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
