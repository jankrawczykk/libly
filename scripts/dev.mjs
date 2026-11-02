import { spawn } from 'node:child_process'
import process from 'node:process'

const npmCliPath = process.env['npm_execpath']
if (npmCliPath === undefined) {
  throw new Error('npm_execpath is required to start workspace dev servers.')
}

const workspaces = ['@libly/server', '@libly/web']
const children = workspaces.map((workspace) => ({
  workspace,
  process: spawn(
    process.execPath,
    [npmCliPath, 'run', 'dev', '--workspace', workspace],
    { stdio: 'inherit' },
  ),
}))

let stopping = false

function stop(signal) {
  if (stopping) {
    return
  }
  stopping = true

  for (const child of children) {
    if (child.process.exitCode === null && child.process.signalCode === null) {
      child.process.kill(signal)
    }
  }
}

for (const child of children) {
  child.process.on('error', (error) => {
    console.error(`Failed to start ${child.workspace}:`, error)
    process.exitCode = 1
    stop('SIGTERM')
  })

  child.process.on('exit', (code, signal) => {
    if (stopping) {
      return
    }

    console.error(
      `${child.workspace} dev process exited unexpectedly (${String(code ?? signal)}).`,
    )
    process.exitCode = code === 0 ? 1 : (code ?? 1)
    stop('SIGTERM')
  })
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
