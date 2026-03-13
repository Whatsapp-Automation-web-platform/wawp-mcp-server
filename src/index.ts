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
        version: "2.0.5",
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
                name: "get_session_health",
                description: "Check if the WhatsApp session is connected.",
                inputSchema: { type: "object", properties: {} }
            },
            {
                name: "send_local_file",
                description: "Upload and send a local file to WhatsApp.",
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
                name: "get_endpoint_details",
                description: "Get documentation for a specific API endpoint.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string" }
                    },
                    required: ["path"]
                }
            },
            {
                name: "search_docs",
                description: "Search Wawp API documentation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "generate_starter_code",
                description: "Generate Node.js or Python code for a task.",
                inputSchema: {
                    type: "object",
                    properties: {
                        task: { type: "string" },
                        language: { type: "string", enum: ["nodejs", "python"] }
                    },
                    required: ["task", "language"]
                }
            },
            {
                name: "execute_request",
                description: "Execute a raw request to the Wawp API.",
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
            },
            {
                name: "install_agent_config",
                description: "Install Wawp agent rules and skills to your project.",
                inputSchema: {
                    type: "object",
                    properties: {
                        project_path: { type: "string" }
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
                    content: [{ type: "text", text: "Error: Credentials not set." }],
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
                throw new Error(`File not found: ${absolutePath}`);
            }

            const fileBuffer = fs.readFileSync(absolutePath);
            const base64Data = fileBuffer.toString("base64");
            const filename = path.basename(absolutePath);

            const endpointMap: Record<string, string> = {
                image: "/v2/send/image",
                pdf: "/v2/send/pdf",
                video: "/v2/send/video",
                audio: "/v2/send/audio",
                voice: "/v2/send/voice"
            };

            const url = `https://api.wawp.net${endpointMap[type] || "/v2/send/image"}`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "access-token": context.access_token
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
                code = `const axios = require('axios');\n\nasync function run() {\n    try {\n        const response = await axios.post('https://api.wawp.net/v2/send/text', {\n            access_token: '${token}',\n            instance_id: '${instance}',\n            chatId: '${testNum}',\n            text: 'Hello from Wawp! Task: ${task}'\n        });\n        console.log(response.data);\n    } catch (e) { console.error(e.message); }\n}\nrun();`;
            } else {
                code = `import requests\n\nurl = "https://api.wawp.net/v2/send/text"\npayload = {\n    "access_token": "${token}",\n    "instance_id": "${instance}",\n    "chatId": "${testNum}",\n    "text": "Hello from Wawp! Task: ${task}"\n}\n\ntry:\n    response = requests.post(url, json=payload)\n    print(response.json())\nexcept Exception as e: print(e)`;
            }

            return {
                content: [{ type: "text", text: `Starter code:\n\n\`\`\`${language}\n${code}\n\`\`\`` }],
            };
        }

        const nativeEndpoints = await fetchEndpoints();

        if (name === "execute_request") {
            let { path: reqPath, method, body, params } = args as any;

            if (!context.access_token || !context.instance_id) {
                return { content: [{ type: "text", text: "Error: Credentials missing." }], isError: true };
            }

            let url = `https://api.wawp.net${reqPath}`.replace("{instance_id}", context.instance_id);

            if (method === "GET" || method === "DELETE") {
                params = params || {};
                params.instance_id = params.instance_id || context.instance_id;
                params.access_token = params.access_token || context.access_token;
            } else {
                body = body || {};
                body.instance_id = body.instance_id || context.instance_id;
                body.access_token = body.access_token || context.access_token;
            }

            if (params) {
                const searchParams = new URLSearchParams(params as any);
                url += (url.includes("?") ? "&" : "?") + searchParams.toString();
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    "access-token": context.access_token
                },
                body: (method === "POST" || method === "PUT") ? JSON.stringify(body) : undefined
            });

            const data = await response.json();
            return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        if (name === "list_endpoints") {
            const category = args?.category as string | undefined;
            const endpoints = nativeEndpoints
                .filter((e: any) => !category || e.category === category)
                .map((e: any) => ({ path: e.path, title: e.title, category: e.category }));
            return { content: [{ type: "text", text: JSON.stringify(endpoints, null, 2) }] };
        }

        if (name === "get_endpoint_details") {
            const endpoint = nativeEndpoints.find((e: any) => e.path === args?.path);
            return { content: [{ type: "text", text: JSON.stringify(endpoint || { error: "Not found" }, null, 2) }] };
        }

        if (name === "search_docs") {
            const query = (args?.query as string || "").toLowerCase();
            const results = nativeEndpoints.filter((e: any) => {
                const text = `${e.path} ${e.title || ""} ${e.description || ""}`.toLowerCase();
                return text.includes(query);
            }).map((e: any) => ({ path: e.path, title: e.title }));
            return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
        }

        if (name === "install_agent_config") {
            const projectRoot = (args?.project_path as string) || process.cwd();
            const results = [];

            const cursorRulesUrl = "https://api.wawp.net/wawp-agent-rules.txt";
            const crResponse = await fetch(cursorRulesUrl);
            if (crResponse.ok) {
                fs.writeFileSync(path.join(projectRoot, ".cursorrules"), await crResponse.text());
                results.push("✅ Installed .cursorrules");
            }

            const skillDir = path.join(projectRoot, ".agent/skills/wawp-api-integration");
            if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });

            const skillUrl = "https://api.wawp.net/wawp-api-skill.md";
            const skillResponse = await fetch(skillUrl);
            if (skillResponse.ok) {
                fs.writeFileSync(path.join(skillDir, "SKILL.md"), await skillResponse.text());
                results.push("✅ Installed Skill");
            }

            return { content: [{ type: "text", text: results.join("\n") }] };
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
