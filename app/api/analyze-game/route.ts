import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { team1, team2, sport, odds1, odds2, gameTime } = await req.json()

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `Sports betting analyst. Analyze this ${sport} matchup and give a pick.

${team1} (${odds1}) vs ${team2} (${odds2})
Time: ${gameTime}

Reply with ONLY this JSON, no other text:
{"pick":"${team1} or ${team2} or SKIP","confidence":"high or medium or low","reasoning":"one sentence why","injuries":"any known concerns or none","form":"brief team quality notes","edge":"why this pick has value","warning":"red flag or null","avoid":false}`
      }]
    })

    const text = message.content.find((b: any) => b.type === 'text')?.text || '{}'

    let result: any = null
    try { result = JSON.parse(text.replace(/```json|```/g,'').trim()) } catch(e) {}
    if (!result) {
      try { const m = text.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : null } catch(e) {}
    }
    if (!result) result = { pick:'SKIP', confidence:'low', reasoning:'Analysis unavailable', injuries:'none', form:'N/A', edge:'N/A', warning:null, avoid:false }

    return NextResponse.json(result)
  } catch(e: any) {
    return NextResponse.json({ pick:'SKIP', confidence:'low', reasoning:'Service unavailable', injuries:'none', form:'N/A', edge:'N/A', warning:null, avoid:false })
  }
}
