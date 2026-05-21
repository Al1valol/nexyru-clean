import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { team1, team2, sport, odds1, odds2, gameTime, context } = await req.json()

  const isPlayerProp = context?.includes('Player prop') ||
    team2?.includes('OVER') || team2?.includes('UNDER')

  const today = new Date().toLocaleDateString('en-US', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  })

  const prompt = isPlayerProp
    ? `Sports betting analyst. Today is ${today}. Analyze this prop:
${context || `${team1} — ${team2}`}
You may not have perfect data but give your best assessment based on the player's known career.
Reply ONLY with JSON: {"pick":"OVER or UNDER or SKIP","confidence":"high or medium or low","reasoning":"one sentence","injuries":"none","form":"brief note","edge":"brief note","warning":null,"avoid":false}`

    : `Sports betting analyst. Today is ${today}.
Game: ${team1} vs ${team2} (${sport})
Odds: ${team1} ${odds1 > 0 ? '+' : ''}${odds1}, ${team2} ${odds2 > 0 ? '+' : ''}${odds2}

Pick ONE team or SKIP. Base it on:
- Odds value (which side has better value)
- Team quality if you know these teams
- Implied probability vs real probability

Do NOT refuse because of missing data. Make a best guess pick.
Reply ONLY with JSON: {"pick":"${team1} or ${team2} or SKIP","confidence":"high or medium or low","reasoning":"one sentence","injuries":"none","form":"brief note","edge":"brief note","warning":null,"avoid":false}`

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
    if (!result) result = {
      pick:'SKIP', confidence:'low',
      reasoning:'Analysis unavailable',
      injuries:'none', form:'N/A', edge:'N/A', warning:null, avoid:false
    }

    return NextResponse.json(result)
  } catch(e: any) {
    return NextResponse.json({
      pick:'SKIP', confidence:'low',
      reasoning:'Service unavailable',
      injuries:'none', form:'N/A', edge:'N/A', warning:null, avoid:false
    })
  }
}
