import express from 'express';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

// 设置静态文件服务 - 现在直接从 publish 目录提供服务
app.use('/down', express.static(path.join(__dirname, '../publish/down')));
app.use('/api', express.static(path.join(__dirname, '../publish/api')));

// 支持的分类
const CATEGORIES = ['plugin', 'skin', 'code'] as const;
type Category = typeof CATEGORIES[number];

interface FileItem {
  name: string;
  downloadUrl: string;
  size: number;
}

interface VersionResponse {
  name: string;
  version: string;
  info?: any;
  files: FileItem[];
}

// 加载索引文件
function loadIndex(category: Category): any[] {
  const indexPath = path.join(__dirname, '../publish', `${category}-index.json`);
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
  return [];
}

// 获取分类下的所有项目
CATEGORIES.forEach(category => {
  app.get(`/api/${category}`, (req, res) => {
    try {
      const index = loadIndex(category);
      // 只返回项目名称列表
      const items = index.map((item: any) => ({
        name: item.name,
        versions: item.versions.map((v: any) => v.version)
      }));
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: `Failed to load ${category} index` });
    }
  });
});

// 获取特定项目的所有版本
CATEGORIES.forEach(category => {
  app.get(`/api/${category}/:item`, (req, res) => {
    try {
      const index = loadIndex(category);
      const item = index.find((i: any) => i.name === req.params.item);
      
      if (!item) {
        return res.status(404).json({ error: `${req.params.item} not found in ${category}` });
      }
      
      // 返回版本信息
      res.json({
        name: item.name,
        versions: item.versions.map((v: any) => ({
          version: v.version,
          info: v.info,
          files: v.files.map((file: string) => ({
            name: file,
            downloadUrl: `/down/${category}/${item.name}/${v.version}/${file}`
          }))
        }))
      });
    } catch (err) {
      res.status(500).json({ error: `Failed to load ${req.params.item} from ${category}` });
    }
  });
});

// 获取特定版本的详细信息
CATEGORIES.forEach(category => {
  app.get(`/api/${category}/:item/:version`, (req, res) => {
    try {
      const index = loadIndex(category);
      const item = index.find((i: any) => i.name === req.params.item);
      
      if (!item) {
        return res.status(404).json({ error: `${req.params.item} not found in ${category}` });
      }
      
      const version = item.versions.find((v: any) => v.version === req.params.version);
      
      if (!version) {
        return res.status(404).json({ error: `Version ${req.params.version} not found for ${req.params.item}` });
      }
      
      // 检查文件是否实际存在于 publish 目录
      const versionDir = path.join(__dirname, '../publish', category, item.name, version.version);
      const existingFiles = version.files.filter((file: string) => 
        fs.existsSync(path.join(versionDir, file))
      );
      
      // 返回文件列表和下载链接
      const response: VersionResponse = {
        name: item.name,
        version: version.version,
        info: version.info,
        files: existingFiles.map((file: string) => ({
          name: file,
          downloadUrl: `/down/${category}/${item.name}/${version.version}/${file}`,
          size: fs.statSync(path.join(versionDir, file)).size
        }))
      };
      
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: `Failed to load version ${req.params.version} of ${req.params.item}` });
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Available API routes:`);
  CATEGORIES.forEach(category => {
    console.log(`  /api/${category} - List all ${category} items`);
    console.log(`  /api/${category}/:item - Get versions for a ${category} item`);
    console.log(`  /api/${category}/:item/:version - Get files for a specific version`);
  });
  console.log(`Download files from /down/:category/:item/:version/:filename`);
});