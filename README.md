# 🎨 Prism AI Generator

> 🇨🇳 专为中文用户打造的智能AI图像生成平台，让创意无限可能

一个现代化的AI图像生成平台，集成多种顶级AI模型，提供智能化的提示词优化系统，让用户轻松创作出专业级的AI艺术作品。

[![Demo](https://img.shields.io/badge/🌐-在线体验-brightgreen)](https://prism.seanfield.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)](https://www.typescriptlang.org/)

## ✨ 核心特色

### 🧠 智能提示词系统
- **🏷️ 分类标签体系**：艺术风格、主题风格、情绪氛围、技术参数等完整分类
- **🤖 AI驱动优化**：集成LLM模型进行提示词智能优化和质量分析
- **🌐 中英文支持**：专业的双语翻译和本土化适配
- **📋 智能模板**：预设多种创作模板，快速启发灵感

### 🎨 专业级图像生成
- **⚡ 精选模型**：Flux Schnell（超快4步生成）、Google Imagen 4 Ultra（顶级质量）
- **🎛️ 智能配置**：参数自动匹配模型最佳设置，推荐标签指导用户选择
- **📱 现代化界面**：三种视图模式（首页/创作/画廊），流畅的响应式体验
- **🖼️ 灵活生成**：根据模型特性自适应（快速模型4张批量，高质量模型精品单张）

### 🚀 性能与体验
- **📦 智能批次管理**：标签分类展示、折叠/展开、批次级操作
- **🖼️ 懒加载优化**：Intersection Observer、渐进式加载、CORS跨域解决
- **🌐 翻译功能**：智能提示词翻译、数据库缓存、一键收起/展开
- **👤 免注册使用**：基于设备指纹的匿名用户系统
- **📊 反馈系统**：点赞/踩功能、批次级反馈、数据分析统计

## 🏗️ 技术架构

### 前端技术栈
```
React 18 + TypeScript + Vite
├── 🎨 Tailwind CSS - 原子化样式
├── 🗃️ Zustand - 状态管理
├── 🖼️ 图片懒加载优化
└── 📱 响应式设计
```

### 后端服务
```
Netlify Functions (Serverless) - 60秒超时优化
├── 🎨 generate-image - AI图像生成（智能轮询、超时保护）
├── 🧠 optimize-prompt - 提示词优化
├── 🔍 analyze-prompt - 提示词分析
├── 🌐 translate-prompt - 中英翻译（数据库缓存）
├── 📋 generate-template - 模板生成
├── 💡 prompt-suggestions - 智能建议
├── 📁 upload-to-r2 - 文件存储
└── 📥 download-image - 图片代理下载（CORS解决）
```

### 数据存储
- **Supabase** - PostgreSQL数据库
- **Cloudflare R2** - 对象存储
- **Replicate API** - AI模型服务

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 pnpm

### 本地开发

1. **克隆仓库**
```bash
git clone https://github.com/your-username/prism-ai-generator.git
cd prism-ai-generator
```

2. **安装依赖**
```bash
# 根目录依赖
npm install

# 前端依赖
cd frontend && npm install
```

3. **环境配置**
```bash
# 复制环境变量模板
cp frontend/.env.example frontend/.env.local

# 配置以下环境变量
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
REPLICATE_API_TOKEN=your_replicate_token

# Netlify Functions 环境变量
CLOUDFLARE_R2_ACCESS_KEY=your_r2_access_key
CLOUDFLARE_R2_SECRET_KEY=your_r2_secret_key  
CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name
```

4. **启动开发服务器**
```bash
# 使用 Netlify Dev（推荐）
netlify dev

# 或者仅启动前端
cd frontend && npm run dev
```

访问 `http://localhost:8888` 开始体验

### 数据库设置

项目使用 Supabase 作为数据库，主要表结构：

- `users` - 用户管理（基于设备指纹）
- `generations` - 生成记录（增强R2存储支持）
- `daily_stats` - 每日统计
- `tag_stats` - 标签使用统计
- `image_feedback` - 用户反馈（批次级反馈）
- `prompt_translations` - 翻译缓存（避免重复翻译）

详细的数据库Schema可以在 `frontend/src/types/database.ts` 中查看。

## 📂 项目结构

```
prism-ai-generator/
├── frontend/                    # 前端应用
│   ├── src/
│   │   ├── components/         # 通用组件
│   │   ├── features/           # 功能模块
│   │   │   ├── ai-models/      # AI模型相关
│   │   │   ├── image-processing/ # 图片处理
│   │   │   └── usage-tracking/ # 用量追踪
│   │   ├── services/           # 服务层
│   │   ├── store/              # 状态管理
│   │   └── types/              # 类型定义
│   └── package.json
├── netlify/
│   └── functions/              # Serverless函数
└── netlify.toml                # 部署配置
```

## 🎯 核心功能演示

### 智能提示词优化
```javascript
// 原始提示词
const userPrompt = "一只可爱的猫咪";

// AI优化后
const optimizedPrompt = `一只可爱的小猫咪，毛茸茸的，大眼睛，
photorealistic, professional photography, 8K ultra-detailed,
warm lighting, soft sunlight, highly detailed`;
```

### 🌐 智能翻译系统
- **数据库缓存** - 相同提示词自动使用缓存，避免重复翻译
- **一键切换** - 点击翻译按钮查看中文，再次点击收起
- **专业术语** - 保留关键英文术语，提供中英对照

### 📊 用户体验优化
- **推荐标签** - 每个模型的最佳参数都有绿色"推荐"标识
- **智能配置** - 切换模型时自动匹配最佳设置
- **批次管理** - 支持折叠/展开、批量操作、反馈统计

### 标签分类系统
- **艺术风格**：摄影级逼真、电影级画质、油画风格、动漫风格
- **主题风格**：赛博朋克、科幻场景、奇幻风格、中国风
- **情绪氛围**：温暖明亮、神秘暗黑、梦幻唯美、震撼史诗
- **技术参数**：镜头设置、光线配置、构图方式
- **增强效果**：超高细节、专业品质、HDR效果

## 🎨 使用示例

### 1. 快速开始模板
平台提供多种预设模板：
- 🏔️ **电影级风景** - 专业摄影，震撼视觉
- 👩‍🎨 **专业人像** - 工作室级人像摄影
- 🌆 **赛博朋克** - 未来科技美学
- 🎭 **概念艺术** - 游戏级概念设计

### 2. 智能优化流程
1. 输入基础创意描述
2. AI自动分析和优化提示词
3. 选择合适的艺术风格和技术参数
4. 生成高质量图像作品

## 🔧 部署指南

### Netlify 部署（推荐）

1. **连接仓库**
   - Fork 本仓库到你的 GitHub
   - 在 Netlify 中连接该仓库

2. **配置环境变量**
   ```
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   REPLICATE_API_TOKEN
   CLOUDFLARE_R2_ACCESS_KEY
   CLOUDFLARE_R2_SECRET_KEY
   CLOUDFLARE_R2_BUCKET_NAME
   ```

3. **构建设置**
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/dist`
   - Functions directory: `netlify/functions`

### 自定义部署

项目采用前后端分离架构，前端可部署到任何静态托管服务：
- Vercel、GitHub Pages、Cloudflare Pages 等
- 后端函数需要支持 Serverless 的平台

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📝 开发规划

### ✅ 已完成功能
- ✅ 智能提示词翻译系统（数据库缓存）
- ✅ 用户反馈系统（点赞/踩）
- ✅ 图片下载CORS问题解决
- ✅ 模型参数智能推荐
- ✅ 504超时问题修复
- ✅ 批次级操作优化

### 🚧 开发中
- [ ] 🎨 更多AI模型接入（DALL-E 3、Stable Diffusion XL）
- [ ] 📱 移动端体验优化
- [ ] 🎯 图片尺寸动态调整
- [ ] 🚀 CDN加速优化

### 🔮 未来规划
- [ ] 🔐 用户账户系统
- [ ] 🎪 社区分享功能
- [ ] 🎯 ControlNet 精确控制
- [ ] 🖼️ 图生图功能
- [ ] 🎨 风格迁移工具
- [ ] 📊 高级数据分析

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证 - 查看 LICENSE 文件了解详情

## 🙏 致谢

- [Replicate](https://replicate.com/) - AI模型API服务
- [Supabase](https://supabase.com/) - 开源数据库平台
- [Netlify](https://netlify.com/) - Serverless部署平台
- [Tailwind CSS](https://tailwindcss.com/) - CSS框架

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给一个星标支持！**

Made with ❤️ by HyxiaoGe

</div>
