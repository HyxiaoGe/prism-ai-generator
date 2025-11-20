import { useEffect, useState } from 'react';
import { Zap, History, Plus, Search, Grid, Image, Home } from 'lucide-react';
import {
  PromptInput,
  LoadingIndicator,
  PromptFeatures,
  ModelSelector,
  SettingsTabs,
  ImageGrid,
} from './features/ai-models';
import { useAIGenerationStore } from './store/aiGenerationStore';
import { useAuthStore } from './store/authStore';
import { UserMenu } from './components/auth';
import { ToastContainer } from './components/ui';
import { useToast } from './hooks/useToast';
import { initializeDebugTools } from './utils/debugDatabase';
import type { GenerationResult } from './types';

function App() {
  const {
    currentGeneration,
    generationHistory,
    generationBatches,
    usageStats,
    isLoading,
    currentConfig,
    pagination,
    updateUsageStats,
    loadHistoryFromDatabase,
    loadHistoryWithPagination,
    loadMoreHistory,
    resetPagination,
    prepareRegeneration
  } = useAIGenerationStore();
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'home' | 'gallery' | 'create'>('home');
  const [searchPrompt, setSearchPrompt] = useState('');
  const [sidebarPrompt, setSidebarPrompt] = useState(''); // 专门用于右侧栏的提示词
  const [suggestedTags, setSuggestedTags] = useState<any>(null); // 推荐的标签组合
  const [galleryLoaded, setGalleryLoaded] = useState(false); // 标记画廊数据是否已加载

  // Toast 通知系统
  const toast = useToast();

  // 认证状态
  const {
    initialize: initializeAuth,
    handleAuthCallback,
    isLoading: authLoading,
    appUser
  } = useAuthStore();

  // 初始化调试工具
  useEffect(() => {
    return initializeDebugTools();
  }, []);

  // 初始化认证和处理 OAuth 回调
  useEffect(() => {
    const initAuth = async () => {
      // 检查是否是 OAuth 回调
      const isCallback = window.location.pathname === '/auth/callback';

      if (isCallback) {
        try {
          console.log('🔐 处理 OAuth 回调...');
          await handleAuthCallback();
          // 回调处理完成后，重定向到首页
          window.history.replaceState({}, '', '/');
        } catch (error) {
          console.error('OAuth 回调处理失败:', error);
          window.history.replaceState({}, '', '/');
        }
      } else {
        // 正常初始化认证状态
        await initializeAuth();
      }
    };

    initAuth();
  }, [initializeAuth, handleAuthCallback]);

  // 初始化应用数据 - 只更新使用统计，画廊数据懒加载
  useEffect(() => {
    // 等待认证完成且有用户信息后才更新统计
    if (authLoading || !appUser) {
      return;
    }

    const initializeApp = async () => {
      try {
        // 只更新使用统计
        await updateUsageStats();
        console.log('✅ 使用统计更新完成');
      } catch (error) {
        console.error('❌ 使用统计更新失败:', error);
        toast.error('使用统计加载失败', '请刷新页面重试');
      }
    };

    initializeApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, appUser?.id]);

  // 懒加载画廊数据 - 只有切换到画廊视图时才加载
  useEffect(() => {
    // 只有在画廊视图且未加载过数据时才加载
    if (viewMode !== 'gallery' || galleryLoaded || authLoading || !appUser) {
      return;
    }

    const loadGalleryData = async () => {
      try {
        await loadHistoryWithPagination(1, true);
        setGalleryLoaded(true);
        console.log('✅ 画廊数据加载完成');
      } catch (error) {
        console.error('❌ 画廊数据加载失败:', error);
        toast.error('画廊加载失败', '请检查网络连接后重试');
      }
    };

    loadGalleryData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, galleryLoaded, authLoading, appUser?.id]);

  // 监听生成状态变化，自动管理视图模式
  useEffect(() => {
    if (currentGeneration.isGenerating) {
      // 生成开始时切换到创作模式，关闭设置面板
      setViewMode('create');
      setShowSettings(false);
    } else if (currentGeneration.stage === 'completed') {
      // 生成完成时切换到画廊模式，清空侧边栏提示词
      setViewMode('gallery');
      setSidebarPrompt('');
      setSuggestedTags(null);
      // 重置画廊加载状态，强制刷新数据（因为有新生成的图片）
      setGalleryLoaded(false);
    } else if (currentGeneration.stage === 'error') {
      // 生成失败时回到首页
      setViewMode('home');
    }
  }, [currentGeneration.isGenerating, currentGeneration.stage]);

  // 处理搜索框生成（简化版，主要通过PromptInput处理）
  const handleSearchGenerate = () => {
    if (!searchPrompt.trim()) return;
    // 将搜索框内容设置到右侧栏，然后打开设置面板
    setSidebarPrompt(searchPrompt);
    setSuggestedTags(null); // 搜索框输入不使用推荐标签
    setShowSettings(true);
  };

  // 处理模板点击
  const handleTemplateClick = (template: any) => {
    setSidebarPrompt(template.prompt); // 只填充右侧栏，不影响搜索框
    setSuggestedTags(template.suggestedTags); // 设置推荐标签
    setShowSettings(true); // 打开设置面板
  };

  // 处理右下角+号点击
  const handleFloatingButtonClick = () => {
    setSidebarPrompt(''); // 清空右侧栏提示词
    setSuggestedTags(null); // 清空推荐标签
    setShowSettings(!showSettings);
  };

  // 处理导航切换
  const handleNavigationChange = (newMode: 'home' | 'gallery') => {
    setViewMode(newMode);
    setShowSettings(false); // 切换页面时关闭设置面板
  };

  // 处理批次重新生成
  const handleRegenerate = async (batch: any) => {
    try {
      // 从批次中构造一个GenerationResult对象用于prepareRegeneration
      const result: GenerationResult = {
        id: `${batch.id}-regenerate`,
        imageUrl: batch.results[0]?.imageUrl || '',
        prompt: batch.prompt,
        config: batch.config,
        createdAt: batch.createdAt,
        status: 'completed',
      };

      // 准备重新生成配置
      await prepareRegeneration(result);

      // 获取更新后的配置，使用解析出的基础提示词
      const { currentConfig: updatedConfig } = useAIGenerationStore.getState();

      // 设置侧边栏提示词（使用解析出的基础描述，而不是完整的技术标签）
      setSidebarPrompt(updatedConfig.prompt || batch.prompt);
      setSuggestedTags(null); // 重新生成不使用推荐标签

      // 打开设置面板
      setShowSettings(true);

    } catch (error) {
      console.error('❌ 准备重新生成失败:', error);
      toast.error('准备重新生成失败', '请重试或联系客服');
    }
  };

  // 检查是否有内容（使用generationBatches）
  const hasContent = generationBatches.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部固定导航栏 - 类似现代创作工具 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            
            {/* 左侧品牌 */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Prism</h1>
                  <div className="text-xs text-gray-500">AI创作平台</div>
                </div>
              </div>
            </div>

            {/* 中间搜索/生成区域 */}
            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="描述你想要生成的图像..."
                  value={searchPrompt}
                  onChange={(e) => setSearchPrompt(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchGenerate();
                    }
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <button 
                  onClick={handleSearchGenerate}
                  disabled={!searchPrompt.trim()}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-xl transition-colors ${
                    !searchPrompt.trim()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700'
                  } text-white`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 右侧工具栏 */}
            <div className="flex items-center space-x-3">
              {/* 用量显示 - 使用 appUser 数据保持与 UserMenu 一致 */}
              {appUser && (
                <div className="hidden lg:flex items-center space-x-2 text-sm bg-gray-100 px-3 py-2 rounded-xl">
                  <div className={`w-2 h-2 rounded-full ${
                    (appUser.daily_quota - appUser.used_today) > 0 ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-gray-600">{appUser.daily_quota - appUser.used_today}/{appUser.daily_quota}</span>
                </div>
              )}
              
              {/* 导航切换 */}
              <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => handleNavigationChange('home')}
                  className={`p-2 rounded-lg transition-all duration-300 transform hover:scale-105 ${
                    viewMode === 'home' ? 'bg-white shadow-sm text-purple-600' : 'hover:bg-gray-200 text-gray-600'
                  }`}
                  title="首页"
                >
                  <Home className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleNavigationChange('gallery')}
                  className={`p-2 rounded-lg transition-all duration-300 transform hover:scale-105 ${
                    viewMode === 'gallery' ? 'bg-white shadow-sm text-purple-600' : 'hover:bg-gray-200 text-gray-600'
                  }`}
                  title="我的作品"
                >
                  <Image className="w-4 h-4" />
                </button>
              </div>

              {/* 用户菜单 */}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="pt-20">
        
        {/* 根据视图模式显示不同内容 */}
        {viewMode === 'home' && (
          <div className="max-w-4xl mx-auto px-6 py-16 animate-fade-in">
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                用AI创造无限可能
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                输入你的想法，我们的AI将为你生成令人惊艳的图像作品
              </p>
            </div>

            {/* 快速开始模板 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {[
                { 
                  emoji: '🏔️', 
                  title: '电影级风景', 
                  desc: '专业摄影，震撼视觉', 
                  prompt: '雄伟的雪山日出，天空云海翻腾，晨光洒向大地',
                  suggestedTags: {
                    artStyle: 'cinematic photography, film photography, dramatic lighting, cinematic composition',
                    themeStyle: 'modern, minimalist, clean design, sleek, contemporary', 
                    mood: 'epic, dramatic, cinematic, powerful, grand scale, awe-inspiring',
                    technical: ['wide-angle lens, 24mm, expansive view, environmental context', 'golden hour lighting, warm sunlight, magic hour, soft shadows'],
                    enhancements: ['cinematic composition, film photography, movie-like quality, Hollywood style', 'HDR photography, high dynamic range, enhanced contrast, vivid colors']
                  }
                },
                { 
                  emoji: '👩‍🎨', 
                  title: '专业人像', 
                  desc: '工作室级人像摄影', 
                  prompt: '优雅女性艺术家肖像，柔和灯光下专注创作的神情',
                  suggestedTags: {
                    artStyle: 'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed',
                    themeStyle: 'modern, minimalist, clean design, sleek, contemporary',
                    mood: 'luxurious, elegant, sophisticated, premium, high-end, glamorous', 
                    technical: ['85mm lens, portrait lens, shallow depth of field', 'studio lighting, softbox, professional lighting setup, controlled environment'],
                    enhancements: ['professional photography, studio quality, commercial grade, award-winning', 'highly detailed, intricate details, ultra-detailed textures, photorealistic details']
                  }
                },
                { 
                  emoji: '🌆', 
                  title: '赛博朋克', 
                  desc: '未来科技美学', 
                  prompt: '霓虹灯闪烁的未来都市夜景，雨水倒映着彩色光芒',
                  suggestedTags: {
                    artStyle: '3D render, CGI, ray tracing, volumetric lighting, subsurface scattering',
                    themeStyle: 'cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets',
                    mood: 'futuristic, high-tech, digital, cyber, holographic, technological',
                    technical: ['blue hour, twilight, evening atmosphere, city lights'],
                    enhancements: ['volumetric lighting, god rays, atmospheric lighting, light beams', 'cinematic composition, film photography, movie-like quality, Hollywood style']
                  }
                },
                { 
                  emoji: '🎭', 
                  title: '概念艺术', 
                  desc: '游戏级概念设计', 
                  prompt: '神秘的奇幻森林，古老的魔法光芒在林间穿梭',
                  suggestedTags: {
                    artStyle: 'concept art, digital painting, matte painting, professional illustration',
                    themeStyle: 'fantasy, magical, mythical creatures, enchanted forest, mystical atmosphere',
                    mood: 'dreamy, ethereal, soft, beautiful, pastel colors, fairy-tale like',
                    technical: [],
                    enhancements: ['highly detailed, intricate details, ultra-detailed textures, photorealistic details', 'masterpiece, award winning, gallery quality, museum piece']
                  }
                },
              ].map((template, index) => (
                <div
                  key={index}
                  onClick={() => handleTemplateClick(template)}
                  className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-purple-200 transform hover:scale-105 hover:-translate-y-1"
                >
                  <div className="text-center">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                      {template.emoji}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {template.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {template.desc}
                    </p>
                    <button className="w-full bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700 py-2 px-4 rounded-lg transition-colors text-sm font-medium">
                      点击体验 →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 成功案例或其他内容 */}
            {hasContent && (
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  您已经创作了 {generationBatches.length} 个作品批次
                </p>
                <button
                  onClick={() => handleNavigationChange('gallery')}
                  className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                >
                  <Image className="w-5 h-5" />
                  <span>查看我的作品</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 创作模式 - 生成过程中显示 */}
        {viewMode === 'create' && (
          <div className="max-w-4xl mx-auto px-6 py-16 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                AI正在为您创作中...
              </h2>
            </div>
            
            {/* 生成进度组件 */}
            <LoadingIndicator />
          </div>
        )}

        {/* 作品画廊模式 */}
        {viewMode === 'gallery' && (
          <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">我的作品画廊</h2>
                {!isLoading && (
                  <p className="text-gray-600 mt-1">
                    共 {pagination.total} 个作品批次 | 已加载 {generationBatches.length} 个批次 (每页10个)，{generationHistory.length} 张图片
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleNavigationChange('home')}
                  className="inline-flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>创作新作品</span>
                </button>
              </div>
            </div>

            {/* 画廊加载状态 */}
            {isLoading ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">正在加载中...</h3>
                <p className="text-gray-600">正在从数据库加载您的作品画廊</p>
                <div className="mt-4 w-32 h-1 bg-gray-200 rounded-full mx-auto overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full animate-pulse"></div>
                </div>
              </div>
            ) : generationBatches.length > 0 ? (
              <>
                <ImageGrid viewMode="masonry" onRegenerate={handleRegenerate} />
                
                {/* 📄 分页控制 */}
                <div className="mt-12 text-center">
                  <div className="mb-6">
                                         <p className="text-gray-600 text-sm">
                       已显示 {generationBatches.length} 个批次，共 {pagination.total} 个批次
                       {pagination.totalPages > 1 && (
                         <span className="ml-2">
                           第 {pagination.currentPage} / {pagination.totalPages} 页 (每页10个批次)
                         </span>
                       )}
                     </p>
                  </div>
                  
                  {pagination.hasMore && (
                    <button
                      onClick={loadMoreHistory}
                      disabled={pagination.isLoadingMore}
                      className={`inline-flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                        pagination.isLoadingMore
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-lg'
                      }`}
                    >
                      {pagination.isLoadingMore ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                          <span>加载中...</span>
                        </>
                      ) : (
                        <>
                          <History className="w-4 h-4" />
                          <span>加载更多作品</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  {!pagination.hasMore && pagination.total > 0 && (
                    <p className="text-gray-500 text-sm">
                      🎉 已显示全部作品
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Image className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有作品</h3>
                <p className="text-gray-600 mb-6">
                  开始您的AI创作之旅，生成您的第一个作品吧！
                </p>
                <button
                  onClick={() => handleNavigationChange('home')}
                  className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  <span>开始创作</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 设置面板 */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowSettings(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] transform transition-all duration-300 scale-100 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 固定标题栏 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">AI图像生成</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 可滚动内容区域 */}
            <div className="flex-1 overflow-y-auto">
              <SettingsTabs 
                initialPrompt={sidebarPrompt} 
                suggestedTags={suggestedTags}
                parsedFeatures={currentConfig.parsedFeatures}
              />
            </div>
          </div>
        </div>
      )}

      {/* 右下角快捷按钮 - 仅在首页显示 */}
      {viewMode === 'home' && (
        <button
          onClick={handleFloatingButtonClick}
          className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-40 transform hover:scale-110 active:scale-95 animate-bounce-subtle"
          title="快速创作"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Toast 通知容器 */}
      <ToastContainer toasts={toast.toasts} onClose={toast.close} />
    </div>
  );
}

export default App; 