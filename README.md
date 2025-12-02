# AI图片提示词反推工具

上传图片，智能生成 Midjourney / Stable Diffusion / Flux 提示词。

## 技术栈

- **前端**: 纯HTML/CSS/JS (无框架，极致轻量)
- **后端**: Cloudflare Pages Functions (Workers)
- **AI**: 支持多种AI提供商 (OpenAI, Claude, 扣子, 豆包)

## 项目结构

```
image-prompt-tool/
├── index.html          # 主页面
├── robots.txt          # SEO配置
├── sitemap.xml         # 站点地图
├── wrangler.toml       # Cloudflare配置
├── _headers            # 自定义响应头
├── _redirects          # 重定向规则
└── functions/
    └── api/
        └── analyze.js  # 图片分析API
```

## 部署步骤

### 1. 准备工作

1. 注册/登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 准备AI API密钥（选择其中一个）:
   - OpenAI: https://platform.openai.com/api-keys
   - Claude: https://console.anthropic.com/
   - 扣子: https://www.coze.cn/
   - 豆包: https://www.volcengine.com/

### 2. 创建Git仓库

```bash
cd image-prompt-tool
git init
git add .
git commit -m "Initial commit: AI图片提示词反推工具"
```

### 3. 推送到GitHub

```bash
# 在GitHub创建新仓库后
git remote add origin https://github.com/你的用户名/image-prompt-tool.git
git branch -M main
git push -u origin main
```

### 4. 连接Cloudflare Pages

1. 进入 Cloudflare Dashboard -> Pages
2. 点击 "Create a project" -> "Connect to Git"
3. 选择GitHub仓库 `image-prompt-tool`
4. 构建设置:
   - Framework preset: None
   - Build command: (留空)
   - Build output directory: /
5. 点击 "Save and Deploy"

### 5. 配置环境变量

在 Cloudflare Pages -> 你的项目 -> Settings -> Environment variables:

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| AI_PROVIDER | AI提供商 | openai / claude / coze / doubao |
| OPENAI_API_KEY | OpenAI密钥 | sk-xxx... |
| CLAUDE_API_KEY | Claude密钥 | sk-ant-xxx... |
| COZE_API_KEY | 扣子密钥 | pat_xxx... |
| COZE_WORKFLOW_ID | 扣子工作流ID | 7xxx... |
| DOUBAO_API_KEY | 豆包密钥 | xxx... |

**注意**: 只需配置你选择使用的AI提供商相关变量。

### 6. 绑定自定义域名

1. Pages -> 你的项目 -> Custom domains
2. 添加域名，如 `imageprompt.tools`
3. 按提示添加DNS记录

## 本地开发

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 本地运行
wrangler pages dev . --local

# 访问 http://localhost:8788
```

## API说明

### POST /api/analyze

分析图片并生成提示词。

**请求体:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "model": "midjourney"  // 可选: midjourney, stable-diffusion, flux, all
}
```

**响应:**
```json
{
  "prompts": {
    "midjourney": "a beautiful sunset over mountains, golden hour..."
  }
}
```

## 扣子工作流配置

如果使用扣子(Coze)作为AI后端，需要创建工作流：

1. 登录 https://www.coze.cn/
2. 创建新工作流
3. 添加节点:
   - 输入: 接收 image(图片base64) 和 model_type(模型类型)
   - 大模型: 使用豆包视觉模型，配置提示词模板
   - 输出: 返回生成的提示词
4. 发布工作流，获取 workflow_id

## 成本估算

- Cloudflare Pages: 免费（每月500次构建，无限请求）
- AI API（按调用量计费）:
  - OpenAI GPT-4o: ~$0.01/次
  - Claude: ~$0.01/次
  - 扣子: 按token计费，约¥0.02/次
  - 豆包: 按token计费，约¥0.01/次

## License

MIT
