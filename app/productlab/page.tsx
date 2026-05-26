'use client'
import React, { useState, useEffect } from 'react'
import {
  Sparkles, TrendingUp, Package, Video, Globe, Users,
  DollarSign, Search, ChevronRight, Copy, CheckCircle,
  Star, Zap, Target, BarChart2, ArrowUpRight, RefreshCw,
  BookOpen, Lightbulb, Factory, Megaphone, ShoppingBag,
  FileText, X, Plus, ChevronDown, Award, Rocket, Brain,
  PenTool, Link, Phone, Mail, ExternalLink
} from 'lucide-react'

// ── Nav ────────────────────────────────────────────
function TopNav() {
  return (
    <div style={{
      borderBottom:'1px solid #1e1e2a', padding:'0 24px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      background:'rgba(9,9,11,0.97)', backdropFilter:'blur(8px)',
      position:'sticky', top:0, zIndex:100, height:52
    }}>
      <div style={{fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', minWidth:80}}>Nexyru</div>
      <nav style={{display:'flex', gap:0, alignItems:'center'}}>
        {[
          {label:'Trading', href:'/dashboard'},
          {label:'Crypto', href:'/crypto'},
          {label:'Sports', href:'/sports'},
          {label:'Options', href:'/options'},
          {label:'Airdrops', href:'/airdrops'},
          {label:'Business Lab', href:'/productlab', active:true},
        ].map(l => (
          <a key={l.href} href={l.href} style={{
            padding:'6px 14px', fontSize:13,
            color: l.active ? '#fff' : '#4b5563',
            textDecoration:'none', whiteSpace:'nowrap',
            fontWeight: l.active ? 700 : 500,
            borderBottom: l.active ? '2px solid #6366f1' : '2px solid transparent',
            display:'inline-flex', alignItems:'center', height:52,
            transition:'color 0.15s'
          }}>{l.label}</a>
        ))}
      </nav>
      <div style={{minWidth:80, display:'flex', justifyContent:'flex-end'}}>
        <a href="/morning" style={{fontSize:12, color:'#6b7280', textDecoration:'none', padding:'5px 10px', borderRadius:6, border:'1px solid #1e1e2a'}}>Briefing</a>
      </div>
    </div>
  )
}

// ── AI Call helper ─────────────────────────────────
async function askAI(prompt: string, maxTokens = 1500): Promise<any> {
  const res = await fetch('/api/analyze-game', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      team1: 'CREATE', team2: 'SKIP', sport: 'PRODUCT_ANALYSIS',
      odds1: 0, odds2: 0, gameTime: 'Now',
      context: prompt
    })
  })
  const data = await res.json()
  const text = data.reasoning || data.edge || JSON.stringify(data)
  const match = text.match(/\{[\s\S]*\}/)
  if (match) return JSON.parse(match[0])
  return null
}

