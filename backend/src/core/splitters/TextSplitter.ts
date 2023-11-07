export interface TextSplitterParams {
  chunkSize: number;
  chunkOverlap: number;
  keepSeparator: boolean;
  lengthFunction?:
  | ((text: string) => number)
  | ((text: string) => Promise<number>);
}

export abstract class TextSplitter implements TextSplitterParams {

  chunkSize = 1000;
  chunkOverlap = 200;
  keepSeparator = false;
  lengthFunction:
    | ((text: string) => number)
    | ((text: string) => Promise<number>);

  constructor(params?: Partial<TextSplitterParams>) {
    this.chunkSize = params?.chunkSize ?? this.chunkSize;
    this.chunkOverlap = params?.chunkOverlap ?? this.chunkOverlap;
    this.keepSeparator = params?.keepSeparator ?? this.keepSeparator;
    this.lengthFunction = params?.lengthFunction ?? ((text: string) => text.length);
    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('Cannot have chunkOverlap >= chunkSize');
    }
  }

  abstract splitText(text: string): Promise<string[]>;

  protected splitOnSeparator(text: string, separator: string): string[] {
    let splits: Array<string>;
    if (separator) {
      if (this.keepSeparator) {
        const regexEscapedSeparator = separator.replace(
          /[/\-\\^$*+?.()|[\]{}]/g,
          '\\$&'
        );
        splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`));
      } else {
        splits = text.split(separator);
      }
    } else {
      splits = text.split('');
    }
    return splits.filter((s: string) => s !== '');
  }

}
