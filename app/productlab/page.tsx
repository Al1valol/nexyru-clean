'use client'
import React, { useState, useEffect } from 'react'
import {
  TrendingUp, Zap, Package, Video, BarChart2, BookOpen,
  Search, Star, StarOff, ChevronRight, RefreshCw, Copy,
  CheckCircle, ArrowUpRight, Flame, Target, DollarSign,
  Users, Globe, ShoppingBag, Sparkles, Play, Plus, X,
  ChevronDown, Filter, Award, Clock, AlertTriangle
} from 'lucide-react'

// ── Mock product data ─────────────────────────────
const MOCK_PRODUCTS = [
  {
    id: '1',
    title: 'Posture Corrector Pro',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
    niche: 'Health & Wellness',
    demandScore: 94,
    competition: 'Low',
    profitMargin: '68%',
    viralPotential: 'Very High',
    audience: 'Office workers 25-45',
    estimatedPrice: '$29-49',
    supplierPrice: '$8-12',
    whyItWorks: 'Remote work boom created massive demand. Solves a real pain point. Easy to demonstrate on TikTok.',
    trending: true,
    beginnerFriendly: true,
    fastShipping: true,
  },
  {
    id: '2',
    title: 'LED Sunset Lamp',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
    niche: 'Home Decor',
    demandScore: 87,
    competition: 'Medium',
    profitMargin: '72%',
    viralPotential: 'High',
    audience: 'Gen Z & Millennials 18-35',
    estimatedPrice: '$39-59',
    supplierPrice: '$10-15',
    whyItWorks: 'Aesthetic home decor dominates TikTok. Creates beautiful content automatically. Gift-able.',
    trending: true,
    beginnerFriendly: true,
    fastShipping: false,
  },
  {
    id: '3',
    title: 'Portable Blender',
    image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop',
    niche: 'Fitness',
    demandScore: 91,
    competition: 'Medium',
    profitMargin: '61%',
    viralPotential: 'High',
    audience: 'Fitness enthusiasts 20-40',
    estimatedPrice: '$34-54',
    supplierPrice: '$11-16',
    whyItWorks: 'Gym culture + healthy eating trend. Easy product demos. Repeat buyers for accessories.',
    trending: false,
    beginnerFriendly: true,
    fastShipping: true,
  },
  {
    id: '4',
    title: 'Smart Ring Light',
    image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=300&fit=crop',
    niche: 'Tech',
    demandScore: 89,
    competition: 'High',
    profitMargin: '55%',
    viralPotential: 'Medium',
    audience: 'Content creators 16-30',
    estimatedPrice: '$45-79',
    supplierPrice: '$14-20',
    whyItWorks: 'Creator economy growing fast. Everyone making content needs lighting. B2B potential.',
    trending: false,
    beginnerFriendly: false,
    fastShipping: true,
  },
  {
    id: '5',
    title: 'Ice Roller Face Massager',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=300&fit=crop',
    niche: 'Beauty',
    demandScore: 96,
    competition: 'Low',
    profitMargin: '75%',
    viralPotential: 'Very High',
    audience: 'Women 20-45',
    estimatedPrice: '$19-35',
    supplierPrice: '$4-7',
    whyItWorks: 'Skincare TikTok is massive. Satisfying to watch. Low cost high margin. Celebrity endorsed.',
    trending: true,
    beginnerFriendly: true,
    fastShipping: true,
  },
  {
    id: '6',
    title: 'Car Organizer Console',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=300&fit=crop',
    niche: 'Auto',
    demandScore: 82,
    competition: 'Low',
    profitMargin: '65%',
    viralPotential: 'Medium',
    audience: 'Car owners 25-50',
    estimatedPrice: '$24-44',
    supplierPrice: '$7-11',
    whyItWorks: 'Universal problem. Before/after content works great. High repurchase for gifts.',
    trending: false,
    beginnerFriendly: true,
    fastShipping: true,
  },
]

const NICHES = ['All', 'Health & Wellness', 'Beauty', 'Fitness', 'Home Decor', 'Tech', 'Auto', 'Pet', 'Kids']
const PRICE_RANGES = ['All', 'Under $25', '$25-50', '$50-100', 'Over $100']

// ── Score meter component ─────────────────────────
function ScoreMeter({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4}}>
        <span style={{color:'#6b7280', fontWeight:600}}>{label}</span>
        <span style={{color, fontWeight:700, fontFamily:'monospace'}}>{value}/100</span>
      </div>
      <div style={{height:4, background:'#1e1e2a', borderRadius:2, overflow:'hidden'}}>
        <div style={{
          height:'100%', width:`${value}%`, background:color, borderRadius:2,
          transition:'width 1s ease'
        }}/>
      </div>
    </div>
  )
}

