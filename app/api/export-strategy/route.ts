import { NextRequest, NextResponse } from 'next/server'

// ─── Condition mapping helpers ───────────────────────────────
// String entry = static snippet. Function entry = computed from cond params.

type CondMap = Record<string, string | ((c: any) => string)>

function getParam(c: any, name: string, fallback: any) {
  if (c?.params && c.params[name] !== undefined && c.params[name] !== null) return c.params[name]
  // Fallback for legacy {id, value} shape
  if (c?.value !== undefined && c?.value !== null) return c.value
  return fallback
}

function expand(entry: string | ((c: any) => string), c: any): string {
  return typeof entry === 'function' ? entry(c) : entry
}

function mapConditions(
  conds: any[],
  mapper: CondMap,
  joiner: string,
  fallback: string,
): string {
  const mapped = (conds || [])
    .map((c: any) => {
      const entry = mapper[c?.id] ?? mapper[c?.type]
      return entry ? expand(entry, c) : null
    })
    .filter((s): s is string => Boolean(s))
  return mapped.length > 0 ? mapped.join(joiner) : fallback
}

// ─── Pine Script v6 ──────────────────────────────────────────
// Snippets reference variables pre-computed at the top of generatePineScript:
// emaFast, emaSlow, ema200, rsiVal, vwapVal, macdLine, macdSignal, macdHist,
// bbMiddle, bbUpper, bbLower

const PINE_CONDITIONS: CondMap = {
  // Moving averages
  'ema_cross_up':    (c) => `ta.crossover(ta.ema(close, ${getParam(c,'fast',9)}), ta.ema(close, ${getParam(c,'slow',21)}))`,
  'ema_cross_down':  (c) => `ta.crossunder(ta.ema(close, ${getParam(c,'fast',9)}), ta.ema(close, ${getParam(c,'slow',21)}))`,
  'price_above_ema': (c) => `close > ta.ema(close, ${getParam(c,'period',21)})`,
  'price_below_ema': (c) => `close < ta.ema(close, ${getParam(c,'period',21)})`,
  'price_bounce_ema':(c) => `low <= ta.ema(close, ${getParam(c,'period',50)}) and close > ta.ema(close, ${getParam(c,'period',50)})`,
  'price_above_sma': (c) => `close > ta.sma(close, ${getParam(c,'period',200)})`,
  'price_below_sma': (c) => `close < ta.sma(close, ${getParam(c,'period',200)})`,
  'sma_cross_up':    (c) => `ta.crossover(ta.sma(close, ${getParam(c,'fast',50)}), ta.sma(close, ${getParam(c,'slow',200)}))`,

  // RSI
  'rsi_above':       (c) => `rsiVal > ${getParam(c,'value',50)}`,
  'rsi_below':       (c) => `rsiVal < ${getParam(c,'value',50)}`,
  'rsi_cross_up':    (c) => `ta.crossover(rsiVal, ${getParam(c,'value',50)})`,
  'rsi_cross_down':  (c) => `ta.crossunder(rsiVal, ${getParam(c,'value',50)})`,
  'rsi_oversold':    'rsiVal < 30',
  'rsi_overbought':  'rsiVal > 70',

  // VWAP
  'price_above_vwap': 'close > vwapVal',
  'price_below_vwap': 'close < vwapVal',
  'vwap_reclaim':     'close > vwapVal and close[1] <= vwapVal[1]',
  'vwap_loses':       'close < vwapVal and close[1] >= vwapVal[1]',
  'vwap_within':      (c) => `math.abs(close - vwapVal) / vwapVal * 100 < ${getParam(c,'percent',0.5)}`,
  'vwap_stretch_long':(c) => `(close - vwapVal) / vwapVal * 100 > ${getParam(c,'percent',2)}`,
  'vwap_stretch_short':(c)=> `(vwapVal - close) / vwapVal * 100 > ${getParam(c,'percent',2)}`,

  // MACD
  'macd_cross_up':   'ta.crossover(macdLine, macdSignal)',
  'macd_cross_down': 'ta.crossunder(macdLine, macdSignal)',
  'macd_hist_pos':   'macdHist > 0',
  'macd_hist_neg':   'macdHist < 0',

  // Bollinger
  'bb_upper_touch': 'close >= bbUpper',
  'bb_lower_touch': 'close <= bbLower',

  // Price action
  'higher_high':   'high > high[1] and high[1] > high[2]',
  'lower_low':     'low  < low[1]  and low[1]  < low[2]',
  'higher_low':    'low  > low[1]  and low[1]  > low[2]',
  'lower_high':    'high < high[1] and high[1] < high[2]',
  'engulf_bull':   'close > open and close[1] < open[1] and close > open[1] and open < close[1]',
  'engulf_bear':   'close < open and close[1] > open[1] and close < open[1] and open > close[1]',
  'inside_bar':    'high < high[1] and low > low[1]',
  'outside_bar':   'high > high[1] and low < low[1]',
  'pin_bar_bull':  '(close - low) / (high - low + 0.0001) > 0.66 and close > open',
  'pin_bar_bear':  '(high - close) / (high - low + 0.0001) > 0.66 and close < open',

  // Volume
  'volume_above_avg': (c) => `volume > ta.sma(volume, 20) * ${getParam(c,'multiplier',1.5)}`,
  'volume_spike':     (c) => `volume == ta.highest(volume, ${getParam(c,'lookback',20)})`,
}

