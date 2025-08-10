/**
 * Converts a nested JSON object into a markdown document
 * @param {any} obj - The JSON object to convert
 * @param {number} depth - Current depth for header levels (default: 1)
 * @param {string} parentKey - Parent key for context (default: '')
 * @returns {string} Formatted markdown string
 */
export function jsonToMarkdown(obj, depth = 1, parentKey = '') {
  if (obj === null || obj === undefined) {
    return '`null`\n\n';
  }
  
  // Handle primitive types
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      // Check if it's a multi-line string
      if (obj.includes('\n')) {
        return '```\n' + obj + '\n```\n\n';
      }
      return obj + '\n\n';
    }
    return '`' + String(obj) + '`\n\n';
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '- *Empty array*\n\n';
    }
    
    // Check if this is a string array (all items are strings/primitives)
    const isStringArray = obj.every(item => typeof item !== 'object' || item === null);
    
    if (isStringArray) {
      // For string arrays, return as a simple list without extra formatting
      let result = '';
      obj.forEach(item => {
        if (item === null || item === undefined) {
          result += '- `null`\n';
        } else if (typeof item === 'string') {
          result += `- ${item}\n`;
        } else {
          result += `- \`${String(item)}\`\n`;
        }
      });
      return result + '\n';
    } else {
      // For object arrays, use the existing format with headers
      let result = '';
      obj.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          result += `- **Item ${index + 1}:**\n`;
          const itemMarkdown = jsonToMarkdown(item, depth + 1, `${parentKey}[${index}]`);
          // Indent the nested content
          result += itemMarkdown.split('\n').map(line => line ? '  ' + line : '').join('\n');
        } else {
          result += `- ${jsonToMarkdown(item, depth, parentKey).trim()}\n`;
        }
      });
      return result + '\n';
    }
  }
  
  // Handle objects
  let result = '';
  const keys = Object.keys(obj);
  
  if (keys.length === 0) {
    return '- *Empty object*\n\n';
  }
  
  let lastWasLeafOrStringArray = false;
  
  keys.forEach((key, index) => {
    const value = obj[key];
    
    // Check if this is a leaf value (primitive or null)
    const isLeaf = value === null || value === undefined || typeof value !== 'object';
    
    // Check if this is a string array (array of primitives)
    const isStringArray = Array.isArray(value) && value.length > 0 && value.every(item => typeof item !== 'object' || item === null);
    
    if (isLeaf) {
      // Use key: value format for leaf values
      const formattedKey = formatKey(key);
      let formattedValue;
      
      if (value === null || value === undefined) {
        formattedValue = '`null`';
      } else if (typeof value === 'string') {
        if (value.includes('\n')) {
          formattedValue = '\n```\n' + value + '\n```';
        } else {
          formattedValue = value;
        }
      } else {
        formattedValue = '`' + String(value) + '`';
      }
      
      result += `**${formattedKey}:** ${formattedValue}\n`;
      lastWasLeafOrStringArray = true;
    } else if (isStringArray) {
      // Use key: value format for string arrays
      const formattedKey = formatKey(key);
      result += `**${formattedKey}:**\n`;
      
      value.forEach(item => {
        if (item === null || item === undefined) {
          result += '- `null`\n';
        } else if (typeof item === 'string') {
          result += `- ${item}\n`;
        } else {
          result += `- \`${String(item)}\`\n`;
        }
      });
      lastWasLeafOrStringArray = true;
    } else {
      // Use markdown headers for intermediate keys (objects/object arrays)
      // Add blank line before header if previous item was a leaf or string array
      if (lastWasLeafOrStringArray) {
        result += '\n';
      }
      
      const headerLevel = Math.min(depth, 6); // Markdown only supports up to 6 levels
      const header = '#'.repeat(headerLevel) + ' ' + formatKey(key) + '\n\n';
      
      result += header;
      
      if (Array.isArray(value)) {
        if (value.length === 0) {
          result += '*Empty array*\n\n';
        } else {
          result += jsonToMarkdown(value, depth + 1, key);
        }
      } else {
        result += jsonToMarkdown(value, depth + 1, key);
      }
      lastWasLeafOrStringArray = false;
    }
  });
  
  return result;
}

/**
 * Formats a key to be more readable in markdown
 * @param {string} key - The key to format
 * @returns {string} Formatted key
 */
function formatKey(key) {
  // Convert camelCase and snake_case to Title Case
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to spaces
    .replace(/_/g, ' ') // snake_case to spaces
    .replace(/\b\w/g, char => char.toUpperCase()); // Title Case
}

/**
 * Main function to convert JSON to markdown with optional title
 * @param {any} jsonObject - The JSON object to convert
 * @param {string} title - Optional title for the document
 * @returns {string} Complete markdown document
 */
function convertJsonToMarkdown(jsonObject, title = 'JSON Document') {
  let markdown = '';
  
  // Add title if provided
  if (title) {
    markdown += `# ${title}\n\n`;
  }
  
  // Add timestamp
  markdown += `*Generated on: ${new Date().toISOString()}*\n\n`;
  
  // Convert the JSON object
  markdown += jsonToMarkdown(jsonObject, 2);
  
  return markdown;
}

// Example usage:
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    jsonToMarkdown,
    convertJsonToMarkdown,
    formatKey
  };
}

// Example usage for browser:
// const sampleJson = {
//   user: {
//     name: "John Doe",
//     email: "john@example.com",
//     age: 30,
//     isActive: true,
//     preferences: {
//       theme: "dark",
//       notifications: ["email", "push"],
//       settings: {
//         autoSave: true,
//         language: "en"
//       }
//     },
//     recentActivity: [
//       {
//         action: "login",
//         timestamp: "2024-01-15T10:30:00Z",
//         ipAddress: "192.168.1.1"
//       },
//       {
//         action: "update_profile",
//         timestamp: "2024-01-15T11:45:00Z",
//         changes: ["email", "preferences"]
//       }
//     ]
//   },
//   metadata: {
//     version: "1.0.0",
//     lastUpdated: "2024-01-15T12:00:00Z"
//   }
// };
// 
// console.log(convertJsonToMarkdown(sampleJson, "User Profile Data")); 