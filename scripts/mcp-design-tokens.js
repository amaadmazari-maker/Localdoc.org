#!/usr/bin/env node
/**
 * Design Tokens & Aesthetics MCP Server
 * Provides vetted color palettes, typography scales, spacing tokens,
 * and Vercel/Linear design guidelines.
 */
const readline = require('readline');

const DESIGN_SYSTEM = {
  colors: {
    brand: {
      teal50: '#F0FDFA',
      teal100: '#CCFBF1',
      teal500: '#14B8A6',
      teal600: '#0D9488',
      teal700: '#0F766E'
    },
    neutralDark: {
      bg: '#090D16',
      surface: '#111827',
      surfaceElevated: '#1F2937',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      borderFocus: 'rgba(20, 184, 166, 0.5)'
    },
    neutralLight: {
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceElevated: '#F1F5F9',
      borderSubtle: '#E2E8F0',
      borderFocus: '#0D9488'
    }
  },
  typography: {
    fontFamilies: {
      sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace"
    },
    scale: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem'
    }
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px'
  }
};

const TOOLS = [
  {
    name: 'get_design_tokens',
    description: 'Retrieve curated design tokens for colors, typography, borders, and spacing.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['colors', 'typography', 'spacing', 'all'] }
      }
    }
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    const { id, method, params } = req;

    if (method === 'initialize') {
      sendResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'design-tokens', version: '1.0.0' }
      });
    } else if (method === 'tools/list') {
      sendResult(id, { tools: TOOLS });
    } else if (method === 'tools/call') {
      const cat = params.arguments && params.arguments.category;
      const data = cat && cat !== 'all' ? DESIGN_SYSTEM[cat] : DESIGN_SYSTEM;
      sendResult(id, {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      });
    } else if (method === 'ping') {
      sendResult(id, {});
    } else {
      sendError(id, -32601, 'Method not found');
    }
  } catch (err) {}
});

function sendResult(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}
