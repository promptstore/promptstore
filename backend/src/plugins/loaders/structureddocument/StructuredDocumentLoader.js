function StructuredDocumentLoader({ __name, constants, logger }) {

  async function load({
    nodeType,
    upload,
  }) {
    const content = upload.data.data.structured_content;
    const chunks = content.map((chunk) => {
      if (chunk.type === 'list') {
        return {
          type: chunk.type,
          subtype: chunk.subtype,
          text: chunk.heading + '\n' + chunk.items.map((it) => '- ' + it).join('\n'),
          nodeType,
        };
      } else {
        return {
          ...chunk,
          nodeType,
        };
      }
    });
    return {
      metadata: upload.data.metadata,
      documents: upload.data.documents,
      chunks,
    };
  }

  return {
    __name,
    load,
  };
}

export default StructuredDocumentLoader;
