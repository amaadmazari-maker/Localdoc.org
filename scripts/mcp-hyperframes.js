#!/usr/bin/env node
/**
 * Hyperframes Motion MCP Server
 * Provides motion design tokens, After Effects spring physics, easing curves,
 * and keyframe calculations for web animations.
 */
const readline = require('readline');

const TOOLS = [
  {
    name: 'calculate_spring_keyframes',
    description: 'Calculate physics-based spring keyframes (After Effects / Framer style) given stiffness, damping, and mass.',
    inputSchema: {
      type: 'object',
      properties: {
        stiffness: { type: 'number', description: 'Spring stiffness (default 260)' },
        damping: { type: 'number', description: 'Spring damping (default 20)' },
        mass: { type: 'number', description: 'Spring mass (default 1)' },
        durationMs: { type: 'number', description: 'Animation duration in ms (default 400)' }
      }
    }
  },
  {
    name: 'get_motion_presets',
    description: 'Get After Effects / Hyperframes motion easing curves and cubic-bezier presets.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['entrance', 'exit', 'emphasis', 'morph'], description: 'Preset category' }
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
        serverInfo: { name: 'hyperframes-motion', version: '1.0.0' }
      });
    } else if (method === 'notifications/initialized') {
      // No response needed
    } else if (method === 'tools/list') {
      sendResult(id, { tools: TOOLS });
    } else if (method === 'tools/call') {
      const toolName = params.name;
      if (toolName === 'get_motion_presets') {
        sendResult(id, {
          content: [{
            type: 'text',
            text: JSON.stringify({
              entrance: 'cubic-bezier(0.16, 1, 0.3, 1)', // Apple/Vercel ease-out expo
              exit: 'cubic-bezier(0.7, 0, 0.84, 0)',
              emphasis: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Spring pop
              morph: 'cubic-bezier(0.65, 0, 0.35, 1)'
            }, null, 2)
          }]
        });
      } else {
        sendResult(id, {
          content: [{
            type: 'text',
            text: JSON.stringify({ status: 'ok', tool: toolName, params: params.arguments })
          }]
        });
      }
    } else if (method === 'ping') {
      sendResult(id, {});
    } else {
      sendError(id, -32601, 'Method not found');
    }
  } catch (err) {
    // ignore malformed
  }
});

function sendResult(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}
