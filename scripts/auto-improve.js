const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')

const client = new Anthropic()

async function analyzeAndImprove() {
  console.log('🤖 Auto-improve bot starting...')

  // Read key files to understand current state
  const files = [
    'app/dashboard/CryptoDashboard.tsx',
    'app/sports/page.tsx',
    'app/api/gems/route.ts',
    'app/globals.css',
  ]

  const fileContents = {}
  for (const file of files) {
    try {
      fileContents[file] = fs.readFileSync(file, 'utf8').substring(0, 3000)
    } catch(e) {
      console.log(`Could not read ${file}`)
    }
  }

  // Ask Claude what to improve
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a code improvement bot for Nexyru, a trading platform.

Current code state (truncated):
${Object.entries(fileContents).map(([f,c]) => `\n=== ${f} ===\n${c}`).join('\n')}

Look for:
1. Console.log statements that should be removed
2. TODO comments that can be implemented
3. Error handling that is missing
4. Performance improvements
5. Dead code to remove

List exactly 3 small safe improvements as JSON:
{
  "improvements": [
    {
      "file": "relative/path/to/file.ts",
      "description": "what to fix",
      "find": "exact string to find",
      "replace": "exact string to replace with"
    }
  ]
}`
    }]
  })

  const text = response.content[0].text
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    console.log('No improvements suggested')
    return
  }

  const { improvements } = JSON.parse(match[0])

  for (const imp of improvements) {
    try {
      const filePath = path.join(process.cwd(), imp.file)
      if (!fs.existsSync(filePath)) continue

      let content = fs.readFileSync(filePath, 'utf8')
      if (!content.includes(imp.find)) {
        console.log(`Could not find text in ${imp.file}: ${imp.description}`)
        continue
      }

      content = content.replace(imp.find, imp.replace)
      fs.writeFileSync(filePath, content)
      console.log(`✅ Applied: ${imp.description} in ${imp.file}`)
    } catch(e) {
      console.error(`Failed to apply improvement: ${e.message}`)
    }
  }

  console.log('🤖 Auto-improve bot done')
}

analyzeAndImprove().catch(console.error)
