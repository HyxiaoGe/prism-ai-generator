import { useEffect, useState } from 'react';
import { Zap, History, Settings, Plus, Search, Grid } from 'lucide-react';
import { 
  PromptInput, 
  LoadingIndicator, 
  ImageGrid, 
  PromptFeatures,
  ModelSelector,
  SettingsTabs,
  useAIGenerationStore
} from './features/ai-models';

function App() {
  const { currentGeneration, generationHistory, usageStats, updateUsageStats } = useAIGenerationStore();
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'gallery' | 'history'>('gallery');
  const [searchPrompt, setSearchPrompt] = useState('');
  const [sidebarPrompt, setSidebarPrompt] = useState(''); // 专门用于右侧栏的提示词

  // 初始化使用统计
  useEffect(() => {
    updateUsageStats();
  }, [updateUsageStats]);

  // 监听生成状态变化，自动管理设置面板
  useEffect(() => {
    if (currentGeneration.isGenerating) {
      // 生成开始时立即关闭设置面板
      setShowSettings(false);
    } else if (currentGeneration.stage === 'completed') {
      // 生成完成时清空侧边栏提示词，避免下次打开时有残留
      setSidebarPrompt('');
    }
  }, [currentGeneration.isGenerating, currentGeneration.stage]);

  // 处理搜索框生成（简化版，主要通过PromptInput处理）
  const handleSearchGenerate = () => {
    if (!searchPrompt.trim()) return;
    // 将搜索框内容设置到右侧栏，然后打开设置面板
    setSidebarPrompt(searchPrompt);
    setShowSettings(true);
  };

  // 处理模板点击
  const handleTemplateClick = (prompt: string) => {
    setSidebarPrompt(prompt); // 只填充右侧栏，不影响搜索框
    setShowSettings(true); // 打开设置面板
  };

  // 处理右下角+号点击
  const handleFloatingButtonClick = () => {
    setSidebarPrompt(''); // 清空右侧栏提示词
    setShowSettings(!showSettings);
  };

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
              {/* 用量显示 */}
              {usageStats && (
                <div className="hidden lg:flex items-center space-x-2 text-sm bg-gray-100 px-3 py-2 rounded-xl">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">{usageStats.daily.remaining}/{usageStats.daily.limit}</span>
                </div>
              )}
              
              {/* 视图切换 */}
              <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('gallery')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'gallery' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                  title="画廊视图"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'history' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                  title="历史记录"
                >
                  <History className="w-4 h-4" />
                </button>
              </div>

              {/* 设置按钮 */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="pt-20">
        
        {/* 快速创建面板 - 仅在没有内容且未在生成时显示 */}
        {(() => {
          if (generationHistory.length === 0 && !currentGeneration.isGenerating) {
            console.log('🏠 显示模板面板，generationHistory长度:', generationHistory.length, '是否正在生成:', currentGeneration.isGenerating);
            return (
              <div className="max-w-4xl mx-auto px-6 py-16">
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
                { emoji: '🏞️', title: '风景照片', desc: '山川河流，自然风光', prompt: '壮丽的山川风景，夕阳西下，云海翻腾' },
                { emoji: '👤', title: '人物肖像', desc: '人物头像，艺术肖像', prompt: '一位优雅的女性肖像，油画风格，细腻的光影' },
                { emoji: '🚀', title: '科幻场景', desc: '未来世界，太空探索', prompt: '未来科技城市，霓虹灯光，赛博朋克风格' },
                { emoji: '🎨', title: '艺术创作', desc: '抽象艺术，创意设计', prompt: '抽象艺术作品，色彩丰富，现代艺术风格' },
              ].map((template, index) => (
                <div
                  key={index}
                  onClick={() => handleTemplateClick(template.prompt)}
                  className="group cursor-pointer bg-white rounded-2xl p-6 border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300"
                >
                  <div className="text-3xl mb-4">{template.emoji}</div>
                  <h3 className="font-semibold text-gray-900 mb-2">{template.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{template.desc}</p>
                  <div className="text-xs text-purple-600 group-hover:text-purple-700 font-medium">
                    点击填充提示词 →
                  </div>
                </div>
              ))}
            </div>
              </div>
            );
          }
          return null;
        })()}

        {/* 生成进度 - 悬浮显示 */}
        {(currentGeneration.isGenerating || 
          currentGeneration.stage === 'completed' || 
          currentGeneration.stage === 'error') && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-60">
            <LoadingIndicator className="shadow-2xl" />
          </div>
        )}

        {/* 图像展示区域 */}
        {(() => {
          if (generationHistory.length > 0) {
            console.log('🖼️ 显示内容，generationHistory长度:', generationHistory.length, '视图模式:', viewMode);
            
            if (viewMode === 'gallery') {
              // 画廊模式：纯图片展示，瀑布流布局
              return (
                <div className="max-w-7xl mx-auto px-6 py-8">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">AI作品画廊</h2>
                    <p className="text-gray-600 mt-1">展示您创作的所有AI图像作品</p>
                  </div>
                  <ImageGrid columns={5} showHistory={true} className="gallery-mode" />
                </div>
              );
            } else {
              // 历史记录模式：详细信息列表
              return (
                <div className="max-w-5xl mx-auto px-6 py-8">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">生成历史</h2>
                      <p className="text-gray-600 mt-1">查看详细的生成记录和参数</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      共 {generationHistory.length} 张图片
                    </div>
                  </div>
                  
                  {/* 历史记录列表 */}
                  <div className="space-y-6">
                    {generationHistory.map((result) => (
                      <div key={result.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="flex flex-col md:flex-row">
                          {/* 图片预览 */}
                          <div className="md:w-48 md:h-48 w-full h-64 bg-gray-100">
                            <img
                              src={result.imageUrl}
                              alt={result.prompt}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          
                                                      {/* 详细信息 */}
                            <div className="flex-1 p-6">
                                                            {/* 使用新的特征标签显示 */}
                              <PromptFeatures result={result} showBasePrompt={true} />
                              
                              {/* 生成时间信息 */}
                              <div className="mt-4 pt-3 border-t border-gray-100">
                                <div className="text-xs text-gray-500">
                                  🕒 生成时间: {result.createdAt.toLocaleString('zh-CN')}
                                </div>
                              </div>
                              
                              {/* 操作按钮 */}
                              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {
                                    // 下载图片
                                    const a = document.createElement('a');
                                    a.href = result.imageUrl;
                                    a.download = `ai-generated-${result.id}.jpg`;
                                    a.click();
                                  }}
                                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                >
                                  下载
                                </button>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(result.prompt);
                                    alert('提示词已复制到剪贴板');
                                  }}
                                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                                >
                                  复制提示词
                                </button>
                              </div>
                              <div className="text-xs text-gray-500">
                                ID: {result.id}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          }
          return null;
        })()}

        {/* 浮动创作按钮 */}
        <button 
          onClick={handleFloatingButtonClick}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-center z-50"
          title="打开创作设置"
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* 设置侧边栏 */}
        {showSettings && (
          <>
            {/* 遮罩 */}
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setShowSettings(false)}
            />
            
            {/* 侧边栏 */}
            <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col">
              <div className="p-6 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">创作设置</h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <SettingsTabs 
                  initialPrompt={sidebarPrompt}
                  disabled={currentGeneration.isGenerating}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App; 