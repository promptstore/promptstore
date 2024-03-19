import fs from 'fs';
import path from 'path';
import uuid from 'uuid';
import { Client, iteratePaginatedAPI } from '@notionhq/client';

function NotionLoader({ __name, constants, logger }) {

  let _client;

  function getClient() {
    if (!_client) {
      _client = new Client({
        auth: constants.NOTION_API_TOKEN,
      });
    }
    return _client;
  }

  /**
   * 
   * @param {*} query
   * @returns 
   */
  async function getListing(query) {
    try {
      const client = await getClient();
      const res = await client.search({
        query,
        filter: {
          property: 'object',
          value: 'page',
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time',
        },
      });
      return res.results;
    } catch (err) {
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return [];
    }
  }

  async function load({
    dataSourceId,
    dataSourceName,
    objectNames,
    bucket,
    prefix,
    recursive,
    query,
    maxBytes = 0,
  }) {
    const client = await getClient();
    const proms = [];
    if (!objectNames) {
      let objects = await getListing(query);
      objectNames = objects
        .map(obj => ({
          id: obj.id,
        }));
    }
    bucket = bucket || constants.FILE_BUCKET;
    for (let { id, uploadId } of objectNames) {
      try {
        const prom = new Promise(async (resolve, reject) => {
          const filename = id + '.html';
          const localFilePath = `/var/data/${bucket}/${filename}`;
          const dirname = path.dirname(localFilePath);
          fs.mkdirSync(dirname, { recursive: true });
          const block = await client.blocks.retrieve({ block_id: id });
          const text = await getTextFromBlock(block, true);
          const blocks = await retrieveBlockChildren(id);
          const proms = blocks.map(getTextFromBlock);
          const texts = await Promise.all(proms);
          const content = [text, ...texts].join('\n\n');
          const mimetype = 'text/html';
          fs.writeFileSync(localFilePath, content);
          const size = new Blob([content]).size;
          resolve({
            id: id || uuid.v4(),
            dataSourceId,
            dataSourceName,
            uploadId,
            filename,
            objectName: filename,
            size,
            content,

            // required by the 'unstructured' extractor which reads files 
            // from the local file system
            filepath: localFilePath,
            originalname: filename,
            mimetype,
          });
        })
        proms.push(prom);
      } catch (err) {
        if (err.stack) {
          message += '\n' + err.stack;
        }
        logger.error(message);
        // continue
      }
    }
    return Promise.all(proms);
  }

  // Take rich text array from a block child that supports rich text and return the plain text.
  // Note: All rich text objects include a plain_text field.
  const getPlainTextFromRichText = (richText) => {
    return richText.map(t => t.plain_text).join('');
    // Note: A page mention will return "Undefined" as the page name if the page has not been shared with the integration. See: https://developers.notion.com/reference/block#mention
  };

  // Use the source URL and optional caption from media blocks (file, video, etc.)
  const getMediaSourceText = (block) => {
    let source, caption;

    if (block[block.type].external) {
      source = block[block.type].external.url;
    } else if (block[block.type].file) {
      source = block[block.type].file.url;
    } else if (block[block.type].url) {
      source = block[block.type].url;
    } else {
      source = '[Missing case for media block types]: ' + block.type;
    }
    // If there's a caption, return it with the source
    if (block[block.type].caption.length) {
      caption = getPlainTextFromRichText(block[block.type].caption);
      return caption + ': ' + source;
    }
    // If no caption, just return the source URL
    return source;
  };

  // Get the plain text from any block type supported by the public API.
  const getTextFromBlock = async (block, doNotRecurse) => {
    let text;

    // Get rich text from blocks that support it
    if (block[block.type].rich_text) {
      // This will be an empty string if it's an empty line.
      text = getPlainTextFromRichText(block[block.type].rich_text);
    }
    // Get text for block types that don't have rich text
    else {
      switch (block.type) {
        case 'unsupported':
          // The public API does not support all block types yet
          // text = '[Unsupported block type]';
          text = '';
          break;
        case 'bookmark':
          text = block.bookmark.url;
          break;
        case 'child_database':
          text = block.child_database.title;
          // Use "Query a database" endpoint to get db rows: https://developers.notion.com/reference/post-database-query
          // Use "Retrieve a database" endpoint to get additional properties: https://developers.notion.com/reference/retrieve-a-database
          break;
        case 'child_page':
          text = block.child_page.title;
          break;
        case 'embed':
        case 'video':
        case 'file':
        case 'image':
        case 'pdf':
          text = getMediaSourceText(block);
          break;
        case 'equation':
          text = block.equation.expression;
          break;
        case 'link_preview':
          text = block.link_preview.url;
          break;
        case 'synced_block':
          // Provides ID for block it's synced with.
          text = block.synced_block.synced_from
            ? 'This block is synced with a block with the following ID: ' +
            block.synced_block.synced_from[block.synced_block.synced_from.type]
            : 'Source sync block that another blocked is synced with.';
          break;
        case 'table':
          // Only contains table properties.
          // Fetch children blocks for more details.
          // text = 'Table width: ' + block.table.table_width;
          text = '';
          break
        case 'table_of_contents':
          // Does not include text from ToC; just the color
          // text = 'ToC color: ' + block.table_of_contents.color;
          text = '';
          break
        case 'breadcrumb':
        case 'column_list':
        case 'divider':
          // text = 'No text available';
          text = '';
          break;
        default:
          // text = '[Needs case added]';
          text = '';
          break;
      }
    }
    // Blocks with the has_children property will require fetching the child blocks.
    // e.g. nested bulleted lists
    if (block.has_children && !doNotRecurse) {
      // For now, we'll just flag there are children blocks.
      // text = text + ' (Has children)';
      const blocks = await retrieveBlockChildren(block.id);
      const proms = blocks.map(getTextFromBlock);
      const texts = await Promise.all(proms);
      text = [text, ...texts].join('\n\n');
    }
    // Includes block type for readability. Update formatting as needed.
    // return block.type + ': ' + text;
    return text;
  };

  async function retrieveBlockChildren(id) {
    const blocks = [];
    const client = await getClient();

    // Use iteratePaginatedAPI helper function to get all blocks first-level blocks on the page
    for await (const block of iteratePaginatedAPI(client.blocks.children.list, {
      block_id: id, // A page ID can be passed as a block ID: https://developers.notion.com/docs/working-with-page-content#modeling-content-as-blocks
    })) {
      if (block.type !== 'child_page') {
        blocks.push(block);
      }
    }

    return blocks;
  }

  return {
    __name,
    load,
  };
}

export default NotionLoader;
