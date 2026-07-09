# web3-quant-sandbox

[中文](README.md) | [English](README.en.md)

离线 Web3 量化研究沙箱：用本地样本和可保存快照跑行情总览、机会雷达、策略回测、风险审计、模拟交易和研究报告。项目默认不连接真实交易账户、不管理钱包、不执行真实下单，适合学习、教学、策略原型验证和 Codex 交付课程演示。

> 如果这个项目对你学习 Web3 量化、回测工程或 Codex 课程流程有帮助，欢迎 Star；如果你要改策略、接数据源或做自己的研究面板，可以 Fork 后直接二次开发。

## 项目亮点

- **本地优先**：内置 `data/dashboard/*.json` 离线样本，断网也能打开核心页面。
- **完整研究路径**：覆盖市场总览、机会扫描、策略回测、风险审计、模拟交易、策略 DSL 和研究报告。
- **交易研究工作站**：`/live-trading` 现在包含 K 线主画布、周期切换、交易计划线、dry-run 订单票据和证据面板。
- **风险边界清晰**：模拟交易只记录 dry-run 研究动作，不连接交易所写接口，不提交真实订单。
- **可扩展策略与指标**：已有 MA、MACD、BOLL、RSI、资金费率、因子挖掘和滚动回测示例。
- **课程文档配套**：`docs/v2/` 的章节、命令和代码需要保持一致，适合边学边改。
- **前后端一体**：Python 本地服务 + React / Ant Design / lightweight-charts 前端。

## 界面预览

![首页概览](image/首页概览.png)

![回测详情](image/回测详情.png)

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+
- npm

### Windows PowerShell

```powershell
py scripts/course.py setup
py app.py
```

如果本机没有可用的 `py` 启动器，可以改用：

```powershell
python scripts/course.py setup
python app.py
```

启动后打开：

```text
http://127.0.0.1:8765
```

常用页面：

| 页面 | 地址 |
| --- | --- |
| 市场总览 | `http://127.0.0.1:8765/trading` |
| 机会雷达 | `http://127.0.0.1:8765/radar` |
| 数据源监控 | `http://127.0.0.1:8765/data-sources` |
| 策略回测 | `http://127.0.0.1:8765/backtests` |
| 模拟交易工作站 | `http://127.0.0.1:8765/live-trading` |
| 风控中心 | `http://127.0.0.1:8765/risk` |
| 策略 DSL | `http://127.0.0.1:8765/strategy` |
| 市场情报 | `http://127.0.0.1:8765/research` |

### macOS / Linux

```bash
make setup
python app.py
```

## 主要能力

| 能力 | Web 路由 | 主要代码路径 | 说明 |
| --- | --- | --- | --- |
| 市场总览 | `/trading` | `src/dashboard/`, `src/web/src/pages/trading/DashboardPage.tsx` | 多资产行情、K 线、交易信号、风险摘要和执行入口 |
| 机会雷达 | `/radar` | `src/dashboard/opportunity.py` | 基于资金、趋势、链上和风险信号扫描机会 |
| 数据源监控 | `/data-sources` | `src/dashboard/snapshot.py`, `src/dashboard/catalog.py` | 查看样本、快照和在线 API 状态 |
| 策略回测 | `/backtests` | `src/backtest/`, `src/backtest/rolling/` | 单策略、窗口对比、walk-forward、组合和稳健性检查 |
| 模拟交易工作站 | `/live-trading` | `src/web/src/pages/trading/LiveTradingPage.tsx`, `src/risk/`, `src/strategy_engine/` | K 线主画布、dry-run 票据、市场/信号/风险/账本/系统证据面板 |
| 风控中心 | `/risk` | `src/risk/`, `src/backtest/audit/` | 回撤、止损、CPCV、PBO、DSR 等风险视角 |
| 策略 DSL | `/strategy` | `src/strategy_engine/dsl/` | AST 白名单、import 限制、前视偏差检查和编译验证 |
| 市场情报 | `/research` | `src/research/`, `src/dashboard/llm_signal.py` | 研究摘要、来源卡片和可选 LLM 信号分析 |
| CLI 报告 | 无 | `report_cli.py`, `src/research/report.py` | 输出 summary 或 JSON 研究报告 |

## 模拟交易工作站

`/live-trading` 是研究流程里的模拟执行入口，不是实盘终端。它现在按交易工作站的信息架构组织：

- **左侧情报栏**：展示当前交易对、参考价格、信号结论、置信度、风险状态和 AI Picks 队列。
- **中央 K 线主画布**：使用 lightweight-charts 展示蜡烛图、成交量、MA20、MA60，并叠加信号给出的入场、止损和目标价线。
- **周期切换**：支持 `15m / 1h / 4h / 1D` K 线周期。
- **右侧 dry-run 票据**：输入交易对、方向、金额、硬上限和确认词，只生成模拟审计记录。
- **证据面板**：用分段控件切换市场、信号、风险、账本和系统假设，减少首屏噪音。
- **浅色/暗色主题**：浅色模式使用白色、淡青和淡绿层级，暗色模式保持深色交易终端质感。

## 适合谁使用

