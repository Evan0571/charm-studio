import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
if (existsSync('.env')) process.loadEnvFile('.env');

let activeChild;
let stopping = false;
let stopTimer;
function stopChild() {
  if (activeChild?.pid) {
    const pid = activeChild.pid;
    try { process.kill(-pid, 'SIGTERM'); } catch { /* Already stopped. */ }
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      try { process.kill(-pid, 'SIGKILL'); } catch { /* Already stopped. */ }
    }, 4000);
    stopTimer.unref();
  }
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => { stopping = true; stopChild(); });
}

function run(command, args) {
  // A separate process group lets closing Terminal also stop the dev server.
  const child = spawn(command, args, {
    stdio: 'inherit', detached: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });
  activeChild = child;
  return new Promise(resolve => {
    child.once('error', () => {
      console.error(`无法运行 ${command}。请检查 Node.js / npm 是否安装完整。`);
      resolve(1);
    });
    child.once('exit', code => {
      clearTimeout(stopTimer);
      if (activeChild === child) activeChild = undefined;
      resolve(code ?? 1);
    });
  });
}

async function isStudio(url) {
  try {
    const response = await fetch(`${url}/api/catalog`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const data = await response.json();
    return data.currency === 'USD' && Array.isArray(data.parts) &&
      ['cord', 'chain', 'hero'].every(id => data.templates?.some(template => template.id === id));
  } catch { return false; }
}

function openBrowser(url) {
  console.log(`\n工作室已就绪：${url}\n`);
  const result = spawnSync('/usr/bin/open', [url]);
  if (result.error || result.status !== 0) console.log('请在浏览器中打开上面的地址。');
}

async function main() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('.env 中的 PORT 必须是 1–65535 的整数。');
  const host = process.env.HOST || '127.0.0.1';
  const browserHost = ['127.0.0.1', '0.0.0.0', '::', '::1', 'localhost'].includes(host) ? 'localhost' : host;
  const url = `http://${browserHost.includes(':') ? `[${browserHost}]` : browserHost}:${port}`;
  const probeHost = host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '::1' : host;
  const probeUrl = `http://${probeHost.includes(':') ? `[${probeHost}]` : probeHost}:${port}`;

  const alreadyRunning = await isStudio(probeUrl);
  if (stopping) return;
  if (alreadyRunning) {
    console.log('工作室已经在运行，直接打开现有页面。');
    openBrowser(url);
    return;
  }
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`无法使用 ${host}:${port}。请检查 HOST 设置、关闭占用端口的程序，或修改 .env 中的 PORT。`)));
    probe.listen(port, host, () => probe.close(resolve));
  });
  if (stopping) return;

  const { packageManager } = JSON.parse(readFileSync('package.json', 'utf8'));
  const version = packageManager.split('@')[1];
  const installed = spawnSync('pnpm', ['--version'], { encoding: 'utf8' });
  const command = installed.status === 0 && installed.stdout.trim() === version ? 'pnpm' : 'npx';
  const prefix = command === 'npx' ? ['--yes', packageManager] : [];

  console.log('正在检查并安装项目依赖，首次启动可能需要几分钟……');
  if (await run(command, [...prefix, 'install', '--frozen-lockfile', '--prefer-offline']) !== 0) {
    if (stopping) return;
    throw new Error('依赖安装失败，请检查网络连接后重试。');
  }
  if (stopping) return;

  console.log('\n正在启动网站……保留此窗口；停止服务请按 Control + C。');
  let exited = false;
  const completion = run(process.execPath, ['--import', 'tsx', 'server/index.ts']).then(code => { exited = true; return code; });
  const deadline = Date.now() + 90_000;
  let ready = false;
  while (!exited && !stopping && Date.now() < deadline) {
    if (await isStudio(probeUrl)) { ready = true; break; }
    await delay(500);
  }
  if (ready && !stopping) openBrowser(url);
  else if (!exited && !stopping) {
    stopChild();
    throw new Error('网站未能在 90 秒内启动，请查看上方运行日志。');
  }
  const exitCode = await completion;
  process.exitCode = stopping ? 0 : exitCode;
}

try { await main(); }
catch (error) { stopChild(); console.error(`\n${error.message}`); process.exitCode = 1; }
