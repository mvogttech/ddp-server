const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function diagnoseBuild() {
  console.log('Diagnosing build output for @meteor/ddp-server...');

  // Check if src/server.ts exists
  const serverPath = path.resolve(__dirname, '../src/server.ts');
  try {
    await fs.access(serverPath);
    console.log('✔ src/server.ts exists');
  } catch {
    console.error(
      '✘ src/server.ts missing. Ensure src/server.ts is present and matches the expected implementation.'
    );
    process.exit(1);
  }

  // Check if dist/ exists
  const distDir = path.resolve(__dirname, '../dist');
  try {
    await fs.access(distDir);
    console.log('✔ dist/ directory exists');
  } catch {
    console.log('dist/ directory missing. Attempting to build...');
  }

  // Run tsc to compile and capture errors
  console.log('Running TypeScript compilation (tsc)...');
  try {
    await execPromise('npx tsc');
    console.log('✔ TypeScript compilation succeeded');
  } catch (err) {
    console.error('✘ TypeScript compilation failed:');
    console.error(err.stdout || err.stderr || err.message);
    console.error('Fix compilation errors and run `npm run build` again.');
    process.exit(1);
  }

  // Check for dist/index.js
  const indexPath = path.join(distDir, 'index.js');
  try {
    await fs.access(indexPath);
    console.log('✔ dist/index.js exists');
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    if (indexContent.includes("from './server'")) {
      console.log('✔ dist/index.js imports ./server');
    } else {
      console.error('✘ dist/index.js missing import for ./server');
    }
  } catch {
    console.error(
      '✘ dist/index.js missing. Compilation may have failed silently.'
    );
    process.exit(1);
  }

  // Check for dist/server.js
  const compiledServerPath = path.join(distDir, 'server.js');
  try {
    await fs.access(compiledServerPath);
    console.log('✔ dist/server.js exists');
  } catch {
    console.error(
      '✘ dist/server.js missing. Compilation did not generate src/server.ts output.'
    );
    console.error('Possible causes:');
    console.error('- src/server.ts has compilation errors.');
    console.error('- tsconfig.json excludes src/server.ts.');
    console.error(
      '- File system issues (e.g., permissions, case sensitivity).'
    );
    process.exit(1);
  }

  // Attempt to import dist/index.js
  try {
    await import('../dist/index.js');
    console.log('✔ Successfully imported dist/index.js');
  } catch (err) {
    console.error('✘ Failed to import dist/index.js:', err);
    console.error(
      'This indicates a module resolution issue in dist/server.js.'
    );
    process.exit(1);
  }

  console.log(
    'Diagnosis complete. Run `npm run test:perf:load` to verify the fix.'
  );
}

diagnoseBuild().catch((err) => {
  console.error('Diagnosis failed:', err);
  process.exit(1);
});
