/**
 * 数据库调试工具
 * 提供开发环境下的数据库调试和维护功能
 */

import { DatabaseService } from '../services/database';
import { DeviceFingerprint } from '../repositories/baseRepository';

// 扩展 Window 类型以支持调试方法
declare global {
  interface Window {
    debugDatabase: () => Promise<void>;
    cleanupDatabase: () => Promise<void>;
    debugTags: () => Promise<void>;
    debugFeedback: () => Promise<void>;
    simulateTagUsage: () => Promise<void>;
    updateTagNames: () => Promise<void>;
    testFeedback: () => Promise<void>;
    showDeviceFingerprint: () => Promise<void>;
    debugUserAccounts: () => Promise<void>;
  }
}

/**
 * 显示当前设备指纹信息
 */
const showDeviceFingerprint = async () => {
  console.log('🔍 ==========设备指纹信息==========');

  const deviceFingerprint = DeviceFingerprint.getInstance();
  const fingerprint = await deviceFingerprint.generateFingerprint();

  console.log('📱 当前设备指纹:', fingerprint);
  console.log('\n📊 指纹生成因素:');
  console.log('  - User Agent:', navigator.userAgent);
  console.log('  - Language:', navigator.language);
  console.log('  - Platform:', navigator.platform);
  console.log('  - Screen:', screen.width + 'x' + screen.height);
  console.log('  - Color Depth:', screen.colorDepth);
  console.log('  - Timezone Offset:', new Date().getTimezoneOffset());
  console.log('  - Hardware Concurrency:', navigator.hardwareConcurrency || 0);
  console.log('  - Device Memory:', ('deviceMemory' in navigator ? (navigator as any).deviceMemory : 0) || 0);

  console.log('\n⚠️  注意：IP地址不在指纹因素中，IP变化不会导致指纹变化');
  console.log('✅ 指纹已缓存在内存中，刷新页面会重新计算');
  console.log('=====================================');
};

/**
 * 调试用户账号信息
 */
const debugUserAccounts = async () => {
  console.log('👥 ==========用户账号调试==========');

  const dbService = DatabaseService.getInstance();

  // 获取当前用户
  const { AuthService } = await import('../services/auth/authService');
  const authService = AuthService.getInstance();
  const currentUser = await authService.getAppUser();

  console.log('👤 当前登录用户:');
  if (currentUser) {
    console.log('  - ID:', currentUser.id);
    console.log('  - 显示名称:', currentUser.display_name);
    console.log('  - 邮箱:', currentUser.email);
    console.log('  - 今日配额:', currentUser.daily_quota);
    console.log('  - 今日已用:', currentUser.used_today);
    console.log('  - 总生成数:', currentUser.total_generated);
  } else {
    console.log('  - 未获取到用户信息');
  }

  // 获取设备指纹
  const deviceFingerprint = DeviceFingerprint.getInstance();
  const fingerprint = await deviceFingerprint.generateFingerprint();
  console.log('\n📱 当前设备指纹:', fingerprint);

  // 查询所有device类型的用户
  console.log('\n🔍 查询数据库中所有device类型账号...');
  console.log('（需要手动执行SQL查询）');
  console.log('SQL: SELECT * FROM users WHERE id IN (SELECT user_id FROM auth_accounts WHERE provider = \'device\')');

  console.log('=====================================');
};

/**
 * 查看今日生成记录
 */
const debugDatabase = async () => {
  const dbService = DatabaseService.getInstance();
  await dbService.getDebugGenerationsToday();
};

/**
 * 清理重复的每日统计记录
 */
const cleanupDatabase = async () => {
  const dbService = DatabaseService.getInstance();
  await dbService.cleanupDuplicateDailyStats();
};

/**
 * 查看标签统计和趋势
 */
const debugTags = async () => {
  const dbService = DatabaseService.getInstance();
  console.log('🏷️ 获取热门标签...');
  const popularTags = await dbService.getPopularTags();
  console.log('📊 热门标签:', popularTags);

  console.log('📈 分析标签趋势...');
  const trends = await dbService.analyzeTagTrends();
  console.log('📈 标签趋势分析:', trends);
};

/**
 * 查看用户反馈统计
 */
