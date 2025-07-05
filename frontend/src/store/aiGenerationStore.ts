import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AIService } from '../features/ai-models/services/aiService';
import { UsageTracker } from '../features/usage-tracking/services/usageTracker';
import { DatabaseService } from '../services/database';
import type { 
  GenerationConfig, 
  GenerationResult, 
  GenerationStatus, 
  AIModel 
} from '../types';
import type { UserUsageStats, TagCategory } from '../types/database';

// 生成批次接口
interface GenerationBatch {
  id: string;
  prompt: string;
  config: GenerationConfig;
  results: GenerationResult[];
  createdAt: Date;
  model: string;
  // 新增：真实的数据库generation_id（UUID格式）
  realGenerationId?: string;
}

interface AIGenerationState {
  // 状态
  currentGeneration: GenerationStatus;
  generationHistory: GenerationResult[]; // 保持兼容性
  generationBatches: GenerationBatch[]; // 新增：按批次分组
  selectedModel: AIModel | null;
  availableModels: AIModel[];
  
  // 配置
  currentConfig: Partial<GenerationConfig>;
  
  // 用量追踪
  usageStats: UserUsageStats | null;
  
  // 加载状态
  isLoading: boolean;
  
  // 📄 新增：分页状态
  pagination: {
    currentPage: number;
    totalPages: number;
    total: number;
    hasMore: boolean;
    isLoadingMore: boolean;
  };
  
  // Actions
  setSelectedModel: (model: AIModel) => void;
  updateConfig: (config: Partial<GenerationConfig>) => void;
  startGeneration: (config: GenerationConfig) => Promise<void>;
  updateProgress: (progress: number, stage?: GenerationStatus['stage']) => void;
  completeGeneration: (results: GenerationResult[]) => void;
  failGeneration: (error: string) => void;
  cancelGeneration: () => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  removeBatch: (batchId: string) => void; // 新增：删除批次
  setAvailableModels: (models: AIModel[]) => void;
  updateUsageStats: () => Promise<void>;
  loadHistoryFromDatabase: () => Promise<void>; // 新增：从数据库加载历史记录
  // 📄 新增：分页方法
  loadHistoryWithPagination: (page?: number, replace?: boolean) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  resetPagination: () => void;
  setLoading: (loading: boolean) => void;
  prepareRegeneration: (result: GenerationResult) => Promise<void>; // 新增：准备重新生成
  updateImageFeedback: (batchId: string, resultIndex: number, feedback: { type: 'like' | 'dislike' | null, submittedAt?: Date }) => void; // 新增：更新图片反馈
  loadFeedbackStates: () => Promise<void>; // 新增：加载反馈状态
}

const initialGenerationStatus: GenerationStatus = {
  isGenerating: false,
  progress: 0,
  stage: 'idle',
  error: null,
};

const defaultConfig: Partial<GenerationConfig> = {
  aspectRatio: '1:1',
  numOutputs: 4,
  outputFormat: 'webp',
  numInferenceSteps: 4,
  model: 'flux-schnell',
  // 兼容性字段
  width: 1024,
  height: 1024,
  steps: 4,
  guidance: 7.5,
};

