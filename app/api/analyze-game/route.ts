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
    ? `You are a sharp sports betting analyst. Today is ${today}.

Analyze this player prop bet:
${context || `${team1} — ${team2}`}

This is a real bet available right now. Give your honest assessment.
Reply ONLY with this exact JSON, no other text:
{"pick":"OVER or UNDER or SKIP","confidence":"high or medium or low","reasoning":"one sentence about whether this prop has value based on the player's known ability","injuries":"any known concerns or none","form":"brief assessment of this player","edge":"why this prop is worth taking or not","warning":"any concern or null","avoid":false}`

    : `You are a sharp sports betting analyst. Today is ${today}.

Analyze this real game happening now or very soon:
${team1} vs ${team2}
Sport: ${sport}
Current odds: ${team1} at ${odds1}, ${team2} at ${odds2}

This game is happening today or this week in 2026. Give a real analysis based on what you know about these teams.
Reply ONLY with this exact JSON, no other text:
{"pick":"${team1} or ${team2} or SKIP","confidence":"high or medium or low","reasoning":"one sentence about which team has the edge","injuries":"any known player concerns or none","form":"brief recent form for both teams","edge":"what gives the pick value","warning":"any red flag or null","avoid":false}`

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
