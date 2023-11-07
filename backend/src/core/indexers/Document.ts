export interface DocumentParams {
  filepath: string;
  filename: string;
  endpoint: string;
  objectName: string;
  database: string;
  mimetype: string;
  etag: string;
  size: number;
  content: any;
  imageURI: string;
}

export class Document {

  filepath: string;
  filename: string;
  endpoint: string;
  objectName: string;
  database: string;
  mimetype: string;
  etag: string;
  size: number;
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