// ─── NinjaScript ─────────────────────────────────────────────
// Snippets reference indicator instances created in State.Configure:
// emaFast, emaSlow, ema200, rsi

const NINJA_CONDITIONS: CondMap = {
  'ema_cross_up':    (c) => `CrossAbove(EMA(${getParam(c,'fast',9)}), EMA(${getParam(c,'slow',21)}), 1)`,
  'ema_cross_down':  (c) => `CrossBelow(EMA(${getParam(c,'fast',9)}), EMA(${getParam(c,'slow',21)}), 1)`,
  'price_above_ema': (c) => `Close[0] > EMA(${getParam(c,'period',21)})[0]`,
  'price_below_ema': (c) => `Close[0] < EMA(${getParam(c,'period',21)})[0]`,
  'price_above_sma': (c) => `Close[0] > SMA(${getParam(c,'period',200)})[0]`,
  'price_below_sma': (c) => `Close[0] < SMA(${getParam(c,'period',200)})[0]`,

  'rsi_above':       (c) => `RSI(14, 3)[0] > ${getParam(c,'value',50)}`,
  'rsi_below':       (c) => `RSI(14, 3)[0] < ${getParam(c,'value',50)}`,
  'rsi_cross_up':    (c) => `CrossAbove(RSI(14, 3), ${getParam(c,'value',50)}, 1)`,
  'rsi_cross_down':  (c) => `CrossBelow(RSI(14, 3), ${getParam(c,'value',50)}, 1)`,
  'rsi_oversold':    'RSI(14, 3)[0] < 30',
  'rsi_overbought':  'RSI(14, 3)[0] > 70',

  'price_above_vwap': 'Close[0] > VWAP()[0]',
  'price_below_vwap': 'Close[0] < VWAP()[0]',

  'macd_cross_up':   'CrossAbove(MACD(12,26,9).Default, MACD(12,26,9).Avg, 1)',
  'macd_cross_down': 'CrossBelow(MACD(12,26,9).Default, MACD(12,26,9).Avg, 1)',
  'macd_hist_pos':   'MACD(12,26,9).Diff[0] > 0',
  'macd_hist_neg':   'MACD(12,26,9).Diff[0] < 0',

  'bb_upper_touch':  'Close[0] >= Bollinger(2, 20).Upper[0]',
  'bb_lower_touch':  'Close[0] <= Bollinger(2, 20).Lower[0]',

  'volume_above_avg':(c) => `Volume[0] > SMA(Volume, 20)[0] * ${getParam(c,'multiplier',1.5)}`,
  'higher_high':     'High[0] > High[1] && High[1] > High[2]',
  'lower_low':       'Low[0] < Low[1] && Low[1] < Low[2]',
  'engulf_bull':     'Close[0] > Open[0] && Close[1] < Open[1] && Close[0] > Open[1] && Open[0] < Close[1]',
  'engulf_bear':     'Close[0] < Open[0] && Close[1] > Open[1] && Close[0] < Open[1] && Open[0] > Close[1]',
  'inside_bar':      'High[0] < High[1] && Low[0] > Low[1]',
  'outside_bar':     'High[0] > High[1] && Low[0] < Low[1]',
}

