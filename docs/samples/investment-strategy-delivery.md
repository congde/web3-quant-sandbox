# 投资策略交付：跨周期趋势组合 v1.1.0

## 准入结论

`PROMOTE_RESEARCH`：策略已通过仓库定义的全部历史研究准入门槛。

这不是实盘授权，也不构成收益保证。真实资金使用前仍需完成纸面交易、实时数据核验、容量与强平建模，以及人工风险审批。

本轮 v1.1 风险预算优化已经观察过该历史准入段，因此它不再是完全未触碰的独立样本。`PROMOTE_RESEARCH` 仅允许进入前向纸面交易，新的未来区间仍须再次通过同一门槛。

## 前向纸面验证

v1.1 已按策略合同生成 SHA-256 指纹，并冻结在 `data/investment_gate/forward_plan.json`。冻结日为 2026-07-22；只有之后完成的 UTC 日线才计入前向样本。

- 少于 90 根新日线：`WAITING_FOR_DATA` 或 `COLLECTING`，决定固定为 `HOLD`。
- 策略合同指纹改变：`BLOCKED_SPEC_DRIFT`，旧前向计划立即失效。
- 五个资产的新样本日期不一致：`BLOCKED_DATA_ALIGNMENT`。
- 满 90 根后才检查正收益、Sharpe ≥ 0.30、回撤 ≤ 15%、年化波动 ≤ 20%。
- 全部门槛通过也只生成 `REQUEST_HUMAN_REVIEW`；代码永远不会自动授予实盘权限。

当前固定数据尚无冻结日之后的新K线，因此状态为 `WAITING_FOR_DATA`，进度为 0 / 90。

## 策略与组合规则

- 标的：BTCUSDT、ETHUSDT、BNBUSDT、SOLUSDT、XRPUSDT。
- 工具：USDT 永续合约研究模拟，日频。
- 做多：收盘价高于 120 日均线，且 63 日动量为正。
- 做空：收盘价低于 120 日均线，且 63 日动量为负。
- 状态退出：使用 100 日均线识别趋势转换。
- 单笔止损 10%，单笔止盈 40%。
- 组合配置：用前一交易日以前的 60 个完整日收益估计逆波动权重，单资产预算限制为 10%–30%。
- 风险缩放：组合预测年化波动目标 20%，总名义敞口不超过 100%，每 7 根日线再平衡。
- 配置成本：组合权重变更按单边换手 0.05%计费。
- 执行成本：单边手续费 0.10%、基础滑点 0.05%，并启用动态滑点。
- 资金费率压力：分别在 -0.01%、0、+0.01% 每 8 小时三个情景复核。

实现位于 `src/backtest/rolling/strategies/regime_trend.py`；固定策略合同、风险预算和准入逻辑位于 `src/backtest/investment_gate.py`。

## 锁定样本外结果

数据源为 Binance 已完成的 UTC 日线。开发数据为前 635 根，其中指标预热后 515 根计入开发稳定性复核；准入区间锁定为最后 365 根，即 2025-07-23 至 2026-07-22。

| 指标 | 策略组合 | 同风险预算买入持有 | 准入门槛 |
| --- | ---: | ---: | ---: |
| 总收益 | 11.02% | -20.05% | ≥ 5% |
| Sharpe | 0.74 | -0.90 | ≥ 0.60 |
| Sortino | 1.07 | — | 观察项 |
| 最大回撤 | 9.09% | 32.20% | ≤ 15% |
| 年化波动 | 15.91% | 22.12% | ≤ 20% |
| 平均总敞口 | 41.5% | 41.5% | 观察项 |
| 最大总敞口 | 60.0% | 60.0% | ≤ 100% |
| 盈利资产 | 4 / 5 | — | ≥ 3 / 5 |
| 完成交易 | 54 | — | ≥ 30 |

开发段收益 9.37%、Sharpe 0.47、最大回撤 21.80%，通过新增的开发稳定性门槛。最不利资金费率情景收益为 9.70%，最大回撤为 10.30%。四组预先声明的邻近参数均保持正收益，最低为 9.14%。

风险预算完全滞后：某日的配置只读取截至前一日收盘的市场收益；测试会对当日收益施加极端冲击并确认当日权重不变。

## 可复核证据

- 固定数据：`data/investment_gate/*.csv`
- 数据清单：`data/investment_gate/manifest.json`
- 前向冻结计划：`data/investment_gate/forward_plan.json`
- 机器可读准入证书：`data/investment_gate/acceptance_certificate.json`
- 已执行验证笔记本：`docs/samples/investment-gate-validation.ipynb`
- 数据刷新脚本：`scripts/build_investment_gate_dataset.py`
- 笔记本生成脚本：`scripts/build_investment_gate_notebook.py`
- Web API：`GET /api/dashboard/backtest/investment-gate`
- 页面：`/backtests` 顶部“投资准入策略”卡片

重新生成证据：

```powershell
.\.venv\Scripts\python.exe scripts\build_investment_gate_dataset.py
$env:PYTHONPATH = "src"
.\.venv\Scripts\python.exe -c "from backtest.investment_gate import write_acceptance_certificate; write_acceptance_certificate()"
.\.venv\Scripts\python.exe scripts\build_investment_gate_notebook.py
```

## 停用线

出现任一情况即撤销研究准入：

- 最新完整滚动 365 日组合收益低于 0；
- 最大回撤超过 15%；
- 日频 Sharpe 低于 0.60；
- 年化实现波动超过 20%；
- 总名义敞口超过 100%；
- 五个资产中少于三个保持正收益；
- 最不利资金费率压力情景收益低于 5%；
- 开发稳定性、数据质量、时间顺序或成本模型任一硬门失败。
