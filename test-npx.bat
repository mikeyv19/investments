@echo off
echo Testing npx command...
"F:\ProgrammingLibraries\nodejs\npx.cmd" --version
echo.
echo Testing Supabase MCP server...
"F:\ProgrammingLibraries\nodejs\npx.cmd" -y @supabase/mcp-server-supabase@latest --help
pause