// ─── Python (pandas) ─────────────────────────────────────────
// Snippets reference df columns added in generatePython:
// ema_fast, ema_slow, ema_trend, rsi, macd_line, macd_signal, macd_hist,
// bb_upper, bb_lower

const PYTHON_CONDITIONS: CondMap = {
  'ema_cross_up':    "(df['ema_fast'] > df['ema_slow']) & (df['ema_fast'].shift(1) <= df['ema_slow'].shift(1))",
  'ema_cross_down':  "(df['ema_fast'] < df['ema_slow']) & (df['ema_fast'].shift(1) >= df['ema_slow'].shift(1))",
  'price_above_ema': "(df['Close'] > df['ema_trend'])",
  'price_below_ema': "(df['Close'] < df['ema_trend'])",
  'price_above_sma': (c) => `(df['Close'] > df['Close'].rolling(${getParam(c,'period',200)}).mean())`,
  'price_below_sma': (c) => `(df['Close'] < df['Close'].rolling(${getParam(c,'period',200)}).mean())`,

  'rsi_above':       (c) => `(df['rsi'] > ${getParam(c,'value',50)})`,
  'rsi_below':       (c) => `(df['rsi'] < ${getParam(c,'value',50)})`,
  'rsi_cross_up':    (c) => `(df['rsi'] > ${getParam(c,'value',50)}) & (df['rsi'].shift(1) <= ${getParam(c,'value',50)})`,
  'rsi_cross_down':  (c) => `(df['rsi'] < ${getParam(c,'value',50)}) & (df['rsi'].shift(1) >= ${getParam(c,'value',50)})`,
  'rsi_oversold':    "(df['rsi'] < 30)",
  'rsi_overbought':  "(df['rsi'] > 70)",

  'macd_cross_up':   "(df['macd_line'] > df['macd_signal']) & (df['macd_line'].shift(1) <= df['macd_signal'].shift(1))",
  'macd_cross_down': "(df['macd_line'] < df['macd_signal']) & (df['macd_line'].shift(1) >= df['macd_signal'].shift(1))",
  'macd_hist_pos':   "(df['macd_hist'] > 0)",
  'macd_hist_neg':   "(df['macd_hist'] < 0)",

  'bb_upper_touch':  "(df['Close'] >= df['bb_upper'])",
  'bb_lower_touch':  "(df['Close'] <= df['bb_lower'])",

  'volume_above_avg':(c) => `(df['Volume'] > df['Volume'].rolling(20).mean() * ${getParam(c,'multiplier',1.5)})`,
  'higher_high':     "(df['High'] > df['High'].shift(1)) & (df['High'].shift(1) > df['High'].shift(2))",
  'lower_low':       "(df['Low'] < df['Low'].shift(1)) & (df['Low'].shift(1) < df['Low'].shift(2))",
  'engulf_bull':     "(df['Close'] > df['Open']) & (df['Close'].shift(1) < df['Open'].shift(1)) & (df['Close'] > df['Open'].shift(1))",
  'engulf_bear':     "(df['Close'] < df['Open']) & (df['Close'].shift(1) > df['Open'].shift(1)) & (df['Close'] < df['Open'].shift(1))",
}

// ─── Templates ───────────────────────────────────────────────