const debugFeedback = async () => {
  const dbService = DatabaseService.getInstance();
  console.log('👍👎 获取用户反馈统计...');
  const feedbackStats = await dbService.getUserFeedbackStats();
  console.log('📊 反馈统计:', feedbackStats);
};

/**
 * 模拟标签使用（测试功能）
 */
const simulateTagUsage = async () => {
  const dbService = DatabaseService.getInstance();
  console.log('🧪 模拟标签使用...');

  // 模拟一些标签使用
  const mockTags = [
    { name: '摄影级逼真', category: 'art_style' as const, value: 'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed' },
    { name: '赛博朋克', category: 'theme_style' as const, value: 'cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets' },
    { name: '温暖明亮', category: 'mood' as const, value: 'warm lighting, bright, cheerful, golden hour, soft sunlight' },
    { name: '超高细节', category: 'enhancement' as const, value: 'highly detailed, intricate details, ultra-detailed textures, photorealistic details' },
  ];

  try {
    await dbService.updateTagStats(mockTags);
    console.log('✅ 模拟标签使用完成');

    // 立即查看更新后的统计
    const updatedTags = await dbService.getPopularTags();
    console.log('📊 更新后的热门标签:', updatedTags);

    alert('模拟标签使用完成！现在您可以在数据库中看到标签统计了。');
  } catch (error) {
    console.error('❌ 模拟标签使用失败:', error);
    alert('模拟标签使用失败，请查看控制台');
  }
};

/**
 * 更新数据库中的标签名称为中文
 */
const updateTagNames = async () => {
  const dbService = DatabaseService.getInstance();
  console.log('🔄 开始更新标签名称为中文...');

  try {
    // 获取 Supabase 客户端
    const supabase = (dbService as any).supabase;

    // 定义标签名称映射
    const tagNameUpdates = [
      // 艺术风格组
      { old: 'concept art, digital painting, matte painting, professional illustration', new: '概念艺术' },
      { old: 'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed', new: '摄影级逼真' },
      { old: 'cinematic photography, film photography, dramatic lighting, cinematic composition', new: '电影级画质' },
      { old: 'oil painting, classical art, brush strokes, Renaissance style', new: '油画风格' },
      { old: 'watercolor painting, soft brushes, artistic, flowing colors', new: '水彩画' },
      { old: 'anime style, manga, japanese animation, cel shading', new: '动漫风格' },
      { old: '3D render, CGI, ray tracing, volumetric lighting, subsurface scattering', new: '3D渲染' },

      // 主题风格组
      { old: 'cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets', new: '赛博朋克' },
      { old: 'sci-fi, futuristic, space technology, holographic displays, advanced technology', new: '科幻场景' },
      { old: 'fantasy, magical, mythical creatures, enchanted forest, mystical atmosphere', new: '奇幻风格' },
      { old: 'steampunk, vintage machinery, brass gears, Victorian era, industrial', new: '蒸汽朋克' },
      { old: 'chinese style, traditional, elegant, ink wash painting, oriental aesthetics', new: '中国风' },

      // 情绪氛围组
      { old: 'warm lighting, bright, cheerful, golden hour, soft sunlight', new: '温暖明亮' },
      { old: 'dark, mysterious, moody lighting, deep shadows, dramatic chiaroscuro', new: '神秘暗黑' },
      { old: 'dreamy, ethereal, soft, beautiful, pastel colors, fairy-tale like', new: '梦幻唯美' },
      { old: 'epic, dramatic, cinematic, powerful, grand scale, awe-inspiring', new: '震撼史诗' },
      { old: 'peaceful, calm, serene, tranquil, meditation, zen atmosphere', new: '宁静平和' },

      // 增强属性组
      { old: 'highly detailed, intricate details, ultra-detailed textures, photorealistic details', new: '超高细节' },
      { old: 'high quality, detailed, masterpiece, best quality, 4k resolution', new: '品质增强' },
      { old: 'HDR photography, high dynamic range, enhanced contrast, vivid colors', new: 'HDR效果' },
      { old: 'masterpiece, award winning, gallery quality, museum piece', new: '艺术大师' },
    ];

    let updatedCount = 0;

    // 逐个更新标签名称
    for (const update of tagNameUpdates) {
      const { data, error } = await supabase
        .from('tag_stats')
        .update({ tag_name: update.new })
        .eq('tag_name', update.old);

      if (error) {
        console.error(`❌ 更新标签失败 "${update.old}" -> "${update.new}":`, error);
      } else {
        console.log(`✅ 更新标签成功: "${update.old}" -> "${update.new}"`);
        updatedCount++;
      }
    }

    console.log(`🎉 标签名称更新完成，共更新 ${updatedCount} 个标签`);

    // 查看更新后的结果
    const { data: allTags, error: queryError } = await supabase
      .from('tag_stats')
      .select('tag_name, tag_category, usage_count, success_rate')
      .order('usage_count', { ascending: false });

    if (queryError) {
      console.error('❌ 查询更新后的标签失败:', queryError);
    } else {
      console.log('📊 更新后的标签列表:', allTags);
    }

    alert(`标签名称更新完成！共更新了 ${updatedCount} 个标签。请查看数据库中的结果。`);

  } catch (error) {
    console.error('❌ 更新标签名称失败:', error);
    alert('更新标签名称失败，请查看控制台');
  }
};

