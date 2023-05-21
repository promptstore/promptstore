import React from 'react';
import { Descriptions, Modal } from 'antd';
// import { TokenAnnotator } from 'react-text-annotate';

export function PIIWarningModal({ piiContent }) {

  // let tokens = [], tokenValues = [];
  // if (piiContent) {
  //   const { tags, text } = piiContent;
  //   tokens = text.split(/\s+/);
  //   let offset = 0;
  //   const charIndex = [];
  //   for (const token of tokens) {
  //     const start = offset + text.slice(offset).indexOf(token);
  //     const end = start + token.length;
  //     charIndex.push({ token, start, end });
  //     offset = end;
  //   }
  //   for (const tag of tags) {
  //     const inrange = (t) => t.end > tag.start && t.start < tag.end;
  //     const start = charIndex.findIndex(inrange);
  //     const end = charIndex.findLastIndex(inrange);
  //     tokenValues.push({
  //       tag: tag.entity_group,
  //       start,
  //       end,
  //     });
  //   }
  // }

  return Modal.warning({
    title: 'Detected PII',
    content: (
      // <TokenAnnotator
      //   tokens={tokens}
      //   value={tokenValues}
      //   style={{ lineHeight: 1.5 }}
      // />
      <Descriptions
        layout="vertical"
        column={1}
        colon={false}
        labelStyle={{ color: '#888' }}
        contentStyle={{ paddingBottom: 16 }}
        style={{ color: 'rgb(204, 204, 204)', padding: '10px 15px' }}
      >
        <Descriptions.Item label="Original">
          {piiContent.original}
        </Descriptions.Item>
        <Descriptions.Item label="Scrubbed">
          {piiContent.text}
        </Descriptions.Item>
      </Descriptions>
    )
  });
}