export const useAIGenerationStore = create<AIGenerationState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      currentGeneration: initialGenerationStatus,
      generationHistory: [],
      generationBatches: [], // 新增：批次数组
      selectedModel: null,
      availableModels: [],
      currentConfig: defaultConfig,
      usageStats: null,
      isLoading: false,
      // 📄 分页状态
      pagination: {
        currentPage: 1,
        totalPages: 1,
        total: 0,
        hasMore: false,
        isLoadingMore: false,
      },

      // Actions
      setSelectedModel: (model) => 
        set({ selectedModel: model }, false, 'setSelectedModel'),

      updateConfig: (config) =>
        set(
          (state) => ({
            currentConfig: { ...state.currentConfig, ...config }
          }),
          false,
          'updateConfig'
        ),

      setLoading: (loading) =>
        set({ isLoading: loading }, false, 'setLoading'),

      startGeneration: async (config) => {
        const usageTracker = UsageTracker.getInstance();
        
        // 检查用量限制
        const usageCheck = await usageTracker.canUse();
        if (!usageCheck.allowed) {
          get().failGeneration(usageCheck.reason || '使用次数已达上限');
          return;
        }        
        
        // 🔥 关键修复：保存完整的生成配置到store
        set(
          (state) => ({
            currentGeneration: {
              isGenerating: true,
              progress: 0,
              stage: 'processing',
              error: null,
              startTime: new Date(),
              estimatedTime: 30000, // Replicate通常20-30秒
            },
            currentConfig: { ...state.currentConfig, ...config } // 🎯 保存标签信息
          }),
          false,
          'startGeneration'
        );

        try {
          const { updateProgress } = get();
          
          // 智能进度模拟 - 模拟真实AI生成过程
          const simulateProgress = () => {
            let currentProgress = 0;
            const interval = setInterval(() => {
              if (!get().currentGeneration.isGenerating) {
                clearInterval(interval);
                return;
              }
              
              // 模拟不同阶段的进度速度
              if (currentProgress < 15) {
                // 理解提示词阶段 - 较快
                currentProgress += Math.random() * 3 + 1;
                updateProgress(Math.min(currentProgress, 15), 'processing');
              } else if (currentProgress < 50) {
                // 生成草图阶段 - 中等速度
                currentProgress += Math.random() * 2 + 0.5;
                updateProgress(Math.min(currentProgress, 50), 'processing');
              } else if (currentProgress < 85) {
                // 细化细节阶段 - 较慢
                currentProgress += Math.random() * 1.5 + 0.3;
                updateProgress(Math.min(currentProgress, 85), 'processing');
              } else if (currentProgress < 95) {
                // 最终优化阶段 - 缓慢
                currentProgress += Math.random() * 1 + 0.2;
                updateProgress(Math.min(currentProgress, 95), 'processing');
              }
            }, 500); // 每500ms更新一次进度
            
            return interval;
          };
          
          // 开始进度模拟
          const progressInterval = simulateProgress();
          
          try {
            // 调用真实的AI服务
            const results = await AIService.generateImage(config);
            
            // 清除进度模拟
            clearInterval(progressInterval);
            
            // 完成最后的进度更新
            updateProgress(100, 'processing');
            
            // 记录使用量
            await usageTracker.recordUsage();
            
            // 更新使用统计
            const newStats = await usageTracker.getUsageStats();
            set((state) => ({ ...state, usageStats: newStats }), false, 'updateUsageStats');
            
            // 短暂延迟让用户看到100%进度
            setTimeout(() => {
              get().completeGeneration(results);
            }, 500);
            
          } catch (error) {
            clearInterval(progressInterval);
            throw error;
          }
          
        } catch (error) {
          console.error('❌ 生成失败:', error);
          get().failGeneration(error instanceof Error ? error.message : '生成失败');
        }
      },

      updateProgress: (progress, stage) =>
        set(
          (state) => ({
            currentGeneration: {
              ...state.currentGeneration,
              progress,
              stage: stage || state.currentGeneration.stage,
            }
          }),
          false,
          'updateProgress'
        ),

      completeGeneration: (results) => {
        const state = get();
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 获取提示词 - 优先从results中获取，然后从currentConfig
        const prompt = results.length > 0 ? results[0].prompt : (state.currentConfig.prompt || '');
        
        // 创建新的生成批次
        const newBatch: GenerationBatch = {
          id: batchId,
          prompt: prompt,
          config: state.currentConfig as GenerationConfig,
          results: results,
          createdAt: new Date(),
          model: state.currentConfig.model || 'flux-schnell',
        };

        // 异步保存到数据库（不阻塞UI）
        const saveToDatabase = async () => {
          try {
            const databaseService = DatabaseService.getInstance();
            
            // 获取模型成本
            const models = await AIService.getAvailableModels();
            const model = models.find(m => m.id === state.currentConfig.model);
            const modelCost = model?.costPerGeneration || 0;

            // 🔥 新增：上传图片到R2存储
            let uploadedResults = results;
            try {
              console.log('🚀 开始上传图片到R2存储...');
              const imageUrls = results.map(result => result.imageUrl);
              const uploadResponse = await fetch('/.netlify/functions/upload-to-r2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageUrls,
                  prompt: prompt,
                  batchId: batchId,
                }),
              });

              if (uploadResponse.ok || uploadResponse.status === 206) {
                const uploadData = await uploadResponse.json();
                console.log('✅ R2上传响应:', uploadData);
                
                // 更新results，添加R2 URL信息
                uploadedResults = results.map((result, index) => {
                  const r2Result = uploadData.data.results[index];
                  if (!r2Result) return result;

                  // 🔥 优先使用publicUrl，其次使用签名URL，最后使用原始URL
                  const bestUrl = r2Result.publicUrl || r2Result.url || result.imageUrl;
                  
                  console.log(`🖼️ 图片 ${index + 1} URL更新:`, {
                    原始URL: result.imageUrl,
                    公共URL: r2Result.publicUrl || '未配置',
                    签名URL: r2Result.url ? '已生成' : '未生成',
                    最终使用: bestUrl
                  });

                  return {
                    ...result,
                    // 保留原始URL作为备用
                    originalImageUrl: result.imageUrl,
                    // 🔥 优先使用公共URL
                    imageUrl: bestUrl,
                    // 添加R2相关信息
                    r2Info: {
                      key: r2Result.key,
                      url: r2Result.url,
                      publicUrl: r2Result.publicUrl,
                      size: r2Result.size,
                      etag: r2Result.etag,
                    },
                  };
                });

                // 更新状态中的批次数据
                set((state) => ({
                  generationBatches: state.generationBatches.map(batch => 
                    batch.id === batchId 
                      ? { ...batch, results: uploadedResults }
                      : batch
                  ),
                }), false, 'updateBatchWithR2Urls');

                // 显示成功或部分成功消息
                if (uploadResponse.status === 206 && uploadData.warnings) {
                  console.warn('⚠️ 部分上传警告:', uploadData.warnings);
                  console.log(`📊 上传统计: ${uploadData.data.uploadedCount}/${uploadData.data.totalCount} 成功`);
                } else {
                  console.log('✅ 所有图片上传成功');
                }
              } else {
                const errorText = await uploadResponse.text().catch(() => '未知错误');
                console.error('❌ R2上传失败:', {
                  status: uploadResponse.status,
                  error: errorText
                });
                // 保持原始URL，不阻塞整个流程
                console.log('🔄 保持使用原始临时URL');
              }
            } catch (r2Error) {
              console.error('❌ R2上传过程中出错:', r2Error);
              // 即使R2上传失败，也继续保存到数据库
            }
            
            // 将选择的标签转换为数据库所需的格式
            const tagsUsed = [];
            const selectedTags = state.currentConfig.selectedTags;
            

            
            if (selectedTags) {
              // 辅助函数：根据标签值获取显示名称
              const getTagDisplayName = (value: string): string => {
                const tagNameMap: Record<string, string> = {
                  // 艺术风格组
                  'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed': '摄影级逼真',
                  'cinematic photography, film photography, dramatic lighting, cinematic composition': '电影级画质',
                  'oil painting, classical art, brush strokes, Renaissance style': '油画风格',
                  'watercolor painting, soft brushes, artistic, flowing colors': '水彩画',
                  'anime style, manga, japanese animation, cel shading': '动漫风格',
                  'pixel art, 8-bit, retro gaming style, pixelated': '像素艺术',
                  'pencil sketch, black and white, hand drawn, charcoal drawing': '素描风格',
                  'concept art, digital painting, matte painting, professional illustration': '概念艺术',
                  '3D render, CGI, ray tracing, volumetric lighting, subsurface scattering': '3D渲染',
                  'impressionist style, soft focus, painterly, artistic brushwork': '印象派',
                  
                  // 主题风格组
                  'cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets': '赛博朋克',
                  'sci-fi, futuristic, space technology, holographic displays, advanced technology': '科幻场景',
                  'fantasy, magical, mythical creatures, enchanted forest, mystical atmosphere': '奇幻风格',
                  'steampunk, vintage machinery, brass gears, Victorian era, industrial': '蒸汽朋克',
                  'chinese style, traditional, elegant, ink wash painting, oriental aesthetics': '中国风',
                  'modern, minimalist, clean design, sleek, contemporary': '现代简约',
                  'retro-futurism, vintage sci-fi, 80s aesthetic, synthwave, vaporwave': '复古未来',
                  'biophilic design, organic forms, nature-inspired, eco-friendly, sustainable': '自然生态',
                  'industrial design, metallic textures, concrete, raw materials, urban decay': '工业风格',
                  'gothic architecture, dark romantic, ornate details, mysterious atmosphere': '哥特风格',
                  
                  // 情绪氛围组
                  'warm lighting, bright, cheerful, golden hour, soft sunlight': '温暖明亮',
                  'dark, mysterious, moody lighting, deep shadows, dramatic chiaroscuro': '神秘暗黑',
                  'dreamy, ethereal, soft, beautiful, pastel colors, fairy-tale like': '梦幻唯美',
                  'epic, dramatic, cinematic, powerful, grand scale, awe-inspiring': '震撼史诗',
                  'peaceful, calm, serene, tranquil, meditation, zen atmosphere': '宁静平和',
                  'energetic, dynamic, vibrant, lively, high-energy, action-packed': '活力动感',
                  'melancholic, contemplative, nostalgic, bittersweet, introspective': '忧郁沉思',
                  'luxurious, elegant, sophisticated, premium, high-end, glamorous': '奢华高贵',
                  'wild, primal, untamed, rugged, natural, raw power': '原始野性',
                  'futuristic, high-tech, digital, cyber, holographic, technological': '未来科技',
                  
                  // 技术参数组
                  '85mm lens, portrait lens, shallow depth of field': '85mm镜头',
                  'wide-angle lens, 24mm, expansive view, environmental context': '广角镜头',
                  'macro photography, extreme close-up, intricate details, magnified': '微距摄影',
                  'telephoto lens, 200mm, compressed perspective, background blur': '长焦镜头',
                  'fisheye lens, distorted perspective, 180-degree view, curved edges': '鱼眼效果',
                  'shallow depth of field, f/1.4, bokeh effect, selective focus': '景深控制',
                  'deep focus, f/11, everything in focus, landscape photography': '全景深',
                  'golden hour lighting, warm sunlight, magic hour, soft shadows': '黄金时刻',
                  'blue hour, twilight, evening atmosphere, city lights': '蓝调时刻',
                  'studio lighting, softbox, professional lighting setup, controlled environment': '工作室灯光',
                  
                  // 构图参数组
                  'rule of thirds, balanced composition, dynamic framing': '三分法则',
                  'centered composition, symmetrical, balanced, focal point': '中心构图',
                  'low angle shot, worm eye view, heroic perspective, dramatic angle': '低角度仰拍',
                  'high angle shot, bird eye view, overhead perspective, aerial view': '高角度俯拍',
                  'close-up shot, intimate framing, detailed focus, emotional connection': '特写镜头',
                  'wide shot, establishing shot, environmental context, full scene': '全景镜头',
                  'medium shot, upper body, conversational framing, portrait style': '肩部特写',
                  'extreme close-up, macro detail, textural focus, intimate detail': '极近特写',
                  'dynamic composition, diagonal lines, movement, energy': '动态构图',
                  'minimalist composition, negative space, clean lines, simple elegance': '极简构图',
                  
                  // 增强属性组
                  'highly detailed, intricate details, ultra-detailed textures, photorealistic details': '超高细节',
                  'cinematic composition, film photography, movie-like quality, Hollywood style': '电影感',
                  'professional photography, studio quality, commercial grade, award-winning': '专业摄影',
                  'masterpiece, award winning, gallery quality, museum piece': '艺术大师',
                  'volumetric lighting, god rays, atmospheric lighting, light beams': '体积光效',
                  'color grading, cinematic colors, film look, professional color correction': '色彩分级',
                  'HDR photography, high dynamic range, enhanced contrast, vivid colors': 'HDR效果',
                  'film grain, analog photography, vintage film look, organic texture': '胶片质感',
                  'high quality, detailed, masterpiece, best quality, 4k resolution': '品质增强',
                  
                  // 负面提示词组
                  'blurry, out of focus, motion blur, soft focus': '避免模糊',
                  'low quality, pixelated, compressed, artifact, noise': '避免低质量',
                  'distorted, deformed, mutated, disfigured, anatomical errors': '避免变形',
                  'overexposed, blown out highlights, washed out, too bright': '避免过曝',
                  'cartoonish, anime, illustration, drawing, painted': '避免卡通化',
                  'copy paste, repetitive, tiled, pattern artifacts': '避免复制粘贴感',
                };
                
                // 如果找到完全匹配的映射，返回中文名称
                if (tagNameMap[value]) {
                  return tagNameMap[value];
                }
                
                // 如果没有完全匹配，尝试部分匹配
                for (const [englishValue, chineseName] of Object.entries(tagNameMap)) {
                  if (value.includes(englishValue) || englishValue.includes(value)) {
                    return chineseName;
                  }
                }
                
                // 如果都没找到，返回截取的英文值
                console.warn('⚠️ 未找到标签映射:', value);
                return value.length > 50 ? value.substring(0, 50) + '...' : value;
              };
              
              // 艺术风格
              if (selectedTags.artStyle) {
                tagsUsed.push({
                  name: getTagDisplayName(selectedTags.artStyle),
                  category: 'art_style' as const,
                  value: selectedTags.artStyle
                });
              }
              
              // 主题风格
              if (selectedTags.themeStyle) {
                tagsUsed.push({
                  name: getTagDisplayName(selectedTags.themeStyle),
                  category: 'theme_style' as const,
                  value: selectedTags.themeStyle
                });
              }
              
              // 情绪氛围
              if (selectedTags.mood) {
                tagsUsed.push({
                  name: getTagDisplayName(selectedTags.mood),
                  category: 'mood' as const,
                  value: selectedTags.mood
                });
              }
              
              // 技术参数
              if (selectedTags.technical) {
                selectedTags.technical.forEach(tech => {
                  tagsUsed.push({
                    name: getTagDisplayName(tech),
                    category: 'technical' as const,
                    value: tech
                  });
                });
              }
              
              // 构图参数
              if (selectedTags.composition) {
                selectedTags.composition.forEach(comp => {
                  tagsUsed.push({
                    name: getTagDisplayName(comp),
                    category: 'composition' as const,
                    value: comp
                  });
                });
              }
              
              // 增强属性
              if (selectedTags.enhancement) {
                selectedTags.enhancement.forEach(enh => {
                  tagsUsed.push({
                    name: getTagDisplayName(enh),
                    category: 'enhancement' as const,
                    value: enh
                  });
                });
              }
              
              // 负面提示词
              if (selectedTags.negative) {
                selectedTags.negative.forEach(neg => {
                  tagsUsed.push({
                    name: getTagDisplayName(neg),
                    category: 'negative' as const,
                    value: neg
                  });
                });
              }
              
              // 品质增强
              if (selectedTags.isQualityEnhanced) {
                tagsUsed.push({
                  name: '品质增强',
                  category: 'enhancement' as const,
                  value: 'high quality, detailed, masterpiece, best quality, 4k resolution'
                });
              }
            }
            

            
            const savedGeneration = await databaseService.saveGeneration({
              prompt: prompt,
              model_name: state.currentConfig.model || 'flux-schnell',
              model_cost: modelCost,
              image_urls: uploadedResults.map(r => r.imageUrl), // 🔥 使用R2 URL
              status: 'completed',
              is_public: true,
              tags_used: tagsUsed, // 传递标签信息
              // 🔥 新增：保存R2相关信息
              original_image_urls: uploadedResults.map(r => r.originalImageUrl).filter((url): url is string => Boolean(url)),
              r2_keys: uploadedResults.map(r => r.r2Info?.key).filter((key): key is string => Boolean(key)),
              r2_data: uploadedResults.map(r => r.r2Info).filter(Boolean),
            });

            // 更新批次和结果的真实 generation_id
            if (savedGeneration && savedGeneration.id) {
              // 更新批次的 realGenerationId
              set((state) => ({
                generationBatches: state.generationBatches.map(batch => 
                  batch.id === batchId ? { 
                    ...batch, 
                    realGenerationId: savedGeneration.id,
                    results: batch.results.map(result => ({
                      ...result,
                      realGenerationId: savedGeneration.id
                    }))
                  } : batch
                ),
                // 同步更新 generationHistory
                generationHistory: state.generationHistory.map(historyItem => 
                  results.some(result => result.id === historyItem.id) ? {
                    ...historyItem,
                    realGenerationId: savedGeneration.id
                  } : historyItem
                )
              }), false, 'updateRealGenerationId');
              
            }

            // 更新提示词统计
            await databaseService.updatePromptStats(prompt);
          } catch (dbError) {
            console.error('❌ 保存生成记录失败:', dbError);
          }
        };

        // 异步保存，不阻塞UI
        saveToDatabase();

        set(
          (state) => ({
            currentGeneration: {
              ...initialGenerationStatus,
              stage: 'completed',
              progress: 100,
            },
            // 保持向后兼容性
            generationHistory: [...results, ...state.generationHistory],
            // 新增：按批次存储
            generationBatches: [newBatch, ...state.generationBatches],
          }),
          false,
          'completeGeneration'
        );
      },

      failGeneration: (error) =>
        set(
          {
            currentGeneration: {
              ...initialGenerationStatus,
              stage: 'error',
              error,
            }
          },
          false,
          'failGeneration'
        ),

      cancelGeneration: () =>
        set(
          { currentGeneration: initialGenerationStatus },
          false,
          'cancelGeneration'
        ),

      clearHistory: () =>
        set({ generationHistory: [] }, false, 'clearHistory'),

      removeFromHistory: (id) =>
        set(
          (state) => ({
            generationHistory: state.generationHistory.filter(item => item.id !== id)
          }),
          false,
          'removeFromHistory'
        ),

      removeBatch: (batchId) =>
        set(
          (state) => ({
            generationBatches: state.generationBatches.filter(batch => batch.id !== batchId),
            // 同时更新generationHistory以保持兼容性
            generationHistory: state.generationHistory.filter(item => 
              !state.generationBatches.find(batch => 
                batch.id === batchId && batch.results.some(result => result.id === item.id)
              )
            ),
          }),
          false,
          'removeBatch'
        ),

      setAvailableModels: (models) =>
        set({ availableModels: models }, false, 'setAvailableModels'),

      updateUsageStats: async () => {
        const usageTracker = UsageTracker.getInstance();
        const stats = await usageTracker.getUsageStats();
        set({ usageStats: stats }, false, 'updateUsageStats');
      },

      loadHistoryFromDatabase: async () => {
        // 设置加载状态
        set({ isLoading: true }, false, 'setLoading');
        
        try {
          const databaseService = DatabaseService.getInstance();
          const records = await databaseService.getUserGenerations();
          
          if (records.length === 0) {
            set({ isLoading: false }, false, 'setLoading');
            return;
          }
          
          // 按提示词和时间分组创建批次
          const batchesMap = new Map<string, GenerationBatch>();
          const historyResults: GenerationResult[] = [];
          
          // 按时间降序排列
          records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          for (const record of records) {
            // 处理时区转换：Supabase存储UTC时间，转换为本地时间
            const utcDate = new Date(record.created_at);
            const localDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
            
            // 处理图片URLs数组，为每张图片创建单独的结果
            const imageUrls = Array.isArray(record.image_urls) ? record.image_urls : [record.image_urls];
            
            // 为每张图片创建GenerationResult对象
            const batchResults: GenerationResult[] = [];
            imageUrls.forEach((imageUrl, index) => {
              const result: GenerationResult = {
                id: `${record.id}_${index}`, // 为每张图片创建唯一ID
                imageUrl: imageUrl,
                prompt: record.prompt,
                createdAt: localDate,
                status: record.status as 'completed' | 'failed',
                config: {
                  model: record.model_name,
                  prompt: record.prompt,
                  aspectRatio: '1:1',
                  numOutputs: imageUrls.length,
                  outputFormat: 'webp',
                  numInferenceSteps: 4,
                  width: 1024,
                  height: 1024,
                  steps: 4,
                  guidance: 7.5,
                },
                // 初始化反馈状态为未设置
                userFeedback: undefined,
                // 保存真实的数据库generation_id
                realGenerationId: record.id
              };
              
              batchResults.push(result);
              historyResults.push(result);
            });
            
            // 创建批次键：基于提示词和时间（精确到分钟）
            const timeKey = localDate.toISOString().substring(0, 16);
            const batchKey = `${record.prompt}_${timeKey}`;
            
            if (!batchesMap.has(batchKey)) {
              // 创建新批次
              const batch: GenerationBatch = {
                id: `batch_${record.id}_${Math.random().toString(36).substr(2, 9)}`,
                prompt: record.prompt,
                config: batchResults[0].config,
                results: batchResults, // 包含所有图片
                createdAt: localDate,
                model: record.model_name,
                // 保存真实的数据库generation_id
                realGenerationId: record.id
              };
              batchesMap.set(batchKey, batch);
            } else {
              // 添加到现有批次
              const existingBatch = batchesMap.get(batchKey)!;
              existingBatch.results.push(...batchResults);
            }
          }
          
          // 转换为数组并按时间降序排序
          const batches = Array.from(batchesMap.values())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          
          // 更新状态
          set(
            {
              generationHistory: historyResults,
              generationBatches: batches,
              isLoading: false,
            },
            false,
            'loadHistoryFromDatabase'
          );
          

          
          // 异步加载反馈状态
          get().loadFeedbackStates().catch(console.error);
          
        } catch (error) {
          console.error('❌ 从数据库加载历史记录失败:', error);
          // 即使出错也要清除加载状态
          set({ isLoading: false }, false, 'setLoading');
        }
      },

      prepareRegeneration: async (result: GenerationResult) => {
        try {
          // 从结果中提取配置
          const originalConfig = result.config;
          
          // 获取可用模型列表
          const { availableModels } = get();
          if (availableModels.length === 0) {
            // 如果还没有加载模型列表，先加载
            const models = await import('../features/ai-models/services/aiService').then(m => m.AIService.getAvailableModels());
            get().setAvailableModels(models);
          }
          
          // 查找对应的模型
          const targetModel = get().availableModels.find(m => m.id === originalConfig.model);
          
          // 智能解析提示词 - 提取基础描述和标签信息
          const { parsePromptFeatures } = await import('../features/ai-models/utils/promptParser');
          const parsedFeatures = parsePromptFeatures(result.prompt, originalConfig);
          
          // 更新当前配置和选中的模型
          set(
            (state) => ({
              currentConfig: {
                ...originalConfig,
                // 使用解析出的基础提示词，而不是完整的技术标签堆砌
                prompt: parsedFeatures.basePrompt || result.prompt,
                // 确保配置完整性，使用默认值补充缺失字段
                aspectRatio: originalConfig.aspectRatio || '1:1',
                numOutputs: originalConfig.numOutputs || 4,
                outputFormat: originalConfig.outputFormat || 'webp',
                numInferenceSteps: originalConfig.numInferenceSteps || 4,
                // 将解析出的标签信息保存，供PromptInput使用
                parsedFeatures: parsedFeatures,
              },
              selectedModel: targetModel || state.availableModels[0] || null,
            }),
            false,
            'prepareRegeneration'
          );
          
        } catch (error) {
          console.error('❌ 准备重新生成失败:', error);
          // 即使失败也不阻塞用户操作，使用当前提示词
          set(
            (state) => ({
              currentConfig: {
                ...state.currentConfig,
                prompt: result.prompt,
              }
            }),
            false,
            'prepareRegeneration'
          );
        }
      },

      updateImageFeedback: (batchId, resultIndex, feedback) => 
        set(
          (state) => ({
            generationBatches: state.generationBatches.map(batch => {
              if (batch.id === batchId) {
                return {
                  ...batch,
                  results: batch.results.map((result, index) => {
                    if (index === resultIndex) {
                      return {
                        ...result,
                        userFeedback: feedback.type ? {
                          type: feedback.type,
                          submittedAt: feedback.submittedAt || new Date()
                        } : undefined
                      };
                    }
                    return result;
                  })
                };
              }
              return batch;
            }),
            // 同步更新 generationHistory 以保持兼容性
            generationHistory: state.generationHistory.map(historyItem => {
              // 找到对应的批次和结果
              const batch = state.generationBatches.find(b => b.id === batchId);
              if (batch && batch.results[resultIndex]?.id === historyItem.id) {
                return {
                  ...historyItem,
                  userFeedback: feedback.type ? {
                    type: feedback.type,
                    submittedAt: feedback.submittedAt || new Date()
                  } : undefined
                };
              }
              return historyItem;
            })
          }),
          false,
          'updateImageFeedback'
        ),

      loadFeedbackStates: async () => {
        try {
          const databaseService = DatabaseService.getInstance();
          const { generationBatches } = get();
          
          console.log(`🔍 开始加载反馈状态 - 共${generationBatches.length}个批次`);
          
          // 🚀 性能优化：收集所有唯一的generation_id，避免重复查询
          const generationIds = new Set<string>();
          generationBatches.forEach(batch => {
            const generationId = batch.realGenerationId;
            if (generationId) {
              generationIds.add(generationId);
            }
          });
          
          if (generationIds.size === 0) {
            console.log('⚠️ 没有找到有效的generation_id，跳过反馈加载');
            return;
          }
          
          console.log(`📊 批量查询${generationIds.size}个generation的反馈（之前会有${generationBatches.reduce((sum, batch) => sum + batch.results.length, 0)}次查询）`);
          
          // 🚀 使用新的批量查询API，一次请求获取所有反馈
          const feedbackMap = await databaseService.getBatchImageFeedback(Array.from(generationIds));
          
          // 更新批次数据
          const updatedBatches = generationBatches.map(batch => {
            const generationId = batch.realGenerationId;
            
            if (!generationId || !feedbackMap.has(generationId)) {
              return batch; // 没有反馈数据，保持原样
            }
            
            const feedbacks = feedbackMap.get(generationId)!;
            if (feedbacks.length === 0) {
              return batch; // 没有反馈，保持原样
            }
            
            // 使用最新的反馈（第一个，因为已按时间降序排列）
            const latestFeedback = feedbacks[0];
            
            // 为整个批次的所有图片应用相同的反馈状态
            const updatedResults = batch.results.map(result => ({
              ...result,
              userFeedback: {
                type: latestFeedback.feedback_type,
                submittedAt: new Date(latestFeedback.created_at)
              }
            }));
            
            return {
              ...batch,
              results: updatedResults
            };
          });
          
          // 更新状态
          set(
            (state) => ({
              generationBatches: updatedBatches,
              // 同步更新 generationHistory
              generationHistory: updatedBatches.flatMap(batch => batch.results)
            }),
            false,
            'loadFeedbackStates'
          );
          
          console.log(`✅ 反馈状态加载完成 - 优化后只需1次数据库查询`);
          
        } catch (error) {
          console.error('❌ 加载反馈状态失败:', error);
        }
      },

      // 📄 新增：分页方法实现
      loadHistoryWithPagination: async (page = 1, replace = false) => {
        try {
          const databaseService = DatabaseService.getInstance();
          
          // 设置加载状态
          if (replace) {
            set({ isLoading: true }, false, 'loadHistoryWithPagination');
          } else {
            set((state) => ({
              pagination: { ...state.pagination, isLoadingMore: true }
            }), false, 'loadHistoryWithPagination');
          }

          console.log(`📄 ${replace ? '重新' : '分页'}加载历史记录 - 第${page}页`);

          // 获取分页数据
          const result = await databaseService.getUserGenerationsWithPagination({ page, limit: 10 });
          
          if (result.data.length === 0 && page === 1) {
            // 第一页没有数据
            set({
              generationHistory: [],
              generationBatches: [],
              isLoading: false,
              pagination: {
                currentPage: 1,
                totalPages: 1,
                total: 0,
                hasMore: false,
                isLoadingMore: false,
              }
            }, false, 'loadHistoryWithPagination');
            return;
          }

          // 处理数据，转换为批次格式
          const batchesMap = new Map<string, GenerationBatch>();
          const historyResults: GenerationResult[] = [];
          
          // 按时间降序排列
          result.data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          for (const record of result.data) {
            // 处理时区转换
            const utcDate = new Date(record.created_at);
            const localDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
            
            // 处理图片URLs数组
            const imageUrls = Array.isArray(record.image_urls) ? record.image_urls : [record.image_urls];
            
            // 为每张图片创建GenerationResult对象
            const batchResults: GenerationResult[] = [];
            imageUrls.forEach((imageUrl, index) => {
              const result: GenerationResult = {
                id: `${record.id}_${index}`,
                imageUrl: imageUrl,
                prompt: record.prompt,
                createdAt: localDate,
                status: record.status as 'completed' | 'failed',
                config: {
                  model: record.model_name,
                  prompt: record.prompt,
                  aspectRatio: '1:1',
                  numOutputs: imageUrls.length,
                  outputFormat: 'webp',
                  numInferenceSteps: 4,
                  width: 1024,
                  height: 1024,
                  steps: 4,
                  guidance: 7.5,
                },
                userFeedback: undefined,
                realGenerationId: record.id
              };
              
              batchResults.push(result);
              historyResults.push(result);
            });
            
            // 创建批次
            const timeKey = localDate.toISOString().substring(0, 16);
            const batchKey = `${record.prompt}_${timeKey}`;
            
            if (!batchesMap.has(batchKey)) {
              const batch: GenerationBatch = {
                id: `batch_${record.id}_${Math.random().toString(36).substr(2, 9)}`,
                prompt: record.prompt,
                config: batchResults[0].config,
                results: batchResults,
                createdAt: localDate,
                model: record.model_name,
                realGenerationId: record.id
              };
              batchesMap.set(batchKey, batch);
            } else {
              const existingBatch = batchesMap.get(batchKey)!;
              existingBatch.results.push(...batchResults);
            }
          }
          
          // 转换为数组并排序
          const newBatches = Array.from(batchesMap.values())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          
          // 更新状态
          set((state) => ({
            generationHistory: replace ? historyResults : [...state.generationHistory, ...historyResults],
            generationBatches: replace ? newBatches : [...state.generationBatches, ...newBatches],
            isLoading: false,
            pagination: {
              currentPage: result.currentPage,
              totalPages: result.totalPages,
              total: result.total,
              hasMore: result.hasMore,
              isLoadingMore: false,
            }
          }), false, 'loadHistoryWithPagination');
          
          // 异步加载反馈状态
          if (newBatches.length > 0) {
            get().loadFeedbackStates().catch(console.error);
          }
          
        } catch (error) {
          console.error('❌ 分页加载历史记录失败:', error);
          set((state) => ({
            isLoading: false,
            pagination: { ...state.pagination, isLoadingMore: false }
          }), false, 'loadHistoryWithPagination');
        }
      },

      loadMoreHistory: async () => {
        const { pagination } = get();
        if (!pagination.hasMore || pagination.isLoadingMore) {
          return;
        }
        
        await get().loadHistoryWithPagination(pagination.currentPage + 1, false);
      },

      resetPagination: () => {
        set({
          generationHistory: [],
          generationBatches: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            total: 0,
            hasMore: false,
            isLoadingMore: false,
          }
        }, false, 'resetPagination');
      },
    }),
    {
      name: 'ai-generation-store',
    }
  )
); 