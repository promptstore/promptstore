function StructuredDocumentLoader({ __name, constants, logger }) {

  async function load({
    nodeType,
    upload,
  }) {
    const chunks = upload.data.data.structured_content;
    const docs = chunks.map((chunk) => {
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
    return docs;
  }

  return {
    __name,
    load,
  };
}

module.exports = StructuredDocumentLoader;