- 想零资金风险学习 Web3 量化和程序化交易的新手。
- 需要本地回测、风控审计和策略验证样例的开发者。
- 想把 Codex 用到研究、实现、验证、文档交付流程里的课程学员。
- 想搭建私有模拟交易面板、机会雷达或研究报告流水线的工程师。

## 二次开发入口

| 目标 | 推荐入口 |
| --- | --- |
| 新增市场数据或快照来源 | `src/dashboard/`, `dashboard_snapshot.py`, `scripts/build_dashboard_fixtures.py` |
| 新增回测策略 | `src/backtest/rolling/strategies/` |
| 新增技术指标 | `src/ta/`, `src/backtest/rolling/indicators.py` |
| 扩展因子挖掘 | `src/factor_mining/` |
| 调整模拟交易和风控 | `src/web/src/pages/trading/LiveTradingPage.tsx`, `src/risk/`, `src/strategy_engine/` |
| 修改 Web 页面 | `src/web/src/pages/trading/`, `src/web/src/components/` |
| 更新课程章节 | `docs/v2/` |

有通用价值的策略、指标、数据源适配或课程修正，欢迎提交 PR。

## 数据模式

Dashboard 数据主要来自三类来源：

1. `data/dashboard/*.json`：仓库内置离线样本，断网也能运行。
2. `data/dashboard/snapshots/`：在线抓取后落盘的快照。
3. 在线 API：仅在配置密钥并启用 `DASHBOARD_DATA_MODE=auto` 或 `DASHBOARD_DATA_MODE=live` 时使用。

常用数据命令：

| 命令 | 作用 |
| --- | --- |
| `py scripts/course.py snapshot` | 联网抓取 dashboard 数据并写入快照 |
| `py scripts/course.py sync-fixtures` | 将完整快照同步为内置样本 |
| `py scripts/course.py save-offline-data` | 抓取快照并同步离线样本 |
| `py scripts/course.py build-fixtures` | 用快照或种子数据补齐样本 |

可以复制 `.env.example` 为 `.env` 后按需配置。未配置 API 密钥时，应用仍会使用离线样本正常启动。

## 命令行报告

```powershell
python report_cli.py --format summary
python report_cli.py --format json --short 3 --long 7
```

报告内容来自 `src/research/report.py`，会合并样本数据、回测指标、风险检查和执行边界说明。

## 前端开发

生产模式由 `app.py` 直接服务 `src/web/static/`。开发前端时可以同时启动 Vite：

```powershell
py app.py
cd src/web
npm run dev
```

单独构建前端：

```powershell
cd src/web
npm run build
```

## 验证

编辑期间建议运行：

```powershell
py scripts/course.py verify
```

在这个 Windows 环境里，如果 `py` 启动器不可用，可以使用仓库虚拟环境：

```powershell
.\.venv\Scripts\python.exe scripts\course.py verify
```

仓库级变更完成前运行：

```powershell
py scripts/course.py check
```

`check` 会额外执行实现矩阵、vendor 漂移检查、资产审计和课程文档检查。编辑绘图脚本后，重新生成教学图：

```powershell
py scripts/course.py teaching-plots
```

## 项目结构

```text
.
├── app.py                     # 本地 HTTP 服务，默认 127.0.0.1:8765
├── report_cli.py              # 命令行研究报告
├── verify.py                  # 产品验证入口
├── scripts/
│   └── course.py              # setup / verify / check / snapshot 等任务
├── src/
│   ├── backtest/              # 回测、滚动窗口、审计指标
│   ├── config/                # 环境变量和上游配置
│   ├── dashboard/             # 行情、快照、机会扫描、API 适配
│   ├── data/                  # point-in-time 数据工具
│   ├── factor_mining/         # 因子挖掘与因子回测
│   ├── research/              # 研究报告组装
│   ├── risk/                  # 风控规则和模拟边界
│   ├── strategy_engine/       # 事件驱动策略引擎与 DSL
│   ├── ta/                    # 技术指标工具
│   └── web/                   # React + Ant Design 前端
├── data/                      # 离线样本和 dashboard 快照
├── docs/v2/                   # 课程章节
├── skills/                    # 课程中沉淀的 Codex 技能
├── tests/                     # pytest 测试
├── outputs/                   # 生成产物
└── reports/                   # 报告产物
```

## GitHub 首页建议

为了让更多人能在 GitHub 搜到这个项目，建议在仓库右侧 About 区域补全：

**Description**

```text
离线 Web3 量化沙箱：本地模拟交易、链上/CEX 策略回测、机会雷达、风险审计和可视化研究面板。
```

**Topics**

```text
web3, quant, crypto-trading, backtest, trading-sandbox, algorithmic-trading, python-quant, trading-bot, react, codex
```

## 安全边界

- 默认不连接真实交易所账户或钱包。
- `/live-trading` 是模拟交易工作站，不是实盘交易终端。
- dry-run 只记录研究动作，不提交真实订单。
- 策略 DSL 会做 AST 白名单、import 限制和前视偏差检查。
- 在线数据仅用于研究展示和回测输入，不构成投资建议。
- API 密钥只应通过本地 `.env` 读取，不应提交到仓库。

## 开源协议

本项目是 MIT 协议开源项目，详见 [LICENSE](LICENSE)。

作者：袁从德

联系方式：congdeyuan@gmail.com
