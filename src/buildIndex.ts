import fs from 'fs';
import path from 'path';

interface VersionInfo {
  version: string;
  info?: any;
  files: string[];
}

interface PluginItem {
  name: string;
  versions: VersionInfo[];
}

interface CategoryIndex {
  plugins: PluginItem[];
}

async function buildIndex() {
  const publicDir = path.join(__dirname, '../public');
  const publishDir = path.join(__dirname, '../publish');
  
  // 清空并重新创建 publish 目录
  if (fs.existsSync(publishDir)) {
    fs.rmSync(publishDir, { recursive: true });
  }
  fs.mkdirSync(publishDir, { recursive: true });
  
  // 要处理的分类
  const categories = ['plugin', 'skin', 'code'];
  
  // 为每个分类构建索引
  for (const category of categories) {
    const categoryDir = path.join(publicDir, category);
    if (!fs.existsSync(categoryDir)) continue;
    
    const items = fs.readdirSync(categoryDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    const categoryIndex: PluginItem[] = [];
    
    for (const item of items) {
      const itemDir = path.join(categoryDir, item);
      const versions = fs.readdirSync(itemDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      const versionInfos: VersionInfo[] = [];
      
      for (const version of versions) {
        const versionDir = path.join(itemDir, version);
        const publishVersionDir = path.join(publishDir, category, item, version);
        
        // 创建目标目录
        fs.mkdirSync(publishVersionDir, { recursive: true });
        
        // 获取文件列表
        const files = fs.readdirSync(versionDir)
          .filter(file => !file.endsWith('.json'));
        
        // 复制文件到 publish 目录
        files.forEach(file => {
          const sourcePath = path.join(versionDir, file);
          const destPath = path.join(publishVersionDir, file);
          fs.copyFileSync(sourcePath, destPath);
        });
        
        // 查找 info.json
        let info = {};
        const infoPath = path.join(versionDir, 'info.json');
        if (fs.existsSync(infoPath)) {
          try {
            info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
            // 复制 info.json 到 publish 目录
            fs.copyFileSync(infoPath, path.join(publishVersionDir, 'info.json'));
          } catch (e) {
            console.error(`Error parsing info.json for ${category}/${item}/${version}:`, e);
          }
        }
        
        versionInfos.push({
          version,
          info,
          files
        });
      }
      
      categoryIndex.push({
        name: item,
        versions: versionInfos
      });
    }
    
    // 将分类索引写入 publish 文件夹
    const indexPath = path.join(publishDir, `${category}-index.json`);
    fs.writeFileSync(indexPath, JSON.stringify(categoryIndex, null, 2));
    console.log(`Built ${category} index with ${categoryIndex.length} items`);
  }
  
  console.log('Index building and file copying completed');
}

// 执行构建
buildIndex().catch(err => {
  console.error('Error building index:', err);
  process.exit(1);
});