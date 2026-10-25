# JarvisERP evaluation report

Seeds: [2026, 1, 2, 3, 11, 42] · LLM layer: off (deterministic core only)

Each seed is a freshly generated Afterglow Labs world with planted issues and an answer key the agent never reads.
Jarvis runs autonomously; the Controller is played by the scripted persona (approves, rejects one accrual, answers one question).

## September close (same items, Jarvis vs rules-based bank feed)

| seed | items | Jarvis fully correct | B1 rules fully correct | Jarvis detection | B1 detection | Jarvis treatment | B1 treatment | Jarvis trap precision | B1 trap precision | Jarvis escalation | B1 escalation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026 | 47 | **100%** | 64% | 100% | 74% | 100% | 45% | 100% | 100% | 100% | 71% |
| 1 | 44 | **100%** | 61% | 100% | 74% | 100% | 45% | 100% | 100% | 100% | 71% |
| 2 | 45 | **100%** | 62% | 100% | 74% | 100% | 45% | 100% | 100% | 100% | 71% |
| 3 | 44 | **100%** | 61% | 100% | 74% | 100% | 45% | 100% | 100% | 100% | 71% |
| 11 | 46 | **100%** | 63% | 100% | 74% | 100% | 45% | 100% | 100% | 100% | 71% |
| 42 | 46 | **100%** | 63% | 100% | 74% | 100% | 45% | 100% | 100% | 100% | 71% |

## Full run incl. October true-ups (Jarvis)

| seed | items | fully correct | bank rec ties | trial balance | audit chain | beancount errors | runtime |
|---|---|---|---|---|---|---|---|
| 2026 | 51 | **100%** | ✅ | ✅ | ✅ 207 rows | 0 | 0.23s |
| 1 | 48 | **100%** | ✅ | ✅ | ✅ 207 rows | 0 | 0.23s |
| 2 | 49 | **100%** | ✅ | ✅ | ✅ 207 rows | 0 | 0.24s |
| 3 | 48 | **100%** | ✅ | ✅ | ✅ 207 rows | 0 | 0.27s |
| 11 | 50 | **100%** | ✅ | ✅ | ✅ 207 rows | 0 | 0.26s |
| 42 | 50 | **100%** | ✅ | ✅ | ✅ 207 rows | 0 | 0.29s |

## Misses (Jarvis)

