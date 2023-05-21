import { useRef } from 'react';

export function PlaygroundTour() {

  const ref1 = useRef(null);
  const ref2 = useRef(null);
  const ref3 = useRef(null);
  const ref4 = useRef(null);
  const ref5 = useRef(null);
  const ref6 = useRef(null);
  const ref7 = useRef(null);
  const ref8 = useRef(null);
  const ref9 = useRef(null);

  const steps = [
    {
      title: 'App Features',
      description: 'Display information from the app brief. This information is used in prompts.',
      target: () => ref1.current,
      placement: 'right',
    },
    {
      title: 'Search',
      description: 'Search for previously generated copy. This enables collaboration. Use the Plus button to add selected content from search results.',
      target: () => ref2.current,
    },
    {
      title: 'Multiple Apps',
      description: 'Generate copy and images.',
      target: () => ref3.current,
      placement: 'top',
    },
    {
      title: 'Generate Variations',
      description: 'Generate variations using features such as need-state, format and style.',
      target: () => ref4.current,
      placement: 'left',
    },
    {
      title: 'Parameters',
      description: 'Parameters such as max-words, temperature, and top-p may be defined to tune generation. Temperature controls how random the ChatGPT response is. Top-p controls the diversity of responses.',
      target: () => ref5.current,
      placement: 'left',
    },
    // {
    //   title: 'Tone of Voice',
    //   description: 'This parameter uses a corpus to train ChatGPT to imitate a given style and tone of voice. A corpus is a file containing text that can be uploaded from the Prompts menu item.',
    //   target: () => ref6.current,
    //   placement: 'left',
    // },
    {
      title: 'Generate Content',
      description: 'Clicking Autogen will construct the appropriate prompts and return with the generated content. If any personally identifiable information is detected, the request will not be sent and a warning will be shown.',
      target: () => ref7.current,
      placement: 'topRight',
    },
    {
      title: 'Instruct to customise',
      description: 'Instruct allows you to supply your own customised prompt to generate output. A prompt tells ChatGPT what role it should play and instructions for generating an appropriate response. Good prompt design is more art than science. Anything entered here will be scanned for possible PII before sending to ChatGPT.',
      target: () => ref8.current,
      placement: 'left',
    },
    {
      title: 'Saved Content',
      description: 'Generated content may be saved.',
      target: () => ref9.current,
      placement: 'bottom',
    },
    {
      title: 'Content Actions',
      description: (
        <>
          <div>Further actions may be taken on a content item.</div>
          <ul style={{ marginLeft: 15 }}>
            <li><strong>Image</strong> generates an image using the content as a description.</li>
            <li><strong>Length</strong> requests a shorter or longer variation.</li>
            <li><strong>Edit</strong> allows the user to modify the content.</li>
            <li><strong>Versions</strong> are automatically recorded when content is edited allowing the user to return to an earlier version.</li>
            <li><strong>Refine</strong> is work-in-progress allowing a user to engage in a chat session to ask ChatGPT to modify the content.</li>
            <li>Finally, an item can be submitted to another member of the workspace to review.</li>
          </ul>
        </>
      ),
      placement: 'bottom',
    },
  ];

  return {
    ref1,
    ref2,
    ref3,
    ref4,
    ref5,
    ref6,
    ref7,
    ref8,
    ref9,
    steps,
  };
}