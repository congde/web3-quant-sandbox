# 因子挖掘教学导读（配套案例）

> 正文专节：**第 21 讲 §21.8 因子挖掘专题**（图 21-5：`docs/v2/assets/chapter-21-factor-mining-pipeline.png`）  
> 代码：`src/factor_mining/` · 页面：`/backtests` · CLI：`scripts/backtest_lab.py mine`

## 1. 因子挖掘是什么

**因子挖掘** = 在历史数据上，自动或半自动地搜索「能解释未来收益或未来风险」的信号表达式或特征组合。

它与三件事不同：

| 概念 | 回答的问题 | 本仓库入口 |
|------|------------|------------|
| **因子计算** | 按固定公式算分数 | `vendor/web3-trading/src/factors/`（31 个预定义因子） |
| **收益因子挖掘** | 谁该预测未来收益 | `mine --target return` |
| **风险因子挖掘** | 谁该预测未来波动 | `mine --target risk` → `risk_apply.py` |
| **策略回测** | 按规则交易赚不赚钱 | `mined_factor`（仅收益因子） |

**IC** 衡量对未来收益的排序能力；**RIC** 衡量对未来风险代理的排序能力；**PnL** 衡量交易结果。三者相关但不等价。

## 2. 一键命令

```powershell
# 收益因子：GP + ML（JSON 输出）
py scripts/backtest_lab.py mine --mode both --limit 120 --horizon 1

# 风险因子：RIC + 仓位缩放预览
py scripts/backtest_lab.py mine --target risk --risk-kind abs_ret --seed 42
py scripts/backtest_lab.py mine --target risk --risk-kind realized_vol --horizon 3

# 仅 GP（更快）
py scripts/backtest_lab.py mine --mode gp --gp-generations 8 --gp-population 16

# 端到端路径（可选追加挖掘步骤）
py scripts/backtest_lab.py path --factor-mine

# 测试
py -m pytest tests/test_factor_mining.py -q
```

## 3. HTTP API

| 方法 | 路径 | 作用 |
|------|------|------|
| GET | `/api/dashboard/factor-mine?mode=both&limit=120&horizon=1` | 收益因子挖掘 |
| GET | `/api/dashboard/factor-mine?target=risk&riskKind=abs_ret` | 风险因子挖掘 |
| POST | `/api/dashboard/factor-mine/backtest` | body 含 `backtest_spec`（**仅收益因子**） |

`backtest_spec` 由挖掘结果的 `leader.backtest_spec` 提供，含 `factor_source`（`gp`/`ml`）、`expr` 或 `weights`。

## 4. 浏览器路径

1. 打开 http://127.0.0.1:8765/backtests  
2. 选择 **收益因子** 或 **风险因子**、标的与 K 线数量  
3. **运行挖掘** → 查看 GP/ML 表达式、训练/测试 IC 或 RIC、`warnings`  
4. **收益因子**：**用领先因子回测** → `mined_factor` 图表  
5. **风险因子**：阅读 **仓位缩放预览** → 对照第 22 讲风控  

## 5. 模块地图

```text
features.py      → 12 维 OHLCV + 指标特征
evaluate.py      → Spearman IC / IR（纯 Python）
risk_apply.py    → 风险因子 z-score → position_scale 预览
expressions.py   → GP 符号树 + delay/rank 算子
gp.py / ml.py    → 搜索
service.py       → 训练测试切分、leader、warnings
serialize.py     → 表达式 JSON ↔ 树
strategies/mined_factor.py → 因子 z-score → LONG/SHORT
```

## 6. 验收清单

| 项 | 通过条件 |
|----|----------|
| 命令可跑 | `mine` 返回 `ok: true` 且 `leader.backtest_spec` 存在 |
| IC 双段 | 同时记录 `train` 与 `test` IC，计算 `overfit_gap` |
| 回测联动 | POST backtest 后 `strategy_key == mined_factor` |
| 对照 | 与 `compare` 中某手写策略并排 PnL，不隐瞒 IC/PnL 矛盾 |
| 边界 | 能说出「单标的时序 IC ≠ 截面多股票检验」 |

## 7. 与回测导读的关系

- 多策略 / 窗口稳定性：[`backtest-teaching-guide.md`](backtest-teaching-guide.md)  
- 过拟合与数据窥探：第 20 讲 §20.0.1  
- 业界对照与升级路线：第 21 讲 §21.8  

## 8. 学员四句话（因子版）

1. 特征从哪来？（第 9 讲指标 + `features.py`）  
2. 公式怎么搜？（GP 表达式 / ML 权重 + `seed`）  
3. IC 说明什么、回测说明什么？  
4. `overfit_gap` 过大时为何必须停止外推？  

## 9. 样例输出

固定教学样本 `WEB3-DEMO/USDT`（`data/prices.csv`，35 根日 K），命令 `mine --mode both --seed 42`：

- [`factor-mining-report.json`](factor-mining-report.json) — 收益因子 `mine --target return`
- [`factor-mining-backtest.json`](factor-mining-backtest.json) — `mined_factor` 回测摘要
- [`factor-mining-risk-report.json`](factor-mining-risk-report.json) — 风险因子 `mine --target risk`

**阅读顺序：**

| 字段 | 说明 |
|------|------|
| `baseline_univariate` | 单特征 IC 粗筛，对照 GP/ML 是否优于简单特征 |
| `gp.expression` / `ml.formula` | 可复现的因子定义 |
| `*.train` / `*.test` | 70/30 时间切分下的 IC；勿只看训练段 |
| `overfit_gap` | \|train IC\| − \|test IC\|；ML 样例约 0.37，触发过拟合警告 |
| `leader` | 按 **测试集 \|IC\|** 在 GP 与 ML 间选取（样例为 GP `ret_5`） |
| `leader.backtest_spec` | POST `/api/dashboard/factor-mine/backtest` 的请求体核心 |
| `factor-mining-backtest.json` | 样例：`test_ic` 为负但 `total_return_pct` 仍可为正——须同时报告，不可只挑有利项 |

本地数字以你运行的 CLI 为准；若 K 线数量或 `seed` 变化，表达式与 IC 会不同。