/**
 * 测试批次反馈功能
 */
const testFeedback = async () => {
  const dbService = DatabaseService.getInstance();
  console.log('🧪 测试批次反馈功能...');

  try {
    // 模拟一个批次的反馈（4张图片）
    const batchId = 'test-batch-' + Date.now();
    const imageUrls = [
      'https://example.com/test-image-1.jpg',
      'https://example.com/test-image-2.jpg',
      'https://example.com/test-image-3.jpg',
      'https://example.com/test-image-4.jpg'
    ];

    // 为整个批次提交反馈（使用新的API）
    await dbService.submitImageFeedback({
      generationId: batchId,
      imageUrls: imageUrls,  // 传递整个批次的图片URL数组
      feedbackType: 'like',
      tagsUsed: ['测试艺术风格', '测试主题风格', '测试情绪氛围'],
      modelUsed: 'flux-schnell'
    });

    console.log(`✅ 测试批次反馈提交成功 (${imageUrls.length}张图片)`);

    // 查看反馈统计
    const feedbackStats = await dbService.getUserFeedbackStats();
    console.log('📊 当前反馈统计:', feedbackStats);

    // 查看提交的反馈记录
    const feedbacks = await dbService.getImageFeedback(batchId);
    console.log('📋 提交的反馈记录:', feedbacks);

    alert(`批次反馈功能测试完成！已为${imageUrls.length}张图片提交了批次反馈。请查看控制台和数据库。`);

  } catch (error) {
    console.error('❌ 测试批次反馈功能失败:', error);
    alert('测试批次反馈功能失败，请查看控制台');
  }
};

/**
 * 初始化调试工具
 * 将调试方法挂载到全局 window 对象
 */
export function initializeDebugTools(): () => void {
  // 将调试方法挂载到全局
  window.debugDatabase = debugDatabase;
  window.cleanupDatabase = cleanupDatabase;
  window.debugTags = debugTags;
  window.debugFeedback = debugFeedback;
  window.simulateTagUsage = simulateTagUsage;
  window.updateTagNames = updateTagNames;
  window.testFeedback = testFeedback;
  window.showDeviceFingerprint = showDeviceFingerprint;
  window.debugUserAccounts = debugUserAccounts;

  console.log('🔧 调试方法已挂载:');
  console.log('- debugDatabase() - 查看今日生成记录');
  console.log('- cleanupDatabase() - 清理重复的每日统计记录');
  console.log('- showDeviceFingerprint() - 查看当前设备指纹');
  console.log('- debugUserAccounts() - 调试用户账号信息');
  console.log('- debugTags() - 查看标签统计和趋势');
  console.log('- debugFeedback() - 查看用户反馈统计');
  console.log('- simulateTagUsage() - 模拟标签使用（测试功能）');
  console.log('- updateTagNames() - 更新数据库中的标签名称为中文');
  console.log('- testFeedback() - 测试批次反馈功能');

  // 返回清理函数
  return () => {
    (window as any).debugDatabase = undefined;
    (window as any).cleanupDatabase = undefined;
    (window as any).debugTags = undefined;
    (window as any).debugFeedback = undefined;
    (window as any).simulateTagUsage = undefined;
    (window as any).updateTagNames = undefined;
    (window as any).testFeedback = undefined;
  };
}