function generatePineScript(strategy: any): string {
  const name = strategy.name || 'My Strategy'
  const riskPct = strategy.riskPct || 1
  const slPct = strategy.slPct || 2
  const tpPct = strategy.tpPct || 4

  const entryLabels = (strategy.entryConds || []).map((c: any) => c.label || c.type || c.id || '').filter(Boolean).join(', ')
  const exitLabels  = (strategy.exitConds  || []).map((c: any) => c.label || c.type || c.id || '').filter(Boolean).join(', ')

  const longConds = mapConditions(
    strategy.entryConds || [],
    PINE_CONDITIONS,
    ' and\n    ',
    'ta.crossover(emaFast, emaSlow)',
  )
  const shortConds = mapConditions(
    strategy.exitConds || [],
    PINE_CONDITIONS,
    ' and\n    ',
    'ta.crossunder(emaFast, emaSlow)',
  )

  return `//@version=6
strategy("${name}", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=${riskPct})

// ─── Inputs ───────────────────────────────────────────────
emaFastLen = input.int(9, "Fast EMA Length", minval=1)
emaSlowLen = input.int(21, "Slow EMA Length", minval=1)
ema200Len  = input.int(200, "Trend EMA Length", minval=1)
rsiLen     = input.int(14, "RSI Length", minval=1)
slPercent  = input.float(${slPct}, "Stop Loss %", minval=0.1, step=0.1)
tpPercent  = input.float(${tpPct}, "Take Profit %", minval=0.1, step=0.1)

// ─── Indicators (pre-computed for use in conditions) ──────
emaFast = ta.ema(close, emaFastLen)
emaSlow = ta.ema(close, emaSlowLen)
ema200  = ta.ema(close, ema200Len)
rsiVal  = ta.rsi(close, rsiLen)
vwapVal = ta.vwap(hlc3)
[macdLine, macdSignal, macdHist] = ta.macd(close, 12, 26, 9)
[bbMiddle, bbUpper, bbLower]     = ta.bb(close, 20, 2.0)

// ─── Strategy Conditions ──────────────────────────────────
// Strategy: ${name}
// Entry: ${entryLabels || '(none — using fallback)'}
// Exit:  ${exitLabels  || '(none — using fallback)'}
longCondition  = ${longConds}
shortCondition = ${shortConds}

// ─── Position Sizing ──────────────────────────────────────
longStop    = close * (1 - slPercent / 100)
longTarget  = close * (1 + tpPercent / 100)
shortStop   = close * (1 + slPercent / 100)
shortTarget = close * (1 - tpPercent / 100)

// ─── Entries ──────────────────────────────────────────────
if longCondition
    strategy.entry("Long", strategy.long)
    strategy.exit("Long Exit", "Long", stop=longStop, limit=longTarget)

if shortCondition
    strategy.entry("Short", strategy.short)
    strategy.exit("Short Exit", "Short", stop=shortStop, limit=shortTarget)

// ─── Visuals ──────────────────────────────────────────────
plot(emaFast, "Fast EMA", color=color.blue, linewidth=1)
plot(emaSlow, "Slow EMA", color=color.orange, linewidth=1)
plot(ema200,  "EMA 200",  color=color.gray,   linewidth=2)
plotshape(longCondition,  "Buy",  shape.triangleup,   location.belowbar, color.green, size=size.small)
plotshape(shortCondition, "Sell", shape.triangledown, location.abovebar, color.red,   size=size.small)
`
}

