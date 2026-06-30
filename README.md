# web3-quant-sandbox

Web3 量化研究与模拟交易沙箱。项目提供一个本地可运行的研究工作台：行情总览、机会雷达、数据源监控、策略回测、模拟交易、风控中心、策略 DSL 校验与研究报告。

默认使用仓库内置离线样本和本地快照运行，不连接真实交易账户，不管理钱包，也不会执行真实下单。所有交易相关功能都是研究、回测和模拟用途。

## 主要能力

| 能力 | Web 路由 | 后端/代码路径 | 说明 |
| --- | --- | --- | --- |
| 市场总览 | `/trading` | `src/dashboard/`, `src/web/src/pages/trading/DashboardPage.tsx` | 多资产行情、K 线、交易信号、风控摘要和执行入口 |
| 机会雷达 | `/radar` | `src/dashboard/opportunity.py` | 按资金、趋势、链上和风险信号扫描机会 |
| 数据源 | `/data-sources` | `src/dashboard/snapshot.py`, `src/dashboard/catalog.py` | 查看样本、快照、在线 API 的状态和完整性 |
| 策略回测 | `/backtests` | `src/backtest/`, `src/backtest/rolling/` | 单策略、窗口对比、Walk-forward、组合和鲁棒性检查 |
| 模拟交易 | `/live-trading` | `src/strategy_engine/`, `src/risk/` | 基于样本行情的模拟执行，不触达实盘 |
| 风控中心 | `/risk` | `src/risk/`, `src/backtest/audit/` | 回撤、止损、CPCV、PBO、DSR 等风险视角 |
| 策略 DSL | `/strategy` | `src/strategy_engine/dsl/` | AST 白名单、import 限制、前视偏差检查和编译验证 |
| 市场情报 | `/research` | `src/research/`, `src/dashboard/llm_signal.py` | 研究摘要、来源卡片和可选 LLM 信号分析 |
| CLI 报告 | 无 | `report_cli.py`, `src/research/report.py` | 输出 summary 或 JSON 研究报告 |

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- npm

### Windows PowerShell

```powershell
py scripts/course.py setup
py app.py
```

如果本机 `py` 启动器配置异常，可以改用：

```powershell
python scripts/course.py setup
python app.py
```

启动后打开：

```text
http://127.0.0.1:8765
```

根路径会自动进入 `/trading`。

### macOS / Linux

```bash
make setup
python app.py
```

### 前端开发模式

生产模式由 `app.py` 直接服务 `src/web/static/`。开发前端时可以同时启动 Vite：

```powershell
py app.py
cd src/web
npm run dev
```

前端构建命令：

```powershell
cd src/web
npm run build
```

## 数据模式

Dashboard 数据有三层来源：

1. `data/dashboard/snapshots/`：在线抓取后落盘的最新快照和历史快照。
2. `data/dashboard/*.json`：仓库内置离线样本，断网也能运行。
3. 在线 API：仅在配置密钥并启用 `DASHBOARD_DATA_MODE=auto` 或 `live` 时使用。

常用命令：

| 命令 | 作用 |
| --- | --- |
| `py scripts/course.py snapshot` | 联网抓取 dashboard 数据并写入快照 |
| `py scripts/course.py sync-fixtures` | 将完整快照同步为内置样本 |
| `py scripts/course.py save-offline-data` | 抓取快照并同步离线样本 |
| `py scripts/course.py build-fixtures` | 用快照或种子数据补齐样本 |

