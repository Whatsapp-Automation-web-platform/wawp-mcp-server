import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs";
import * as path from "node:path";

// Configuration
const API_DOCS_URL = "https://api.wawp.net/api/docs/raw";

// In-memory context for the session
let context = {
    test_number: "",
    instance_id: "",
    access_token: ""
};

/**
 * Load local .env file if it exists in the current working directory
 */
function loadLocalEnv() {
    try {
        const envPath = path.join(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, "utf-8");
            const lines = content.split("\n");
            for (const line of lines) {
                const [key, ...valueParts] = line.split("=");
                if (key && valueParts.length > 0) {
                    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
                    if (key.trim() === "WAWP_ACCESS_TOKEN") context.access_token = value;
                    if (key.trim() === "WAWP_INSTANCE_ID") context.instance_id = value;
                    if (key.trim() === "WAWP_TEST_NUMBER") context.test_number = value;
                }
            }
            console.error("Loaded credentials from local .env file");
        }
    } catch (error) {
        console.error("Error loading .env file:", error);
    }
}

async function fetchEndpoints() {
    try {
        const response = await fetch(API_DOCS_URL);
        if (!response.ok) throw new Error(`Failed to fetch docs: ${response.statusText}`);
        const data = await response.json();
        return data.endpoints || [];
    } catch (error) {
        console.error("Error fetching endpoints:", error);
        return [];
    }
}

