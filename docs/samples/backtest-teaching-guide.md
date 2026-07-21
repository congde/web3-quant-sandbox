# 回测教学导读（配套案例）

> 本文件对应第四篇「策略实现、回测与风险控制」的案例导读。  
> 可运行命令见 `scripts/backtest_lab.py`；Web 入口见 http://127.0.0.1:8765/backtests

## 1. 回测是什么

**回测 = 用历史 K 线，按固定规则，模拟一遍「如果当时这样交易会发生了什么」。**

它不是预测未来，而是研究流程里的**证据环节**：

| 环节 | 回答的问题 |
|------|-----------|
| 数据 | 用了哪段历史？ |
| 规则 | 策略在什么条件下买卖？ |
| 模拟 | 按时间顺序，订单如何成交？ |
| 指标 | 收益、回撤、Sharpe 等如何计算？ |
| 限制 | 哪些假设必须声明？为什么不能外推？ |

**本仓库不做真实下单。** 数据来自固定教学 CSV 或 dashboard 离线/实时 K 线快照（见下表）。

| 数据源 | 代码路径 | 日期范围（示例） | 说明 |
|--------|----------|------------------|------|
| `WEB3-DEMO/USDT` | `data/prices.csv` | 2026-01-05 → 2026-02-20 | 固定教学样本，35 根日 K，不自动更新 |
| `BTC-USDT` | `data/dashboard/snapshots/market_candles.json` | 快照内最近约 100 根日 K | 默认回测数据源；可勾选「拉取最新 K 线」从 KuCoin 刷新 |

`load_candles()` 始终取**最近 N 根**日 K（不是最旧 N 根）。回测 API 返回 `data_from`、`data_through`、`data_source` 供页面标注样本窗口。

## 2. 两套引擎，两个教学重点

| 引擎 | 代码 | 章节 | 教什么 |
|------|------|------|--------|
| 事件驱动 | `src/strategy_engine/backtest/engine.py` | 第 18 讲 | 订单生命周期、挂单、风控拒绝 |
| 滚动窗口 | `src/backtest/rolling/engine.py` | 第 21 讲 | 多策略比较、止损止盈、窗口稳定性 |

Web 页面 `/backtests` 使用滚动窗口引擎；Dashboard 报告与 `/risk` 使用事件驱动引擎。

## 3. 一键命令地图

```powershell
# 第 18 讲 — 事件驱动
py scripts/backtest_lab.py trace
py scripts/backtest_lab.py scenario

# 第 19 讲 — 指标解释（收益 vs 回撤）
py scripts/backtest_lab.py metrics

# 第 20 讲 — 前视偏差 / DSL 污染检查
py scripts/backtest_lab.py pollution

# 第 21 讲 — 多策略 / 多窗口
py scripts/backtest_lab.py compare
py scripts/backtest_lab.py windows --strategy ma_crossover

# 第 21 讲 21.0.1 — GP / ML 因子挖掘 + 挖掘因子回测
py scripts/backtest_lab.py mine --mode both --limit 120

# 第 34 讲 — 端到端研究路径（可选 --factor-mine 追加挖掘步骤）
py scripts/backtest_lab.py path
py scripts/backtest_lab.py path --factor-mine
```

## 4. 浏览器路径（第 26 讲）

```text
/strategy  → 校验策略 DSL
/backtests → 运行回测 + 组合图表 + 多策略比较 + 窗口稳定性
/risk      → 查看风控拒绝与回测后复核
```

### 回测页 `/backtests` 读图要点

| 区块 | 组件 / API | 读什么 |
|------|------------|--------|
| 回测图表 | `BacktestComboChart.tsx` | 上：日 K + ▲买/●平仓；下：权益（左轴）与价格（右轴）；X 轴为 `YYYY-MM-DD` |
| 指标卡片 | `/api/dashboard/backtest` | 收益、回撤、Sharpe、交易数 |
| 多策略比较 | `/api/dashboard/backtest/compare` | 五策略同一样本、同一手续费 |
| 成交明细 | `/api/dashboard/backtest` → `trades[]` | 逐笔入场/出场、PnL%、平仓原因、持仓 K 数 |
| 窗口稳定性 | `/api/dashboard/backtest/windows` | 三分窗是否同为正收益 |
| 因子挖掘 | `/api/dashboard/factor-mine` | GP 表达式、ML 公式、训练/测试 IC、overfit_gap |
| 挖掘因子回测 | `POST /api/dashboard/factor-mine/backtest` | 将 leader.backtest_spec 送入 `mined_factor` 策略 |

操作：**滚轮缩放**、**拖动平移**时间轴；需要最新行情时选 `BTC-USDT` 并勾选 **拉取最新 K 线** 后点「运行回测」。因子挖掘与回测共用标的与 bar 数：先 **运行挖掘**，再 **用领先因子回测**。

页面截图：

- 回测图表 → [`回测详情.png`](../v2/assets/回测详情.png) — 图 21-2 / 26-2 / 34-2
- 多策略比较 → [`多策略比较.png`](../v2/assets/多策略比较.png) — 图 21-3 / 26-3 / 34-3
- 成交明细 → [`成交明细.png`](../v2/assets/成交明细.png) — 图 21-4 / 26-4 / 34-4

## 5. 样例输出

- [`backtest-teaching-guide.md`](backtest-teaching-guide.md) — 回测导读
- [`factor-mining-teaching-guide.md`](factor-mining-teaching-guide.md) — 因子挖掘导读（第 21 讲 §21.8）
- [`backtest-compare-report.json`](backtest-compare-report.json) — 五策略比较
- [`backtest-event-trace.json`](backtest-event-trace.json) — 事件驱动轨迹
- [`backtest-windows-report.json`](backtest-windows-report.json) — 三分窗稳定性
- [`factor-mining-report.json`](factor-mining-report.json) — 收益因子挖掘（第 21 讲 §21.8）
- [`factor-mining-risk-report.json`](factor-mining-risk-report.json) — 风险因子挖掘（§21.8.10）
- [`factor-mining-backtest.json`](factor-mining-backtest.json) — 挖掘因子 `mined_factor` 回测摘要

## 6. 学员必须能回答的四句话

1. 输入来自哪里？（样本 / 快照 / 版本）
2. 策略规则是什么？（无歧义、可复现；若来自挖掘，写出 GP 表达式或 ML 权重）
3. 回测证明了什么、不能证明什么？（IC 与 PnL 分别说明什么）
4. 风控在哪里停止它？（拒绝、降级、不可外推；挖掘时还有 overfit_gap）
