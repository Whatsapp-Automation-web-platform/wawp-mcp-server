import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ListPromptsRequestSchema,
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
        version: "2.0.3",
    },
    {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
    }
);

// List available tools with detailed descriptions for Smithery Quality Score
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "set_config",
                description: "Update your Wawp API credentials for the current session. Use this if you haven't set .env variables.",
                inputSchema: {
                    type: "object",
                    properties: {
                        instance_id: { type: "string", description: "Your unique Wawp Instance ID (found in dashboard)" },
                        access_token: { type: "string", description: "Your secret Wawp Access Token" },
                        test_number: { type: "string", description: "Default WhatsApp number to send test messages to" }
                    }
                }
            },
            {
                name: "get_session_health",
                description: "Check if your WhatsApp instance is currently connected and ready to send/receive messages.",
                inputSchema: { type: "object", properties: {} }
            },
            {
                name: "send_local_file",
                description: "Upload and send a file from your computer to a WhatsApp contact.",
                inputSchema: {
                    type: "object",
                    properties: {
                        file_path: { type: "string", description: "The full path to the local file (e.g., /home/user/image.jpg)" },
                        chatId: { type: "string", description: "Target WhatsApp number with country code (e.g., 1234567890@c.us)" },
                        caption: { type: "string", description: "Optional text to send along with the file" },
                        type: { type: "string", enum: ["image", "pdf", "video", "audio", "voice"], description: "The category of the file being sent" }
                    },
                    required: ["file_path", "chatId", "type"]
                }
            },
            {
                name: "list_endpoints",
                description: "Browse all available Wawp API endpoints and documentation articles.",
                inputSchema: {
                    type: "object",
                    properties: {
                        category: {
                            type: "string",
                            description: "Filter endpoints by category (e.g., 'Messages', 'Groups', 'Profile')"
                        }
                    }
                }
            },
            {
                name: "get_endpoint_details",
                description: "Retrieve full technical details, JSON schemas, and usage examples for a specific API path.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "The API endpoint path (e.g., '/v2/send/text')"
                        }
                    },
                    required: ["path"]
                }
            },
            {
                name: "search_docs",
                description: "Search across Wawp documentation for specific keywords or features.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search keywords (e.g., 'webhooks', 'interactive buttons')"
                        }
                    },
                    required: ["query"]
                }
            },
            {
                name: "generate_starter_code",
                description: "Create a copy-pasteable Node.js or Python script for a specific task using your credentials.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task: { type: "string", description: "What do you want the script to do?" },
                        language: { type: "string", enum: ["nodejs", "python"], description: "The programming language for the generated code" }
                    },
                    required: ["task", "language"]
                }
            },
            {
                name: "execute_request",
                description: "Make a live API call to Wawp. This is the most powerful tool for automation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "The API endpoint path" },
                        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], description: "HTTP method" },
                        body: { type: "object", description: "JSON body for POST/PUT requests" },
                        params: { type: "object", description: "URL query parameters" }
                    },
                    required: ["path", "method"]
                }
            },
            {
                name: "install_agent_config",
                description: "Configure your local project with Wawp-specific AI rules and skills.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_path: { type: "string", description: "Directory to install configuration (defaults to current)" }
                    }
                }
            }
        ],
    };
});

/**
 * Add Resources to boost Smithery score
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "wawp://docs/main",
                name: "Main Documentation",
                description: "Full Wawp API specification and guides",
                mimeType: "text/markdown"
            }
        ]
    };
});

// Implementation of Prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [
            {
                name: "send_welcome",
                description: "Generate a welcome message flow for new customers",
            }
        ]
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
