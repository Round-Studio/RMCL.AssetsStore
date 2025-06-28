import fs from 'fs';
import path from 'path';

interface VersionInfo {
  version: string;
  files: string[];
}

interface PluginItem {
  name: string;
  versions: VersionInfo[];
}

async function buildStaticSite() {
  const publicDir = path.join(__dirname, '../public');
  const publishDir = path.join(__dirname, '../publish');
  
  // 清空并重建 publish 目录
  if (fs.existsSync(publishDir)) {
    fs.rmSync(publishDir, { recursive: true });
  }
  fs.mkdirSync(publishDir, { recursive: true });

  // 1. 复制所有静态文件
  copyFolderRecursiveSync(publicDir, path.join(publishDir,"down"));

  // 2. 生成静态 API 文件
  const categories = ['plugin', 'skin', 'code'];
  
  // 创建 API 目录
  const apiDir = path.join(publishDir, 'api');
  fs.mkdirSync(apiDir, { recursive: true });

  for (const category of categories) {
    const categoryDir = path.join(publicDir, category);
    if (!fs.existsSync(categoryDir)) continue;

    // 生成分类索引
    const items = scanCategory(categoryDir);
    fs.writeFileSync(
      path.join(apiDir, `${category}.json`),
      JSON.stringify(items.map(item => ({
        name: item.name,
        description: getItemDescription(categoryDir, item.name), // 添加项目描述
        versions: item.versions.map(v => v.version)
      })), null, 2) // 添加格式化使JSON更易读
    );

    // 生成每个项目的版本索引
    for (const item of items) {
      const itemApiDir = path.join(apiDir, category, item.name);
      fs.mkdirSync(itemApiDir, { recursive: true });

      // 项目总览
      fs.writeFileSync(
        path.join(itemApiDir, 'index.json'),
        JSON.stringify({
          name: item.name,
          description: getItemDescription(categoryDir, item.name), // 添加项目描述
          versions: item.versions.map(v => ({
            version: v.version,
            files: v.files.map(f => ({
              name: f,
              downloadUrl: `/down/${category}/${item.name}/${v.version}/${f}`
            }))
          }))
        }, null, 2)
      );
    }
  }

  console.log('Static site build completed!');
  console.log(`Deploy contents from: ${publishDir}`);
}

// 新增：获取项目描述信息
function getItemDescription(categoryDir: string, itemName: string): string {
  const infoPath = path.join(categoryDir, itemName, 'info.txt');
  try {
    if (fs.existsSync(infoPath)) {
      return fs.readFileSync(infoPath, 'utf-8').trim();
    }
  } catch (e) {
    console.error(`Error reading description for ${itemName}:`, e);
  }
  return ''; // 默认返回空字符串
}

function scanCategory(categoryDir: string): PluginItem[] {
  return fs.readdirSync(categoryDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => {
      const itemDir = path.join(categoryDir, dirent.name);
      const versions = fs.readdirSync(itemDir, { withFileTypes: true })
        .filter(v => v.isDirectory())
        .map(v => {
          const versionDir = path.join(itemDir, v.name);
          const files = fs.readdirSync(versionDir)
            .filter(f => !f.endsWith('.txt'));

          return {
            version: v.name,
            files
          };
        });

      return {
        name: dirent.name,
        versions
      };
    });
}

function copyFolderRecursiveSync(source: string, target: string) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  fs.readdirSync(source).forEach(file => {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}

buildStaticSite().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});