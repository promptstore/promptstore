export interface ChunkParams {
  id: string;
  nodeLabel: string;
  documentId: string;
  type: string;
  name: string;
  text: string;
  data: any;
  metadata: any;
  createdDatetime: Date;
  createdBy: string;
  startDatetime: Date;
  endDatetime: Date;
  version: number;
}

export class Chunk {

  id: string;
  nodeLabel: string;
  documentId: string;
  type: string;
  name: string;
  text: string;
  data: any;
  metadata: any;
  createdDatetime: Date;
  createdBy: string;
  startDatetime: Date;
  endDatetime: Date;
  version: number;

  constructor(params: Partial<ChunkParams>) {
    for (const [k, v] of Object.entries(params)) {
      this[k] = v;
    }
  }

  static create(params: Partial<ChunkParams>) {
    return new Chunk(params);
  }

}
