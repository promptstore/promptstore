import { useContext, useEffect } from 'react';
import { Typography } from 'antd';

import NavbarContext from '../../context/NavbarContext';

import PromptStore from '../../images/Prompt Store.png';

const { Paragraph, Title } = Typography;

export function About() {

  const { setNavbarState } = useContext(NavbarContext);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'About',
    }));
  }, []);

  return (
    <div id="about">
      <Paragraph>
        A Prompt Store is a shared facility to create, share, and use prompts within Generative
        AI applications. It's like a Content Management System for Prompts, but is more. Prompts
        can be used within Semantic Functions for perform various tasks on both structured and
        unstructured information.
      </Paragraph>
      <Paragraph>
        Prompts embedded in Generative AI applications become unmanageable.
        <ol>
          <li>
            Prompt engineering is not an exact science. The techniques are evolving, and the
            optimum prompt will vary by model. What is needed is the ability to review and edit
            prompts without requiring an application redeployment.
          </li>
          <li>
            The ability to share prompts, and learn from what has worked, leads to better results.
          </li>
          <li>
            Prompt design is critical to the performance, reliability, and security of Generative
            AI applications. A Prompt Store allows prompts to be reviewed and rapidly updated to
            resolve any issues or mitigate new risks.
          </li>
        </ol>
      </Paragraph>
      <Paragraph>
        <img src={PromptStore} alt="Prompt Store" />
      </Paragraph>
      <Paragraph>
        In addition to management of prompts, a Prompt Store enables the following:
      </Paragraph>
      <Title level={4}>Type definitions for increased reliability</Title>
      <Paragraph>
        Prompt arguments are defined using JSON Schema to validate runtime requests, which increases
        application reliability.
      </Paragraph>
      <Title level={4}>Semantic Functions</Title>
      <Paragraph>
        A Semantic Function uses prompts to instruct a GPT model to perform a task such as summarization,
        sentiment classification, or question answering.
      </Paragraph>
      <Paragraph>
        Functions defined in the Prompt Store leverages the same management support for prompts. In
        addition, execution can be scaled without having to build the scaling infrastructure in every
        application.
      </Paragraph>
      <Title level={4}>Support for multiple development languages</Title>
      <Paragraph>
        A Client SDK exists for multiple languages including Node and Python. A REST API supports
        languages that don't currently have an SDK.
      </Paragraph>
      <Title level={4}>Future Proof</Title>
      <Paragraph>
        The Prompt Store uses OpenAI but is not tied to it. The Prompt Store can use open source GPT
        and task specific models from Hugging Face, Google, or custom developed solutions.
      </Paragraph>
    </div>
  );
}