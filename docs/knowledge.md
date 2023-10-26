

Types

Extractor
Extract chunks from data. An extractor may load the source document given a
filepath. The document is generally loaded first into Prompt Store's object 
store. Extractors produce documents with a published schema. Extractors extract
chunks from documents.

Examples: Unstructured, Onesource, CSVParser

Chunk
A chunk is a segment of text and associated metadata. Data includes fields
that are indexed to support hybrid or faceted search. All chunks have a
`nodeType`, which defaults to 'Chunk'. Use "chunk" instead of "document",
which we'll use to refer to the source document. A document therefore has one
or more chunks. Chunks are immutable.

Fields:
chunkId
nodeLabel - the node type that will be used in a graph representation, e.g., "Chunk". Also equates to Entity in a Feature Store.
documentId
type
text
imageURI
data - all other data entries
metadata:
    author
    mimetype
    page
    wordCount
    length
    size
createdDateTime
createdBy
startDateTime
endDateTime
version

Loader
Loads the document or data from a source system. Loaders load documents.

Examples: MinIODocumentoader

All schemas use JSONSchema format