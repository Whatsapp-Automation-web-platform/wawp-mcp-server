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
        version: "2.0.0",
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
                description: "Set your Wawp API configuration (instance_id, access_token, test_number) for the current session.",
                inputSchema: {
                    type: "object",
                    properties: {
                        instance_id: { type: "string", description: "Your Wawp Instance ID" },
                        access_token: { type: "string", description: "Your Wawp Access Token" },
                        test_number: { type: "string", description: "Target WhatsApp number for testing (optional)" }
                    }
                }
            },
            {
                name: "get_session_health",
                description: "Check if the current Wawp session is connected and ready to send messages.",
                inputSchema: { type: "object", properties: {} }
            },
            {
                name: "send_local_file",
                description: "Upload and send a local file (image, pdf, video, audio) from your computer to WhatsApp.",
                inputSchema: {
                    type: "object",
                    properties: {
                        file_path: { type: "string", description: "Absolute or relative path to the local file" },
                        chatId: { type: "string", description: "Target WhatsApp number or Group ID" },
                        caption: { type: "string", description: "Optional caption for the file" },
                        type: { type: "string", enum: ["image", "pdf", "video", "audio", "voice"], description: "Type of file being sent" }
                    },
                    required: ["file_path", "chatId", "type"]
                }
            },
            {
                name: "list_endpoints",
                description: "List all available WhatsApp API endpoints and articles",
                inputSchema: {
                    type: "object",
                    properties: {
                        category: {
                            type: "string",
                            description: "Optional category to filter by (e.g., 'Send Messages', 'Groups')"
                        }
                    }
                }
            },
            {
                name: "get_endpoint_details",
                description: "Get full details for a specific API endpoint including parameters and responses",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "The API path (e.g., '/v2/send-text')"
                        }
                    },
                    required: ["path"]
                }
            },
            {
                name: "search_docs",
                description: "Search documentation for keywords across paths, titles, and descriptions",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query (e.g., 'send media', 'webhook authentication')"
                        }
                    },
                    required: ["query"]
                }
            },
            {
                name: "generate_starter_code",
                description: "Generates a fully working starter script (Node.js or Python) for a specific WhatsApp task using your credentials.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task: { type: "string", description: "What do you want to do? (e.g., 'send a welcome message', 'handle incoming orders')" },
                        language: { type: "string", enum: ["nodejs", "python"], description: "Programming language" }
                    },
                    required: ["task", "language"]
                }
            },
            {
                name: "execute_request",
                description: "Execute a real request to the Wawp API using your configured credentials. This will be logged as 'MCP' in Wawp logs.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "The API path (e.g., '/v2/send-text')" },
                        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], description: "HTTP method" },
                        body: { type: "object", description: "The request body (for POST/PUT)" },
                        params: { type: "object", description: "Query parameters" }
                    },
                    required: ["path", "method"]
                }
            },
            {
                name: "install_agent_config",
                description: "Automatically install Wawp Agent rules (.cursorrules) and Design System Skills into your current project. This gives your AI full context of Wawp's premium design standards and coding logic.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_path: { type: "string", description: "Path to the project root (default: current directory)" }
                    }
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

            return {
                content: [{ type: "text", text: "Configuration updated successfully." }],
            };
        }

        if (name === "get_session_health") {
            if (!context.access_token || !context.instance_id) {
                return {
                    content: [{ type: "text", text: "Error: Please set your 'access_token' and 'instance_id' first using set_config." }],
                    isError: true
                };
            }

            const url = `https://api.wawp.net/v2/session/info?instance_id=${context.instance_id}&access_token=${context.access_token}`;
            const response = await fetch(url);
            const data = await response.json();

            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            };
        }

        if (name === "send_local_file") {
            const { file_path, chatId, caption, type } = args as any;

            if (!context.access_token || !context.instance_id) {
                throw new Error("Credentials not configured.");
            }

            const absolutePath = path.isAbsolute(file_path) ? file_path : path.join(process.cwd(), file_path);

            if (!fs.existsSync(absolutePath)) {
                throw new Error(`File not found at path: ${absolutePath}`);
            }

            const fileBuffer = fs.readFileSync(absolutePath);
            const base64Data = fileBuffer.toString("base64");
            const filename = path.basename(absolutePath);

            const typeToEndpoint: Record<string, string> = {
                image: "/v2/send/image",
                pdf: "/v2/send/pdf",
                video: "/v2/send/video",
                audio: "/v2/send/audio",
                voice: "/v2/send/voice"
            };

            const endpoint = typeToEndpoint[type] || "/v2/send/image";
            const url = `https://api.wawp.net${endpoint}`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "access-token": context.access_token,
                    "X-Wawp-Source": "MCP"
                },
                body: JSON.stringify({
                    instance_id: context.instance_id,
                    chatId,
                    caption: caption || "",
                    file: {
                        url: `data:application/octet-stream;base64,${base64Data}`,
                        filename: filename,
                        mimetype: "application/octet-stream"
                    }
                })
            });

            const result = await response.json();
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }

        if (name === "generate_starter_code") {
            const { task, language } = args as any;
            const token = context.access_token || "YOUR_ACCESS_TOKEN";
            const instance = context.instance_id || "YOUR_INSTANCE_ID";
            const testNum = context.test_number || "RECIPIENT_NUMBER";

            let code = "";
            if (language === "nodejs") {
                code = `
// Wawp WhatsApp API - ${task}
const axios = require('axios');

async function run() {
    try {
        const response = await axios.post('https://api.wawp.net/v2/send/text', {
            access_token: '${token}',
            instance_id: '${instance}',
            chatId: '${testNum}',
            text: 'Hello from Wawp! This script was generated for: ${task}'
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

run();`;
            } else {
                code = `
# Wawp WhatsApp API - ${task}
import requests

url = "https://api.wawp.net/v2/send/text"
payload = {
    "access_token": "${token}",
    "instance_id": "${instance}",
    "chatId": "${testNum}",
    "text": "Hello from Wawp! This script was generated for: ${task}"
}

try:
    response = requests.post(url, json=payload)
    print("Response:", response.json())
except Exception as e:
    print("Error:", str(e))`;
            }

            return {
                content: [{ type: "text", text: `Here is your ${language} code for the task: ${task}\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nMake sure you have '${language === "nodejs" ? "axios" : "requests"}' installed.` }],
            };
        }

        const nativeEndpoints = await fetchEndpoints();

        if (name === "execute_request") {
            let { path: reqPath, method, body, params } = args as any;

            if (!context.access_token || !context.instance_id) {
                return {
                    content: [{ type: "text", text: "Error: Please set your 'access_token' and 'instance_id' first using set_config." }],
                    isError: true
                };
            }

            let url = `https://api.wawp.net${reqPath}`.replace("{instance_id}", context.instance_id);

            if (method === "GET" || method === "DELETE") {
                params = params || {};
                if (!params.instance_id) params.instance_id = context.instance_id;
                if (!params.access_token) params.access_token = context.access_token;
            } else if (method === "POST" || method === "PUT") {
                body = body || {};
                if (!body.instance_id) body.instance_id = context.instance_id;
                if (!body.access_token) body.access_token = context.access_token;
            }

            if (params) {
                const searchParams = new URLSearchParams(params as any);
                url += (url.includes("?") ? "&" : "?") + searchParams.toString();
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    "access-token": context.access_token,
                    "X-Wawp-Source": "MCP"
                },
                body: (method === "POST" || method === "PUT") ? JSON.stringify(body) : undefined
            });

            const data = await response.json();
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            };
        }

        if (name === "list_endpoints") {
            const category = args?.category as string | undefined;
            const endpoints = nativeEndpoints
                .filter((e: any) => !category || e.category === category)
                .map((e: any) => ({
                    path: e.path,
                    title: e.title || e.path,
                    category: e.category,
                    isArticle: !!e.isArticle
                }));

            return {
                content: [{ type: "text", text: JSON.stringify(endpoints, null, 2) }],
            };
        }

        if (name === "get_endpoint_details") {
            const path = args?.path as string;
            const endpoint = nativeEndpoints.find((e: any) => e.path === path);

            if (!endpoint) {
                return {
                    content: [{ type: "text", text: `Error: Endpoint with path '${path}' not found.` }],
                    isError: true
                };
            }

            return {
                content: [{ type: "text", text: JSON.stringify(endpoint, null, 2) }],
            };
        }

        if (name === "search_docs") {
            const query = (args?.query as string || "").toLowerCase();
            const words = query.split(/\s+/).filter(w => w.length > 0);

            const results = nativeEndpoints.filter((e: any) => {
                const text = `${e.path} ${e.title || ""} ${e.description || ""} ${e.category} ${e.extraInfo || ""}`.toLowerCase();
                return words.every(word => text.includes(word));
            }).map((e: any) => ({
                path: e.path,
                title: e.title || e.path,
                category: e.category,
                isArticle: !!e.isArticle
            }));

            return {
                content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
            };
        }

        if (name === "install_agent_config") {
            const projectRoot = (args?.project_path as string) || process.cwd();
            const results = [];

            try {
                // 1. Install .cursorrules
                const cursorRulesUrl = "https://api.wawp.net/wawp-agent-rules.txt";
                const crResponse = await fetch(cursorRulesUrl);
                if (crResponse.ok) {
                    const content = await crResponse.text();
                    fs.writeFileSync(path.join(projectRoot, ".cursorrules"), content);
                    results.push("✅ Installed .cursorrules (Wawp API Master Rules)");
                }

                // 2. Install Wawp API Integration Skill
                const skillDir = path.join(projectRoot, ".agent/skills/wawp-api-integration");
                if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });

                const skillUrl = "https://api.wawp.net/wawp-api-skill.md";
                const skillResponse = await fetch(skillUrl);
                if (skillResponse.ok) {
                    const content = await skillResponse.text();
                    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content);
                    results.push("✅ Installed Wawp API Integration Skill (.agent/skills/wawp-api-integration/SKILL.md)");
                }

                return {
                    content: [{ type: "text", text: results.join("\n") + "\n\nYour AI is now boosted with Wawp API mastery!" }],
                };
            } catch (error: any) {
                throw new Error(`Failed to install agent config: ${error.message}`);
            }
        }

        throw new Error(`Tool not found: ${name}`);
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
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
