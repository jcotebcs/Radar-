#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Import optimization tools
const terser = require('terser');
const postcss = require('postcss');
const cssnano = require('cssnano');
const { minify: minifyHTML } = require('html-minifier-terser');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);

const sourceDir = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, '..', 'dist');

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function minifyJS(inputPath, outputPath) {
  console.log(`Minifying JS: ${inputPath} -> ${outputPath}`);
  const code = await readFile(inputPath, 'utf8');
  const result = await terser.minify(code, {
    compress: {
      drop_console: process.env.NODE_ENV === 'production',
      drop_debugger: true,
      pure_funcs: ['console.log', 'console.info']
    },
    mangle: true,
    format: {
      comments: false
    }
  });
  
  if (result.error) {
    throw result.error;
  }
  
  await writeFile(outputPath, result.code);
  console.log(`✓ Minified JS: ${path.basename(inputPath)}`);
}

async function minifyCSS(inputPath, outputPath) {
  console.log(`Minifying CSS: ${inputPath} -> ${outputPath}`);
  const css = await readFile(inputPath, 'utf8');
  const result = await postcss([cssnano()]).process(css, { from: inputPath });
  await writeFile(outputPath, result.css);
  console.log(`✓ Minified CSS: ${path.basename(inputPath)}`);
}

async function minifyHTMLFile(inputPath, outputPath) {
  console.log(`Minifying HTML: ${inputPath} -> ${outputPath}`);
  const html = await readFile(inputPath, 'utf8');
  const minified = await minifyHTML(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: true
  });
  await writeFile(outputPath, minified);
  console.log(`✓ Minified HTML: ${path.basename(inputPath)}`);
}

async function copyAssets() {
  console.log('Copying static assets...');
  const files = ['manifest.json'];
  
  for (const file of files) {
    const src = path.join(sourceDir, file);
    const dest = path.join(distDir, file);
    
    if (fs.existsSync(src)) {
      await copyFile(src, dest);
      console.log(`✓ Copied: ${file}`);
    }
  }
}

async function generateCacheManifest() {
  console.log('Generating cache manifest...');
  const files = [];
  const distFiles = fs.readdirSync(distDir);
  
  for (const file of distFiles) {
    if (file !== 'sw.js') { // Service worker shouldn't cache itself
      files.push(`/${file}`);
    }
  }
  
  const manifest = {
    version: Date.now(),
    files: files
  };
  
  await writeFile(
    path.join(distDir, 'cache-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`✓ Generated cache manifest with ${files.length} files`);
}

async function build() {
  try {
    console.log('🚀 Starting build process...');
    console.log(`Source: ${sourceDir}`);
    console.log(`Output: ${distDir}`);
    
    // Ensure dist directory exists
    await ensureDir(distDir);
    
    // Process files
    await Promise.all([
      minifyJS(
        path.join(sourceDir, 'app.js'),
        path.join(distDir, 'app.js')
      ),
      minifyCSS(
        path.join(sourceDir, 'style.css'),
        path.join(distDir, 'style.css')
      ),
      minifyHTMLFile(
        path.join(sourceDir, 'index.html'),
        path.join(distDir, 'index.html')
      )
    ]);
    
    // Copy static assets
    await copyAssets();
    
    // Generate cache manifest
    await generateCacheManifest();
    
    console.log('✅ Build completed successfully!');
    
    // Display build stats
    const getFileSize = (filePath) => {
      const stats = fs.statSync(filePath);
      return (stats.size / 1024).toFixed(2);
    };
    
    console.log('\n📊 Build Statistics:');
    const files = fs.readdirSync(distDir);
    for (const file of files) {
      const size = getFileSize(path.join(distDir, file));
      console.log(`  ${file}: ${size} KB`);
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build if called directly
if (require.main === module) {
  build();
}

module.exports = { build };