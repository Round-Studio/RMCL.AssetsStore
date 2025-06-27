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

async function buildStaticSite() {
  const publicDir = path.join(__dirname, '../../public');
  const publishDir = path.join(__dirname, '../../publish');
  
  // 清空并重建 publish 目录
  if (fs.existsSync(publishDir)) {
    fs.rmSync(publishDir, { recursive: true });
  }
  fs.mkdirSync(publishDir, { recursive: true });

  // 1. 复制所有静态文件
  copyFolderRecursiveSync(publicDir, publishDir);

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
        versions: item.versions.map(v => v.version)
      })))
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
          versions: item.versions.map(v => ({
            version: v.version,
            info: v.info,
            files: v.files.map(f => ({
              name: f,
              downloadUrl: `/down/${category}/${item.name}/${v.version}/${f}`
            }))
          }))
        })
      );

      // 每个版本的详情
      for (const version of item.versions) {
        fs.writeFileSync(
          path.join(itemApiDir, `${version.version}.json`),
          JSON.stringify({
            name: item.name,
            version: version.version,
            info: version.info,
            files: version.files.map(f => ({
              name: f,
              downloadUrl: `/down/${category}/${item.name}/${version.version}/${f}`,
              size: fs.statSync(
                path.join(categoryDir, item.name, version.version, f)
              ).size
            }))
          })
        );
      }
    }
  }

  console.log('Static site build completed!');
  console.log(`Deploy contents from: ${publishDir}`);
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
            .filter(f => !f.endsWith('.json'));
          
          let info = {};
          const infoPath = path.join(versionDir, 'info.json');
          if (fs.existsSync(infoPath)) {
            try {
              info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
            } catch (e) {
              console.error(`Error parsing info.json for ${versionDir}:`, e);
            }
          }

          return {
            version: v.name,
            info,
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