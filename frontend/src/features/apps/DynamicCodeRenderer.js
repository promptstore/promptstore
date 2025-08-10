import React from 'react';
import * as Babel from '@babel/standalone';
import * as antd from 'antd';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}

// Helper function to parse imports and remove them from code
const parseImports = code => {
  const imports = {};
  let transformedCode = code;

  // Parse import statements
  const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"];?\s*/g;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    const [fullMatch, namedImports, starImport, defaultImport, module] = match;

    // Remove import statement from code
    transformedCode = transformedCode.replace(fullMatch, '');

    // Handle different import types
    if (module === 'antd') {
      if (namedImports) {
        // Handle named imports like { Card, Button }
        const importNames = namedImports.split(',').map(name => name.trim());
        importNames.forEach(name => {
          imports[name] = antd[name];
        });
      } else if (starImport) {
        // Handle star imports like * as antd
        imports[starImport] = antd;
      } else if (defaultImport) {
        // Handle default imports
        imports[defaultImport] = antd;
      }
    }
    // Add more modules as needed
  }

  return { transformedCode, imports };
};

// Helper function to transform module-style code to component function
const transformModuleToComponent = code => {
  // Handle export default at the end
  let transformedCode = code.replace(/export\s+default\s+(\w+);?\s*$/, '');

  // Find the main component name from export default
  const exportMatch = code.match(/export\s+default\s+(\w+)/);
  const componentName = exportMatch ? exportMatch[1] : null;

  if (componentName) {
    // Return the component by name
    transformedCode += `\nreturn ${componentName};`;
  } else {
    // If no export default found, try to find the last function component
    const funcMatch = transformedCode.match(/const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*{[\s\S]*}/);
    if (funcMatch) {
      const lastComponentName = funcMatch[1];
      transformedCode += `\nreturn ${lastComponentName};`;
    }
  }

  return transformedCode;
};

export default function DynamicCodeRenderer({ code, type = 'jsx', props = {} }) {
  const [RenderedComponent, setRenderedComponent] = React.useState(null);

  React.useEffect(() => {
    try {
      let Component;

      if (type === 'jsx') {
        // Parse and handle imports
        const { transformedCode: importsParsed, imports } = parseImports(code);

        // Check if code is a complete component or just JSX
        const isCompleteComponent =
          importsParsed.includes('export default') ||
          importsParsed.includes('const ') ||
          importsParsed.includes('function ');

        let transformedCode;
        if (isCompleteComponent) {
          // Transform module-style code to component function
          transformedCode = transformModuleToComponent(importsParsed);
        } else {
          // Wrap raw JSX in a component function
          transformedCode = `
            (function() {
              const DynamicComponent = ({ data }) => {
                return ${importsParsed.trim()};
              };
              return DynamicComponent;
            })()
          `;
        }

        // Create context with imported libraries
        const context = {
          React,
          Card: antd.Card,
          Collapse: antd.Collapse,
          Divider: antd.Divider,
          List: antd.List,
          Row: antd.Row,
          Col: antd.Col,
          Space: antd.Space,
          Statistic: antd.Statistic,
          Tabs: antd.Tabs,
          Typography: antd.Typography,
          ...imports,
        };

        // Use Babel to transform JSX
        const compiledCode = Babel.transform(transformedCode, {
          presets: ['react'],
          plugins: ['proposal-object-rest-spread'],
        }).code;

        // Create function with context
        const contextKeys = Object.keys(context);
        const contextValues = Object.values(context);

        // Create a function that returns the component
        const componentFunction = new Function(...contextKeys, `return ${compiledCode}`);
        const ComponentClass = componentFunction(...contextValues);

        // Wrap component to handle props safely
        Component = (props = {}) => {
          try {
            return React.createElement(ComponentClass, props);
          } catch (error) {
            console.error('Error rendering component:', error);
            return React.createElement('div', null, `Component Error: ${error.message}`);
          }
        };
      } else {
        // Direct eval for plain JavaScript
        Component = eval(`(${code})`);
      }

      setRenderedComponent(() => Component);
    } catch (error) {
      console.error('Error rendering dynamic code:', error);
      setRenderedComponent(() => () => <div>Error: {error.message}</div>);
    }
  }, [code, type]);

  if (!RenderedComponent) return <div>Loading...</div>;

  return (
    <ErrorBoundary>
      <RenderedComponent {...props} />
    </ErrorBoundary>
  );
}
