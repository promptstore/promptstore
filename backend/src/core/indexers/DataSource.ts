import type { Schema } from 'jsonschema';

enum DataSourceType {
  api = 'api',
  document = 'document',
  featurestore = 'featurestore',
  folder = 'folder',
  graphstore = 'graphstore',
  sql = 'sql',
  crawler = 'crawler',
  wikipedia = 'wikipedia',
}

enum DocumentType {
  csv = 'csv',
  epub = 'epub',
  eml = 'eml',
  xlsx = 'xlsx',
  html = 'html',
  json = 'json',
  md = 'md',
  doc = 'doc',
  docx = 'docx',
  odt = 'odt',
  msg = 'msg',
  pdf = 'pdf',
  ppt = 'ppt',
  pptx = 'pptx',
  rst = 'rst',
  rtf = 'rtf',
  tsv = 'tsv',
  txt = 'txt',
  xml = 'xml',
}

enum SplitterType {
  delimiter = 'delimiter',
  token = 'token',
  chunker = 'chunker',
}

enum SQLType {
  sample = 'sample',
  schema = 'schema',
}

export interface DataSource {
  id: number;
  name: string;
  description: string;
  type: DataSourceType;
  workspaceId: number;
}

interface WikipediaSource extends DataSource {
  query: string;
}

interface FolderSource extends DataSource {
  bucket: string;
  prefix: string;
  recursive: boolean;
}

interface DocumentSource extends DataSource {
  documentType: DocumentType;
  documents: number[];
  extractMetadata: boolean;
  schema: Schema;
}

interface CSVSource extends DocumentSource {
  delimiter: string;
  quoteChar: string;
}

// https://blog.bitsrc.io/multiple-inheritance-or-typescript-mixins-10076c4f136a

type Constructor<T = any> = new (...args: any[]) => T;

interface DelimiterSplitter {
  characters: string;
}

interface ChunkerSplitter {
  functionId: number;
}

interface TokenSplitter {
  chunkSize: number;
  chunkOverlap: number;
}

function mixinDelimiterSplitter<T extends Constructor>(base: T): Constructor<DelimiterSplitter> & T {
  return class extends base {
    constructor(...args: any[]) {
      super(...args);
    }
  }
}

function mixinChunkerSplitter<T extends Constructor>(base: T): Constructor<ChunkerSplitter> & T {
  return class extends base {
    constructor(...args: any[]) {
      super(...args);
    }
  }
}

function mixinTokenSplitter<T extends Constructor>(base: T): Constructor<TokenSplitter> & T {
  return class extends base {
    constructor(...args: any[]) {
      super(...args);
    }
  }
}

interface TextSource extends DocumentSource {
  splitter: SplitterType;
  rephraseFunctionIds?: number[];
}

const DelimitedTextSource = mixinDelimiterSplitter(class { });

const ChunkedTextSource = mixinChunkerSplitter(class { });

const TokenSplitTextSource = mixinTokenSplitter(class { });

interface FeatureStoreSource extends DataSource {
  featurestore: string;
  httpMethod: string;
  url: string;
  parameterSchema: Schema;
  appId: string;
  appSecret: string;
}

interface FeastSource extends FeatureStoreSource {
  featureService: string;
  featureList: string;
  entity: string;
}

interface AnamlSource extends FeatureStoreSource {
  featureStoreName: string;
}

interface GraphStoreSource extends DataSource {
  graphstore: string;
}

interface Neo4jGraphStoreSource extends GraphStoreSource {
  nodeLabel: string;
  indexId: string | number;
  embeddingNodeProperty: string;
  textNodeProperties: string[];
  limit: number;
}

interface CrawledSource extends DataSource {
  baseUrl: string;
  maxRequestsPerCrawl: number;
  chunkElement: string;
  scrapingSpec: Schema;
}

interface SQLSource extends DataSource {
  dialect: string;
  sqlType: SQLType;
}

interface SampleFields {
  tableName: string;
  sampleRows: number;
}


function mixinSampledSource<T extends Constructor>(base: T): Constructor<SampleFields> & T {
  return class extends base {
    constructor(...args: any[]) {
      super(...args);
    }
  }
}

const SampledSource = mixinSampledSource(class { });

// Also BigQuery
interface PostgreSQLSource extends SQLSource {
  connectionString: string;
  dataset: string;
  tables: string;
}

interface Credentials {
  username: string;
  password: string;
}

interface ClickhouseSQLSource extends SQLSource {
  databaseHost: string;
  databaseName: string;
  credentials: Credentials;
}

interface APISource extends DataSource {
  endpoint: string;
  schema: Schema;
}