function generateNinjaScript(strategy: any): string {
  const name = (strategy.name || 'MyStrategy').replace(/[^a-zA-Z0-9]/g, '')
  const slPct = strategy.slPct || 2
  const tpPct = strategy.tpPct || 4

  const entryLabels = (strategy.entryConds || []).map((c: any) => c.label || c.type || c.id || '').filter(Boolean).join(', ')
  const exitLabels  = (strategy.exitConds  || []).map((c: any) => c.label || c.type || c.id || '').filter(Boolean).join(', ')

  const longConds = mapConditions(
    strategy.entryConds || [],
    NINJA_CONDITIONS,
    '\n                && ',
    'CrossAbove(emaFast, emaSlow, 1)',
  )
  const shortConds = mapConditions(
    strategy.exitConds || [],
    NINJA_CONDITIONS,
    '\n                && ',
    'CrossBelow(emaFast, emaSlow, 1)',
  )

  return `// NinjaTrader 8 NinjaScript Strategy
// Strategy: ${strategy.name || 'My Strategy'}
// Entry:    ${entryLabels || '(none — using fallback)'}
// Exit:     ${exitLabels  || '(none — using fallback)'}
// Generated by Nexyru

#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using NinjaTrader.Cbi;
using NinjaTrader.Gui;
using NinjaTrader.Gui.Chart;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.Indicators;
using NinjaTrader.NinjaScript.DrawingTools;
#endregion

namespace NinjaTrader.NinjaScript.Strategies
{
    public class ${name} : Strategy
    {
        private EMA emaFast;
        private EMA emaSlow;
        private EMA ema200;
        private RSI rsi;

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description = "Generated by Nexyru - ${strategy.name || 'My Strategy'}";
                Name = "${name}";
                Calculate = Calculate.OnBarClose;
                EntriesPerDirection = 1;
                EntryHandling = EntryHandling.AllEntries;
                IsExitOnSessionCloseStrategy = true;
                StopTargetHandling = StopTargetHandling.PerEntryExecution;
            }
            else if (State == State.Configure)
            {
                emaFast = EMA(9);
                emaSlow = EMA(21);
                ema200  = EMA(200);
                rsi     = RSI(14, 3);

                SetStopLoss(CalculationMode.Percent, ${slPct});
                SetProfitTarget(CalculationMode.Percent, ${tpPct});
            }
        }

        protected override void OnBarUpdate()
        {
            if (CurrentBar < 200) return;

            bool longCondition = ${longConds};

            bool shortCondition = ${shortConds};

            if (longCondition && Position.MarketPosition == MarketPosition.Flat)
            {
                EnterLong("Long Entry");
            }
            else if (shortCondition && Position.MarketPosition == MarketPosition.Flat)
            {
                EnterShort("Short Entry");
            }
        }
    }
}
`
}