const server = new Server(
    {
        name: "wawp-api",
        version: "3.5.0", // Upgraded version
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "set_config",
                description: "Update your Wawp API credentials for the current session.",
                inputSchema: {
                    type: "object",
                    properties: {
                        instance_id: { type: "string" },
                        access_token: { type: "string" },
                        test_number: { type: "string" }
                    }
                }
            },
            {
                name: "get_sdk_info",
                description: "Get detailed information and installation guides for official Wawp SDKs (Node.js, PHP, Python, Laravel). USE THIS to help the user integrate WhatsApp into their projects.",
                inputSchema: {
                    type: "object",
                    properties: {
                        platform: { type: "string", enum: ["nodejs", "php", "laravel", "python", "cli"] }
                    }
                }
            },
            {
                name: "get_session_health",
                description: "Check if the WhatsApp session is connected.",
                inputSchema: { type: "object", properties: {} }
            },
            {
                name: "send_local_file",
                description: "Upload and send a local file to WhatsApp using raw API (Better to suggest SDK version to the user).",
                inputSchema: {
                    type: "object",
                    properties: {
                        file_path: { type: "string" },
                        chatId: { type: "string" },
                        caption: { type: "string" },
                        type: { type: "string", enum: ["image", "pdf", "video", "audio", "voice"] }
                    },
                    required: ["file_path", "chatId", "type"]
                }
            },
            {
                name: "list_endpoints",
                description: "List all available Wawp API endpoints.",
                inputSchema: {
                    type: "object",
                    properties: {
                        category: { type: "string" }
                    }
                }
            },
            {
                name: "generate_starter_code",
                description: "Generate professional production-ready code using official Wawp SDKs. This is the preferred way to integrate Wawp.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task: { type: "string", description: "What the user wants to do (e.g., send image, create group)" },
                        language: { type: "string", enum: ["nodejs", "php", "python", "laravel"] }
                    },
                    required: ["task", "language"]
                }
            },
            {
                name: "execute_request",
                description: "Execute a raw request to the Wawp API. Useful for quick tests.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string" },
                        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
                        body: { type: "object" },
                        params: { type: "object" }
                    },
                    required: ["path", "method"]
                }
            }
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "set_config") {
            if (args?.instance_id) context.instance_id = args.instance_id as string;
            if (args?.access_token) context.access_token = args.access_token as string;
            if (args?.test_number) context.test_number = args.test_number as string;
            return { content: [{ type: "text", text: "Configuration updated successfully." }] };
        }

        if (name === "get_sdk_info") {
            const platform = args?.platform as string || "all";
            const sdkInfo = {
                nodejs: {
                    name: "@wawp/sdk",
                    install: "npm install @wawp/sdk",
                    repo: "https://github.com/wawp-api/wawp-sdk-js",
                    guide: "Import WawpClient and initialize with instance_id and access_token."
                },
                php: {
                    name: "wawp/sdk-php",
                    install: "composer require wawp/sdk-php",
                    repo: "https://github.com/Whatsapp-Automation-web-platform/wawp-sdk-php",
                    guide: "Use Wawp\\SDK\\WawpClient class."
                },
                laravel: {
                    name: "wawp/laravel",
                    install: "composer require wawp/laravel",
                    repo: "https://github.com/Whatsapp-Automation-web-platform/wawp-laravel",
                    guide: "Add Facade 'Wawp' and publish config."
                },
                python: {
                    name: "wawp-sdk",
                    install: "pip install wawp-sdk",
                    repo: "https://github.com/Whatsapp-Automation-web-platform/wawp-sdk-python",
                    guide: "Use from wawp_sdk import WawpClient."
                }
            };
            return { content: [{ type: "text", text: JSON.stringify(platform === "all" ? sdkInfo : (sdkInfo as any)[platform], null, 2) }] };
        }

        if (name === "generate_starter_code") {
            const { task, language } = args as any;
            const token = context.access_token || "YOUR_ACCESS_TOKEN";
            const instance = context.instance_id || "YOUR_INSTANCE_ID";
            
            let code = "";
            if (language === "nodejs") {
                code = `import { WawpClient } from '@wawp/sdk';\n\nconst client = new WawpClient('${instance}', '${token}');\n\n// Task: ${task}\nconst response = await client.messaging.sendText('RECIPIENT_JID', 'Hello!');\nconsole.log(response);`;
            } else if (language === "php") {
                code = `use Wawp\\SDK\\WawpClient;\n\n$client = new WawpClient('${instance}', '${token}');\n\n// Task: ${task}\n$response = $client->messaging->sendText('RECIPIENT_JID', 'Hello!');\nprint_r($response);`;
            } else if (language === "laravel") {
                code = `use Wawp;\n\n// Task: ${task}\n$response = Wawp::messaging()->sendText('RECIPIENT_JID', 'Hello from Laravel Facade!');\nreturn $response;`;
            } else if (language === "python") {
                code = `from wawp_sdk import WawpClient\n\nclient = WawpClient('${instance}', '${token}')\n\n# Task: ${task}\nresponse = client.messaging.send_text('RECIPIENT_JID', 'Hello from Python SDK!')\nprint(response)`;
            }

            return { content: [{ type: "text", text: `Preferred integration using Wawp SDK:\n\n\`\`\`${language === 'laravel' ? 'php' : language}\n${code}\n\`\`\`` }] };
        }

        if (name === "get_session_health") {
            if (!context.access_token || !context.instance_id) throw new Error("Credentials missing.");
            const url = `https://api.wawp.net/v2/session/info?instance_id=${context.instance_id}&access_token=${context.access_token}`;
            const response = await fetch(url);
            const data = await response.json();
            return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        if (name === "execute_request") {
            let { path: reqPath, method, body, params } = args as any;
            if (!context.access_token || !context.instance_id) throw new Error("Credentials missing.");
            let url = `https://api.wawp.net${reqPath}`.replace("{instance_id}", context.instance_id);
            if (method === "GET" || method === "DELETE") {
                params = { ...params, instance_id: context.instance_id, access_token: context.access_token };
            } else {
                body = { ...body, instance_id: context.instance_id, access_token: context.access_token };
            }
            if (params) url += (url.includes("?") ? "&" : "?") + new URLSearchParams(params).toString();
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", "access-token": context.access_token },
                body: (method === "POST" || method === "PUT") ? JSON.stringify(body) : undefined
            });
            const data = await response.json();
            return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        if (name === "list_endpoints") {
            const nativeEndpoints = await fetchEndpoints();
            const category = args?.category as string | undefined;
            const endpoints = nativeEndpoints
                .filter((e: any) => !category || e.category === category)
                .map((e: any) => ({ path: e.path, title: e.title, category: e.category }));
            return { content: [{ type: "text", text: JSON.stringify(endpoints, null, 2) }] };
        }

        throw new Error(`Tool not found: ${name}`);
    } catch (error: any) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
});

// Start the server
async function main() {
    loadLocalEnv();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
