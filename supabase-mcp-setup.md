# Supabase MCP Server Setup Guide

## Overview
This guide documents how to set up and test the Supabase MCP (Model Context Protocol) server for connecting Claude to your Supabase database.

## Prerequisites
- Node.js and npm installed
- Supabase project with access token
- Your Supabase project reference ID

## Setup Steps

### 1. Environment Setup
First, set your Supabase access token as an environment variable:

**Command Prompt (CMD):**
```cmd
set SUPABASE_ACCESS_TOKEN=sbp_918b6319007e28b9606185f3f24f2e9c6434a327
```

**PowerShell:**
```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_918b6319007e28b9606185f3f24f2e9c6434a327"
```

### 2. Running the MCP Server

Basic command to start the server:
```bash
npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=borpmguppzkklueyzcew
```

With access token as parameter (alternative):
```bash
npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=borpmguppzkklueyzcew --access-token=sbp_918b6319007e28b9606185f3f24f2e9c6434a327
```

**Note:** When run directly, the server will appear to "hang" - this is normal behavior as it's waiting for MCP protocol messages via stdin.

### 3. Testing the Server

To verify the server is working, send an initialization message:

```powershell
echo '{"jsonrpc": "2.0", "method": "initialize", "params": {"protocolVersion": "0.1.0", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}, "id": 1}' | npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=borpmguppzkklueyzcew --access-token=sbp_918b6319007e28b9606185f3f24f2e9c6434a327
```

Expected successful response:
```json
{
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {"tools": {}},
    "serverInfo": {"name": "supabase", "version": "0.4.5"}
  },
  "jsonrpc": "2.0",
  "id": 1
}
```

## Integration with Claude

### Option 1: Claude Desktop (if using desktop app)
Add to your Claude Desktop configuration file:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Configuration:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref=borpmguppzkklueyzcew"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_918b6319007e28b9606185f3f24f2e9c6434a327"
      }
    }
  }
}
```

### Option 2: Web-based Claude
For web-based Claude (claude.ai), MCP servers need to be:
1. Hosted on a publicly accessible endpoint, OR
2. Run locally with a tunneling service (like ngrok), OR
3. Integrated into your application as a proxy

### Option 3: Programmatic Integration
Use the MCP server in your application by spawning it as a child process:

```javascript
const { spawn } = require('child_process');

const mcpServer = spawn('npx', [
  '-y',
  '@supabase/mcp-server-supabase@latest',
  '--read-only',
  '--project-ref=borpmguppzkklueyzcew',
  '--access-token=sbp_918b6319007e28b9606185f3f24f2e9c6434a327'
]);

// Send initialization
mcpServer.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    protocolVersion: "0.1.0",
    capabilities: {},
    clientInfo: { name: "my-app", version: "1.0.0" }
  },
  id: 1
}) + '\n');

// Handle responses
mcpServer.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});
```

## Common MCP Commands

After initialization, you can send these commands:

### List available tools:
```json
{"jsonrpc": "2.0", "method": "tools/list", "id": 2}
```

### Execute a query:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "execute_query",
    "arguments": {
      "query": "SELECT * FROM companies LIMIT 5"
    }
  },
  "id": 3
}
```

## Troubleshooting

1. **"Unknown option" error**: The MCP server has limited command-line options. Stick to documented flags.

2. **"Please provide a personal access token" error**: Ensure the environment variable is set correctly or use the `--access-token` flag.

3. **Server appears to hang**: This is normal - the server is waiting for JSON-RPC messages on stdin.

4. **"Required clientInfo" error**: Include the `clientInfo` object in your initialization request.

## Security Notes

- Never commit your access token to version control
- Use environment variables or secure key management
- The `--read-only` flag ensures the MCP server can only read data, not modify it

## Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Supabase MCP Server GitHub](https://github.com/supabase/mcp-server-supabase)
- [Claude Desktop MCP Documentation](https://docs.anthropic.com/claude/docs/mcp)