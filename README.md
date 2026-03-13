# Wawp MCP Server 🤖

[![smithery badge](https://smithery.ai/badge/wawp/whatsapp)](https://smithery.ai/servers/wawp/whatsapp)


The Model Context Protocol (MCP) server for the Wawp WhatsApp API. This tool allows AI models (like Cursor, Windsurf, or Claude Desktop) to interact directly with your WhatsApp instances.

## 🚀 Quick Start

You don't need to install anything manually. You can use **Smithery** for one-click deployment or use `npx`.

<a href="https://smithery.ai/servers/wawp/whatsapp"><img src="https://smithery.ai/badge/wawp/whatsapp" alt="Smithery Badge" /></a>


### 🖱️ Cursor / Windsurf
Add a new MCP server with the following settings:
- **Type:** `command`
- **Command:** `npx`
- **Args:** `["-y", "@wawp/mcp-server"]`

### 🤖 Claude Desktop
Add this to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "wawp": {
      "command": "npx",
      "args": ["-y", "@wawp/mcp-server"]
    }
  }
}
```

## 🔑 Configuration

Once the server is connected, you can set your credentials using the `set_config` tool or by creating a `.env` file in your project root:

```env
WAWP_INSTANCE_ID=your_instance_id
WAWP_ACCESS_TOKEN=your_access_token
WAWP_TEST_NUMBER=recipient_number
```

## 🛠️ Available Tools

- `set_config`: Update credentials for the current session.
- `get_session_health`: Check WhatsApp connection status.
- `send_local_file`: Send images, PDFs, videos, or audio files from your local machine.
- `execute_request`: Make any raw request to the Wawp API.
- `install_agent_config`: Auto-install `.cursorrules` and Wawp AI Skills into your project.
- `generate_starter_code`: Get ready-to-use Node.js or Python snippets.
- `list_endpoints` / `get_endpoint_details`: Explore the API documentation.

## 📄 License
MIT

---
Built with ❤️ by [Wawp Team](https://wawp.net)
