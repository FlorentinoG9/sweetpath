import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function logInfo(message) {
  process.stdout.write(`[install-python-deps] ${message}\n`);
}

function logError(message) {
  process.stderr.write(`[install-python-deps] ${message}\n`);
}

function resolvePythonCommand() {
  if (process.env.PYTHON) return process.env.PYTHON;
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    return 'python3';
  } catch {
    return 'python';
  }
}

function installDependencies() {
  const scriptPath = fileURLToPath(import.meta.url);
  const repoRoot = dirname(dirname(scriptPath));
  const apiPath = join(repoRoot, 'apps', 'api');
  const pyprojectPath = join(apiPath, 'pyproject.toml');

  if (!existsSync(pyprojectPath)) {
    logInfo('No Python project detected at apps/api; skipping install.');
    return;
  }

  const python = resolvePythonCommand();

  logInfo(`Installing Python dependencies in ${apiPath} using ${python}.`);

  try {
    execSync(`${python} -m pip install --upgrade pip`, {
      cwd: apiPath,
      stdio: 'inherit',
    });
    execSync(`${python} -m pip install -e .`, {
      cwd: apiPath,
      stdio: 'inherit',
    });
    logInfo('Python dependencies installed successfully.');
  } catch (error) {
    logError('Failed to install Python dependencies.');
    if (error instanceof Error && error.message) {
      logError(error.message);
    }
    process.exitCode = 1;
  }
}

installDependencies();