可复制 `.env.example` 为 `.env`，按需配置：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DASHBOARD_DATA_MODE` | `offline` | `offline` / `auto` / `live` |
| `WEB3_TRADING_UPSTREAM` | `never` | 是否代理外部 web3-trading 服务 |
| `VS_OPEN_API_KEY` / `VS_OPEN_SECRET_KEY` | 空 | ValueScan Open API |
| `DEX_API_KEY` | 空 | DexScan DEX 数据 |
| `KUCOIN_PUBLIC_API_BASE` | KuCoin 公网 API | 无密钥行情来源 |
| `FEAR_GREED_API` | alternative.me | 恐惧贪婪指数 |
| `OPENAI_API_KEY` | 空 | LLM 信号分析，可兼容 DeepSeek/OpenAI API |

未配置密钥时，应用仍会使用离线样本正常启动。

## HTTP API

`app.py` 默认监听 `127.0.0.1:8765`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/` | React SPA 入口 |
| GET | `/api/report?short=3&long=7` | 统一研究报告 |
| POST | `/api/validate-strategy` | 校验策略 DSL 代码 |
| GET | `/api/dashboard/config` | 运行配置 |
| GET | `/api/dashboard/sources/status` | 数据源状态 |
| GET | `/api/dashboard/snapshots` | 快照状态 |
| GET | `/api/dashboard/vs/ai-picks` | AI 精选样本/接口数据 |
| GET | `/api/dashboard/vs/sector-fund` | 板块资金 |
| GET | `/api/dashboard/vs/token-fund` | Token 资金 |
| GET | `/api/dashboard/onchain` | 链上摘要 |
| GET | `/api/dashboard/dex/trending` | DEX 热门资产 |
| GET | `/api/dashboard/opportunity-scan` | 机会扫描 |
| GET | `/api/market/candles` | K 线数据 |
| GET | `/api/market/tickers` | Ticker 列表 |
| GET | `/api/market/ticker` | 单个 Ticker 统计 |
| GET | `/api/market/kline-analysis` | K 线分析 |
| GET | `/api/dashboard/backtest` | 执行回测 |
| GET | `/api/dashboard/backtest/compare` | 策略对比 |
| GET | `/api/dashboard/backtest/windows` | 多窗口对比 |
| GET | `/api/dashboard/backtest/walk-forward` | Walk-forward 验证 |
| GET | `/api/dashboard/backtest/portfolio` | 组合对比 |
| GET | `/api/dashboard/backtest/robustness` | 鲁棒性检查 |
| GET | `/api/dashboard/backtest/cpcv` | CPCV 检查 |
| GET | `/api/dashboard/factor-mine` | 因子挖掘 |
| POST | `/api/dashboard/factor-mine/backtest` | 挖掘因子回测 |
| GET | `/api/dashboard/signal-analysis` | 规则化信号分析 |
| GET | `/api/dashboard/llm-signal-analysis` | 启动 LLM 信号分析 |
| GET | `/api/dashboard/llm-signal-analysis/poll` | 轮询 LLM 分析任务 |

## 命令行报告

```powershell
python report_cli.py --format summary
python report_cli.py --format json --short 3 --long 7
```

报告内容来自 `src/research/report.py`，会合并样本数据、回测指标、风险检查和执行边界说明。

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
├── tests/                     # pytest 测试
├── vendor/                    # 上游对照代码，只读参考
├── outputs/                   # 生成产物，可按需清理
└── reports/                   # 报告产物
```

`src/` 是当前产品代码。`vendor/` 只用于对照和 baseline 校验，产品代码不应从 `vendor/` import。

## 验证

常用检查：

```powershell
py scripts/course.py verify
```

该命令会：

1. 安装/刷新前端依赖。
2. 构建 React 前端。
3. 检查关键项目文件。
4. 运行上游 baseline 校验。
5. 运行 `tests/` 下的 pytest 测试。

完整仓库检查：

```powershell
py scripts/course.py check
```

`check` 会额外执行资源审计、vendor 漂移检查和文档类检查。如果只关注当前应用代码，优先看 `verify`。

单独构建前端：

```powershell
cd src/web
npm run build
```

## 端口占用处理

如果启动时报错 `Cannot bind 127.0.0.1:8765`，说明已有进程占用端口。

Windows PowerShell：

```powershell
Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
py app.py
```

## 安全边界

- 默认不连接真实交易所账户或钱包。
- `/live-trading` 是模拟交易界面，不是实盘交易终端。
- 策略 DSL 会做 AST 白名单、import 限制和前视偏差检查。
- 在线数据只用于研究展示和回测输入，不构成投资建议。
- API 密钥只通过本地 `.env` 读取，不应提交到仓库。

## 开发约定

- 产品代码放在 `src/`。
- 前端代码放在 `src/web/`。
- 测试放在 `tests/`。
- 离线样本放在 `data/`。
- `vendor/` 为只读上游对照，不从产品代码直接引用。
- 生成型文件优先放入 `outputs/` 或 `reports/`。
