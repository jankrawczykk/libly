import { spawnSync } from 'node:child_process'

const result = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' })

if (result.error) {
  console.error(`Unable to list tracked files: ${result.error.message}`)
  process.exitCode = 1
} else if (result.status !== 0) {
  console.error(`git ls-files failed with status ${result.status}`)
  process.exitCode = 1
} else {
  const forbiddenFiles = result.stdout
    .split('\0')
    .filter(Boolean)
    .filter(
      (file) => file !== '.env.example' && /(?:^|\/)\.env(?:$|[.-])/.test(file),
    )

  if (forbiddenFiles.length > 0) {
    console.error('Tracked environment files are not allowed:')
    for (const file of forbiddenFiles) {
      console.error(`  ${file}`)
    }
    process.exitCode = 1
  } else {
    console.log('No tracked .env files found (except .env.example).')
  }
}