function generatePython(strategy: any): string {
  const name = strategy.name || 'My Strategy'
  const slPct = strategy.slPct || 2
  const tpPct = strategy.tpPct || 4

  const entryLabels = (strategy.entryConds || []).map((c: any) => c.label || c.type || c.id || '').filter(Boolean).join(', ')
  const exitLabels  = (strategy.exitConds  || []).map((c: any) => c.label || c.type || c.id || '').filter(Boolean).join(', ')

  const longConds = mapConditions(
    strategy.entryConds || [],
    PYTHON_CONDITIONS,
    ' &\n    ',
    "(df['ema_fast'] > df['ema_slow']) & (df['ema_fast'].shift(1) <= df['ema_slow'].shift(1))",
  )
  const shortConds = mapConditions(
    strategy.exitConds || [],
    PYTHON_CONDITIONS,
    ' &\n    ',
    "(df['ema_fast'] < df['ema_slow']) & (df['ema_fast'].shift(1) >= df['ema_slow'].shift(1))",
  )

  return `# Python Backtesting Script
# Strategy: ${name}
# Entry:    ${entryLabels || '(none — using fallback)'}
# Exit:     ${exitLabels  || '(none — using fallback)'}
# Generated by Nexyru
# Requirements: pip install pandas numpy yfinance

import pandas as pd
import numpy as np
import yfinance as yf

# ─── Configuration ────────────────────────────────────────
SYMBOL = "ES=F"        # Change to your instrument
PERIOD = "1y"          # Data period
INTERVAL = "1h"        # Timeframe
STOP_PCT = ${slPct} / 100
TARGET_PCT = ${tpPct} / 100
INITIAL_CAPITAL = 10000

# ─── Download Data ────────────────────────────────────────
print(f"Downloading {SYMBOL} data...")
df = yf.download(SYMBOL, period=PERIOD, interval=INTERVAL)
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.droplevel(1)

# ─── Indicators ───────────────────────────────────────────
df['ema_fast']  = df['Close'].ewm(span=9).mean()
df['ema_slow']  = df['Close'].ewm(span=21).mean()
df['ema_trend'] = df['Close'].ewm(span=200).mean()

# RSI (Wilder)
delta = df['Close'].diff()
gain  = delta.where(delta > 0, 0).ewm(span=14).mean()
loss  = (-delta.where(delta < 0, 0)).ewm(span=14).mean()
df['rsi'] = 100 - (100 / (1 + gain / loss))

# MACD
ema12 = df['Close'].ewm(span=12).mean()
ema26 = df['Close'].ewm(span=26).mean()
df['macd_line']   = ema12 - ema26
df['macd_signal'] = df['macd_line'].ewm(span=9).mean()
df['macd_hist']   = df['macd_line'] - df['macd_signal']

# Bollinger Bands
bb_mid = df['Close'].rolling(20).mean()
bb_std = df['Close'].rolling(20).std()
df['bb_upper'] = bb_mid + 2 * bb_std
df['bb_lower'] = bb_mid - 2 * bb_std

# ─── Signals ──────────────────────────────────────────────
df['long_signal']  = (
    ${longConds}
)
df['short_signal'] = (
    ${shortConds}
)

# ─── Backtest ─────────────────────────────────────────────
capital     = INITIAL_CAPITAL
position    = 0
entry_price = 0.0
stop        = 0.0
target      = 0.0
trades      = []

for i, row in df.iterrows():
    if position == 0:
        if row['long_signal']:
            position    = 1
            entry_price = row['Close']
            stop        = entry_price * (1 - STOP_PCT)
            target      = entry_price * (1 + TARGET_PCT)
        elif row['short_signal']:
            position    = -1
            entry_price = row['Close']
            stop        = entry_price * (1 + STOP_PCT)
            target      = entry_price * (1 - TARGET_PCT)
    elif position == 1:
        if row['Close'] <= stop or row['Close'] >= target:
            pnl = (row['Close'] - entry_price) / entry_price
            capital *= (1 + pnl)
            trades.append({'side': 'long', 'entry': entry_price, 'exit': row['Close'], 'pnl': pnl})
            position = 0
    elif position == -1:
        if row['Close'] >= stop or row['Close'] <= target:
            pnl = (entry_price - row['Close']) / entry_price
            capital *= (1 + pnl)
            trades.append({'side': 'short', 'entry': entry_price, 'exit': row['Close'], 'pnl': pnl})
            position = 0

# ─── Results ──────────────────────────────────────────────
if trades:
    results = pd.DataFrame(trades)
    wins = results[results['pnl'] > 0]
    losses = results[results['pnl'] < 0]

    print(f"\\n=== ${name} Backtest Results ===")
    print(f"Total Trades:     {len(trades)}")
    print(f"Win Rate:         {len(wins)/len(trades)*100:.1f}%")
    print(f"Total Return:     {(capital/INITIAL_CAPITAL-1)*100:.2f}%")
    print(f"Final Capital:    \${capital:,.2f}")
    print(f"Avg Win:          {wins['pnl'].mean()*100:.2f}%" if len(wins) > 0 else "Avg Win: N/A")
    print(f"Avg Loss:         {losses['pnl'].mean()*100:.2f}%" if len(losses) > 0 else "Avg Loss: N/A")
    profit_factor = abs(wins['pnl'].sum() / losses['pnl'].sum()) if len(losses) > 0 else float('inf')
    print(f"Profit Factor:    {profit_factor:.2f}")
else:
    print("No trades generated. Try adjusting parameters.")
`
}

export async function POST(req: NextRequest) {
  try {
    const { strategy, format } = await req.json()

    let code = ''
    if (format === 'pinescript') {
      code = generatePineScript(strategy)
    } else if (format === 'ninjatrader') {
      code = generateNinjaScript(strategy)
    } else if (format === 'python') {
      code = generatePython(strategy)
    } else {
      code = generatePineScript(strategy)
    }

    return NextResponse.json({ code })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
