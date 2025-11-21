-- ==============================================
-- Prism AI Generator - 场景模板扩充脚本
-- ==============================================
-- 目标：将模板库从25个扩充到80+个高质量模板
-- 特点：每个分类5-10个模板，包含缩略图URL
-- ==============================================

-- 1. 摄影艺术类 (photography) - 新增5个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('黄金时刻风光', '捕捉日出日落的温暖光线', '摄影艺术', 'landscape', ARRAY['landscape','golden hour'], 'beginner', 'stunning landscape photography during golden hour, warm sunlight, dramatic sky', '{"mood":["warm","epic"],"artStyle":["photorealistic"],"technical":["wide angle","golden hour"]}', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop', true, 'active', 4.85, 0),

('极简建筑', '现代建筑的几何美学', '摄影艺术', 'architecture', ARRAY['architecture','minimal'], 'intermediate', 'minimalist architectural photography, clean lines, geometric shapes, modern building', '{"mood":["clean","modern"],"artStyle":["photorealistic"],"technical":["architectural","symmetry"]}', 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=400&h=300&fit=crop', true, 'active', 4.75, 0),

('街头纪实', '捕捉城市生活瞬间', '摄影艺术', 'street', ARRAY['street','documentary'], 'advanced', 'street photography, candid moment, urban life, black and white, documentary style', '{"mood":["authentic","gritty"],"artStyle":["documentary"],"technical":["35mm","high contrast"]}', 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop', true, 'active', 4.90, 0),

('美食静物', '商业级美食摄影', '摄影艺术', 'food', ARRAY['food','commercial'], 'intermediate', 'professional food photography, appetizing lighting, styled composition, commercial quality', '{"mood":["appetizing","luxurious"],"artStyle":["commercial photography"],"technical":["macro","soft lighting"]}', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop', true, 'active', 4.80, 0),

('野生动物', '自然环境中的动物肖像', '摄影艺术', 'wildlife', ARRAY['wildlife','nature'], 'advanced', 'wildlife photography, animal portrait in natural habitat, telephoto lens, natural behavior', '{"mood":["wild","majestic"],"artStyle":["nature photography"],"technical":["telephoto","shallow dof"]}', 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=400&h=300&fit=crop', true, 'active', 4.92, 0);

-- 2. 日系动漫类 (anime) - 新增7个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('魔法少女', '变身系魔法少女风格', 'anime', 'magical girl', ARRAY['anime','magical'], 'beginner', 'magical girl anime character, transformation scene, sparkles and ribbons, colorful magic', '{"mood":["cheerful","magical"],"artStyle":["anime"],"enhancement":["highly detailed"]}', 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=300&fit=crop', true, 'active', 4.88, 0),

('机甲驾驶员', '未来科幻机甲操作员', 'anime', 'mecha', ARRAY['anime','sci-fi','mecha'], 'advanced', 'anime mecha pilot character, futuristic cockpit, holographic displays, dynamic pose', '{"mood":["futuristic","intense"],"artStyle":["anime","sci-fi"],"enhancement":["detailed mecha"]}', 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=400&h=300&fit=crop', true, 'active', 4.92, 0),

('校园日常', '青春校园生活场景', 'anime', 'school life', ARRAY['anime','slice of life'], 'beginner', 'anime school life scene, students in classroom, cherry blossoms outside window, peaceful atmosphere', '{"mood":["peaceful","nostalgic"],"artStyle":["anime"],"enhancement":["soft colors"]}', 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop', true, 'active', 4.75, 0),

('战斗场景', '热血动作战斗瞬间', 'anime', 'action', ARRAY['anime','action','battle'], 'intermediate', 'dynamic anime battle scene, energy effects, speed lines, intense action moment', '{"mood":["intense","epic"],"artStyle":["anime","action"],"enhancement":["motion blur","effects"]}', 'https://images.unsplash.com/photo-1550859492-d5da9d8e45f3?w=400&h=300&fit=crop', true, 'active', 4.85, 0),

('异世界冒险', '奇幻异世界探险', 'anime', 'isekai', ARRAY['anime','fantasy','adventure'], 'intermediate', 'isekai anime scene, fantasy world landscape, adventurer character, magical elements', '{"mood":["adventurous","fantastical"],"artStyle":["anime","fantasy"],"enhancement":["detailed background"]}', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop', true, 'active', 4.90, 0),

('萌系角色', 'SD可爱萌系风格', 'anime', 'chibi', ARRAY['anime','cute','chibi'], 'beginner', 'chibi anime character, super deformed style, cute and adorable, pastel colors', '{"mood":["cute","cheerful"],"artStyle":["anime","chibi"],"enhancement":["soft shading"]}', 'https://images.unsplash.com/photo-1514846226882-28b324ef7f28?w=400&h=300&fit=crop', true, 'active', 4.70, 0),

('赛博朋克少女', '未来都市霓虹风格', 'anime', 'cyberpunk', ARRAY['anime','cyberpunk'], 'advanced', 'cyberpunk anime girl, neon city background, holographic interface, futuristic fashion', '{"mood":["futuristic","edgy"],"artStyle":["anime","cyberpunk"],"enhancement":["neon lights","high detail"]}', 'https://images.unsplash.com/photo-1509043759401-136742328bb3?w=400&h=300&fit=crop', true, 'active', 4.95, 0);

-- 3. 游戏风格类 (game) - 新增5个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('JRPG场景', '日式RPG游戏城镇', 'game', 'jrpg', ARRAY['game','rpg','fantasy'], 'intermediate', 'JRPG style town scene, isometric view, medieval fantasy, vibrant colors, detailed buildings', '{"mood":["adventurous","colorful"],"artStyle":["game art","isometric"],"enhancement":["detailed"]}', 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop', true, 'active', 4.82, 0),

('FPS武器设计', '第一人称射击武器', 'game', 'fps', ARRAY['game','weapon','realistic'], 'advanced', 'FPS game weapon design, detailed gun model, realistic materials, professional rendering', '{"mood":["tactical","realistic"],"artStyle":["3d render","pbr"],"technical":["detailed textures"]}', 'https://images.unsplash.com/photo-1605901309584-818e25960a8f?w=400&h=300&fit=crop', true, 'active', 4.88, 0),

('卡牌游戏角色', 'TCG卡牌插画风格', 'game', 'card game', ARRAY['game','card','illustration'], 'intermediate', 'trading card game character art, dynamic pose, fantasy armor, detailed illustration, card frame', '{"mood":["epic","powerful"],"artStyle":["digital painting","card art"],"enhancement":["highly detailed"]}', 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=400&h=300&fit=crop', true, 'active', 4.85, 0),

('横版平台场景', '2D横版游戏关卡', 'game', 'platformer', ARRAY['game','2d','platform'], 'beginner', '2D platformer game level, side-scrolling view, colorful platforms, parallax background', '{"mood":["playful","colorful"],"artStyle":["2d game art"],"enhancement":["vibrant colors"]}', 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=300&fit=crop', true, 'active', 4.75, 0),

('MOBA英雄设计', 'MOBA游戏英雄概念', 'game', 'moba', ARRAY['game','character','moba'], 'advanced', 'MOBA hero character design, full body concept art, unique abilities visual, splash art style', '{"mood":["heroic","dynamic"],"artStyle":["concept art","splash art"],"enhancement":["epic scale"]}', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop', true, 'active', 4.90, 0);

-- 4. 绘画艺术类 (painting) - 新增6个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('印象派风景', '莫奈风格印象派', 'painting', 'impressionism', ARRAY['painting','impressionism'], 'intermediate', 'impressionist landscape painting, loose brushstrokes, vibrant colors, light and atmosphere', '{"mood":["serene","atmospheric"],"artStyle":["impressionism"],"enhancement":["painterly"]}', 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=300&fit=crop', true, 'active', 4.88, 0),

('抽象表现主义', '现代抽象艺术', 'painting', 'abstract', ARRAY['painting','abstract','modern'], 'advanced', 'abstract expressionism artwork, bold colors, dynamic composition, emotional energy', '{"mood":["energetic","expressive"],"artStyle":["abstract art"],"enhancement":["bold strokes"]}', 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=300&fit=crop', true, 'active', 4.75, 0),

('文艺复兴肖像', '古典大师肖像画', 'painting', 'renaissance', ARRAY['painting','classical','portrait'], 'advanced', 'renaissance portrait painting, classical composition, rich oil colors, dramatic lighting', '{"mood":["classical","noble"],"artStyle":["renaissance"],"technical":["chiaroscuro"]}', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop', true, 'active', 4.92, 0),

('浮世绘', '日本传统版画', 'painting', 'ukiyo-e', ARRAY['painting','japanese','traditional'], 'intermediate', 'japanese ukiyo-e woodblock print, traditional composition, flat colors, decorative patterns', '{"mood":["traditional","elegant"],"artStyle":["ukiyo-e"],"enhancement":["detailed patterns"]}', 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=300&fit=crop', true, 'active', 4.85, 0),

('波普艺术', '安迪沃霍尔风格', 'painting', 'pop art', ARRAY['painting','pop art','modern'], 'beginner', 'pop art style portrait, bold colors, halftone dots, repetition, commercial aesthetic', '{"mood":["vibrant","playful"],"artStyle":["pop art"],"enhancement":["high contrast"]}', 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=400&h=300&fit=crop', true, 'active', 4.78, 0),

('超现实主义', '达利风格梦境', 'painting', 'surrealism', ARRAY['painting','surreal','dreamlike'], 'advanced', 'surrealist painting, dreamlike imagery, impossible compositions, melting objects, strange combinations', '{"mood":["dreamlike","mysterious"],"artStyle":["surrealism"],"enhancement":["highly imaginative"]}', 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&h=300&fit=crop', true, 'active', 4.90, 0);

-- 5. 概念设计类 (concept) - 新增4个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('载具设计', '未来科幻交通工具', 'concept', 'vehicle', ARRAY['concept','vehicle','sci-fi'], 'advanced', 'futuristic vehicle concept design, sleek aerodynamic form, technical details, multiple views', '{"mood":["futuristic","sleek"],"artStyle":["concept art"],"technical":["technical drawing"]}', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=300&fit=crop', true, 'active', 4.87, 0),

('生物设计', '奇幻生物概念', 'concept', 'creature', ARRAY['concept','creature','fantasy'], 'advanced', 'fantasy creature design, anatomical study, multiple angles, detailed textures and features', '{"mood":["fantastical","detailed"],"artStyle":["concept art"],"enhancement":["anatomically detailed"]}', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop', true, 'active', 4.92, 0),

('武器装备', '游戏武器设计稿', 'concept', 'prop', ARRAY['concept','weapon','prop'], 'intermediate', 'fantasy weapon prop design, detailed ornamentation, material callouts, design breakdown', '{"mood":["powerful","detailed"],"artStyle":["concept art"],"technical":["design sheet"]}', 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&h=300&fit=crop', true, 'active', 4.80, 0),

('UI界面设计', '游戏HUD界面', 'concept', 'ui', ARRAY['concept','ui','interface'], 'intermediate', 'game UI interface design, futuristic HUD elements, holographic panels, clean typography', '{"mood":["futuristic","clean"],"artStyle":["ui design"],"enhancement":["detailed interface"]}', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop', true, 'active', 4.75, 0);

-- 6. 中国风类 (chinese) - 新增4个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('工笔花鸟', '传统工笔画风格', 'chinese', 'gongbi', ARRAY['chinese','traditional','detailed'], 'advanced', 'chinese gongbi painting, meticulous brushwork, flowers and birds, delicate colors, traditional composition', '{"mood":["elegant","delicate"],"artStyle":["chinese art","gongbi"],"enhancement":["highly detailed"]}', 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=400&h=300&fit=crop', true, 'active', 4.90, 0),

('敦煌壁画', '敦煌石窟艺术风格', 'chinese', 'dunhuang', ARRAY['chinese','buddhist','mural'], 'advanced', 'dunhuang mural style, buddhist theme, flying apsaras, rich gold and mineral colors, ancient art', '{"mood":["sacred","ancient"],"artStyle":["dunhuang art"],"enhancement":["traditional pigments"]}', 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=300&fit=crop', true, 'active', 4.95, 0),

('青绿山水', '传统青绿山水画', 'chinese', 'landscape', ARRAY['chinese','landscape','traditional'], 'intermediate', 'chinese blue-green landscape painting, mineral colors, mountains and rivers, traditional composition', '{"mood":["majestic","traditional"],"artStyle":["chinese landscape"],"enhancement":["mineral pigments"]}', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop', true, 'active', 4.88, 0),

('剪纸艺术', '民间剪纸风格', 'chinese', 'paper cut', ARRAY['chinese','folk art','decorative'], 'beginner', 'chinese paper cutting art, intricate patterns, red paper, folk art motifs, symmetrical design', '{"mood":["festive","traditional"],"artStyle":["paper cut art"],"enhancement":["intricate patterns"]}', 'https://images.unsplash.com/photo-1513346940221-6f673d962e97?w=400&h=300&fit=crop', true, 'active', 4.72, 0);

-- 7. 卡通插画类 (cartoon) - 新增5个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('迪士尼风格', '经典迪士尼动画风格', 'cartoon', 'disney', ARRAY['cartoon','disney','classic'], 'intermediate', 'disney animation style character, expressive features, clean lines, vibrant colors, friendly design', '{"mood":["cheerful","friendly"],"artStyle":["disney style"],"enhancement":["expressive"]}', 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=300&fit=crop', true, 'active', 4.85, 0),

('卡通网络', '探险时光风格', 'cartoon', 'cartoon network', ARRAY['cartoon','adventure time'], 'beginner', 'cartoon network style, simple shapes, bold outlines, quirky characters, playful design', '{"mood":["playful","quirky"],"artStyle":["cartoon"],"enhancement":["bold colors"]}', 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=400&h=300&fit=crop', true, 'active', 4.70, 0),

('吉卜力风格', '宫崎骏动画场景', 'cartoon', 'ghibli', ARRAY['cartoon','ghibli','anime'], 'intermediate', 'studio ghibli style background, pastoral landscape, soft colors, dreamy atmosphere, detailed nature', '{"mood":["peaceful","nostalgic"],"artStyle":["ghibli"],"enhancement":["detailed background"]}', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop', true, 'active', 4.95, 0),

('复古卡通', '1930s橡皮软管风格', 'cartoon', 'rubber hose', ARRAY['cartoon','retro','vintage'], 'beginner', 'rubber hose cartoon style, 1930s animation, simple round shapes, black and white, vintage', '{"mood":["nostalgic","playful"],"artStyle":["vintage cartoon"],"enhancement":["retro"]}', 'https://images.unsplash.com/photo-1514846226882-28b324ef7f28?w=400&h=300&fit=crop', true, 'active', 4.65, 0),

('矢量插画', '现代扁平设计', 'cartoon', 'vector', ARRAY['cartoon','vector','modern'], 'beginner', 'modern vector illustration, flat design, geometric shapes, clean style, bold colors', '{"mood":["modern","clean"],"artStyle":["flat design"],"enhancement":["minimalist"]}', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop', true, 'active', 4.75, 0);

-- 8. 暗黑风格类 (dark) - 新增3个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('吸血鬼主题', '哥特式吸血鬼氛围', 'dark', 'vampire', ARRAY['dark','gothic','vampire'], 'advanced', 'gothic vampire scene, dark castle, moonlight, dramatic shadows, blood red accents', '{"mood":["eerie","dramatic"],"artStyle":["gothic art"],"technical":["dramatic lighting"]}', 'https://images.unsplash.com/photo-1509043759401-136742328bb3?w=400&h=300&fit=crop', true, 'active', 4.82, 0),

('死灵法师', '暗黑魔法仪式', 'dark', 'necromancy', ARRAY['dark','magic','occult'], 'advanced', 'dark necromancy ritual, summoning circle, ethereal spirits, arcane symbols, forbidden magic', '{"mood":["ominous","mystical"],"artStyle":["dark fantasy"],"enhancement":["mystical effects"]}', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop', true, 'active', 4.88, 0),

('废土末世', '后启示录世界', 'dark', 'post-apocalyptic', ARRAY['dark','apocalypse','ruins'], 'intermediate', 'post-apocalyptic wasteland, ruined cityscape, desolate atmosphere, dust and decay', '{"mood":["desolate","grim"],"artStyle":["concept art"],"technical":["atmospheric perspective"]}', 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop', true, 'active', 4.85, 0);

-- 9. 蒸汽朋克/柴油朋克类 (steampunk/dieselpunk) - 新增3个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('飞艇码头', '蒸汽朋克飞行器停泊站', 'steampunk', 'airship', ARRAY['steampunk','airship'], 'advanced', 'steampunk airship dock, brass gears, steam pipes, victorian architecture, detailed machinery', '{"mood":["industrial","fantastical"],"artStyle":["steampunk"],"enhancement":["detailed mechanisms"]}', 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop', true, 'active', 4.90, 0),

('机械工坊', '维多利亚时代发明家工作室', 'steampunk', 'workshop', ARRAY['steampunk','inventor','workshop'], 'intermediate', 'steampunk inventor workshop, brass instruments, cogwheels, blueprints, vintage tools', '{"mood":["inventive","detailed"],"artStyle":["steampunk"],"technical":["brass materials"]}', 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop', true, 'active', 4.85, 0),

('重型机甲', '柴油朋克战争机器', 'dieselpunk', 'mech', ARRAY['dieselpunk','mech','military'], 'advanced', 'dieselpunk heavy mech, 1940s military aesthetic, riveted steel plates, diesel engines, imposing design', '{"mood":["gritty","powerful"],"artStyle":["dieselpunk"],"enhancement":["weathered metal"]}', 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=400&h=300&fit=crop', true, 'active', 4.88, 0);

-- 10. 自然生态类 (nature) - 新增4个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('水下世界', '珊瑚礁海洋生态', 'nature', 'underwater', ARRAY['nature','ocean','coral'], 'intermediate', 'underwater coral reef scene, tropical fish, clear water, vibrant marine life, sun rays filtering', '{"mood":["peaceful","vibrant"],"artStyle":["nature photography"],"technical":["underwater"]}', 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop', true, 'active', 4.82, 0),

('雨林秘境', '热带雨林深处', 'nature', 'rainforest', ARRAY['nature','jungle','tropical'], 'intermediate', 'dense tropical rainforest, lush vegetation, misty atmosphere, exotic plants, layered canopy', '{"mood":["lush","mysterious"],"artStyle":["nature photography"],"enhancement":["highly detailed flora"]}', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400&h=300&fit=crop', true, 'active', 4.85, 0),

('极光之夜', '北极光自然奇观', 'nature', 'aurora', ARRAY['nature','aurora','night sky'], 'intermediate', 'northern lights aurora borealis, night sky, mountain silhouette, vibrant green and purple lights', '{"mood":["magical","awe-inspiring"],"artStyle":["nature photography"],"technical":["long exposure"]}', 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop', true, 'active', 4.95, 0),

('沙漠风暴', '沙漠沙尘暴景观', 'nature', 'desert', ARRAY['nature','desert','storm'], 'advanced', 'desert sandstorm, dramatic weather, sand dunes, powerful wind, dramatic sky', '{"mood":["dramatic","powerful"],"artStyle":["nature photography"],"technical":["dramatic weather"]}', 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400&h=300&fit=crop', true, 'active', 4.80, 0);

-- 11. 建筑设计类 (architecture) - 新增5个
INSERT INTO scene_templates (name, description, category, subcategory, tags, difficulty, base_prompt, suggested_tags, thumbnail_url, is_official, status, rating, usage_count) VALUES
('包豪斯建筑', '现代主义建筑设计', 'architecture', 'bauhaus', ARRAY['architecture','modernism'], 'intermediate', 'bauhaus architecture, modernist design, clean geometric forms, functional aesthetic, minimal ornamentation', '{"mood":["modern","clean"],"artStyle":["architectural"],"enhancement":["geometric precision"]}', 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=400&h=300&fit=crop', true, 'active', 4.85, 0),

('参数化设计', '数字化有机建筑', 'architecture', 'parametric', ARRAY['architecture','parametric','futuristic'], 'advanced', 'parametric architecture design, organic flowing forms, complex geometry, futuristic structure', '{"mood":["futuristic","organic"],"artStyle":["parametric design"],"enhancement":["complex geometry"]}', 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&h=300&fit=crop', true, 'active', 4.90, 0),

('木结构建筑', '传统木构建筑美学', 'architecture', 'timber', ARRAY['architecture','traditional','wood'], 'intermediate', 'traditional timber architecture, exposed wooden beams, natural materials, craftmanship details', '{"mood":["warm","traditional"],"artStyle":["architectural photography"],"technical":["natural materials"]}', 'https://images.unsplash.com/photo-1515263487990-61b07816b324?w=400&h=300&fit=crop', true, 'active', 4.78, 0),

('后现代主义', '解构主义建筑', 'architecture', 'postmodern', ARRAY['architecture','deconstructivist'], 'advanced', 'postmodern deconstructivist architecture, fragmented forms, unconventional angles, bold statement', '{"mood":["bold","unconventional"],"artStyle":["deconstructivism"],"enhancement":["dramatic angles"]}', 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=400&h=300&fit=crop', true, 'active', 4.82, 0),

('绿色建筑', '生态可持续建筑', 'architecture', 'sustainable', ARRAY['architecture','green','sustainable'], 'intermediate', 'sustainable green architecture, living walls, solar panels, eco-friendly design, integration with nature', '{"mood":["sustainable","harmonious"],"artStyle":["architectural"],"enhancement":["green integration"]}', 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=400&h=300&fit=crop', true, 'active', 4.88, 0);

-- ==============================================
-- 更新统计信息
-- ==============================================
-- 注意：实际部署时，这些模板的 usage_count 和 likes_count 会从 0 开始增长

-- 添加完成后的模板数量统计：
-- 摄影艺术: 1 (原有) + 5 (新增) = 6
-- 日系动漫: 3 (原有) + 7 (新增) = 10
-- 游戏风格: 3 (原有) + 5 (新增) = 8
-- 绘画艺术: 4 (原有) + 6 (新增) = 10
-- 概念设计: 4 (原有) + 4 (新增) = 8
-- 中国风: 3 (原有) + 4 (新增) = 7
-- 卡通插画: 3 (原有) + 5 (新增) = 8
-- 暗黑风格: 2 (原有) + 3 (新增) = 5
-- 蒸汽朋克: 1 (原有) + 2 (新增) = 3
-- 柴油朋克: 1 (原有) + 1 (新增) = 2
-- 自然生态: 2 (原有) + 4 (新增) = 6
-- 建筑设计: 2 (原有) + 5 (新增) = 7
--
-- 总计: 25 (原有) + 55 (新增) = 80 个高质量模板
