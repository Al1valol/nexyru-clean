import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { team1, team2, sport, odds1, odds2, gameTime, context } = await req.json()

  const isPlayerProp = typeof team2 === 'string' && (team2.includes('OVER') || team2.includes('UNDER'))

  const prompt = isPlayerProp
    ? `You are a sports betting analyst. Analyze this player prop bet.

Player: ${team1}
Bet: ${team2} ${context || ''}
Odds: -110

Based on what you know about ${team1}'s performance and consistency, reply ONLY with JSON:
{"pick":"${team2} or SKIP","confidence":"high or medium or low","reasoning":"one sentence about this player prop","injuries":"any known injury concerns or none","form":"recent performance assessment","edge":"why this prop has value or not","warning":"any red flag or null","avoid":false}`
    : `You are a sports betting analyst. Analyze this matchup.

${team1} vs ${team2}
Sport: ${sport}
Odds: ${team1} at ${odds1}, ${team2} at ${odds2}
Time: ${gameTime}

Reply ONLY with JSON:
{"pick":"${team1} or ${team2} or SKIP","confidence":"high or medium or low","reasoning":"one sentence why","injuries":"any known concerns or none","form":"brief assessment","edge":"why this pick has value","warning":"red flag or null","avoid":false}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }]
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
