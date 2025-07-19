# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prism AI Generator is a modern AI image generation platform built for Chinese users. It integrates multiple AI models and provides intelligent prompt optimization, making it easy for users to create professional AI artwork.

**Key Features:**
- Multi-model AI image generation (Flux Schnell, Google Imagen via Replicate)
- Intelligent prompt optimization with LLM integration
- Comprehensive tag classification system for art styles, themes, moods, and technical parameters
- Serverless architecture with Netlify Functions
- Real-time usage tracking and daily limits
- Batch generation management
- Responsive React frontend

## Architecture

### Frontend (React + TypeScript + Vite)
- **Framework**: React 18 with TypeScript, built with Vite
- **State Management**: Zustand for global state
- **Styling**: Tailwind CSS with custom components
- **Key Store**: `frontend/src/store/aiGenerationStore.ts` - Main application state

### Backend (Serverless Functions)
- **Platform**: Netlify Functions (Node.js serverless)
- **Functions Location**: `netlify/functions/`
- **Key Functions**:
  - `generate-image.js` - Main AI image generation endpoint
  - `optimize-prompt.js` - LLM-powered prompt optimization
  - `analyze-prompt.js` - Prompt analysis and suggestions
  - `translate-prompt.js` - Chinese/English translation
  - `upload-to-r2.js` - Cloudflare R2 storage integration

### Data Storage
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Cloudflare R2 for generated images
- **AI Models**: Replicate API

### Core Services Architecture
- **Adapter Pattern**: `frontend/src/features/ai-models/adapters/` - Modular AI model integration
- **Service Layer**: `frontend/src/features/ai-models/services/AdapterManager.ts` - Manages AI model adapters
- **Feature-based Structure**: Organized by domain (ai-models, image-processing, usage-tracking)

## Development Commands

### Frontend Development
```bash
# Install dependencies
cd frontend && npm install

# Start development server
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Lint code
cd frontend && npm run lint

# Preview production build
cd frontend && npm run preview
```

### Full Stack Development
```bash
# Install all dependencies (run from project root)
npm install
cd frontend && npm install

# Start with Netlify Dev (recommended - includes functions)
netlify dev

# Runs on http://localhost:8888
```

### Testing
```bash
# No specific test framework configured
# When adding tests, check package.json for test scripts
```

## Key Configuration Files

- `frontend/package.json` - Frontend dependencies and scripts
- `frontend/vite.config.ts` - Vite build configuration
- `frontend/tailwind.config.js` - Tailwind CSS configuration
- `netlify.toml` - Netlify deployment and function configuration
- `frontend/tsconfig.json` - TypeScript configuration

## Environment Variables

Required environment variables (create `frontend/.env.local`):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
REPLICATE_API_TOKEN=your_replicate_token
```

## Important Implementation Details

### AI Model Integration
- Uses adapter pattern for extensible AI model support
- Current adapters: Replicate (supports Flux Schnell, Google Imagen)
- AdapterManager handles model lifecycle and status monitoring
- Located in: `frontend/src/features/ai-models/`

### State Management
- Zustand store in `frontend/src/store/aiGenerationStore.ts`
- Handles generation state, history, batching, and pagination
- Includes usage tracking and feedback management

### Image Storage Flow
1. Generate images via Replicate API
2. Upload to Cloudflare R2 for permanent storage
3. Update database records with R2 URLs
4. Display with fallback to original temporary URLs

### Prompt Enhancement System
- Tag-based prompt building with categories: art style, theme, mood, technical, composition, enhancement
- AI-powered optimization via OpenAI/LLM integration
- Chinese/English bilingual support

### Database Schema (Supabase)
Key tables:
- `users` - Device fingerprint-based user management
- `generations` - Image generation records
- `daily_stats` - Usage statistics
- `tag_stats` - Tag usage analytics
- `image_feedback` - User feedback on generated images

## Deployment

### Netlify Configuration
- Build command: `cd frontend && npm install && npm run build`
- Publish directory: `frontend/dist`
- Functions directory: `netlify/functions`
- Function timeout: 60 seconds

### Environment Setup
1. Connect repository to Netlify
2. Configure environment variables in Netlify dashboard
3. Set up Supabase database with provided schema
4. Configure Cloudflare R2 bucket for image storage

## Common Development Workflows

### Adding New AI Models
1. Create new adapter in `frontend/src/features/ai-models/adapters/`
2. Extend `BaseAdapter` class
3. Register in `AdapterManager`
4. Update model configuration in `aiService.ts`

### Modifying Prompt Tags
1. Update tag definitions in `frontend/src/features/ai-models/components/PromptFeatures.tsx`
2. Update tag mapping in `aiGenerationStore.ts` (getTagDisplayName function)
3. Consider database migration for new tag categories

### Function Development
1. Create new function in `netlify/functions/`
2. Test locally with `netlify dev`
3. Ensure proper CORS headers (configured in `netlify.toml`)
4. Handle timeout constraints (60s limit)

### Database Changes
1. Update types in `frontend/src/types/database.ts`
2. Modify service methods in `frontend/src/services/database.ts`
3. Update Zustand store if needed
4. Test with Supabase local development

## 语言和Git规范要求

### 语言要求
**必须使用中文进行以下内容：**
- 所有代码注释必须使用中文
- 错误信息和解释说明使用中文
- 新创建的文档和注释使用中文
- Git提交信息必须使用中文（标题和描述）

### Git提交规范

**提交信息格式：**
```
类型: 简短描述

- 详细说明1
- 详细说明2
- 详细说明3

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**中文提交类型：**
- `feat:` 新功能
- `fix:` 修复bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构代码
- `test:` 测试相关
- `chore:` 构建工具或辅助工具的变动

**提交示例：**
```
feat: 添加RAG检索增强功能

- 实现向量数据库集成
- 优化文档分块策略
- 添加混合搜索支持

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**必要要求：**
- 每个提交都必须包含Co-authored-by信息
- 提交信息必须使用中文描述
- 遵循约定式提交格式