// ── Product card ─────────────────────────────────
function ProductCard({ product, saved, onSave, onClick }) {
  const compColor = product.competition === 'Low' ? '#22c55e' : product.competition === 'Medium' ? '#f59e0b' : '#ef4444'

  return (
    <div
      onClick={onClick}
      style={{
        background:'#0f0f15',
        border:'1px solid #1e1e2a',
        borderRadius:14,
        overflow:'hidden',
        cursor:'pointer',
        transition:'border-color 0.2s, transform 0.15s',
        position:'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e2a'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {product.trending && (
        <div style={{
          position:'absolute', top:10, left:10, zIndex:2,
          display:'flex', alignItems:'center', gap:4,
          padding:'3px 8px', borderRadius:20,
          background:'rgba(239,68,68,0.9)',
          fontSize:10, fontWeight:700, color:'#fff'
        }}>
          <Flame size={10}/> TRENDING
        </div>
      )}

      <button
        onClick={e => { e.stopPropagation(); onSave(product.id) }}
        style={{
          position:'absolute', top:10, right:10, zIndex:2,
          width:32, height:32, borderRadius:'50%',
          background:'rgba(0,0,0,0.5)', border:'none',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', color: saved ? '#f59e0b' : '#fff'
        }}
      >
        {saved ? <Star size={14} fill="#f59e0b"/> : <StarOff size={14}/>}
      </button>

      <div style={{
        height:160, overflow:'hidden',
        background:'#1a1a24'
      }}>
        <img src={product.image} alt={product.title}
          style={{width:'100%', height:'100%', objectFit:'cover', opacity:0.85}}
          onError={e => { e.currentTarget.style.display='none' }}
        />
      </div>

      <div style={{padding:14}}>
        <div style={{fontSize:14, fontWeight:800, color:'#fff', marginBottom:2, lineHeight:1.3}}>
          {product.title}
        </div>
        <div style={{fontSize:11, color:'#6b7280', marginBottom:10}}>{product.niche}</div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10}}>
          {[
            {label:'Demand', value:product.demandScore+'', color:'#22c55e'},
            {label:'Margin', value:product.profitMargin, color:'#a5b4fc'},
            {label:'Price', value:product.estimatedPrice, color:'#fff'},
            {label:'Competition', value:product.competition, color:compColor},
          ].map(s => (
            <div key={s.label} style={{background:'#1a1a24', borderRadius:6, padding:'6px 8px'}}>
              <div style={{fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2}}>{s.label}</div>
              <div style={{fontSize:12, fontWeight:700, color:s.color, fontFamily:'monospace'}}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{
          display:'flex', alignItems:'center', gap:6, fontSize:11,
          color:'#f59e0b', fontWeight:600, marginBottom:8
        }}>
          <Zap size={11}/> {product.viralPotential} viral potential
        </div>

        <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
          {product.beginnerFriendly && (
            <span style={{fontSize:10, padding:'2px 6px', borderRadius:3, background:'rgba(34,197,94,0.1)', color:'#22c55e', fontWeight:600}}>
              Beginner Friendly
            </span>
          )}
          {product.fastShipping && (
            <span style={{fontSize:10, padding:'2px 6px', borderRadius:3, background:'rgba(99,102,241,0.1)', color:'#a5b4fc', fontWeight:600}}>
              Fast Ship
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Product Detail Modal ─────────────────────────
function ProductModal({ product, onClose, onGenerate }) {
  const [activeTab, setActiveTab] = useState('analysis')
  const [generating, setGenerating] = useState(false)
  const [scripts, setScripts] = useState<any[]>([])
  const [brandData, setBrandData] = useState<any>(null)
  const [scriptStyle, setScriptStyle] = useState('problem-solving')

  const generateAnalysis = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/analyze-game', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          team1: 'LAUNCH',
          team2: 'SKIP',
          sport: 'PRODUCT_ANALYSIS',
          odds1: 0, odds2: 0,
          gameTime: 'Now',
          context: `You are an expert dropshipping and e-commerce strategist. Analyze this product for a beginner dropshipper.

PRODUCT: ${product.title}
NICHE: ${product.niche}
ESTIMATED PRICE: ${product.estimatedPrice}
SUPPLIER PRICE: ${product.supplierPrice}
AUDIENCE: ${product.audience}
WHY IT WORKS: ${product.whyItWorks}

Provide a complete product analysis. Reply ONLY with JSON:
{
  "targetAudience": "detailed audience description",
  "emotionalTriggers": ["trigger1", "trigger2", "trigger3"],
  "painPoints": ["pain1", "pain2", "pain3"],
  "competitors": ["competitor1", "competitor2"],
  "pricingStrategy": "recommended pricing approach",
  "upsellIdeas": ["upsell1", "upsell2", "upsell3"],
  "adAngles": ["angle1", "angle2", "angle3"],
  "tiktokHooks": ["hook1", "hook2", "hook3"],
  "brandNames": ["BrandName1", "BrandName2", "BrandName3"],
  "slogans": ["slogan1", "slogan2"],
  "domainSuggestions": ["domain1.com", "domain2.com"],
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "viralityScore": 85,
  "saturationScore": 35,
  "scalabilityScore": 78,
  "impulseScore": 91,
  "summary": "2-3 sentence expert take on this product opportunity"
}`
        })
      })
      const data = await res.json()
      const text = data.reasoning || data.edge || JSON.stringify(data)
      const match = text.match(/\{[\s\S]*\}/)
      if (match) setBrandData(JSON.parse(match[0]))
    } catch(e) { console.error(e) }
    setGenerating(false)
  }

  const generateScripts = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/analyze-game', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          team1: 'CREATE',
          team2: 'SKIP',
          sport: 'PRODUCT_ANALYSIS',
          odds1: 0, odds2: 0,
          gameTime: 'Now',
          context: `You are a viral TikTok and short-form content expert. Create 3 video scripts for this product.

PRODUCT: ${product.title}
AUDIENCE: ${product.audience}
STYLE: ${scriptStyle}
PRICE: ${product.estimatedPrice}

Generate 3 complete scripts. Reply ONLY with JSON:
{
  "scripts": [
    {
      "style": "${scriptStyle}",
      "duration": "30 seconds",
      "hook": "opening hook line",
      "scenes": [
        {"time": "0-3s", "visual": "what to show", "voiceover": "what to say", "caption": "on-screen text"},
        {"time": "3-8s", "visual": "what to show", "voiceover": "what to say", "caption": "on-screen text"},
        {"time": "8-20s", "visual": "what to show", "voiceover": "what to say", "caption": "on-screen text"},
        {"time": "20-30s", "visual": "CTA shot", "voiceover": "CTA line", "caption": "link in bio"}
      ],
      "cta": "call to action",
      "thumbnailIdea": "thumbnail description",
      "hashtags": ["#tag1", "#tag2", "#tag3"]
    }
  ]
}`
        })
      })
      const data = await res.json()
      const text = data.reasoning || data.edge || JSON.stringify(data)
      const match = text.match(/\{[\s\S]*\}/)
      if (match) setScripts(JSON.parse(match[0]).scripts || [])
    } catch(e) { console.error(e) }
    setGenerating(false)
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
      backdropFilter:'blur(4px)', zIndex:2000,
      display:'flex', alignItems:'flex-start', justifyContent:'center',
      padding:'20px 16px', overflowY:'auto'
    }}>
      <div style={{
        background:'#0f0f15', border:'1px solid #1e1e2a',
        borderRadius:16, width:'100%', maxWidth:720,
        animation:'fadeIn 0.2s ease'
      }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid #1e1e2a'
        }}>
          <div>
            <div style={{fontSize:18, fontWeight:800, color:'#fff'}}>{product.title}</div>
            <div style={{fontSize:12, color:'#6b7280'}}>{product.niche} · {product.estimatedPrice}</div>
          </div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:'50%', border:'none',
            background:'#1a1a24', color:'#6b7280', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center'
          }}><X size={16}/></button>
        </div>

        {/* Tabs */}
        <div style={{display:'flex', borderBottom:'1px solid #1e1e2a', padding:'0 20px'}}>
          {[
            {id:'analysis', label:'AI Analysis'},
            {id:'scripts', label:'Video Scripts'},
            {id:'store', label:'Store Copy'},
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding:'10px 14px', border:'none', background:'transparent',
              color: activeTab===t.id?'#fff':'#6b7280', fontSize:13,
              fontWeight: activeTab===t.id?700:500, cursor:'pointer',
              borderBottom: activeTab===t.id?'2px solid #6366f1':'2px solid transparent',
              marginBottom:-1
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{padding:20}}>
          {/* ANALYSIS TAB */}
          {activeTab === 'analysis' && (
            <div>
              {!brandData ? (
                <div style={{textAlign:'center', padding:'32px 0'}}>
                  <div style={{fontSize:40, marginBottom:12}}>🧠</div>
                  <div style={{fontSize:15, fontWeight:700, color:'#fff', marginBottom:8}}>
                    Get a full AI breakdown
                  </div>
                  <div style={{fontSize:13, color:'#6b7280', marginBottom:20, lineHeight:1.6}}>
                    Target audience, ad angles, brand names, pricing strategy, TikTok hooks — everything you need to launch.
                  </div>
                  <button onClick={generateAnalysis} disabled={generating} style={{
                    padding:'11px 28px', borderRadius:9, border:'none',
                    background: generating?'#1a1a24':'#6366f1',
                    color: generating?'#6b7280':'#fff',
                    fontSize:14, fontWeight:700, cursor: generating?'default':'pointer',
                    display:'inline-flex', alignItems:'center', gap:8
                  }}>
                    {generating ? <><div style={{width:16,height:16,border:'2px solid #374151',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Analyzing...</> : <><Sparkles size={16}/> Analyze This Product</>}
                  </button>
                </div>
              ) : (
                <div>
                  {/* Score meters */}
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20}}>
                    <ScoreMeter label="Viral Potential" value={brandData.viralityScore||85} color="#f59e0b"/>
                    <ScoreMeter label="Impulse Buy" value={brandData.impulseScore||91} color="#22c55e"/>
                    <ScoreMeter label="Scalability" value={brandData.scalabilityScore||78} color="#a5b4fc"/>
                    <ScoreMeter label="Saturation" value={brandData.saturationScore||35} color="#ef4444"/>
                  </div>

                  <div style={{padding:14, borderRadius:10, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', marginBottom:16, fontSize:13, color:'#d1d5db', lineHeight:1.6}}>
                    {brandData.summary}
                  </div>

                  {/* TikTok hooks */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:8, display:'flex', alignItems:'center', gap:6}}>
                      <Play size={13} color="#f59e0b"/> TikTok Hooks
                    </div>
                    {(brandData.tiktokHooks||[]).map((hook, i) => (
                      <div key={i} style={{
                        padding:'8px 12px', borderRadius:6, marginBottom:6,
                        background:'#1a1a24', border:'1px solid #1e1e2a',
                        fontSize:13, color:'#d1d5db', display:'flex', justifyContent:'space-between', alignItems:'center'
                      }}>
                        <span>"{hook}"</span>
                        <button onClick={() => navigator.clipboard.writeText(hook)} style={{
                          padding:'3px 8px', borderRadius:4, border:'none',
                          background:'transparent', color:'#4b5563', cursor:'pointer', flexShrink:0
                        }}><Copy size={12}/></button>
                      </div>
                    ))}
                  </div>

                  {/* Ad angles */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:8}}>
                      Ad Angles
                    </div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                      {(brandData.adAngles||[]).map((angle, i) => (
                        <span key={i} style={{
                          padding:'5px 10px', borderRadius:6, fontSize:12,
                          background:'rgba(99,102,241,0.1)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.2)'
                        }}>{angle}</span>
                      ))}
                    </div>
                  </div>

                  {/* Brand names */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:8}}>Brand Name Ideas</div>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
                      {(brandData.brandNames||[]).map((name, i) => (
                        <div key={i} style={{
                          padding:'10px', borderRadius:8, textAlign:'center',
                          background:'#1a1a24', border:'1px solid #1e1e2a',
                          fontSize:14, fontWeight:800, color:'#fff'
                        }}>{name}</div>
                      ))}
                    </div>
                  </div>

                  {/* Color palette */}
                  {brandData.colorPalette && (
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:8}}>Brand Colors</div>
                      <div style={{display:'flex', gap:8}}>
                        {brandData.colorPalette.map((color, i) => (
                          <div key={i} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                            <div style={{width:40, height:40, borderRadius:8, background:color, border:'1px solid #1e1e2a'}}/>
                            <div style={{fontSize:9, color:'#6b7280', fontFamily:'monospace'}}>{color}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upsells */}
                  <div>
                    <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:8}}>Upsell Ideas</div>
                    {(brandData.upsellIdeas||[]).map((upsell, i) => (
                      <div key={i} style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'7px 10px', marginBottom:5, fontSize:13, color:'#d1d5db'
                      }}>
                        <DollarSign size={12} color="#22c55e"/> {upsell}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCRIPTS TAB */}
          {activeTab === 'scripts' && (
            <div>
              <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center'}}>
                <div style={{fontSize:13, color:'#6b7280', marginRight:4}}>Style:</div>
                {['problem-solving', 'funny', 'luxury', 'fast-paced', 'meme'].map(style => (
                  <button key={style} onClick={() => setScriptStyle(style)} style={{
                    padding:'5px 12px', borderRadius:6, border:'none', fontSize:12, fontWeight:600,
                    background: scriptStyle===style?'rgba(99,102,241,0.2)':'#1a1a24',
                    color: scriptStyle===style?'#a5b4fc':'#6b7280',
                    cursor:'pointer', textTransform:'capitalize'
                  }}>{style}</button>
                ))}
              </div>

              <button onClick={generateScripts} disabled={generating} style={{
                width:'100%', padding:'11px', borderRadius:9, border:'none',
                background: generating?'#1a1a24':'#6366f1',
                color: generating?'#6b7280':'#fff',
                fontSize:14, fontWeight:700, cursor:generating?'default':'pointer',
                marginBottom:20, display:'flex', alignItems:'center', justifyContent:'center', gap:8
              }}>
                {generating
                  ? <><div style={{width:16,height:16,border:'2px solid #374151',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Writing scripts...</>
                  : <><Video size={16}/> Generate TikTok Scripts</>
                }
              </button>

              {scripts.map((script, i) => (
                <div key={i} style={{
                  background:'#1a1a24', border:'1px solid #1e1e2a',
                  borderRadius:10, padding:16, marginBottom:12
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
                    <div>
                      <span style={{fontSize:12, fontWeight:700, color:'#fff'}}>Script {i+1}</span>
                      <span style={{fontSize:11, color:'#6b7280', marginLeft:8}}>{script.duration}</span>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(JSON.stringify(script, null, 2))} style={{
                      padding:'4px 8px', borderRadius:4, border:'1px solid #1e1e2a',
                      background:'transparent', color:'#6b7280', fontSize:11, cursor:'pointer',
                      display:'flex', alignItems:'center', gap:4
                    }}><Copy size={11}/> Copy</button>
                  </div>

                  <div style={{
                    padding:'8px 12px', borderRadius:6, marginBottom:12,
                    background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)',
                    fontSize:13, fontWeight:700, color:'#f59e0b'
                  }}>
                    Hook: "{script.hook}"
                  </div>

                  {(script.scenes||[]).map((scene, j) => (
                    <div key={j} style={{
                      display:'grid', gridTemplateColumns:'60px 1fr',
                      gap:8, marginBottom:8, fontSize:12
                    }}>
                      <div style={{
                        padding:'4px 6px', borderRadius:4, textAlign:'center',
                        background:'#111', color:'#6b7280', fontFamily:'monospace', fontSize:10, alignSelf:'start', marginTop:2
                      }}>{scene.time}</div>
                      <div style={{background:'#111', borderRadius:6, padding:10}}>
                        <div style={{color:'#a5b4fc', marginBottom:3}}>🎥 {scene.visual}</div>
                        <div style={{color:'#d1d5db', marginBottom:3}}>🎙 {scene.voiceover}</div>
                        <div style={{color:'#f59e0b'}}>📝 {scene.caption}</div>
                      </div>
                    </div>
                  ))}

                  <div style={{marginTop:10, fontSize:12, color:'#22c55e', fontWeight:600}}>
                    CTA: {script.cta}
                  </div>

                  <div style={{marginTop:6, display:'flex', gap:4, flexWrap:'wrap'}}>
                    {(script.hashtags||[]).map((tag, j) => (
                      <span key={j} style={{fontSize:10, color:'#6b7280', fontFamily:'monospace'}}>{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STORE COPY TAB */}
          {activeTab === 'store' && (
            <div>
              <StoreCopyGenerator product={product}/>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Store copy generator ─────────────────────────
function StoreCopyGenerator({ product }) {
  const [generating, setGenerating] = useState(false)
  const [copy, setCopy] = useState<any>(null)
  const [theme, setTheme] = useState('clean modern')

  const generateCopy = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/analyze-game', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          team1: 'CREATE',
          team2: 'SKIP',
          sport: 'PRODUCT_ANALYSIS',
          odds1: 0, odds2: 0,
          gameTime: 'Now',
          context: `You are an expert Shopify copywriter. Generate complete store copy for this product.

PRODUCT: ${product.title}
PRICE: ${product.estimatedPrice}
AUDIENCE: ${product.audience}
THEME: ${theme}

Reply ONLY with JSON:
{
  "headline": "main product headline",
  "subheadline": "supporting tagline",
  "description": "3-4 sentence product description",
  "bulletPoints": ["benefit 1", "benefit 2", "benefit 3", "benefit 4"],
  "faqs": [
    {"q": "question 1", "a": "answer 1"},
    {"q": "question 2", "a": "answer 2"},
    {"q": "question 3", "a": "answer 3"}
  ],
  "reviewExamples": [
    {"name": "Sarah M.", "rating": 5, "text": "review text"},
    {"name": "James T.", "rating": 5, "text": "review text"}
  ],
  "ctaButton": "CTA button text",
  "urgencyText": "urgency/scarcity text",
  "announcementBar": "announcement bar text"
}`
        })
      })
      const data = await res.json()
      const text = data.reasoning || data.edge || JSON.stringify(data)
      const match = text.match(/\{[\s\S]*\}/)
      if (match) setCopy(JSON.parse(match[0]))
    } catch(e) { console.error(e) }
    setGenerating(false)
  }

  if (!copy) return (
    <div style={{textAlign:'center', padding:'24px 0'}}>
      <div style={{fontSize:13, color:'#6b7280', marginBottom:16}}>
        Generate product page copy, FAQs, reviews, and CTAs for your store.
      </div>
      <div style={{display:'flex', gap:6, justifyContent:'center', marginBottom:16, flexWrap:'wrap'}}>
        {['clean modern', 'minimalist', 'luxury', 'streetwear'].map(t => (
          <button key={t} onClick={() => setTheme(t)} style={{
            padding:'5px 12px', borderRadius:6, border:'none', fontSize:12, fontWeight:600,
            background: theme===t?'rgba(99,102,241,0.2)':'#1a1a24',
            color: theme===t?'#a5b4fc':'#6b7280', cursor:'pointer', textTransform:'capitalize'
          }}>{t}</button>
        ))}
      </div>
      <button onClick={generateCopy} disabled={generating} style={{
        padding:'10px 24px', borderRadius:8, border:'none',
        background:generating?'#1a1a24':'#6366f1', color:generating?'#6b7280':'#fff',
        fontSize:13, fontWeight:700, cursor:generating?'default':'pointer',
        display:'inline-flex', alignItems:'center', gap:8
      }}>
        {generating ? 'Generating...' : <><ShoppingBag size={14}/> Generate Store Copy</>}
      </button>
    </div>
  )

  return (
    <div>
      <div style={{background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8, padding:10, marginBottom:12, fontSize:11, color:'#22c55e', fontFamily:'monospace'}}>
        📢 {copy.announcementBar}
      </div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:20, fontWeight:900, color:'#fff', marginBottom:4}}>{copy.headline}</div>
        <div style={{fontSize:14, color:'#6b7280'}}>{copy.subheadline}</div>
      </div>
      <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.7, marginBottom:14}}>{copy.description}</div>
      <div style={{marginBottom:14}}>
        {(copy.bulletPoints||[]).map((b, i) => (
          <div key={i} style={{display:'flex', gap:8, marginBottom:6, fontSize:13, color:'#d1d5db'}}>
            <CheckCircle size={14} color="#22c55e" style={{flexShrink:0, marginTop:2}}/> {b}
          </div>
        ))}
      </div>
      <div style={{
        width:'100%', padding:'12px', borderRadius:8, border:'none',
        background:'#6366f1', color:'#fff', fontSize:14, fontWeight:800,
        textAlign:'center', marginBottom:8
      }}>{copy.ctaButton}</div>
      <div style={{fontSize:11, color:'#ef4444', textAlign:'center', marginBottom:16, fontWeight:600}}>
        ⚡ {copy.urgencyText}
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:8}}>FAQs</div>
        {(copy.faqs||[]).map((faq, i) => (
          <div key={i} style={{marginBottom:10}}>
            <div style={{fontSize:13, fontWeight:600, color:'#fff', marginBottom:3}}>Q: {faq.q}</div>
            <div style={{fontSize:12, color:'#9ca3af'}}>A: {faq.a}</div>
          </div>
        ))}
      </div>
      <button onClick={() => navigator.clipboard.writeText(JSON.stringify(copy, null, 2))} style={{
        width:'100%', padding:'9px', borderRadius:8, border:'1px solid #1e1e2a',
        background:'transparent', color:'#6b7280', fontSize:13, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:6
      }}><Copy size={13}/> Copy All Store Copy</button>
    </div>
  )
}

// ── Beginner Checklist ────────────────────────────
function BeginnerMode() {
  const [completed, setCompleted] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('productlab_checklist') || '[]')) } catch { return new Set() }
  })

  const toggle = (id: string) => {
    const next = new Set(completed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCompleted(next)
    localStorage.setItem('productlab_checklist', JSON.stringify([...next]))
  }

  const steps = [
    {
      id: 'product', phase: '1. Find Your Product',
      items: [
        {id:'find', label:'Found a winning product', tip:'Look for products that solve a problem, have emotional appeal, and are hard to find locally'},
        {id:'validate', label:'Validated demand (searched TikTok, Amazon)', tip:'Search the product on TikTok — if there are viral videos already, demand exists'},
        {id:'supplier', label:'Found a supplier (AliExpress, CJDropshipping)', tip:'CJDropshipping has faster shipping than AliExpress. Look for 4.5+ star suppliers'},
        {id:'margin', label:'Profit margin is at least 3x cost price', tip:'If supplier price is $10, sell for $30-40 minimum. You need margin for ads'},
      ]
    },
    {
      id: 'brand', phase: '2. Build Your Brand',
      items: [
        {id:'name', label:'Chose a brand name', tip:'Keep it short, memorable, and not too product-specific so you can expand later'},
        {id:'domain', label:'Bought a domain ($10-15/year on Namecheap)', tip:'Try [BrandName].com first, then .co or .shop as alternatives'},
        {id:'logo', label:'Created a simple logo (Canva is free)', tip:'Simple text logos work fine to start. You can refine later'},
        {id:'colors', label:'Chose brand colors', tip:'Pick 2-3 colors max. Use the palette from the AI analysis above'},
      ]
    },
    {
      id: 'store', phase: '3. Build Your Store',
      items: [
        {id:'shopify', label:'Set up Shopify ($39/month or free trial)', tip:'Shopify is the easiest platform. Use the 3-day free trial to start'},
        {id:'product_page', label:'Created product page with AI copy', tip:'Use the Store Copy generator above. Good copy can double your conversion rate'},
        {id:'payments', label:'Connected payment processor (Shopify Payments)', tip:'Enable Shopify Payments first. PayPal as backup. Both needed.'},
        {id:'shipping', label:'Set up shipping rates', tip:'Offer free shipping and build the cost into your product price — converts better'},
      ]
    },
    {
      id: 'content', phase: '4. Create Content',
      items: [
        {id:'tiktok', label:'Created TikTok business account', tip:'Post organically first before running paid ads. Build social proof.'},
        {id:'videos', label:'Filmed 3+ TikTok videos', tip:'Use the video scripts from the AI above. Film in good lighting. No fancy camera needed.'},
        {id:'posted', label:'Posted first video', tip:'Post daily if possible. The algorithm rewards consistency.'},
        {id:'hooks', label:'Tested different hooks', tip:'The first 2 seconds determine everything. Try 3-5 different hooks per product.'},
      ]
    },
    {
      id: 'launch', phase: '5. Get Your First Sale',
      items: [
        {id:'organic', label:'Got first organic traffic', tip:'Share your TikTok link in relevant Facebook groups and Reddit communities'},
        {id:'first_sale', label:'Got first sale 🎉', tip:'If no sales after 50 video views, tweak the product page. If no views, tweak the hook.'},
        {id:'fulfillment', label:'Successfully fulfilled first order', tip:'Order manually from supplier first time. Then automate with AutoDS or DSers'},
        {id:'ads', label:'Ready to test paid ads (optional)', tip:'Only run TikTok ads after you have proof of organic conversion. $50/day minimum budget.'},
      ]
    },
  ]

  const totalItems = steps.flatMap(s => s.items).length
  const completedCount = [...completed].length
  const progress = Math.round(completedCount / totalItems * 100)

  return (
    <div>
      {/* Progress */}
      <div style={{background:'#0f0f15', border:'1px solid #1e1e2a', borderRadius:12, padding:16, marginBottom:20}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
          <div style={{fontSize:14, fontWeight:700, color:'#fff'}}>Launch Progress</div>
          <div style={{fontSize:14, fontWeight:800, color:'#6366f1', fontFamily:'monospace'}}>{progress}%</div>
        </div>
        <div style={{height:8, background:'#1a1a24', borderRadius:4, overflow:'hidden', marginBottom:8}}>
          <div style={{height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#6366f1,#22c55e)', borderRadius:4, transition:'width 0.4s ease'}}/>
        </div>
        <div style={{fontSize:12, color:'#6b7280'}}>{completedCount} of {totalItems} steps completed</div>
      </div>

      {/* Budget warning */}
      <div style={{background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:14, marginBottom:20}}>
        <div style={{display:'flex', gap:8, alignItems:'flex-start'}}>
          <AlertTriangle size={14} color="#f59e0b" style={{flexShrink:0, marginTop:2}}/>
          <div>
            <div style={{fontSize:12, fontWeight:700, color:'#f59e0b', marginBottom:4}}>Realistic Expectations</div>
            <div style={{fontSize:12, color:'#9ca3af', lineHeight:1.6}}>
              Estimated startup budget: <strong style={{color:'#fff'}}>$200-500</strong> (domain + Shopify + initial product testing).
              Most people don't profit in month 1. Average time to first profitable month is 3-6 months with consistent effort.
              Treat this like a real business, not a get-rich-quick scheme.
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      {steps.map((phase, pi) => (
        <div key={phase.id} style={{marginBottom:20}}>
          <div style={{fontSize:13, fontWeight:800, color:'#fff', marginBottom:10, display:'flex', alignItems:'center', gap:8}}>
            <div style={{
              width:22, height:22, borderRadius:'50%', flexShrink:0,
              background: phase.items.every(i => completed.has(i.id)) ? '#22c55e' : '#1a1a24',
              border:'1px solid #1e1e2a', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, color: phase.items.every(i => completed.has(i.id)) ? '#fff' : '#6b7280'
            }}>{pi+1}</div>
            {phase.phase}
          </div>
          {phase.items.map(item => (
            <div key={item.id} style={{
              display:'flex', gap:10, alignItems:'flex-start',
              padding:'10px 12px', borderRadius:8, marginBottom:6,
              background: completed.has(item.id) ? 'rgba(34,197,94,0.06)' : '#1a1a24',
              border:`1px solid ${completed.has(item.id) ? 'rgba(34,197,94,0.2)' : '#1e1e2a'}`,
              cursor:'pointer'
            }} onClick={() => toggle(item.id)}>
              <div style={{
                width:18, height:18, borderRadius:4, flexShrink:0, marginTop:1,
                background: completed.has(item.id) ? '#22c55e' : 'transparent',
                border:`2px solid ${completed.has(item.id) ? '#22c55e' : '#2a2a3a'}`,
                display:'flex', alignItems:'center', justifyContent:'center'
              }}>
                {completed.has(item.id) && <CheckCircle size={12} color="#fff"/>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13, color: completed.has(item.id) ? '#6b7280' : '#fff', fontWeight:600,
                  textDecoration: completed.has(item.id) ? 'line-through' : 'none'
                }}>{item.label}</div>
                <div style={{fontSize:11, color:'#4b5563', marginTop:2, lineHeight:1.5}}>{item.tip}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Content Hub ────────────────────────────────────
function ContentHub() {
  const [generating, setGenerating] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [topic, setTopic] = useState('')

  const generateContent = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/analyze-game', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          team1: 'CREATE',
          team2: 'SKIP',
          sport: 'PRODUCT_ANALYSIS',
          odds1: 0, odds2: 0,
          gameTime: 'Now',
          context: `You are a viral content strategist for e-commerce brands.

PRODUCT/TOPIC: ${topic}

Generate a full week content plan. Reply ONLY with JSON:
{
  "todayAngles": ["angle 1", "angle 2", "angle 3"],
  "hooks": ["hook 1", "hook 2", "hook 3", "hook 4", "hook 5"],
  "captions": ["caption 1", "caption 2", "caption 3"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6"],
  "weekPlan": [
    {"day": "Monday", "type": "Problem/Solution", "idea": "content idea"},
    {"day": "Tuesday", "type": "Social Proof", "idea": "content idea"},
    {"day": "Wednesday", "type": "Tutorial", "idea": "content idea"},
    {"day": "Thursday", "type": "Behind the Scenes", "idea": "content idea"},
    {"day": "Friday", "type": "Trending Audio", "idea": "content idea"},
    {"day": "Saturday", "type": "Comparison", "idea": "content idea"},
    {"day": "Sunday", "type": "CTA Heavy", "idea": "content idea"}
  ],
  "bestPostingTimes": ["6-9am", "12-2pm", "7-10pm"]
}`
        })
      })
      const data = await res.json()
      const text = data.reasoning || data.edge || JSON.stringify(data)
      const match = text.match(/\{[\s\S]*\}/)
      if (match) setContent(JSON.parse(match[0]))
    } catch(e) { console.error(e) }
    setGenerating(false)
  }

  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:20}}>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key==='Enter' && generateContent()}
          placeholder='Enter your product or niche (e.g. "posture corrector" or "beauty gadgets")'
          style={{
            flex:1, padding:'10px 14px', borderRadius:8,
            border:'1px solid #1e1e2a', background:'#1a1a24',
            color:'#fff', fontSize:13, outline:'none'
          }}
        />
        <button onClick={generateContent} disabled={generating||!topic.trim()} style={{
          padding:'10px 20px', borderRadius:8, border:'none',
          background:(!topic.trim()||generating)?'#1a1a24':'#6366f1',
          color:(!topic.trim()||generating)?'#4b5563':'#fff',
          fontSize:13, fontWeight:700, cursor:(!topic.trim()||generating)?'default':'pointer',
          display:'flex', alignItems:'center', gap:6
        }}>
          {generating ? 'Generating...' : <><Sparkles size={14}/> Generate</>}
        </button>
      </div>

      {content && (
        <div>
          {/* Today's angles */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:10, display:'flex', alignItems:'center', gap:6}}>
              <Flame size={14} color="#f59e0b"/> Today's Viral Angles
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {(content.todayAngles||[]).map((angle, i) => (
                <div key={i} style={{
                  padding:'10px 14px', borderRadius:8,
                  background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)',
                  fontSize:13, color:'#d1d5db', display:'flex', justifyContent:'space-between', alignItems:'center'
                }}>
                  {angle}
                  <button onClick={() => navigator.clipboard.writeText(angle)} style={{padding:'2px 6px',borderRadius:4,border:'none',background:'transparent',color:'#4b5563',cursor:'pointer'}}>
                    <Copy size={11}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Hooks */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:10}}>Hook Library</div>
            {(content.hooks||[]).map((hook, i) => (
              <div key={i} style={{
                padding:'8px 12px', borderRadius:6, marginBottom:6,
                background:'#1a1a24', border:'1px solid #1e1e2a',
                fontSize:13, color:'#d1d5db', display:'flex', justifyContent:'space-between', alignItems:'center'
              }}>
                <span>"{hook}"</span>
                <button onClick={() => navigator.clipboard.writeText(hook)} style={{padding:'2px 6px',borderRadius:4,border:'none',background:'transparent',color:'#4b5563',cursor:'pointer'}}>
                  <Copy size={11}/>
                </button>
              </div>
            ))}
          </div>

          {/* Week plan */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:10}}>
              <Clock size={13} style={{marginRight:6, verticalAlign:'middle'}}/> 7-Day Content Plan
            </div>
            {(content.weekPlan||[]).map((day, i) => (
              <div key={i} style={{
                display:'grid', gridTemplateColumns:'90px 100px 1fr',
                gap:10, padding:'10px 12px', marginBottom:6, borderRadius:8,
                background:'#1a1a24', border:'1px solid #1e1e2a', alignItems:'center'
              }}>
                <div style={{fontSize:12, fontWeight:700, color:'#fff'}}>{day.day}</div>
                <div style={{
                  fontSize:10, padding:'3px 7px', borderRadius:4,
                  background:'rgba(99,102,241,0.1)', color:'#a5b4fc', fontWeight:600, textAlign:'center'
                }}>{day.type}</div>
                <div style={{fontSize:12, color:'#9ca3af'}}>{day.idea}</div>
              </div>
            ))}
          </div>

          {/* Hashtags */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:8}}>Hashtags</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {(content.hashtags||[]).map((tag, i) => (
                <span key={i} onClick={() => navigator.clipboard.writeText(tag)} style={{
                  padding:'4px 10px', borderRadius:4, fontSize:12,
                  background:'#1a1a24', color:'#a5b4fc', border:'1px solid #1e1e2a',
                  cursor:'pointer', fontFamily:'monospace'
                }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Best posting times */}
          <div style={{
            padding:14, borderRadius:10, background:'rgba(34,197,94,0.06)',
            border:'1px solid rgba(34,197,94,0.2)'
          }}>
            <div style={{fontSize:12, fontWeight:700, color:'#22c55e', marginBottom:6}}>Best Posting Times (EST)</div>
            <div style={{display:'flex', gap:8}}>
              {(content.bestPostingTimes||[]).map((time, i) => (
                <span key={i} style={{
                  padding:'4px 10px', borderRadius:4, fontSize:12,
                  background:'rgba(34,197,94,0.1)', color:'#22c55e', fontFamily:'monospace'
                }}>{time}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────
export default function ProductLabPage() {
  const [section, setSection] = useState('products')
  const [products, setProducts] = useState(MOCK_PRODUCTS)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('productlab_saved') || '[]')) } catch { return new Set() }
  })
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [niche, setNiche] = useState('All')
  const [filter, setFilter] = useState({ beginner: false, lowComp: false, fastShip: false })
  const [searchQ, setSearchQ] = useState('')

  const toggleSave = (id: string) => {
    const next = new Set(savedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSavedIds(next)
    localStorage.setItem('productlab_saved', JSON.stringify([...next]))
  }

  const findProducts = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500)) // Simulate search
    setProducts([...MOCK_PRODUCTS].sort(() => Math.random() - 0.5))
    setLoading(false)
  }

  const filtered = products.filter(p => {
    if (niche !== 'All' && p.niche !== niche) return false
    if (filter.beginner && !p.beginnerFriendly) return false
    if (filter.lowComp && p.competition !== 'Low') return false
    if (filter.fastShip && !p.fastShipping) return false
    if (searchQ && !p.title.toLowerCase().includes(searchQ.toLowerCase()) && !p.niche.toLowerCase().includes(searchQ.toLowerCase())) return false
    return true
  })

  const navItems = [
    {id:'products', label:'Products', icon:<TrendingUp size={16}/>},
    {id:'saved', label:'Saved', icon:<Star size={16}/>},
    {id:'beginner', label:'Start Here', icon:<BookOpen size={16}/>},
    {id:'content', label:'Content Hub', icon:<Video size={16}/>},
  ]

  return (
    <div style={{
      minHeight:'100vh', background:'#09090b', color:'#e8e8ec',
      fontFamily:"'Syne', 'Inter', sans-serif"
    }}>
      {/* Header */}
      <div style={{
        borderBottom:'1px solid #1e1e2a', padding:'14px 24px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'rgba(9,9,11,0.95)', backdropFilter:'blur(8px)',
        position:'sticky', top:0, zIndex:100
      }}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <a href="/dashboard" style={{
            fontSize:11, color:'#4b5563', textDecoration:'none',
            display:'flex', alignItems:'center', gap:4
          }}>← Back</a>
          <div style={{width:1, height:16, background:'#1e1e2a'}}/>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{
              width:28, height:28, borderRadius:6,
              background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display:'flex', alignItems:'center', justifyContent:'center'
            }}>
              <Sparkles size={14} color="#fff"/>
            </div>
            <div>
              <div style={{fontSize:14, fontWeight:800, color:'#fff', letterSpacing:'-0.02em'}}>AI Product Lab</div>
              <div style={{fontSize:10, color:'#4b5563'}}>Dropshipping & E-Commerce</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{display:'flex', gap:2}}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'6px 12px', borderRadius:7, border:'none',
              background: section===item.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: section===item.id ? '#a5b4fc' : '#6b7280',
              fontSize:12, fontWeight: section===item.id ? 700 : 500,
              cursor:'pointer'
            }}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1100, margin:'0 auto', padding:'24px 20px'}}>

        {/* PRODUCTS SECTION */}
        {section === 'products' && (
          <div>
            {/* Hero */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:28, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:6}}>
                Find your winning product.
              </div>
              <div style={{fontSize:14, color:'#6b7280'}}>
                AI-curated products with real demand signals. No guessing.
              </div>
            </div>

            {/* Search + Find */}
            <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
              <div style={{
                flex:1, display:'flex', alignItems:'center', gap:8,
                background:'#1a1a24', border:'1px solid #1e1e2a', borderRadius:8,
                padding:'8px 12px', minWidth:200
              }}>
                <Search size={14} color="#4b5563"/>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search products..."
                  style={{background:'transparent', border:'none', color:'#fff', fontSize:13, outline:'none', flex:1}}
                />
              </div>
              <button onClick={findProducts} disabled={loading} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'10px 20px', borderRadius:8, border:'none',
                background: loading?'#1a1a24':'#6366f1', color:loading?'#6b7280':'#fff',
                fontSize:13, fontWeight:700, cursor:loading?'default':'pointer'
              }}>
                {loading
                  ? <><div style={{width:16,height:16,border:'2px solid #374151',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Scanning...</>
                  : <><Sparkles size={14}/> Find Winning Products</>
                }
              </button>
            </div>

            {/* Filters */}
            <div style={{display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center'}}>
              <div style={{display:'flex', gap:4, overflowX:'auto'}}>
                {NICHES.map(n => (
                  <button key={n} onClick={() => setNiche(n)} style={{
                    padding:'5px 12px', borderRadius:6, border:'none', fontSize:12, fontWeight:600,
                    background: niche===n?'rgba(99,102,241,0.2)':'#1a1a24',
                    color: niche===n?'#a5b4fc':'#6b7280', cursor:'pointer', whiteSpace:'nowrap'
                  }}>{n}</button>
                ))}
              </div>
              <div style={{width:1, height:20, background:'#1e1e2a'}}/>
              {[
                {key:'beginner', label:'Beginner Friendly'},
                {key:'lowComp', label:'Low Competition'},
                {key:'fastShip', label:'Fast Shipping'},
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(p => ({...p, [f.key]: !p[f.key]}))} style={{
                  padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600,
                  border:`1px solid ${filter[f.key]?'rgba(34,197,94,0.4)':'#1e1e2a'}`,
                  background: filter[f.key]?'rgba(34,197,94,0.1)':'transparent',
                  color: filter[f.key]?'#22c55e':'#6b7280', cursor:'pointer', whiteSpace:'nowrap'
                }}>{f.label}</button>
              ))}
            </div>

            {/* Product grid */}
            {loading ? (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16}}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} style={{borderRadius:14, overflow:'hidden', border:'1px solid #1e1e2a'}}>
                    <div style={{height:160, background:'linear-gradient(90deg,#1a1a24 25%,#222232 50%,#1a1a24 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite'}}/>
                    <div style={{padding:14}}>
                      <div style={{height:16, borderRadius:4, marginBottom:8, background:'linear-gradient(90deg,#1a1a24 25%,#222232 50%,#1a1a24 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite'}}/>
                      <div style={{height:12, borderRadius:4, width:'60%', background:'linear-gradient(90deg,#1a1a24 25%,#222232 50%,#1a1a24 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite'}}/>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16}}>
                {filtered.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    saved={savedIds.has(product.id)}
                    onSave={toggleSave}
                    onClick={() => setSelectedProduct(product)}
                  />
                ))}
                {filtered.length === 0 && (
                  <div style={{gridColumn:'1/-1', textAlign:'center', padding:48, color:'#4b5563'}}>
                    No products match your filters. Try widening the search.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SAVED SECTION */}
        {section === 'saved' && (
          <div>
            <div style={{fontSize:22, fontWeight:800, color:'#fff', marginBottom:4, letterSpacing:'-0.02em'}}>Saved Products</div>
            <div style={{fontSize:13, color:'#6b7280', marginBottom:20}}>Your shortlisted products</div>
            {savedIds.size === 0 ? (
              <div style={{textAlign:'center', padding:48, color:'#4b5563'}}>
                <Star size={32} style={{marginBottom:12, opacity:0.3}}/>
                <div style={{fontSize:15, fontWeight:700, color:'#fff', marginBottom:4}}>No saved products yet</div>
                <div style={{fontSize:13}}>Star products from the Products tab to save them here</div>
              </div>
            ) : (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16}}>
                {products.filter(p => savedIds.has(p.id)).map(product => (
                  <ProductCard key={product.id} product={product} saved={true} onSave={toggleSave} onClick={() => setSelectedProduct(product)}/>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BEGINNER SECTION */}
        {section === 'beginner' && (
          <div>
            <div style={{fontSize:22, fontWeight:800, color:'#fff', marginBottom:4, letterSpacing:'-0.02em'}}>Start Here</div>
            <div style={{fontSize:13, color:'#6b7280', marginBottom:20}}>Step-by-step guide to launching your first store</div>
            <BeginnerMode/>
          </div>
        )}

        {/* CONTENT HUB */}
        {section === 'content' && (
          <div>
            <div style={{fontSize:22, fontWeight:800, color:'#fff', marginBottom:4, letterSpacing:'-0.02em'}}>Content Hub</div>
            <div style={{fontSize:13, color:'#6b7280', marginBottom:20}}>Generate hooks, scripts, captions and a full week of content ideas</div>
            <ContentHub/>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onGenerate={() => {}}
        />
      )}
    </div>
  )
}
