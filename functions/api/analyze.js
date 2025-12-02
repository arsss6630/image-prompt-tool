/**
 * AI图片提示词反推 - Cloudflare Workers API
 *
 * 支持的AI后端:
 * 1. 扣子(Coze) 工作流
 * 2. OpenAI GPT-4 Vision
 * 3. Claude Vision
 * 4. 豆包(Doubao) Vision
 */

// 提示词模板
const PROMPT_TEMPLATES = {
    system: `你是一个专业的AI绘画提示词专家。你的任务是分析用户上传的图片，并生成适用于不同AI绘画模型的提示词。

请仔细分析图片中的以下元素：
1. 主体：人物、动物、物体等主要元素
2. 场景：环境、背景、地点
3. 风格：艺术风格、画风、质感
4. 光影：光线方向、氛围、色调
5. 构图：视角、景深、构图方式
6. 细节：服装、表情、纹理等细节特征`,

    midjourney: `请为这张图片生成Midjourney格式的提示词。

要求：
- 使用英文
- 包含主体描述、场景、风格、光影等元素
- 在末尾添加适当的参数，如 --ar 16:9, --v 6, --style raw 等
- 使用逗号分隔不同的描述元素
- 提示词应该简洁但完整，通常在50-150个单词之间

示例格式：
a beautiful woman with long black hair, standing in a cherry blossom garden, soft pink petals falling, golden hour lighting, cinematic composition, detailed face, elegant dress, photorealistic style, 8k quality --ar 16:9 --v 6`,

    stableDiffusion: `请为这张图片生成Stable Diffusion格式的提示词。

要求：
- 使用英文
- 分为正向提示词(Positive)和负向提示词(Negative)
- 正向提示词包含：主体、场景、风格、质量标签(如masterpiece, best quality, 8k)
- 负向提示词包含常见的质量排除词
- 使用逗号分隔

输出格式：
Positive: [正向提示词]
Negative: [负向提示词]

示例：
Positive: masterpiece, best quality, 1girl, long black hair, cherry blossom garden, pink petals, golden hour, soft lighting, detailed face, elegant dress, photorealistic, 8k uhd
Negative: lowres, bad anatomy, bad hands, text, error, missing fingers, cropped, worst quality, low quality, jpeg artifacts, ugly, duplicate, blurry`,

    flux: `请为这张图片生成Flux格式的提示词。

要求：
- 使用自然语言描述，可以是较长的句子
- Flux模型更擅长理解自然语言，所以描述可以更加详细和连贯
- 包含主体、环境、风格、氛围等元素
- 使用英文

示例：
A stunning portrait of a young woman with flowing black hair standing gracefully in a traditional Japanese garden. Cherry blossom petals drift gently through the air around her. The scene is bathed in warm golden hour sunlight, creating a dreamy and romantic atmosphere. She wears an elegant silk dress that catches the light beautifully. The image has a cinematic quality with professional photography composition and exceptional detail.`
};

export async function onRequestPost(context) {
    const { request, env } = context;

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        const { image, model } = await request.json();

        if (!image) {
            return new Response(JSON.stringify({ error: '请上传图片' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 根据选择的模型生成提示词
        const modelsToGenerate = model === 'all'
            ? ['midjourney', 'stable-diffusion', 'flux']
            : [model];

        const prompts = {};

        for (const modelType of modelsToGenerate) {
            const prompt = await generatePrompt(env, image, modelType);
            prompts[modelType] = prompt;
        }

        return new Response(JSON.stringify({ prompts }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ error: '服务器错误: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// 处理 OPTIONS 请求 (CORS preflight)
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}

/**
 * 生成提示词 - 根据配置调用不同的AI API
 */
async function generatePrompt(env, imageBase64, modelType) {
    // 获取API配置
    const apiProvider = env.AI_PROVIDER || 'openai'; // openai, claude, coze, doubao

    switch (apiProvider) {
        case 'openai':
            return await callOpenAI(env, imageBase64, modelType);
        case 'claude':
            return await callClaude(env, imageBase64, modelType);
        case 'coze':
            return await callCoze(env, imageBase64, modelType);
        case 'doubao':
            return await callDoubao(env, imageBase64, modelType);
        default:
            return await callOpenAI(env, imageBase64, modelType);
    }
}

/**
 * 调用 OpenAI GPT-4 Vision API (支持中转API)
 */
async function callOpenAI(env, imageBase64, modelType) {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API Key 未配置');
    }

    // 支持自定义 API 地址（中转API）
    const baseUrl = env.OPENAI_BASE_URL || 'https://api.openai.com';
    // 支持自定义模型（需要支持视觉的模型）
    const modelName = env.OPENAI_MODEL || 'gpt-4o';

    const promptTemplate = getPromptTemplate(modelType);

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: modelName,
            messages: [
                {
                    role: 'system',
                    content: PROMPT_TEMPLATES.system
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: promptTemplate
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageBase64
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API错误: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * 调用 Claude Vision API
 */
async function callClaude(env, imageBase64, modelType) {
    const apiKey = env.CLAUDE_API_KEY;
    if (!apiKey) {
        throw new Error('Claude API Key 未配置');
    }

    const promptTemplate = getPromptTemplate(modelType);

    // 从 base64 数据 URL 中提取实际的 base64 内容和媒体类型
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
        throw new Error('无效的图片格式');
    }
    const mediaType = matches[1];
    const base64Data = matches[2];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: PROMPT_TEMPLATES.system,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64Data
                            }
                        },
                        {
                            type: 'text',
                            text: promptTemplate
                        }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API错误: ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

/**
 * 调用扣子(Coze)工作流 API
 */
async function callCoze(env, imageBase64, modelType) {
    const apiKey = env.COZE_API_KEY;
    const workflowId = env.COZE_WORKFLOW_ID;

    if (!apiKey || !workflowId) {
        throw new Error('Coze API 配置不完整');
    }

    const response = await fetch('https://api.coze.cn/v1/workflow/run', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            workflow_id: workflowId,
            parameters: {
                image: imageBase64,
                model_type: modelType
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Coze API错误: ${error}`);
    }

    const data = await response.json();
    return data.data?.output || data.data;
}

/**
 * 调用豆包(Doubao) Vision API
 */
async function callDoubao(env, imageBase64, modelType) {
    const apiKey = env.DOUBAO_API_KEY;
    const endpoint = env.DOUBAO_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3';

    if (!apiKey) {
        throw new Error('Doubao API Key 未配置');
    }

    const promptTemplate = getPromptTemplate(modelType);

    const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'doubao-seed-1-6-vision',
            messages: [
                {
                    role: 'system',
                    content: PROMPT_TEMPLATES.system
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: promptTemplate
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageBase64
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Doubao API错误: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * 获取对应模型的提示词模板
 */
function getPromptTemplate(modelType) {
    switch (modelType) {
        case 'midjourney':
            return PROMPT_TEMPLATES.midjourney;
        case 'stable-diffusion':
            return PROMPT_TEMPLATES.stableDiffusion;
        case 'flux':
            return PROMPT_TEMPLATES.flux;
        default:
            return PROMPT_TEMPLATES.midjourney;
    }
}