// ── Section: Product Ideation ─────────────────────
function ProductIdeation() {
  const [loading, setLoading] = useState(false)
  const [ideas, setIdeas] = useState<any[]>([])
  const [interests, setInterests] = useState('')
  const [budget, setBudget] = useState('5000')
  const [savedIdeas, setSavedIdeas] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('bizlab_saved_ideas') || '[]') } catch { return [] }
  })

  const generateIdeas = async () => {
    if (!interests.trim()) return
    setLoading(true)
    try {
      const result = await askAI(`You are a business strategist helping someone start a real product business from scratch.

They are interested in: ${interests}
Starting budget: $${budget}

Generate 8 unique one-product business ideas. These are NOT dropshipping — they are real brands built around one product with proper manufacturing.

Think: LMNT (electrolytes), Hims (hair loss), AG1 (greens), Hexclad (pans), Oura (ring).

For each idea:
- Make it specific and ownable (not "protein powder" but "recovery protein for shift workers")
- Include a clear brand story
- Show realistic margins and startup costs
- Identify a specific underserved audience

Reply ONLY with JSON:
{
  "ideas": [
    {
      "id": "1",
      "name": "product name",
      "tagline": "one line brand promise",
      "description": "2 sentence description",
      "audience": "very specific target customer",
      "problem": "exact pain point being solved",
      "uniqueAngle": "what makes this different from everything else",
      "estimatedStartupCost": "$X,XXX",
      "estimatedRetailPrice": "$XX-XX",
      "estimatedCOGS": "$X-XX",
      "margin": "XX%",
      "subscriptionPotential": true,
      "viralPotential": "High",
      "difficulty": "Beginner / Intermediate / Advanced",
      "category": "Health / Beauty / Food / Tech / Home / Wellness"
    }
  ]
}`)
      if (result?.ideas) setIdeas(result.ideas)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const saveIdea = (idea: any) => {
    const updated = [...savedIdeas.filter(i => i.id !== idea.id), idea]
    setSavedIdeas(updated)
    localStorage.setItem('bizlab_saved_ideas', JSON.stringify(updated))
  }

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:6}}>
          Find Your Business Idea
        </div>
        <div style={{fontSize:13, color:'#6b7280'}}>
          Tell us what you care about and we'll find a one-product business opportunity built for you.
        </div>
      </div>

      <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:14, padding:20, marginBottom:24}}>
        <div style={{marginBottom:16}}>
          <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>
            What are you interested in or know a lot about?
          </label>
          <div style={{fontSize:11, color:'#4b5563', marginBottom:8}}>
            The best businesses come from genuine passion or expertise. Be specific.
          </div>
          <textarea
            value={interests}
            onChange={e => setInterests(e.target.value)}
            placeholder='e.g. "I go to the gym every day and hate how complicated pre-workout is" or "I&apos;m a nurse and patients always complain about bad sleep" or "I love cooking but hate how messy olive oil bottles are"'
            rows={3}
            style={{
              width:'100%', padding:'12px', borderRadius:8,
              border:'1px solid #1e1e2a', background:'#1a1a24',
              color:'#fff', fontSize:13, outline:'none', resize:'none',
              fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box'
            }}
          />
        </div>

        <div style={{marginBottom:16}}>
          <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>
            Starting budget
          </label>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {[['1000','$1k — very lean'],['5000','$5k — typical'],['10000','$10k — comfortable'],['25000','$25k+']].map(([val, label]) => (
              <button key={val} onClick={() => setBudget(val)} style={{
                padding:'7px 14px', borderRadius:7, border:'none', fontSize:12, fontWeight:600,
                background: budget===val ? 'rgba(99,102,241,0.2)' : '#1a1a24',
                color: budget===val ? '#a5b4fc' : '#6b7280',
                cursor:'pointer'
              }}>{label}</button>
            ))}
          </div>
        </div>

        <button onClick={generateIdeas} disabled={loading || !interests.trim()} style={{
          width:'100%', padding:'12px', borderRadius:9, border:'none',
          background: (loading||!interests.trim()) ? '#1a1a24' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color: (loading||!interests.trim()) ? '#4b5563' : '#fff',
          fontSize:14, fontWeight:700, cursor: (loading||!interests.trim()) ? 'default' : 'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8
        }}>
          {loading
            ? <><div style={{width:16,height:16,border:'2px solid #374151',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Finding your opportunity...</>
            : <><Lightbulb size={16}/> Generate Business Ideas</>
          }
        </button>
      </div>

      {ideas.length > 0 && (
        <div>
          <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:14}}>
            {ideas.length} ideas generated — click any to deep dive
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14}}>
            {ideas.map(idea => {
              const isSaved = savedIdeas.some(s => s.id === idea.id)
              const diffColor = idea.difficulty === 'Beginner' ? '#22c55e' : idea.difficulty === 'Intermediate' ? '#f59e0b' : '#ef4444'
              return (
                <div key={idea.id} style={{
                  background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:12,
                  padding:16, cursor:'pointer', transition:'border-color 0.15s',
                  position:'relative'
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='#2a2a3a'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='#1e1e2a'}
                >
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15, fontWeight:800, color:'#fff', marginBottom:3}}>{idea.name}</div>
                      <div style={{fontSize:11, color:'#a5b4fc', fontStyle:'italic', marginBottom:6}}>"{idea.tagline}"</div>
                    </div>
                    <button onClick={() => saveIdea(idea)} style={{
                      width:30, height:30, borderRadius:'50%', border:'none',
                      background:'transparent', color: isSaved ? '#f59e0b' : '#374151',
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                    }}>
                      <Star size={14} fill={isSaved?'#f59e0b':'none'}/>
                    </button>
                  </div>

                  <div style={{fontSize:12, color:'#9ca3af', lineHeight:1.5, marginBottom:10}}>{idea.description}</div>

                  <div style={{fontSize:11, color:'#6b7280', marginBottom:10, padding:'8px', background:'#1a1a24', borderRadius:6}}>
                    <strong style={{color:'#fff'}}>Problem: </strong>{idea.problem}
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10}}>
                    {[
                      {label:'MARGIN', value:idea.margin, color:'#22c55e'},
                      {label:'STARTUP', value:idea.estimatedStartupCost, color:'#fff'},
                      {label:'SELL FOR', value:idea.estimatedRetailPrice, color:'#fff'},
                      {label:'DIFFICULTY', value:idea.difficulty, color:diffColor},
                    ].map(s => (
                      <div key={s.label} style={{background:'#111', borderRadius:6, padding:'7px 8px'}}>
                        <div style={{fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2}}>{s.label}</div>
                        <div style={{fontSize:12, fontWeight:700, color:s.color}}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{display:'flex', gap:4, flexWrap:'wrap', marginBottom:10}}>
                    <span style={{fontSize:10, padding:'2px 7px', borderRadius:3, background:'rgba(99,102,241,0.1)', color:'#a5b4fc', fontWeight:600}}>{idea.category}</span>
                    {idea.subscriptionPotential && <span style={{fontSize:10, padding:'2px 7px', borderRadius:3, background:'rgba(34,197,94,0.1)', color:'#22c55e', fontWeight:600}}>Subscription</span>}
                    <span style={{fontSize:10, padding:'2px 7px', borderRadius:3, background:'rgba(245,158,11,0.1)', color:'#f59e0b', fontWeight:600}}>{idea.viralPotential} viral</span>
                  </div>

                  <div style={{fontSize:11, color:'#6366f1', fontWeight:600, display:'flex', alignItems:'center', gap:4}}>
                    <ChevronRight size={12}/> {idea.uniqueAngle}
                  </div>
                </div>
              )
            })}
          </div>

          {savedIdeas.length > 0 && (
            <div style={{marginTop:20, padding:14, borderRadius:10, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)'}}>
              <div style={{fontSize:12, fontWeight:700, color:'#22c55e', marginBottom:6}}>
                ⭐ {savedIdeas.length} saved idea{savedIdeas.length>1?'s':''}
              </div>
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {savedIdeas.map(idea => (
                  <span key={idea.id} style={{fontSize:12, color:'#d1d5db', padding:'3px 10px', borderRadius:6, background:'#1a1a24', border:'1px solid #1e1e2a'}}>
                    {idea.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section: Manufacturer Finder ──────────────────
function ManufacturerFinder() {
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState('')
  const [results, setResults] = useState<any>(null)

  const findManufacturers = async () => {
    if (!product.trim()) return
    setLoading(true)
    try {
      const result = await askAI(`You are a sourcing expert helping someone manufacture their product.

PRODUCT: ${product}

Give them a complete sourcing guide. Reply ONLY with JSON:
{
  "overview": "2 sentence sourcing overview for this product",
  "manufacturingTypes": [
    {
      "type": "Contract Manufacturing",
      "description": "what this means",
      "bestFor": "when to use this",
      "minOrderQuantity": "typical MOQ",
      "leadTime": "typical lead time",
      "estimatedCostPerUnit": "$X-XX"
    }
  ],
  "platforms": [
    {
      "name": "Alibaba",
      "url": "https://alibaba.com",
      "description": "what it is",
      "bestFor": "what type of products",
      "searchTip": "exact search term to use for this product",
      "pros": ["pro1", "pro2"],
      "cons": ["con1"]
    },
    {
      "name": "Made-in-China",
      "url": "https://made-in-china.com",
      "description": "what it is",
      "bestFor": "what type of products",
      "searchTip": "exact search term",
      "pros": ["pro1"],
      "cons": ["con1"]
    },
    {
      "name": "ThomasNet",
      "url": "https://thomasnet.com",
      "description": "US-based manufacturers",
      "bestFor": "USA made premium positioning",
      "searchTip": "exact search term",
      "pros": ["pro1", "pro2"],
      "cons": ["con1"]
    }
  ],
  "certifications": ["FDA", "CE", "ISO 9001"],
  "redFlags": ["red flag to watch for 1", "red flag 2", "red flag 3"],
  "sampleProcess": [
    "Step 1: Search for suppliers with 3+ years history",
    "Step 2: Request samples from top 5 suppliers",
    "Step 3: Test samples for 2 weeks"
  ],
  "negotiationTips": ["tip 1", "tip 2", "tip 3"],
  "estimatedTimeline": "X-X months from idea to first shipment",
  "totalLandedCost": "explanation of all costs including shipping customs etc"
}`)
      setResults(result)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:6}}>
          Find Manufacturers
        </div>
        <div style={{fontSize:13, color:'#6b7280'}}>
          Where to source your product, how to vet suppliers, and what to pay.
        </div>
      </div>

      <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:14, padding:20, marginBottom:24}}>
        <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>
          What product do you want to manufacture?
        </label>
        <div style={{display:'flex', gap:8}}>
          <input
            value={product}
            onChange={e => setProduct(e.target.value)}
            onKeyDown={e => e.key==='Enter' && findManufacturers()}
            placeholder='e.g. "magnesium sleep gummies" or "bamboo toothbrush" or "copper tongue scraper"'
            style={{
              flex:1, padding:'10px 14px', borderRadius:8,
              border:'1px solid #1e1e2a', background:'#1a1a24',
              color:'#fff', fontSize:13, outline:'none'
            }}
          />
          <button onClick={findManufacturers} disabled={loading||!product.trim()} style={{
            padding:'10px 20px', borderRadius:8, border:'none',
            background:(loading||!product.trim())?'#1a1a24':'#6366f1',
            color:(loading||!product.trim())?'#4b5563':'#fff',
            fontSize:13, fontWeight:700, cursor:(loading||!product.trim())?'default':'pointer',
            display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap'
          }}>
            {loading ? 'Searching...' : <><Factory size={14}/> Find Sources</>}
          </button>
        </div>
      </div>

      {results && (
        <div>
          <div style={{padding:14, borderRadius:10, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', marginBottom:20, fontSize:13, color:'#d1d5db', lineHeight:1.6}}>
            {results.overview}
          </div>

          {/* Platforms */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:12}}>Where to Find Suppliers</div>
            {(results.platforms||[]).map((platform: any, i: number) => (
              <div key={i} style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:16, marginBottom:10}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
                  <div style={{fontSize:15, fontWeight:800, color:'#fff'}}>{platform.name}</div>
                  <a href={platform.url} target="_blank" rel="noreferrer" style={{
                    display:'flex', alignItems:'center', gap:4,
                    padding:'5px 10px', borderRadius:6, border:'1px solid #1e1e2a',
                    color:'#6b7280', fontSize:11, textDecoration:'none'
                  }}><ExternalLink size={11}/> Visit</a>
                </div>
                <div style={{fontSize:12, color:'#9ca3af', marginBottom:8}}>{platform.description}</div>
                <div style={{
                  padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.06)',
                  border:'1px solid rgba(34,197,94,0.15)', marginBottom:8,
                  fontSize:12, color:'#22c55e'
                }}>
                  🔍 Search: <strong>"{platform.searchTip}"</strong>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                  <div>
                    <div style={{fontSize:10, color:'#22c55e', fontWeight:700, marginBottom:4}}>PROS</div>
                    {(platform.pros||[]).map((p: string, j: number) => (
                      <div key={j} style={{fontSize:11, color:'#9ca3af', marginBottom:2}}>✓ {p}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{fontSize:10, color:'#ef4444', fontWeight:700, marginBottom:4}}>CONS</div>
                    {(platform.cons||[]).map((c: string, j: number) => (
                      <div key={j} style={{fontSize:11, color:'#9ca3af', marginBottom:2}}>✗ {c}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sample Process */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:12}}>How to Sample Suppliers</div>
            {(results.sampleProcess||[]).map((step: string, i: number) => (
              <div key={i} style={{display:'flex', gap:10, marginBottom:8, alignItems:'flex-start'}}>
                <div style={{
                  width:24, height:24, borderRadius:'50%', flexShrink:0,
                  background:'rgba(99,102,241,0.15)', color:'#a5b4fc',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:700
                }}>{i+1}</div>
                <div style={{fontSize:13, color:'#d1d5db', paddingTop:3}}>{step}</div>
              </div>
            ))}
          </div>

          {/* Red flags */}
          <div style={{background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:14, marginBottom:20}}>
            <div style={{fontSize:13, fontWeight:700, color:'#ef4444', marginBottom:8}}>⚠ Red Flags — Walk Away If You See These</div>
            {(results.redFlags||[]).map((flag: string, i: number) => (
              <div key={i} style={{fontSize:12, color:'#fca5a5', marginBottom:4}}>• {flag}</div>
            ))}
          </div>

          {/* Timeline + costs */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:14}}>
              <div style={{fontSize:11, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4}}>Timeline</div>
              <div style={{fontSize:14, fontWeight:700, color:'#fff'}}>{results.estimatedTimeline}</div>
            </div>
            <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:14}}>
              <div style={{fontSize:11, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4}}>Total Landed Cost</div>
              <div style={{fontSize:12, color:'#9ca3af', lineHeight:1.5}}>{results.totalLandedCost}</div>
            </div>
          </div>

          {/* Negotiation tips */}
          {results.negotiationTips?.length > 0 && (
            <div style={{marginTop:16, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:14}}>
              <div style={{fontSize:13, fontWeight:700, color:'#f59e0b', marginBottom:8}}>💡 Negotiation Tips</div>
              {results.negotiationTips.map((tip: string, i: number) => (
                <div key={i} style={{fontSize:12, color:'#fcd34d', marginBottom:4}}>• {tip}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section: Brand Builder ────────────────────────
function BrandBuilder() {
  const [loading, setLoading] = useState(false)
  const [productName, setProductName] = useState('')
  const [audience, setAudience] = useState('')
  const [results, setResults] = useState<any>(null)
  const [copied, setCopied] = useState('')

  const buildBrand = async () => {
    if (!productName.trim()) return
    setLoading(true)
    try {
      const result = await askAI(`You are a brand strategist. Create a complete brand identity for a one-product business.

PRODUCT: ${productName}
TARGET AUDIENCE: ${audience || 'determine from product'}

Reply ONLY with JSON:
{
  "brandNames": [
    {"name": "BrandName", "domain": "brandname.com", "reasoning": "why this works", "available": true}
  ],
  "taglines": ["tagline 1", "tagline 2", "tagline 3"],
  "brandVoice": "how the brand speaks — personality description",
  "colorPalette": [
    {"name": "Primary", "hex": "#000000", "usage": "headlines and CTA buttons"},
    {"name": "Secondary", "hex": "#ffffff", "usage": "backgrounds"},
    {"name": "Accent", "hex": "#6366f1", "usage": "highlights and links"}
  ],
  "typography": {
    "headline": "font name and why",
    "body": "font name and why"
  },
  "brandStory": "3-4 sentence compelling brand origin story",
  "missionStatement": "one sentence mission",
  "targetCustomerProfile": "detailed description of the ideal customer — name them, give them a job, age, daily routine",
  "competitorGap": "what the competition is missing that this brand fills",
  "brandDifferentiators": ["differentiator 1", "differentiator 2", "differentiator 3"],
  "instagramBio": "ideal instagram bio under 150 chars",
  "emailSignature": "brand personality in an email signature line"
}`)
      setResults(result)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:6}}>Brand Builder</div>
        <div style={{fontSize:13, color:'#6b7280'}}>Name, identity, story, and positioning for your brand.</div>
      </div>

      <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:14, padding:20, marginBottom:24}}>
        <div style={{marginBottom:14}}>
          <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>Your product</label>
          <input value={productName} onChange={e => setProductName(e.target.value)}
            placeholder='e.g. "magnesium sleep gummies" or "copper tongue scraper"'
            style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box'}}
          />
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>Target audience (optional)</label>
          <input value={audience} onChange={e => setAudience(e.target.value)}
            placeholder='e.g. "stressed professionals who cant sleep" or "gym goers 25-40"'
            style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box'}}
          />
        </div>
        <button onClick={buildBrand} disabled={loading||!productName.trim()} style={{
          width:'100%', padding:'12px', borderRadius:9, border:'none',
          background:(loading||!productName.trim())?'#1a1a24':'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color:(loading||!productName.trim())?'#4b5563':'#fff',
          fontSize:14, fontWeight:700, cursor:(loading||!productName.trim())?'default':'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8
        }}>
          {loading
            ? <><div style={{width:16,height:16,border:'2px solid #374151',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Building brand...</>
            : <><PenTool size={16}/> Build My Brand</>
          }
        </button>
      </div>

      {results && (
        <div>
          {/* Brand names */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:12}}>Brand Name Options</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10}}>
              {(results.brandNames||[]).map((brand: any, i: number) => (
                <div key={i} style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:14}}>
                  <div style={{fontSize:18, fontWeight:900, color:'#fff', marginBottom:2}}>{brand.name}</div>
                  <div style={{fontSize:11, color:'#6366f1', marginBottom:6, fontFamily:'monospace'}}>{brand.domain}</div>
                  <div style={{fontSize:11, color:'#9ca3af', lineHeight:1.5}}>{brand.reasoning}</div>
                  <button onClick={() => copy(brand.name, `name_${i}`)} style={{
                    marginTop:8, padding:'4px 8px', borderRadius:4, border:'1px solid #1e1e2a',
                    background:'transparent', color:'#4b5563', fontSize:11, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:4
                  }}>
                    {copied===`name_${i}` ? <><CheckCircle size={10}/> Copied</> : <><Copy size={10}/> Copy</>}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Color palette */}
          {results.colorPalette && (
            <div style={{marginBottom:20}}>
              <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:12}}>Brand Colors</div>
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                {results.colorPalette.map((color: any, i: number) => (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:10, background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:8, padding:'10px 14px'}}>
                    <div style={{width:36, height:36, borderRadius:6, background:color.hex, border:'1px solid rgba(255,255,255,0.1)', flexShrink:0}}/>
                    <div>
                      <div style={{fontSize:12, fontWeight:700, color:'#fff'}}>{color.name}</div>
                      <div style={{fontSize:11, color:'#6b7280', fontFamily:'monospace'}}>{color.hex}</div>
                      <div style={{fontSize:10, color:'#4b5563'}}>{color.usage}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Taglines */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:10}}>Taglines</div>
            {(results.taglines||[]).map((tagline: string, i: number) => (
              <div key={i} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'10px 14px', borderRadius:8, marginBottom:6,
                background:'#0f0f15', border:'1px solid #1e1e2a',
                fontSize:14, fontWeight:700, color:'#fff', fontStyle:'italic'
              }}>
                "{tagline}"
                <button onClick={() => copy(tagline, `tag_${i}`)} style={{padding:'3px 7px',borderRadius:4,border:'none',background:'transparent',color:'#4b5563',cursor:'pointer',flexShrink:0}}>
                  {copied===`tag_${i}` ? <CheckCircle size={12} color="#22c55e"/> : <Copy size={12}/>}
                </button>
              </div>
            ))}
          </div>

          {/* Brand story */}
          <div style={{marginBottom:20, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, padding:16}}>
            <div style={{fontSize:12, fontWeight:700, color:'#a5b4fc', marginBottom:8}}>Brand Story</div>
            <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.7}}>{results.brandStory}</div>
            <button onClick={() => copy(results.brandStory, 'story')} style={{marginTop:10,padding:'5px 10px',borderRadius:5,border:'1px solid #1e1e2a',background:'transparent',color:'#6b7280',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
              {copied==='story'?<><CheckCircle size={10}/> Copied</>:<><Copy size={10}/> Copy Story</>}
            </button>
          </div>

          {/* Customer profile */}
          <div style={{marginBottom:20, background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:14}}>
            <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:6}}>Your Ideal Customer</div>
            <div style={{fontSize:13, color:'#9ca3af', lineHeight:1.6}}>{results.targetCustomerProfile}</div>
          </div>

          {/* Instagram bio */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:14}}>
              <div style={{fontSize:11, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6}}>Instagram Bio</div>
              <div style={{fontSize:13, color:'#fff'}}>{results.instagramBio}</div>
            </div>
            <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:14}}>
              <div style={{fontSize:11, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6}}>Mission</div>
              <div style={{fontSize:13, color:'#fff', fontStyle:'italic'}}>"{results.missionStatement}"</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section: Website & Shopify ────────────────────
function WebsiteBuilder() {
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState('')
  const [platform, setPlatform] = useState('shopify')
  const [results, setResults] = useState<any>(null)
  const [activeSection, setActiveSection] = useState('homepage')

  const generate = async () => {
    if (!product.trim()) return
    setLoading(true)
    try {
      const result = await askAI(`You are an expert e-commerce conversion rate optimizer.

PRODUCT: ${product}
PLATFORM: ${platform}

Generate complete website copy and structure. Reply ONLY with JSON:
{
  "homepage": {
    "heroHeadline": "main headline",
    "heroSubline": "supporting line",
    "heroCtaButton": "button text",
    "socialProof": "trust line under CTA",
    "featuresSection": [
      {"icon": "emoji", "title": "feature title", "description": "one sentence"}
    ],
    "howItWorksSteps": [
      {"step": 1, "title": "step title", "description": "one sentence"}
    ],
    "testimonials": [
      {"name": "First L.", "text": "review", "rating": 5}
    ],
    "faq": [
      {"q": "question", "a": "answer"}
    ],
    "finalCta": "closing CTA headline"
  },
  "productPage": {
    "title": "product page title",
    "subtitle": "product page subtitle",
    "price": "$XX",
    "originalPrice": "$XX",
    "bulletPoints": ["benefit 1", "benefit 2", "benefit 3", "benefit 4", "benefit 5"],
    "ingredients": "key ingredients or materials",
    "howToUse": ["step 1", "step 2", "step 3"],
    "guarantee": "money back guarantee text",
    "urgencyText": "limited time offer text",
    "upsellOffer": "upsell product offer"
  },
  "emailSequence": [
    {
      "emailNumber": 1,
      "trigger": "immediately after purchase",
      "subject": "email subject",
      "previewText": "preview line",
      "keyMessage": "main message of this email"
    },
    {
      "emailNumber": 2,
      "trigger": "3 days after purchase",
      "subject": "email subject",
      "previewText": "preview line",
      "keyMessage": "main message"
    },
    {
      "emailNumber": 3,
      "trigger": "7 days after purchase",
      "subject": "email subject",
      "previewText": "preview line",
      "keyMessage": "main message"
    }
  ],
  "shopifyApps": [
    {"name": "app name", "purpose": "what it does", "price": "free or $X/month", "priority": "Must Have / Nice to Have"}
  ],
  "conversionTips": ["tip 1", "tip 2", "tip 3"]
}`)
      setResults(result)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:6}}>Website & Store</div>
        <div style={{fontSize:13, color:'#6b7280'}}>Complete website copy, Shopify setup guide, and email sequences.</div>
      </div>

      <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:14, padding:20, marginBottom:24}}>
        <div style={{marginBottom:14}}>
          <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>Product</label>
          <input value={product} onChange={e => setProduct(e.target.value)}
            placeholder='Describe your product briefly'
            style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box'}}
          />
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>Platform</label>
          <div style={{display:'flex', gap:8}}>
            {[['shopify','Shopify'],['standalone','Standalone Website'],['landing','Landing Page Only']].map(([val, label]) => (
              <button key={val} onClick={() => setPlatform(val)} style={{
                padding:'7px 14px', borderRadius:7, border:'none', fontSize:12, fontWeight:600,
                background:platform===val?'rgba(99,102,241,0.2)':'#1a1a24',
                color:platform===val?'#a5b4fc':'#6b7280', cursor:'pointer'
              }}>{label}</button>
            ))}
          </div>
        </div>
        <button onClick={generate} disabled={loading||!product.trim()} style={{
          width:'100%', padding:'12px', borderRadius:9, border:'none',
          background:(loading||!product.trim())?'#1a1a24':'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color:(loading||!product.trim())?'#4b5563':'#fff',
          fontSize:14, fontWeight:700, cursor:(loading||!product.trim())?'default':'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8
        }}>
          {loading ? 'Building...' : <><Globe size={16}/> Generate Website Copy</>}
        </button>
      </div>

      {results && (
        <div>
          {/* Section tabs */}
          <div style={{display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #1e1e2a', paddingBottom:0}}>
            {[
              {id:'homepage', label:'Homepage'},
              {id:'product', label:'Product Page'},
              {id:'email', label:'Email Sequence'},
              {id:'apps', label:'Shopify Apps'},
            ].map(t => (
              <button key={t.id} onClick={() => setActiveSection(t.id)} style={{
                padding:'8px 14px', border:'none', background:'transparent',
                color:activeSection===t.id?'#fff':'#6b7280', fontSize:13,
                fontWeight:activeSection===t.id?700:500, cursor:'pointer',
                borderBottom:activeSection===t.id?'2px solid #6366f1':'2px solid transparent', marginBottom:-1
              }}>{t.label}</button>
            ))}
          </div>

          {activeSection === 'homepage' && results.homepage && (
            <div>
              <div style={{background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.05))', border:'1px solid rgba(99,102,241,0.2)', borderRadius:12, padding:20, marginBottom:16, textAlign:'center'}}>
                <div style={{fontSize:24, fontWeight:900, color:'#fff', marginBottom:8}}>{results.homepage.heroHeadline}</div>
                <div style={{fontSize:15, color:'#9ca3af', marginBottom:16}}>{results.homepage.heroSubline}</div>
                <div style={{display:'inline-block', padding:'11px 28px', borderRadius:8, background:'#6366f1', color:'#fff', fontSize:14, fontWeight:800}}>
                  {results.homepage.heroCtaButton}
                </div>
                <div style={{fontSize:11, color:'#6b7280', marginTop:8}}>{results.homepage.socialProof}</div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16}}>
                {(results.homepage.featuresSection||[]).map((f: any, i: number) => (
                  <div key={i} style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:8, padding:12}}>
                    <div style={{fontSize:20, marginBottom:4}}>{f.icon}</div>
                    <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>{f.title}</div>
                    <div style={{fontSize:11, color:'#9ca3af'}}>{f.description}</div>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:16}}>
                <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:10}}>How It Works</div>
                {(results.homepage.howItWorksSteps||[]).map((step: any, i: number) => (
                  <div key={i} style={{display:'flex', gap:10, marginBottom:8}}>
                    <div style={{width:24, height:24, borderRadius:'50%', background:'rgba(99,102,241,0.15)', color:'#a5b4fc', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0}}>
                      {step.step}
                    </div>
                    <div style={{paddingTop:3}}>
                      <span style={{fontSize:13, fontWeight:700, color:'#fff'}}>{step.title}</span>
                      <span style={{fontSize:13, color:'#9ca3af'}}> — {step.description}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:16}}>
                <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:10}}>FAQ</div>
                {(results.homepage.faq||[]).map((item: any, i: number) => (
                  <div key={i} style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:8, padding:12, marginBottom:8}}>
                    <div style={{fontSize:13, fontWeight:600, color:'#fff', marginBottom:4}}>Q: {item.q}</div>
                    <div style={{fontSize:12, color:'#9ca3af'}}>A: {item.a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'product' && results.productPage && (
            <div>
              <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:12, padding:20, marginBottom:16}}>
                <div style={{fontSize:20, fontWeight:900, color:'#fff', marginBottom:4}}>{results.productPage.title}</div>
                <div style={{fontSize:14, color:'#9ca3af', marginBottom:12}}>{results.productPage.subtitle}</div>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:16}}>
                  <span style={{fontSize:24, fontWeight:900, color:'#fff'}}>{results.productPage.price}</span>
                  <span style={{fontSize:16, color:'#4b5563', textDecoration:'line-through'}}>{results.productPage.originalPrice}</span>
                </div>
                {(results.productPage.bulletPoints||[]).map((b: string, i: number) => (
                  <div key={i} style={{display:'flex', gap:8, marginBottom:6, fontSize:13, color:'#d1d5db'}}>
                    <CheckCircle size={14} color="#22c55e" style={{flexShrink:0, marginTop:2}}/>{b}
                  </div>
                ))}
                <div style={{marginTop:12, padding:'8px 12px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', fontSize:12, color:'#ef4444', fontWeight:600}}>
                  ⚡ {results.productPage.urgencyText}
                </div>
              </div>
              <div style={{background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:10, padding:14}}>
                <div style={{fontSize:12, fontWeight:700, color:'#22c55e', marginBottom:4}}>Guarantee</div>
                <div style={{fontSize:13, color:'#d1d5db'}}>{results.productPage.guarantee}</div>
              </div>
            </div>
          )}

          {activeSection === 'email' && (
            <div>
              {(results.emailSequence||[]).map((email: any, i: number) => (
                <div key={i} style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:16, marginBottom:10}}>
                  <div style={{display:'flex', gap:10, marginBottom:10, alignItems:'center'}}>
                    <div style={{width:28, height:28, borderRadius:'50%', background:'rgba(99,102,241,0.15)', color:'#a5b4fc', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0}}>
                      {email.emailNumber}
                    </div>
                    <div>
                      <div style={{fontSize:11, color:'#4b5563', marginBottom:1}}>Sends: {email.trigger}</div>
                      <div style={{fontSize:14, fontWeight:700, color:'#fff'}}>{email.subject}</div>
                    </div>
                  </div>
                  <div style={{fontSize:11, color:'#6b7280', marginBottom:6}}>Preview: {email.previewText}</div>
                  <div style={{fontSize:12, color:'#9ca3af'}}>{email.keyMessage}</div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'apps' && (
            <div>
              {(results.shopifyApps||[]).map((app: any, i: number) => (
                <div key={i} style={{
                  background:'#0f0f15', border:'1px solid #1e1e2a',
                  borderRadius:10, padding:14, marginBottom:8,
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:12
                }}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                      <span style={{fontSize:14, fontWeight:700, color:'#fff'}}>{app.name}</span>
                      <span style={{
                        fontSize:10, padding:'2px 6px', borderRadius:3,
                        background: app.priority==='Must Have'?'rgba(239,68,68,0.1)':'rgba(107,114,128,0.1)',
                        color: app.priority==='Must Have'?'#ef4444':'#6b7280', fontWeight:700
                      }}>{app.priority}</span>
                    </div>
                    <div style={{fontSize:12, color:'#9ca3af'}}>{app.purpose}</div>
                  </div>
                  <div style={{fontSize:13, fontWeight:700, color:'#22c55e', flexShrink:0}}>{app.price}</div>
                </div>
              ))}

              {results.conversionTips?.length > 0 && (
                <div style={{marginTop:16, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:14}}>
                  <div style={{fontSize:13, fontWeight:700, color:'#f59e0b', marginBottom:8}}>💡 Conversion Tips</div>
                  {results.conversionTips.map((tip: string, i: number) => (
                    <div key={i} style={{fontSize:12, color:'#fcd34d', marginBottom:4}}>• {tip}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section: Ads & Content ────────────────────────
function AdsContent() {
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState('')
  const [platform, setPlatform] = useState('tiktok')
  const [adStyle, setAdStyle] = useState('ugc')
  const [results, setResults] = useState<any>(null)

  const generate = async () => {
    if (!product.trim()) return
    setLoading(true)
    try {
      const result = await askAI(`You are an expert performance marketer specializing in ${platform} ads for DTC brands.

PRODUCT: ${product}
PLATFORM: ${platform}
AD STYLE: ${adStyle}

Generate a complete ad campaign. Reply ONLY with JSON:
{
  "campaignOverview": "2 sentence campaign strategy",
  "targetingStrategy": {
    "demographics": "age range and gender",
    "interests": ["interest 1", "interest 2", "interest 3"],
    "behaviors": ["behavior 1", "behavior 2"],
    "lookalikeSeed": "what audience to build lookalike from"
  },
  "adCreatives": [
    {
      "adNumber": 1,
      "format": "video or image",
      "hook": "first 3 seconds / headline",
      "body": "main ad copy",
      "cta": "call to action button text",
      "visualDescription": "what the ad looks like",
      "angle": "emotional angle being used",
      "targetEmotion": "fear / desire / curiosity / social proof"
    }
  ],
  "budgetStrategy": {
    "testingBudget": "$X/day for first 2 weeks",
    "scalingBudget": "when and how to scale",
    "adSetStructure": "how to structure ad sets",
    "kpisToWatch": ["KPI 1", "KPI 2", "KPI 3"]
  },
  "organicContent": [
    {
      "contentType": "type of content",
      "hook": "opening hook",
      "idea": "full content idea",
      "bestTime": "when to post"
    }
  ],
  "influencerStrategy": {
    "followerRange": "nano (1k-10k) / micro (10k-100k) / macro",
    "reasoning": "why this range",
    "pitchTemplate": "short pitch message to send influencers",
    "compensation": "free product / commission / flat fee recommendation"
  }
}`)
      setResults(result)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:6}}>Ads & Content</div>
        <div style={{fontSize:13, color:'#6b7280'}}>Ad scripts, targeting strategy, and organic content plan.</div>
      </div>

      <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:14, padding:20, marginBottom:24}}>
        <div style={{marginBottom:14}}>
          <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>Product</label>
          <input value={product} onChange={e => setProduct(e.target.value)}
            placeholder='Your product'
            style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box'}}
          />
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>Platform</label>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {[['tiktok','TikTok'],['meta','Meta (FB/IG)'],['youtube','YouTube Shorts'],['google','Google'],['organic','Organic Only']].map(([val, label]) => (
              <button key={val} onClick={() => setPlatform(val)} style={{
                padding:'6px 12px', borderRadius:6, border:'none', fontSize:12, fontWeight:600,
                background:platform===val?'rgba(99,102,241,0.2)':'#1a1a24',
                color:platform===val?'#a5b4fc':'#6b7280', cursor:'pointer'
              }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:6}}>Ad Style</label>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {[['ugc','UGC Style'],['product','Product Demo'],['testimonial','Testimonial'],['story','Story/Problem-Solution'],['meme','Meme/Trend']].map(([val, label]) => (
              <button key={val} onClick={() => setAdStyle(val)} style={{
                padding:'6px 12px', borderRadius:6, border:'none', fontSize:12, fontWeight:600,
                background:adStyle===val?'rgba(34,197,94,0.15)':'#1a1a24',
                color:adStyle===val?'#22c55e':'#6b7280', cursor:'pointer'
              }}>{label}</button>
            ))}
          </div>
        </div>
        <button onClick={generate} disabled={loading||!product.trim()} style={{
          width:'100%', padding:'12px', borderRadius:9, border:'none',
          background:(loading||!product.trim())?'#1a1a24':'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color:(loading||!product.trim())?'#4b5563':'#fff',
          fontSize:14, fontWeight:700, cursor:(loading||!product.trim())?'default':'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8
        }}>
          {loading ? 'Creating...' : <><Megaphone size={16}/> Generate Ad Campaign</>}
        </button>
      </div>

      {results && (
        <div>
          <div style={{padding:14, borderRadius:10, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', marginBottom:20, fontSize:13, color:'#d1d5db', lineHeight:1.6}}>
            {results.campaignOverview}
          </div>

          {/* Ad creatives */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:12}}>Ad Creatives</div>
            {(results.adCreatives||[]).map((ad: any, i: number) => (
              <div key={i} style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:16, marginBottom:12}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
                  <div style={{fontSize:13, fontWeight:700, color:'#fff'}}>Ad {ad.adNumber} — {ad.format}</div>
                  <div style={{display:'flex', gap:6}}>
                    <span style={{fontSize:10, padding:'2px 7px', borderRadius:3, background:'rgba(99,102,241,0.1)', color:'#a5b4fc', fontWeight:600}}>{ad.angle}</span>
                    <span style={{fontSize:10, padding:'2px 7px', borderRadius:3, background:'rgba(245,158,11,0.1)', color:'#f59e0b', fontWeight:600}}>{ad.targetEmotion}</span>
                  </div>
                </div>
                <div style={{padding:'8px 12px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', marginBottom:8, fontSize:13, fontWeight:700, color:'#f59e0b'}}>
                  Hook: "{ad.hook}"
                </div>
                <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6, marginBottom:8}}>{ad.body}</div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12}}>
                  <span style={{color:'#9ca3af'}}>🎥 {ad.visualDescription}</span>
                  <span style={{padding:'5px 12px', borderRadius:5, background:'#6366f1', color:'#fff', fontWeight:700}}>{ad.cta}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Budget strategy */}
          {results.budgetStrategy && (
            <div style={{marginBottom:20, background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:10, padding:16}}>
              <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:12}}>Budget Strategy</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
                <div style={{background:'#1a1a24', borderRadius:8, padding:12}}>
                  <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4}}>Testing Phase</div>
                  <div style={{fontSize:13, fontWeight:700, color:'#fff'}}>{results.budgetStrategy.testingBudget}</div>
                </div>
                <div style={{background:'#1a1a24', borderRadius:8, padding:12}}>
                  <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4}}>Scaling</div>
                  <div style={{fontSize:12, color:'#9ca3af'}}>{results.budgetStrategy.scalingBudget}</div>
                </div>
              </div>
              <div style={{fontSize:12, color:'#6b7280', marginBottom:6}}>Watch these KPIs:</div>
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {(results.budgetStrategy.kpisToWatch||[]).map((kpi: string, i: number) => (
                  <span key={i} style={{fontSize:11, padding:'3px 8px', borderRadius:4, background:'rgba(99,102,241,0.1)', color:'#a5b4fc', fontFamily:'monospace'}}>{kpi}</span>
                ))}
              </div>
            </div>
          )}

          {/* Influencer strategy */}
          {results.influencerStrategy && (
            <div style={{marginBottom:20, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:16}}>
              <div style={{fontSize:13, fontWeight:700, color:'#f59e0b', marginBottom:8}}>Influencer Strategy</div>
              <div style={{fontSize:12, color:'#fcd34d', marginBottom:6}}>Target: <strong>{results.influencerStrategy.followerRange}</strong> — {results.influencerStrategy.reasoning}</div>
              <div style={{fontSize:11, color:'#6b7280', marginBottom:6}}>Compensation: {results.influencerStrategy.compensation}</div>
              <div style={{background:'#1a1a24', borderRadius:6, padding:10, fontSize:12, color:'#d1d5db', fontStyle:'italic'}}>
                Pitch template: "{results.influencerStrategy.pitchTemplate}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section: Launch Checklist ─────────────────────
function LaunchChecklist() {
  const [completed, setCompleted] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('bizlab_checklist') || '[]')) } catch { return new Set() }
  })

  const toggle = (id: string) => {
    const next = new Set(completed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCompleted(next)
    localStorage.setItem('bizlab_checklist', JSON.stringify([...next]))
  }

  const phases = [
    {
      id:'research', phase:'Phase 1 — Research & Validation', color:'#6366f1',
      items:[
        {id:'idea',label:'Identified a specific product idea with clear audience',tip:'Be specific. Not "protein powder" but "recovery protein for nurses on night shifts"'},
        {id:'validate',label:'Validated demand (searched TikTok, Reddit, Amazon reviews)',tip:"Look for complaints about existing products — that's your opportunity"},
        {id:'competition',label:'Analyzed top 3 competitors',tip:"Buy their product. Read their 1-star reviews. Find what they're missing."},
        {id:'margin',label:'Confirmed 60%+ gross margin is achievable',tip:'If supplier costs $10, you need to sell for $25+ to survive after ads'},
        {id:'samples',label:'Ordered samples from 3+ manufacturers',tip:'Never commit to MOQ without testing the physical product yourself'},
      ]
    },
    {
      id:'brand', phase:'Phase 2 — Brand Foundation', color:'#8b5cf6',
      items:[
        {id:'name',label:'Chose and registered brand name',tip:'Check trademark, Instagram handle, and .com domain availability before falling in love with a name'},
        {id:'domain',label:'Bought domain ($10-15 on Namecheap)',tip:"Get .com first. If taken get .co or ShopBrandName.com"},
        {id:'logo',label:'Created logo (Canva or Fiverr)',tip:"Simple wordmark is fine to start. You're not Apple yet."},
        {id:'story',label:'Wrote brand story and mission statement',tip:'Use the Brand Builder tool above. Your story is your marketing.'},
        {id:'social',label:'Created Instagram and TikTok accounts',tip:"Grab the handle immediately even before you're ready to post"},
      ]
    },
    {
      id:'product', phase:'Phase 3 — Product & Packaging', color:'#06b6d4',
      items:[
        {id:'manufacturer',label:'Selected and contracted manufacturer',tip:'Start with a small MOQ (250-500 units) to test before committing'},
        {id:'packaging',label:'Designed product packaging',tip:"Packaging IS marketing. It's the first physical experience customers have with your brand"},
        {id:'insert',label:'Created packaging insert with QR code',tip:'Insert should have: review request, Instagram follow, discount for next order'},
        {id:'inventory',label:'First inventory order placed',tip:"Calculate: expected monthly sales × 3 months. Don't overstock."},
        {id:'cogs',label:'Calculated total landed cost per unit',tip:'Product + shipping + customs + warehousing = true COGS'},
      ]
    },
    {
      id:'store', phase:'Phase 4 — Store & Operations', color:'#22c55e',
      items:[
        {id:'shopify',label:'Shopify store set up',tip:'Start with the Dawn theme. You can customize later. Launch fast.'},
        {id:'copy',label:'Product page copy written (use Website Builder above)',tip:'Headline, bullets, story, FAQ, guarantee. Use the Website Builder tool.'},
        {id:'photos',label:'Professional product photos taken',tip:"You don't need a photographer. Natural light + iPhone + clean background works."},
        {id:'payments',label:'Payment processing enabled (Shopify Payments + PayPal)',tip:'Enable both. Some customers only trust PayPal. You lose sales without it.'},
        {id:'shipping',label:'Shipping rates configured',tip:'Free shipping converts better. Build cost into product price.'},
        {id:'email',label:'Email flows set up (Klaviyo free up to 500 contacts)',tip:'Welcome series + abandoned cart = 20-30% of revenue from day 1'},
      ]
    },
    {
      id:'launch', phase:'Phase 5 — Launch', color:'#f59e0b',
      items:[
        {id:'content',label:'Created 10 pieces of organic content before launch',tip:'Bank content before launching. Post daily for first 30 days minimum.'},
        {id:'softlaunch',label:'Soft launched to friends/family for first reviews',tip:'5 real reviews before running paid ads dramatically improves conversion'},
        {id:'ads',label:'First paid ad campaign live (even $20/day)',tip:"Test 3-5 different hooks. Kill what doesn't work after 1000 impressions."},
        {id:'influencer',label:'Sent product to 10 micro influencers',tip:'Nano influencers (1k-10k) often have better engagement and are free for product'},
        {id:'firstsale',label:'First sale achieved 🎉',tip:"Screenshot this. You'll look back at this moment when you scale."},
      ]
    },
    {
      id:'scale', phase:'Phase 6 — Scale', color:'#ef4444',
      items:[
        {id:'profitable',label:'Achieved positive unit economics',tip:'Revenue - COGS - shipping - ads > 0 on a per-order basis'},
        {id:'review',label:'20+ genuine customer reviews collected',tip:'Reviews are leverage for everything: ads, PR, wholesale, investors'},
        {id:'retention',label:'Email/SMS retention strategy running',tip:'LTV is everything. Repeat customers are 5x cheaper to sell to.'},
        {id:'pr',label:'Pitched to 5 relevant media publications',tip:'Product Hunt, niche newsletters, micro blogs in your category'},
        {id:'wholesale',label:'Explored wholesale or B2B opportunities',tip:'One boutique stocking your product = credibility + volume'},
      ]
    },
  ]

  const allItems = phases.flatMap(p => p.items)
  const completedCount = [...completed].filter(id => allItems.some(i => i.id === id)).length
  const progress = Math.round(completedCount / allItems.length * 100)

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:6}}>Launch Checklist</div>
        <div style={{fontSize:13, color:'#6b7280'}}>Every step from idea to your first $10k month.</div>
      </div>

      {/* Progress */}
      <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:12, padding:16, marginBottom:24}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
          <div style={{fontSize:14, fontWeight:700, color:'#fff'}}>Overall Progress</div>
          <div style={{fontSize:16, fontWeight:900, color:'#6366f1', fontFamily:'monospace'}}>{progress}%</div>
        </div>
        <div style={{height:8, background:'#1a1a24', borderRadius:4, overflow:'hidden', marginBottom:8}}>
          <div style={{height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#6366f1,#22c55e)', borderRadius:4, transition:'width 0.5s ease'}}/>
        </div>
        <div style={{fontSize:12, color:'#6b7280'}}>{completedCount} of {allItems.length} steps · Estimated time to completion: {Math.ceil((allItems.length - completedCount) * 0.5)} hours of work</div>
      </div>

      {phases.map(phase => {
        const phaseCompleted = phase.items.filter(i => completed.has(i.id)).length
        const phaseProgress = Math.round(phaseCompleted / phase.items.length * 100)
        return (
          <div key={phase.id} style={{marginBottom:20}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <div style={{width:3, height:20, borderRadius:1, background:phase.color}}/>
                <div style={{fontSize:14, fontWeight:800, color:'#fff'}}>{phase.phase}</div>
              </div>
              <div style={{fontSize:12, color:'#6b7280', fontFamily:'monospace'}}>{phaseCompleted}/{phase.items.length}</div>
            </div>
            {phase.items.map(item => (
              <div key={item.id} onClick={() => toggle(item.id)} style={{
                display:'flex', gap:10, padding:'10px 12px', borderRadius:8,
                marginBottom:5, cursor:'pointer',
                background:completed.has(item.id)?'rgba(34,197,94,0.04)':'#0f0f15',
                border:`1px solid ${completed.has(item.id)?'rgba(34,197,94,0.15)':'#1e1e2a'}`,
                transition:'all 0.15s'
              }}>
                <div style={{
                  width:18, height:18, borderRadius:4, flexShrink:0, marginTop:1,
                  background:completed.has(item.id)?phase.color:'transparent',
                  border:`2px solid ${completed.has(item.id)?phase.color:'#2a2a3a'}`,
                  display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s'
                }}>
                  {completed.has(item.id) && <CheckCircle size={11} color="#fff"/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{
                    fontSize:13, fontWeight:600, lineHeight:1.4,
                    color:completed.has(item.id)?'#4b5563':'#fff',
                    textDecoration:completed.has(item.id)?'line-through':'none'
                  }}>{item.label}</div>
                  <div style={{fontSize:11, color:'#4b5563', marginTop:2, lineHeight:1.5}}>{item.tip}</div>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────
export default function ProductLabPage() {
  const [section, setSection] = useState('ideas')

  const sections = [
    {id:'ideas', label:'Business Ideas', icon:<Lightbulb size={16}/>, desc:'Find your product'},
    {id:'manufacturers', label:'Manufacturers', icon:<Factory size={16}/>, desc:'Source it'},
    {id:'brand', label:'Brand Builder', icon:<PenTool size={16}/>, desc:'Build identity'},
    {id:'website', label:'Website & Store', icon:<Globe size={16}/>, desc:'Sell it'},
    {id:'ads', label:'Ads & Content', icon:<Megaphone size={16}/>, desc:'Market it'},
    {id:'checklist', label:'Launch Checklist', icon:<CheckCircle size={16}/>, desc:'Ship it'},
  ]

  return (
    <div style={{minHeight:'100vh', background:'#09090b', color:'#e8e8ec', fontFamily:"'Syne','Inter',sans-serif"}}>
      <TopNav/>

      <div style={{maxWidth:1000, margin:'0 auto', padding:'0 20px'}}>
        {/* Hero */}
        <div style={{padding:'32px 0 24px', borderBottom:'1px solid #1e1e2a', marginBottom:28}}>
          <div style={{fontSize:11, color:'#6366f1', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8, fontFamily:'monospace'}}>
            Business Lab
          </div>
          <div style={{fontSize:30, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:6}}>
            Build a real brand.<br/>From idea to first sale.
          </div>
          <div style={{fontSize:14, color:'#6b7280', maxWidth:500, lineHeight:1.6}}>
            Not a dropshipping template. A complete toolkit for building a one-product brand with real manufacturing, real margins, and a real story.
          </div>
        </div>

        {/* Section nav */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8, marginBottom:32}}>
          {sections.map((s, i) => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              padding:'12px 8px', borderRadius:10, border:'none', cursor:'pointer',
              background: section===s.id ? 'rgba(99,102,241,0.15)' : '#0f0f15',
              borderTop: section===s.id ? '2px solid #6366f1' : '2px solid transparent',
              borderLeft:'1px solid #1e1e2a',
              borderRight:'1px solid #1e1e2a',
              borderBottom:'1px solid #1e1e2a',
              display:'flex', flexDirection:'column', alignItems:'center', gap:6,
              transition:'all 0.15s'
            }}>
              <div style={{color: section===s.id?'#a5b4fc':'#4b5563'}}>{s.icon}</div>
              <div style={{fontSize:11, fontWeight:700, color:section===s.id?'#fff':'#6b7280', textAlign:'center', lineHeight:1.2}}>
                {s.label}
              </div>
              <div style={{fontSize:9, color:'#4b5563', fontFamily:'monospace'}}>{s.desc}</div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{paddingBottom:60}}>
          {section === 'ideas' && <ProductIdeation/>}
          {section === 'manufacturers' && <ManufacturerFinder/>}
          {section === 'brand' && <BrandBuilder/>}
          {section === 'website' && <WebsiteBuilder/>}
          {section === 'ads' && <AdsContent/>}
          {section === 'checklist' && <LaunchChecklist/>}
        </div>
      </div>
    </div>
  )
}
