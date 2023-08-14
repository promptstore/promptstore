import { parse } from 'csv-parse/sync';

function CsvLoader({ __name, constants, logger }) {

  async function load({
    delimiter,
    nodeType,
    quote,
    text,
  }) {
    const options = {
      bom: true,
      columns: true,
      delimiter,
      quote,
      skip_records_with_error: true,
      trim: true,
    };
    const records = parse(text, options);
    const docs = records.map((rec) => ({ ...rec, nodeType }));
    return docs;
  }

  return {
    __name,
    load,
  };
}

export default CsvLoader;
