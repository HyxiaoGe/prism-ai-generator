import { useEffect, useState } from 'react';
import { Zap, History, Settings, Plus, Search, Grid } from 'lucide-react';
import { PromptInput } from './components/PromptInput';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ImageGrid } from './components/ImageGrid';
import { useAIGenerationStore } from './store/aiGenerationStore';

function App() {
  const { currentGeneration, generationHistory, usageStats, updateUsageStats } = useAIGenerationStore();
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('masonry');
  const [searchPrompt, setSearchPrompt] = useState('');
  const [sidebarPrompt, setSidebarPrompt] = useState(''); // 专门用于右侧栏的提示词

  // 初始化使用统计
  useEffect(() => {
    updateUsageStats();
  }, [updateUsageStats]);

  // 监听生成完成，自动关闭设置面板并清空侧边栏提示词
  useEffect(() => {
    if (currentGeneration.stage === 'completed') {
      setShowSettings(false);
      setSidebarPrompt(''); // 清空侧边栏提示词，避免下次打开时有残留
    }
  }, [currentGeneration.stage]);

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
                  onClick={() => setViewMode('masonry')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'masonry' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
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
        
        {/* 快速创建面板 - 仅在没有内容时显示 */}
        {generationHistory.length === 0 && (
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
        )}

        {/* 生成进度 - 悬浮显示 */}
        {(currentGeneration.isGenerating || 
          currentGeneration.stage === 'completed' || 
          currentGeneration.stage === 'error') && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
            <LoadingIndicator className="shadow-2xl" />
          </div>
        )}

        {/* 图像展示区域 - 瀑布流布局 */}
        {generationHistory.length > 0 && (
          <div className="max-w-7xl mx-auto px-6 py-8">
            <ImageGrid viewMode={viewMode} />
          </div>
        )}

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
            <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300">
              <div className="p-6 border-b border-gray-200">
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
              
              <div className="p-6 overflow-y-auto h-full">
                <PromptInput initialPrompt={sidebarPrompt} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App; 