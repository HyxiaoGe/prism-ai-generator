import { Zap, Sparkles, History, Palette } from 'lucide-react';
import { PromptInput } from './components/PromptInput';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ImageGrid } from './components/ImageGrid';
import { useAIGenerationStore } from './store/aiGenerationStore';

function App() {
  const { currentGeneration, generationHistory } = useAIGenerationStore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部导航 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-600 to-purple-700 rounded-xl">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Prism</h1>
                <p className="text-sm text-gray-500">AI图像生成器</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center text-sm text-gray-600">
                <Sparkles className="w-4 h-4 mr-2 text-primary-600" />
                支持多AI模型，创造无限可能
              </div>
              
              {/* 生成历史统计 */}
              <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-500">
                <History className="w-4 h-4" />
                <span>已生成 {generationHistory.length} 张图像</span>
              </div>
              
              <div className="text-xs text-gray-500">
                MVP v1.0.0
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 左侧：输入和控制区域 */}
          <div className="lg:col-span-5 space-y-6">
            <PromptInput />
            
            {/* 显示进度指示器 */}
            {(currentGeneration.isGenerating || 
              currentGeneration.stage === 'completed' || 
              currentGeneration.stage === 'error') && (
              <LoadingIndicator />
            )}

            {/* AI创作提示 */}
            <div className="card p-4">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                <Palette className="w-4 h-4 mr-2 text-primary-600" />
                💡 AI创作提示
              </h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• <strong>详细描述</strong>：包含主体、环境、风格、色彩等元素</li>
                <li>• <strong>风格指定</strong>：如"摄影级逼真"、"油画风格"、"赛博朋克"</li>
                <li>• <strong>情绪氛围</strong>：描述光线、情感、季节等氛围元素</li>
                <li>• <strong>创意组合</strong>：尝试将不同概念巧妙结合</li>
              </ul>
            </div>

            {/* 功能特性 */}
            <div className="card p-4">
              <h3 className="font-medium text-gray-900 mb-3">🚀 平台特性</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">4个AI模型</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">多种尺寸</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-600">快速生成</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-600">高质量输出</span>
                </div>
              </div>
            </div>

            {/* 模型对比简要 */}
            <div className="card p-4">
              <h3 className="font-medium text-gray-900 mb-3">⚡ 快速选择</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">🚀 快速创意</span>
                  <span className="text-primary-600 font-medium">Flux Schnell</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">🎨 专业创作</span>
                  <span className="text-purple-600 font-medium">Flux Dev</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">⚡ 超快速度</span>
                  <span className="text-orange-600 font-medium">SDXL Lightning</span>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：图像展示区域 */}
          <div className="lg:col-span-7">
            <ImageGrid />
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-500">
              © 2024 Prism AI Generator. 基于Replicate多AI模型构建。
            </div>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <span className="text-xs text-gray-400">
                支持Flux、SDXL等多个先进AI模型
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App; 