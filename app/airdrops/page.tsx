'use client'
import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, Activity, RefreshCw, Bell, BellOff,
  Search, Filter, Star, StarOff, Copy, ExternalLink, ChevronDown,
  ChevronUp, ChevronRight, AlertTriangle, CheckCircle, XCircle, Clock, Zap,
  Shield, Target, BarChart2, Wallet, ArrowUpRight, ArrowDownRight,
  Radio, Eye, Trash2, Edit2, Plus, Award, BookOpen
} from 'lucide-react'

interface Airdrop {
  id: string
  name: string
  logo: string
  chain: string
  chainColor: string
  category: string
  description: string
  estimatedValue: string
  probability: 'HIGH' | 'MEDIUM' | 'LOW'
  deadline?: string
  daysLeft?: number
  vcBacking: string[]
  totalRaised: string
  tasks: Task[]
  links: {label: string, url: string}[]
  tips: string
  confirmed: boolean
  status: 'active' | 'ended' | 'claimed'
}

interface Task {
  id: string
  label: string
  description: string
  cost: string
  difficulty: 'easy' | 'medium' | 'hard'
  completed: boolean
  link: string
  steps: string[]
}

interface Progress {
  [airdropId: string]: {
    [taskId: string]: boolean
  }
}

export default function AirdropsPage() {
  const [progress, setProgress] = useState<Progress>({})
  const [filter, setFilter] = useState<'all'|'confirmed'|'likely'|'completed'>('all')
  const [chainFilter, setChainFilter] = useState('all')
  const [section, setSection] = useState<'airdrops'|'daily'|'learn'>('airdrops')
  const [isMobile, setIsMobile] = useState(false)
  const [expandedId, setExpandedId] = useState<string|null>(null)
  const [expandedTask, setExpandedTask] = useState<string|null>(null)

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('airdrop_progress') || '{}')
      setProgress(p)
    } catch {}
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const C = {
    bg:'#080808', card:'#0d0d12', border:'#16161f',
    green:'#22c55e', red:'#ef4444', accent:'#6366f1',
    muted:'#6b7280', yellow:'#f59e0b', text:'#fff'
  }

  const airdrops: Airdrop[] = [
    {
      id: 'sonic',
      name: 'Sonic SVM',
      logo: 'SO',
      chain: 'Solana',
      chainColor: '#9945ff',
      category: 'Gaming/L2',
      description: 'First gaming chain on Solana. $12M raised. No token yet. Confirmed airdrop coming.',
      estimatedValue: '$200-2,000',
      probability: 'HIGH',
      vcBacking: ['Bitkraft', 'Solana Ventures'],
      totalRaised: '$12M',
      confirmed: true,
      status: 'active',
      tips: 'Play games daily for max points. The more you play the bigger your allocation.',
      tasks: [
        {
          id:'sonic1', label:'Create account on Sonic', cost:'Free', difficulty:'easy',
          completed:false, link:'https://sonic.game',
          description:'Sign up on Sonic and connect your Solana wallet',
          steps:[
            '1. Open https://sonic.game in your browser',
            '2. Click "Connect Wallet" in the top right',
            '3. Select Phantom wallet (or your Solana wallet)',
            '4. Approve the connection in your wallet popup',
            '5. Done — your account is created automatically',
          ]
        },
        {
          id:'sonic2', label:'Play games daily', cost:'Free', difficulty:'easy',
          completed:false, link:'https://sonic.game',
          description:'Play any game for 15+ mins per day to earn points',
          steps:[
            '1. Go to https://sonic.game and sign in',
            '2. Click "Games" in the navigation',
            '3. Pick any game and click Play',
            '4. Play for at least 15 minutes',
            '5. Check your points balance in your profile',
            '6. Repeat every day for maximum allocation',
          ]
        },
        {
          id:'sonic3', label:'Daily check-in', cost:'Free', difficulty:'easy',
          completed:false, link:'https://sonic.game',
          description:'Check in every day for streak bonus points',
          steps:[
            '1. Go to https://sonic.game',
            '2. Look for the "Daily Check-in" button on the dashboard',
            '3. Click it once per day',
            '4. Approve any wallet signature if prompted (free — no gas)',
            '5. Your streak counter increases — longer streak = bigger bonus',
          ]
        },
        {
          id:'sonic4', label:'Join Discord and verify', cost:'Free', difficulty:'easy',
          completed:false, link:'https://discord.gg/sonicsvmlabs',
          description:'Join Sonic Discord and verify your wallet for bonus points',
          steps:[
            '1. Go to https://discord.gg/sonicsvmlabs',
            '2. Click "Accept Invite"',
            '3. Complete the verification steps in the #verify channel',
            '4. Look for a bot command like /verify or a link to connect wallet',
            '5. Connect your Solana wallet to verify ownership',
            '6. You should get a verified role in Discord',
          ]
        },
      ],
      links: [{label:'App', url:'https://sonic.game'},{label:'Twitter', url:'https://twitter.com/SonicSVM'}],
    },
    {
      id: 'kamino',
      name: 'Kamino Finance',
      logo: 'KM',
      chain: 'Solana',
      chainColor: '#9945ff',
      category: 'DeFi/Lending',
      description: 'Largest lending protocol on Solana. $34M TVL. No token. Very likely to airdrop.',
      estimatedValue: '$300-3,000',
      probability: 'HIGH',
      vcBacking: ['Multicoin', 'Sequoia'],
      totalRaised: '$10M',
      confirmed: false,
      status: 'active',
      tips: 'Supply and borrow assets to earn points. More TVL = bigger allocation.',
      tasks: [
        {
          id:'kamino1', label:'Connect wallet to Kamino', cost:'Free', difficulty:'easy',
          completed:false, link:'https://kamino.finance',
          description:'Connect your Phantom wallet to Kamino Finance',
          steps:[
            '1. Go to https://kamino.finance',
            '2. Click "Launch App" or "Connect Wallet" in top right',
            '3. Select Phantom from the wallet options',
            '4. Click "Connect" in your Phantom popup',
            '5. You should see your wallet address appear in the top right',
          ]
        },
        {
          id:'kamino2', label:'Supply SOL or USDC', cost:'$10-50 minimum', difficulty:'easy',
          completed:false, link:'https://kamino.finance',
          description:'Deposit tokens to start earning Kamino points',
          steps:[
            '1. Go to https://kamino.finance and connect wallet',
            '2. Click "Lend" in the navigation',
            '3. Find SOL or USDC in the list',
            '4. Click "Supply" next to the asset you want to deposit',
            '5. Enter the amount (start with $20-50 worth)',
            '6. Click "Supply" and approve the transaction in Phantom',
            '7. Gas cost: about $0.01 SOL — almost free',
            '8. You will now see your deposit and start earning points',
          ]
        },
        {
          id:'kamino3', label:'Borrow against your collateral', cost:'Gas ~$0.01', difficulty:'medium',
          completed:false, link:'https://kamino.finance',
          description:'Borrow a small amount to increase your points multiplier',
          steps:[
            '1. After supplying, go to the "Borrow" tab',
            '2. Select USDC to borrow (safest option)',
            '3. Borrow a SMALL amount — 20-30% of your collateral max',
            '4. Example: supplied $50 SOL → borrow $10-15 USDC',
            '5. Click "Borrow" and approve in Phantom',
            '6. Important: keep health factor above 1.5 to avoid liquidation',
            '7. You can repay anytime by clicking "Repay"',
          ]
        },
        {
          id:'kamino4', label:'Hold position for 30+ days', cost:'None', difficulty:'easy',
          completed:false, link:'https://kamino.finance',
          description:'Keep funds in the protocol — longer = more points',
          steps:[
            '1. Leave your supplied funds in Kamino',
            '2. Check your points balance weekly at kamino.finance/points',
            '3. Points accumulate every day automatically',
            '4. Do NOT withdraw early — you lose your streak',
            '5. After 30+ days you have a strong chance of qualifying',
            '6. Repay your borrow and withdraw whenever you want after snapshot',
          ]
        },
      ],
      links: [{label:'App', url:'https://kamino.finance'},{label:'Twitter', url:'https://twitter.com/KaminoFinance'}],
    },
    {
      id: 'drift',
      name: 'Drift Protocol',
      logo: 'DR',
      chain: 'Solana',
      chainColor: '#9945ff',
      category: 'DeFi/Perps',
      description: 'Largest perpetuals DEX on Solana. $1B+ volume. Season 2 airdrop points active now.',
      estimatedValue: '$100-1,500',
      probability: 'HIGH',
      vcBacking: ['Multicoin', 'Jump'],
      totalRaised: '$23.5M',
      confirmed: true,
      status: 'active',
      tips: 'Trade perps regularly. Even small trades count. Provide liquidity for bigger allocation.',
      tasks: [
        {
          id:'drift1', label:'Create Drift account', cost:'Gas ~$0.01', difficulty:'easy',
          completed:false, link:'https://app.drift.trade',
          description:'Sign up and deposit funds to Drift Protocol',
          steps:[
            '1. Go to https://app.drift.trade',
            '2. Click "Connect Wallet" top right',
            '3. Select Phantom wallet',
            '4. Click "Create Account" — this costs a tiny SOL gas fee (~$0.01)',
            '5. Approve the transaction in Phantom',
            '6. Deposit some USDC or SOL to start trading',
            '7. Click "Deposit" and enter amount, approve in Phantom',
          ]
        },
        {
          id:'drift2', label:'Make 5+ trades', cost:'Gas ~$0.001 each', difficulty:'easy',
          completed:false, link:'https://app.drift.trade',
          description:'Trade any perp pair — size does not matter much',
          steps:[
            '1. Go to https://app.drift.trade',
            '2. Click on any market like SOL-PERP or BTC-PERP',
            '3. Choose Long (price goes up) or Short (price goes down)',
            '4. Enter a small amount like $5-10',
            '5. Set leverage to 1x (safest)',
            '6. Click "Place Order" and approve in Phantom',
            '7. Close the trade after a few minutes: click your position → Close',
            '8. Repeat 5+ times across different days',
          ]
        },
        {
          id:'drift3', label:'Provide liquidity', cost:'$20-50 minimum', difficulty:'medium',
          completed:false, link:'https://app.drift.trade',
          description:'Add to a liquidity pool for higher point multiplier',
          steps:[
            '1. Go to https://app.drift.trade',
            '2. Click "Earn" or "Liquidity" in the navigation',
            '3. Select a pool — USDC or SOL pools are safest',
            '4. Click "Add Liquidity"',
            '5. Enter the amount you want to provide',
            '6. Click "Confirm" and approve in Phantom',
            '7. You now earn fees AND airdrop points simultaneously',
          ]
        },
        {
          id:'drift4', label:'Trade at least weekly', cost:'Gas only', difficulty:'easy',
          completed:false, link:'https://app.drift.trade',
          description:'Make at least 1 trade per week to maintain eligibility',
          steps:[
            '1. Set a weekly reminder every Monday',
            '2. Open https://app.drift.trade',
            '3. Make any small trade — even $5 counts',
            '4. Close the trade same day if you want',
            '5. Consistency matters more than size',
          ]
        },
      ],
      links: [{label:'App', url:'https://app.drift.trade'},{label:'Twitter', url:'https://twitter.com/DriftProtocol'}],
    },
    {
      id: 'marginfi',
      name: 'marginfi',
      logo: 'MF',
      chain: 'Solana',
      chainColor: '#9945ff',
      category: 'DeFi/Lending',
      description: 'Top lending protocol on Solana. $500M+ TVL. No token yet. Strong airdrop signals.',
      estimatedValue: '$500-5,000',
      probability: 'HIGH',
      vcBacking: ['Multicoin', 'Foundation Capital'],
      totalRaised: '$19M',
      confirmed: false,
      status: 'active',
      tips: 'Supply assets and maintain positions. Early users get biggest allocations.',
      tasks: [
        {
          id:'mfi1', label:'Connect to marginfi', cost:'Free', difficulty:'easy',
          completed:false, link:'https://app.marginfi.com',
          description:'Connect your wallet to marginfi app',
          steps:[
            '1. Go to https://app.marginfi.com',
            '2. Click "Connect Wallet" in the top right corner',
            '3. Choose Phantom from the list',
            '4. Click "Connect" in the Phantom popup',
            '5. Your wallet address should now appear in the app',
          ]
        },
        {
          id:'mfi2', label:'Supply SOL or stablecoins', cost:'$10+ recommended', difficulty:'easy',
          completed:false, link:'https://app.marginfi.com',
          description:'Deposit tokens to start earning mrgnpoints',
          steps:[
            '1. On the marginfi app click "Lend" tab',
            '2. Find USDC or SOL in the list of assets',
            '3. Click "Supply" next to your chosen asset',
            '4. Type the amount you want to supply — $20-50 recommended',
            '5. Click "Confirm Supply"',
            '6. Approve the transaction in Phantom (costs ~$0.01 gas)',
            '7. Check your mrgnpoints balance in the top bar — they start accumulating immediately',
          ]
        },
        {
          id:'mfi3', label:'Earn mrgnpoints daily', cost:'None after deposit', difficulty:'easy',
          completed:false, link:'https://app.marginfi.com',
          description:'Points accumulate automatically while funds are deposited',
          steps:[
            '1. No action needed — points accumulate automatically',
            '2. Check your balance at app.marginfi.com/points',
            '3. The longer you keep funds in the higher your allocation',
            '4. Optionally borrow against your collateral for 2x points multiplier',
            '5. Check back weekly to monitor your points ranking',
          ]
        },
        {
          id:'mfi4', label:'Refer friends for bonus points', cost:'Free', difficulty:'easy',
          completed:false, link:'https://app.marginfi.com',
          description:'Get 10% of your referrals points added to yours',
          steps:[
            '1. Go to app.marginfi.com/points',
            '2. Find your referral link on the page',
            '3. Share with anyone who might use DeFi',
            '4. When they supply funds you earn 10% of their points',
            '5. No limit on referrals — more = better',
          ]
        },
      ],
      links: [{label:'App', url:'https://app.marginfi.com'},{label:'Twitter', url:'https://twitter.com/marginfi'}],
    },
    {
      id: 'layerzero',
      name: 'LayerZero Season 2',
      logo: 'LZ',
      chain: 'Multi-chain',
      chainColor: '#00d4ff',
      category: 'Infrastructure',
      description: 'Cross-chain messaging protocol. Season 2 points program active now.',
      estimatedValue: '$100-1,000',
      probability: 'HIGH',
      vcBacking: ['a16z', 'Sequoia', 'Coinbase'],
      totalRaised: '$263M',
      confirmed: true,
      status: 'active',
      tips: 'Bridge tokens across chains regularly using Stargate Finance.',
      tasks: [
        {
          id:'lz1', label:'Bridge on Stargate Finance', cost:'$5-15 gas', difficulty:'easy',
          completed:false, link:'https://stargate.finance',
          description:'Bridge tokens from one blockchain to another using Stargate',
          steps:[
            '1. Go to https://stargate.finance',
            '2. Connect your MetaMask or Phantom wallet',
            '3. Select the FROM chain (e.g. Ethereum, Base, or Arbitrum)',
            '4. Select the TO chain (different from FROM)',
            '5. Choose USDC as the token to bridge',
            '6. Enter the amount — even $10-20 counts',
            '7. Click "Transfer" and approve in your wallet',
            '8. Wait 1-5 minutes for the bridge to complete',
            '9. You will receive USDC on the destination chain',
          ]
        },
        {
          id:'lz2', label:'Bridge at least monthly', cost:'Gas each time', difficulty:'easy',
          completed:false, link:'https://stargate.finance',
          description:'Do at least 1 bridge per month to stay active',
          steps:[
            '1. Set a monthly reminder on your phone',
            '2. Go to https://stargate.finance',
            '3. Bridge any amount between any two chains',
            '4. Even bridging $10 back and forth counts',
            '5. Consistency over 3-6 months = bigger allocation',
          ]
        },
        {
          id:'lz3', label:'Bridge across multiple chains', cost:'Gas each time', difficulty:'medium',
          completed:false, link:'https://stargate.finance',
          description:'Use at least 3 different chains for bigger allocation',
          steps:[
            '1. Bridge from Ethereum → Arbitrum',
            '2. Then bridge from Arbitrum → Base',
            '3. Then bridge from Base → Optimism',
            '4. Using more chains = higher LayerZero score',
            '5. Cheapest route: use Base and Arbitrum (low gas)',
            '6. Avoid Ethereum mainnet as the source — too expensive',
          ]
        },
        {
          id:'lz4', label:'Check your LayerZero score', cost:'Free', difficulty:'easy',
          completed:false, link:'https://layerzeroscan.com',
          description:'Track your activity score on LayerZero scanner',
          steps:[
            '1. Go to https://layerzeroscan.com',
            '2. Search your wallet address in the search bar',
            '3. You can see all your cross-chain transactions',
            '4. More transactions across more chains = better score',
            '5. Check this monthly to make sure your activity is being tracked',
          ]
        },
      ],
      links: [{label:'Stargate', url:'https://stargate.finance'},{label:'LZ Scan', url:'https://layerzeroscan.com'}],
    },
    {
      id: 'base-protocols',
      name: 'Base Ecosystem',
      logo: 'BA',
      chain: 'Base',
      chainColor: '#0052ff',
      category: 'Multi-protocol',
      description: 'Coinbase L2. Aerodrome and Morpho are prime airdrop candidates — no tokens yet.',
      estimatedValue: '$200-2,000',
      probability: 'HIGH',
      vcBacking: ['Coinbase Ventures', 'a16z'],
      totalRaised: 'Coinbase backed',
      confirmed: false,
      status: 'active',
      tips: 'Use Aerodrome for LP and Morpho for lending. Both are prime airdrop candidates.',
      tasks: [
        {
          id:'base1', label:'Get funds on Base chain', cost:'$1-5 gas', difficulty:'easy',
          completed:false, link:'https://bridge.base.org/deposit',
          description:'Bridge ETH or USDC to Base — very cheap gas',
          steps:[
            '1. Go to https://bridge.base.org/deposit',
            '2. Connect MetaMask wallet',
            '3. Make sure you have some ETH on Ethereum mainnet',
            '4. Enter amount to bridge — $20-50 recommended',
            '5. Click "Deposit" and approve in MetaMask',
            '6. Wait 5-15 minutes for funds to arrive on Base',
            '7. Switch MetaMask network to "Base" to see your funds',
            'Alternative: If you have Coinbase account you can withdraw directly to Base for free',
          ]
        },
        {
          id:'base2', label:'Swap on Aerodrome', cost:'Gas ~$0.10', difficulty:'easy',
          completed:false, link:'https://aerodrome.finance',
          description:'Swap tokens on Aerodrome — biggest DEX on Base',
          steps:[
            '1. Go to https://aerodrome.finance',
            '2. Connect MetaMask (make sure you are on Base network)',
            '3. Click "Swap" in the navigation',
            '4. Select FROM token (ETH) and TO token (USDC)',
            '5. Enter amount — even $10 counts',
            '6. Click "Swap" and approve in MetaMask',
            '7. Gas cost is about $0.10 — very cheap on Base',
            '8. Repeat weekly for consistent activity',
          ]
        },
        {
          id:'base3', label:'Supply on Morpho', cost:'$20 minimum recommended', difficulty:'easy',
          completed:false, link:'https://app.morpho.org',
          description:'Supply USDC or ETH on Morpho lending protocol',
          steps:[
            '1. Go to https://app.morpho.org',
            '2. Connect MetaMask on Base network',
            '3. Click "Supply" tab',
            '4. Choose USDC (safest) or ETH',
            '5. Click "Supply" next to your chosen asset',
            '6. Enter amount — $20-50 recommended minimum',
            '7. Click "Confirm" and approve in MetaMask',
            '8. Gas ~$0.20 — very cheap',
            '9. Your funds earn yield AND airdrop points simultaneously',
          ]
        },
        {
          id:'base4', label:'Stay active weekly on Base', cost:'Almost free', difficulty:'easy',
          completed:false, link:'https://aerodrome.finance',
          description:'Make at least 1 transaction per week on Base',
          steps:[
            '1. Set a weekly reminder every Sunday',
            '2. Go to Aerodrome and do a small swap',
            '3. Even swapping $5 back and forth counts',
            '4. Base gas is so cheap it costs less than $0.10 per transaction',
            '5. Keep this up for 3-6 months for best results',
          ]
        },
      ],
      links: [{label:'Aerodrome', url:'https://aerodrome.finance'},{label:'Morpho', url:'https://app.morpho.org'}],
    },
    {
      id: 'monad',
      name: 'Monad',
      logo: 'MO',
      chain: 'Monad',
      chainColor: '#836ef9',
      category: 'Infrastructure',
      description: 'Next gen EVM blockchain. $225M raised from Paradigm. Testnet live now. Mainnet = massive airdrop.',
      estimatedValue: '$500-10,000',
      probability: 'HIGH',
      vcBacking: ['Paradigm', 'a16z'],
      totalRaised: '$225M',
      confirmed: false,
      status: 'active',
      tips: 'Testnet activity almost always counts toward mainnet airdrops. Start NOW.',
      tasks: [
        {
          id:'monad1', label:'Join Monad Discord', cost:'Free', difficulty:'easy',
          completed:false, link:'https://discord.gg/monadlabs',
          description:'Join the official Monad Discord server',
          steps:[
            '1. Go to https://discord.gg/monadlabs',
            '2. Click "Accept Invite"',
            '3. Complete Discord verification (solve captcha)',
            '4. Read the rules channel and agree',
            '5. Introduce yourself in the introductions channel',
            '6. Check the #testnet channel for latest instructions',
          ]
        },
        {
          id:'monad2', label:'Get testnet MON tokens', cost:'Free', difficulty:'easy',
          completed:false, link:'https://monad.xyz',
          description:'Request free testnet tokens from the Monad faucet',
          steps:[
            '1. Go to https://monad.xyz and find the testnet section',
            '2. Or check the Discord #faucet channel for the faucet link',
            '3. Enter your wallet address (MetaMask)',
            '4. Click "Request tokens"',
            '5. Testnet tokens are free and worthless — just for testing',
            '6. Add Monad testnet to MetaMask: RPC details in Discord pinned messages',
          ]
        },
        {
          id:'monad3', label:'Make transactions on testnet', cost:'Free (testnet)', difficulty:'easy',
          completed:false, link:'https://monad.xyz',
          description:'Use testnet apps to build up your activity score',
          steps:[
            '1. With testnet MON tokens in your wallet',
            '2. Find DEXs deployed on Monad testnet — check Discord for links',
            '3. Swap tokens on the testnet DEX',
            '4. Send small amounts to another wallet address',
            '5. Do 10+ transactions to show consistent activity',
            '6. Everything is free on testnet — no real money at risk',
          ]
        },
        {
          id:'monad4', label:'Follow and engage on Twitter', cost:'Free', difficulty:'easy',
          completed:false, link:'https://twitter.com/monad_xyz',
          description:'Social activity sometimes counts toward allocations',
          steps:[
            '1. Follow @monad_xyz on Twitter',
            '2. Like and retweet their major announcements',
            '3. Reply to their posts with genuine comments',
            '4. Share any Monad content you find interesting',
            '5. Some projects airdrop to active community members on social media',
          ]
        },
      ],
      links: [{label:'Website', url:'https://monad.xyz'},{label:'Discord', url:'https://discord.gg/monadlabs'}],
    },
    {
      id: 'jupiter-lp',
      name: 'Jupiter Rewards',
      logo: 'JU',
      chain: 'Solana',
      chainColor: '#9945ff',
      category: 'DeFi/DEX',
      description: 'Jupiter is Solanas biggest DEX. Ongoing rewards for liquidity providers and active traders.',
      estimatedValue: '$100-500',
      probability: 'HIGH',
      vcBacking: ['Multicoin', 'Pantera'],
      totalRaised: '$100M+',
      confirmed: true,
      status: 'active',
      tips: 'Trade on Jupiter regularly and provide liquidity to earn JUP rewards.',
      tasks: [
        {
          id:'jup1', label:'Swap on Jupiter', cost:'Gas ~$0.001', difficulty:'easy',
          completed:false, link:'https://jup.ag',
          description:'Use Jupiter to swap tokens — most volume DEX on Solana',
          steps:[
            '1. Go to https://jup.ag',
            '2. Click "Connect Wallet" top right',
            '3. Select Phantom wallet',
            '4. Click the FROM token and select SOL',
            '5. Click the TO token and select USDC',
            '6. Enter amount — even $5-10 counts',
            '7. Click "Swap" and approve in Phantom',
            '8. Gas cost: less than $0.001 — basically free',
            '9. Do this weekly for consistent activity',
          ]
        },
        {
          id:'jup2', label:'Vote on JUP governance', cost:'Free', difficulty:'easy',
          completed:false, link:'https://vote.jup.ag',
          description:'Vote on DAO proposals to earn governance rewards',
          steps:[
            '1. Go to https://vote.jup.ag',
            '2. Connect your Phantom wallet',
            '3. You need to hold some JUP tokens to vote',
            '4. If you dont have JUP: buy a small amount on Jupiter ($5-10)',
            '5. Go back to vote.jup.ag and find active proposals',
            '6. Read the proposal and click "Vote Yes" or "Vote No"',
            '7. Approve in Phantom — free transaction',
            '8. Voters get bonus JUP rewards',
          ]
        },
        {
          id:'jup3', label:'Lock JUP tokens', cost:'Need JUP tokens', difficulty:'medium',
          completed:false, link:'https://jup.ag',
          description:'Lock JUP for voting power and rewards multiplier',
          steps:[
            '1. Buy some JUP on https://jup.ag (even $10-20 worth)',
            '2. Go to the JUP staking page at jup.ag/governance',
            '3. Click "Lock JUP"',
            '4. Select lock duration — longer = higher multiplier',
            '5. Enter amount to lock',
            '6. Confirm and approve in Phantom',
            '7. Locked JUP earns ongoing rewards and future airdrops',
          ]
        },
        {
          id:'jup4', label:'Trade weekly on Jupiter', cost:'Gas only', difficulty:'easy',
          completed:false, link:'https://jup.ag',
          description:'Stay active with at least 1 weekly swap',
          steps:[
            '1. Set weekly reminder on your phone — Mondays work well',
            '2. Go to https://jup.ag',
            '3. Swap any amount — even $5 counts',
            '4. Takes less than 2 minutes',
            '5. Consistent weekly use = bigger rewards over time',
          ]
        },
      ],
      links: [{label:'App', url:'https://jup.ag'},{label:'Vote', url:'https://vote.jup.ag'}],
    },
  ]

  const toggleTask = (airdropId: string, taskId: string) => {
    const updated = {
      ...progress,
      [airdropId]: {
        ...(progress[airdropId] || {}),
        [taskId]: !progress[airdropId]?.[taskId]
      }
    }
    setProgress(updated)
    localStorage.setItem('airdrop_progress', JSON.stringify(updated))
  }

  const getCompletedCount = (airdrop: Airdrop) => {
    const p = progress[airdrop.id] || {}
    return airdrop.tasks.filter(t => p[t.id]).length
  }

  const filtered = airdrops
    .filter(a => filter === 'all' ? true : filter === 'confirmed' ? a.confirmed : filter === 'likely' ? !a.confirmed : getCompletedCount(a) === a.tasks.length)
    .filter(a => chainFilter === 'all' || a.chain === chainFilter)

  const chains = ['all', ...Array.from(new Set(airdrops.map(a => a.chain)))]

  const navItems = [
    {id:'airdrops', Icon: Zap, label:'Airdrops'},
    {id:'daily', Icon: CheckCircle, label:'Daily Tasks'},
    {id:'learn', Icon: BookOpen, label:'Learn'},
  ]

  const probColor = (p: string) => p === 'HIGH' ? C.green : p === 'MEDIUM' ? C.yellow : C.muted
  const probBg = (p: string) => p === 'HIGH' ? 'rgba(34,197,94,0.15)' : p === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)'

  return (
    <div style={{background:C.bg, minHeight:'100vh', color:C.text, fontFamily:'system-ui,sans-serif'}}>

      {isMobile && (
        <div style={{display:'flex', background:'rgba(8,8,8,0.95)', backdropFilter:'blur(12px)', borderBottom:`1px solid ${C.border}`, padding:'0 2px'}}>
          {[
            {Icon: TrendingUp, href:'/dashboard'},
            {Icon: Activity, href:'/crypto'},
            {Icon: Target, href:'/sports'},
            {Icon: BarChart2, href:'/options'},
            {Icon: Zap, href:'/airdrops', active:true},
            {Icon: Award, href:'/morning'},
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'12px 2px',
              color: link.active ? '#fff' : '#4b5563', textDecoration:'none',
              borderBottom: link.active ? `2px solid ${C.accent}` : '2px solid transparent',
              transition:'color 0.15s, border-color 0.15s'
            }}>
              <link.Icon size={18}/>
            </a>
          ))}
        </div>
      )}

      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding: isMobile ? '12px 16px' : '14px 24px',
        background:'rgba(8,8,8,0.95)', backdropFilter:'blur(12px)', borderBottom:`1px solid ${C.border}`,
        position:'sticky', top:0, zIndex:100
      }}>
        {/* Left - Logo */}
        <div style={{display:'flex', alignItems:'center', gap:8, fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', minWidth: isMobile ? 'auto' : 80}}>
          Nexyru
        </div>

        {/* Center - Nav links */}
        {!isMobile && (
          <nav style={{display:'flex', gap:2, alignItems:'center'}}>
            {[
              {label:'Trading', href:'/dashboard'},
              {label:'Crypto', href:'/crypto'},
              {label:'Sports', href:'/sports'},
              {label:'Options', href:'/options'},
              {label:'Airdrops', href:'/airdrops', active:true},
            ].map(l => (
              <a key={l.href} href={l.href} style={{
                padding:'6px 14px', fontSize:13,
                color: l.active ? '#fff' : '#4b5563',
                textDecoration:'none', whiteSpace:'nowrap',
                fontWeight: l.active ? 700 : 500,
                borderBottom: l.active ? '2px solid #6366f1' : '2px solid transparent',
                transition:'color 0.15s'
              }}>{l.label}</a>
            ))}
          </nav>
        )}

        {/* Right - Briefing */}
        <div style={{minWidth: isMobile ? 'auto' : 80, display:'flex', justifyContent:'flex-end'}}>
          <a href="/morning" style={{padding:'6px 12px', borderRadius:6, border:'1px solid #1e1e2a', background:'transparent', color:'#6b7280', fontSize:12, fontWeight:600, textDecoration:'none'}}>Briefing</a>
        </div>
      </div>

      <div style={{display:'flex'}}>
        {!isMobile && (
          <div style={{width:180, background:'#0a0a0f', borderRight:`1px solid ${C.border}`, padding:'16px 0', position:'sticky', top:53, height:'calc(100vh - 53px)'}}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setSection(item.id as any)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'10px 16px', border:'none',
                background: section===item.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: section===item.id ? '#a5b4fc' : '#6b7280',
                fontSize:13, fontWeight: section===item.id?700:500,
                cursor:'pointer', textAlign:'left',
                borderLeft: section===item.id ? `3px solid ${C.accent}` : '3px solid transparent',
                transition:'all 0.15s'
              }}>
                <item.Icon size={16}/>
                {item.label}
              </button>
            ))}

            <div style={{margin:'16px', padding:12, background:'#0f0f15', borderRadius:12, border:`1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}>
              <div style={{fontSize:11, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:8}}>YOUR PROGRESS</div>
              <div style={{fontSize:13, color:'#d1d5db', marginBottom:4, lineHeight:1.6}}>
                Airdrops: <strong style={{color:'#fff'}}>{airdrops.length}</strong>
              </div>
              <div style={{fontSize:13, color:'#d1d5db', marginBottom:4, lineHeight:1.6}}>
                Tasks done: <strong style={{color:C.green}}>
                  {airdrops.reduce((s,a) => s + getCompletedCount(a), 0)}
                </strong>/{airdrops.reduce((s,a) => s + a.tasks.length, 0)}
              </div>
              <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6}}>
                Est. value: <strong style={{color:C.green}}>$1,600-25,500</strong>
              </div>
            </div>
          </div>
        )}

        <div style={{flex:1, padding: isMobile?12:20, paddingBottom: isMobile?80:20}}>

          {section === 'airdrops' && (
            <div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:8}}>
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:8, fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginBottom:4}}>
                    <Zap size={22}/> Active Airdrops
                  </div>
                  <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6}}>Complete tasks to qualify for free tokens</div>
                </div>
                <div style={{background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13}}>
                  <span style={{color:C.muted}}>Total est. value: </span>
                  <strong style={{color:C.green}}>$1,600 - $25,500</strong>
                </div>
              </div>

              <div style={{background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:12, padding:14, marginBottom:16, fontSize:13, color:'#fbbf24', lineHeight:1.6, display:'flex', alignItems:'flex-start', gap:8}}>
                <AlertTriangle size={14} style={{flexShrink:0, marginTop:2}}/>
                <div><strong>Airdrop risk:</strong> Not guaranteed. Only invest time and gas fees you can afford to lose. Never share your seed phrase. Only use official links.</div>
              </div>

              <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
                <div style={{display:'flex', gap:4}}>
                  {[
                    {id:'all', label:'All', Icon: null},
                    {id:'confirmed', label:'Confirmed', Icon: CheckCircle},
                    {id:'likely', label:'Likely', Icon: Eye},
                  ].map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id as any)} style={{
                      display:'flex', alignItems:'center', gap:6,
                      padding:'8px 14px', borderRadius:8, fontSize:13,
                      fontWeight: filter===f.id?700:600,
                      border:`1px solid ${filter===f.id?C.accent:'#16161f'}`,
                      background: filter===f.id?'rgba(99,102,241,0.15)':'transparent',
                      color: filter===f.id?'#a5b4fc':'#6b7280', cursor:'pointer',
                      transition:'all 0.15s'
                    }}>
                      {f.Icon && <f.Icon size={12}/>}
                      {f.label}
                    </button>
                  ))}
                </div>
                <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                  {chains.map(c => (
                    <button key={c} onClick={() => setChainFilter(c)} style={{
                      padding:'8px 14px', borderRadius:8, fontSize:13,
                      fontWeight: chainFilter===c?700:600,
                      border:`1px solid ${chainFilter===c?C.accent:'#16161f'}`,
                      background: chainFilter===c?'rgba(99,102,241,0.15)':'transparent',
                      color: chainFilter===c?'#a5b4fc':'#6b7280', cursor:'pointer',
                      whiteSpace:'nowrap', transition:'all 0.15s'
                    }}>{c}</button>
                  ))}
                </div>
              </div>

              {filtered.map(airdrop => {
                const completed = getCompletedCount(airdrop)
                const total = airdrop.tasks.length
                const pct = Math.round(completed/total*100)
                const isExpanded = expandedId === airdrop.id

                return (
                  <div key={airdrop.id} style={{
                    background:'#0f0f15',
                    border:`1px solid ${airdrop.confirmed?'rgba(34,197,94,0.3)':C.border}`,
                    borderRadius:12, marginBottom:12, overflow:'hidden',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.3)', transition:'border-color 0.2s'
                  }}>
                    <div style={{padding:16, cursor:'pointer'}} onClick={() => setExpandedId(isExpanded ? null : airdrop.id)}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10}}>
                        <div style={{display:'flex', alignItems:'center', gap:10}}>
                          <span style={{
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            width:40, height:40, borderRadius:10,
                            background:`${airdrop.chainColor}22`, color: airdrop.chainColor,
                            fontSize:13, fontWeight:800, letterSpacing:'-0.02em',
                            border:`1px solid ${airdrop.chainColor}40`
                          }}>{airdrop.logo}</span>
                          <div>
                            <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
                              <span style={{fontSize:16, fontWeight:800}}>{airdrop.name}</span>
                              {airdrop.confirmed && <span style={{display:'inline-flex', alignItems:'center', gap:3, fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(34,197,94,0.15)', color:C.green, fontWeight:700}}><CheckCircle size={11}/> CONFIRMED</span>}
                            </div>
                            <div style={{display:'flex', gap:6, alignItems:'center'}}>
                              <span style={{fontSize:11, padding:'2px 6px', borderRadius:4, background:`${airdrop.chainColor}22`, color:airdrop.chainColor, fontWeight:600}}>{airdrop.chain}</span>
                              <span style={{fontSize:11, color:C.muted}}>{airdrop.category}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:14, fontWeight:800, color:C.green, marginBottom:2}}>{airdrop.estimatedValue}</div>
                          <span style={{fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, background:probBg(airdrop.probability), color:probColor(airdrop.probability)}}>
                            {airdrop.probability} prob.
                          </span>
                        </div>
                      </div>

                      <div style={{fontSize:12, color:'#9ca3af', marginBottom:10, lineHeight:1.5}}>{airdrop.description}</div>

                      <div style={{marginBottom:8}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:C.muted, marginBottom:4}}>
                          <span>Progress: {completed}/{total} tasks</span>
                          <span style={{color: pct===100?C.green:C.muted}}>{pct}%</span>
                        </div>
                        <div style={{height:6, background:'#1a1a24', borderRadius:3, overflow:'hidden'}}>
                          <div style={{height:'100%', width:`${pct}%`, background:pct===100?C.green:C.accent, borderRadius:3, transition:'width 0.3s'}}/>
                        </div>
                      </div>

                      <div style={{fontSize:11, color:C.muted, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center'}}>
                        <span>Raised: <strong style={{color:C.text}}>{airdrop.totalRaised}</strong></span>
                        <span>VCs: <strong style={{color:C.text}}>{airdrop.vcBacking.join(', ')}</strong></span>
                        <span style={{display:'inline-flex', alignItems:'center', gap:4, color:C.accent}}>
                          {isExpanded ? <><ChevronUp size={12}/> Less</> : <><ChevronDown size={12}/> See tasks</>}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{borderTop:`1px solid ${C.border}`, padding:16}}>
                        <div style={{display:'flex', alignItems:'flex-start', gap:6, fontSize:13, fontWeight:700, marginBottom:4, color:'#fff'}}>
                          <Zap size={14} style={{flexShrink:0, marginTop:2, color:'#a5b4fc'}}/>
                          <div>Pro tip: <span style={{fontWeight:500, color:'#d1d5db'}}>{airdrop.tips}</span></div>
                        </div>

                        <div style={{fontSize:11, fontWeight:600, color:'#4b5563', marginBottom:10, marginTop:12, textTransform:'uppercase', letterSpacing:'0.06em'}}>Tasks to complete:</div>

                        {airdrop.tasks.map(task => {
                          const done = progress[airdrop.id]?.[task.id] || false
                          return (
                            <div key={task.id} style={{
                              display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px',
                              background: done ? 'rgba(34,197,94,0.05)' : '#1a1a24',
                              border:`1px solid ${done?'rgba(34,197,94,0.2)':C.border}`,
                              borderRadius:8, marginBottom:8
                            }}>
                              <button onClick={() => toggleTask(airdrop.id, task.id)} style={{
                                width:22, height:22, borderRadius:4, flexShrink:0,
                                border:`2px solid ${done?C.green:C.muted}`,
                                background: done?C.green:'transparent',
                                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                                color:'#fff', fontSize:12, marginTop:1
                              }}>
                                {done ? <CheckCircle size={12}/> : ''}
                              </button>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13, fontWeight:600, color: done?C.muted:C.text, textDecoration:done?'line-through':'none', marginBottom:2}}>
                                  {task.label}
                                </div>
                                <div style={{fontSize:12, color:'#9ca3af', marginBottom:6, lineHeight:1.5}}>{task.description}</div>
                                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                                  <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(99,102,241,0.1)', color:'#a5b4fc', fontWeight:600}}>
                                    {task.difficulty}
                                  </span>
                                  <span style={{fontSize:10, color:C.muted}}>Cost: {task.cost}</span>
                                  <a href={task.link} target="_blank" rel="noreferrer" style={{display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:C.accent, textDecoration:'none', fontWeight:600}}>
                                    Go <ExternalLink size={10}/>
                                  </a>
                                </div>
                                {task.steps && task.steps.length > 0 && (
                                  <div style={{marginTop:8, background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:6, padding:10}}>
                                    <div style={{fontSize:10, fontWeight:700, color:'#a5b4fc', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em'}}>
                                      How to complete:
                                    </div>
                                    {task.steps.map((step, i) => (
                                      <div key={i} style={{fontSize:11, color:'#d1d5db', marginBottom:4, lineHeight:1.5, paddingLeft:4}}>
                                        {step}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        <div style={{display:'flex', gap:8, marginTop:12, flexWrap:'wrap'}}>
                          {airdrop.links.map(link => (
                            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" style={{
                              display:'inline-flex', alignItems:'center', gap:6,
                              padding:'9px 18px', borderRadius:8,
                              border:`1px solid ${C.accent}40`,
                              background:'rgba(99,102,241,0.08)',
                              color:'#a5b4fc', fontSize:13, fontWeight:700, textDecoration:'none',
                              transition:'all 0.15s'
                            }}>{link.label} <ExternalLink size={12}/></a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {section === 'daily' && (
            <div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginBottom:4}}>
                <CheckCircle size={22}/> Daily Tasks
              </div>
              <div style={{fontSize:13, color:'#d1d5db', marginBottom:16, lineHeight:1.6}}>Quick tasks to do every day — takes 15-30 mins total</div>

              <div style={{background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:12, padding:14, marginBottom:20, fontSize:13, color:'#86efac', lineHeight:1.6, display:'flex', alignItems:'flex-start', gap:8}}>
                <Zap size={14} style={{flexShrink:0, marginTop:2}}/>
                <div><strong>Daily habit:</strong> Open this page every morning. Complete unchecked tasks. Close it. Takes 15-30 mins. Consistency = bigger airdrops.</div>
              </div>

              {airdrops.map(airdrop => {
                const easyTasks = airdrop.tasks.filter(t => t.difficulty === 'easy')
                const hasUncompleted = easyTasks.some(t => !progress[airdrop.id]?.[t.id])

                return (
                  <div key={airdrop.id} style={{background:'#0f0f15', border:`1px solid ${!hasUncompleted?'rgba(34,197,94,0.3)':C.border}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:'0 1px 3px rgba(0,0,0,0.3)', transition:'border-color 0.2s'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        width:32, height:32, borderRadius:8,
                        background:`${airdrop.chainColor}22`, color: airdrop.chainColor,
                        fontSize:11, fontWeight:800, letterSpacing:'-0.02em',
                        border:`1px solid ${airdrop.chainColor}40`
                      }}>{airdrop.logo}</span>
                      <div>
                        <div style={{fontSize:14, fontWeight:700}}>{airdrop.name}</div>
                        <div style={{fontSize:11, color:C.muted}}>{airdrop.chain} · {airdrop.estimatedValue}</div>
                      </div>
                      {!hasUncompleted && <span style={{marginLeft:'auto', display:'inline-flex', alignItems:'center', gap:4, fontSize:12, color:C.green, fontWeight:700}}><CheckCircle size={12}/> All done!</span>}
                    </div>

                    {easyTasks.map(task => {
                      const done = progress[airdrop.id]?.[task.id] || false
                      return (
                        <div key={task.id} style={{marginBottom:6}}>
                          <div style={{
                            display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                            background:'#1a1a24', borderRadius:6,
                            opacity: done ? 0.6 : 1
                          }}>
                            <button onClick={() => toggleTask(airdrop.id, task.id)} style={{
                              width:20, height:20, borderRadius:4, flexShrink:0,
                              border:`2px solid ${done?C.green:C.muted}`,
                              background:done?C.green:'transparent',
                              cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'
                            }}>
                              {done && <CheckCircle size={10}/>}
                            </button>
                            <span
                              onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                              style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:12, flex:1, color:done?C.muted:C.text, textDecoration:done?'line-through':'none', cursor:'pointer'}}
                            >
                              {task.label} {expandedTask === task.id ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                            </span>
                            <a href={task.link} target="_blank" rel="noreferrer" style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:C.accent, textDecoration:'none', flexShrink:0, fontWeight:600}}>Go <ExternalLink size={10}/></a>
                          </div>
                          {expandedTask === task.id && task.steps && (
                            <div style={{marginTop:8, paddingLeft:32, borderLeft:'2px solid rgba(99,102,241,0.3)'}}>
                              {task.steps.map((step, i) => (
                                <div key={i} style={{fontSize:11, color:'#9ca3af', marginBottom:3, lineHeight:1.5}}>{step}</div>
                              ))}
                              <a href={task.link} target="_blank" rel="noreferrer" style={{
                                display:'inline-flex', alignItems:'center', gap:4, marginTop:6, fontSize:11, fontWeight:700,
                                color:'#a5b4fc', textDecoration:'none'
                              }}>Open app to complete <ExternalLink size={10}/></a>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {section === 'learn' && (
            <div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginBottom:4}}>
                <BookOpen size={22}/> How Airdrops Work
              </div>
              <div style={{fontSize:13, color:'#d1d5db', marginBottom:20, lineHeight:1.6}}>Everything you need to know</div>

              {[
                {title:'What is an airdrop?', content:'When a crypto project launches a token, they often give free tokens to early users as a reward for using their protocol before launch. This is called an airdrop. You can receive hundreds or thousands of dollars worth of tokens just for using an app.', example:'Jupiter (Solana DEX) gave $800+ in free JUP tokens to everyone who had made at least 1 swap before the snapshot date.'},
                {title:'How to qualify', content:'Each project sets their own rules. Usually you need to: use the protocol (swap, lend, bridge), hold positions for a minimum time, and be active regularly. The more you use the protocol the bigger your allocation.', example:'Arbitrum airdrop — users who made 10+ transactions got 1,750 ARB ($2,100). Users who made 3 transactions got 625 ARB ($750).'},
                {title:'What is a snapshot?', content:'A snapshot is when the project takes a photo of all wallets that qualify. After the snapshot your past activity is locked in — you either qualify or you don\'t. You need to be active BEFORE the snapshot which is usually unannounced.', example:'This is why you need to start NOW, not when the airdrop is announced. By then it\'s too late.'},
                {title:'How much does it cost?', content:'On Solana almost nothing — gas is less than $0.01 per transaction. On Base and Arbitrum gas is $0.10-2.00 per transaction. Avoid Ethereum mainnet where gas is $5-50. Your main cost is the capital you put into protocols temporarily.', example:'To qualify for Kamino Finance airdrop: deposit $20 USDC, pay $0.01 gas, leave for 30 days, withdraw. Total cost: ~$0.01 in gas + opportunity cost on $20.'},
                {title:'Rug pulls and scams', content:'NEVER share your seed phrase. NEVER approve random contracts. Only use official links from verified Twitter accounts or the official Discord. Fake airdrop websites are the #1 crypto scam.', example:'Real airdrops: you go to THEIR app and connect wallet. Fake airdrops: they ask you to enter your seed phrase or send tokens first. Always fake.'},
                {title:'Tax implications', content:'In most countries airdrop tokens are taxed as income at the fair market value when you receive them. Keep records of what you received and when. Consult a crypto-savvy accountant.', example:'You receive 1,000 tokens at $1 each = $1,000 taxable income. If they go to $5 and you sell = $4,000 additional capital gains.'},
              ].map((item, i) => (
                <div key={i} style={{background:'#0f0f15', border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:'0 1px 3px rgba(0,0,0,0.3)', transition:'border-color 0.2s'}}>
                  <div style={{fontSize:14, fontWeight:700, color:'#a5b4fc', marginBottom:8}}>{item.title}</div>
                  <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6, marginBottom:8}}>{item.content}</div>
                  <div style={{background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:8, padding:10, fontSize:12, color:'#d1d5db', display:'flex', alignItems:'flex-start', gap:6, lineHeight:1.6}}>
                    <Zap size={12} style={{flexShrink:0, marginTop:2, color:'#a5b4fc'}}/>
                    {item.example}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isMobile && (
        <div style={{position:'fixed', bottom:0, left:0, right:0, zIndex:200, background:'rgba(8,8,8,0.95)', backdropFilter:'blur(12px)', borderTop:`1px solid ${C.border}`, display:'flex', height:70, paddingBottom:'env(safe-area-inset-bottom)'}}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setSection(item.id as any)} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              border:'none', background:'transparent', gap:4, cursor:'pointer',
              color: section===item.id?'#a5b4fc':'#4b5563',
              borderTop: section===item.id ? `2px solid ${C.accent}` : '2px solid transparent',
              transition:'all 0.15s'
            }}>
              <item.Icon size={20}/>
              <span style={{fontSize:11, fontWeight:section===item.id?700:500, letterSpacing:'-0.01em'}}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
