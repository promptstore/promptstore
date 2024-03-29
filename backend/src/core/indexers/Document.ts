export interface DocumentParams {
  dataSourceId: number;
  dataSourceName: string;
  uploadId: number;
  filepath: string;
  filename: string;
  endpoint: string;
  objectName: string;
  database: string;
  mimetype: string;
  originalname: string;
  etag: string;
  size: number;
  content: any;
  imageURI: string;
}

export class Document {

  dataSourceId: number;
  dataSourceName: string;
  uploadId: number;
  filepath: string;
  filename: string;
  endpoint: string;
  objectName: string;
  database: string;
  query: string;
  mimetype: string;
  originalname: string;
  etag: string;
  size: number;
  title: string;
  content: any;
  imageURI: string;

  constructor(params: Partial<DocumentParams>) {
    for (const [k, v] of Object.entries(params)) {
      this[k] = v;
    }
  }

  static create(params: Partial<DocumentParams>) {
    return new Document(params);
  }

  // toJSON() {
  //   return Object.entries(this).reduce((a, [k, v]) => {
  //     if (this.hasOwnProperty(k)) {
  //       a[k] = v;
  //     }
  //     return a;
  //   }, {});
  // }

}
