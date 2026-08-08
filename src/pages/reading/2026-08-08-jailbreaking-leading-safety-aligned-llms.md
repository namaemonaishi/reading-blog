---
layout: ../../layouts/ReadingLayout.astro
title: "Jailbreaking Leading Safety-Aligned LLMs with Simple Adaptive Attacks"
description: "The paper shows that leading safety-aligned LLMs remain vulnerable to surprisingly simple adaptive jailbreak attacks based on model-specific prompting, adversarial suffix optimization, self-transfer, transfer attacks, and API-specific vulnerabilities."
date: "2026-08-08"
source: "ICLR 2025 / arXiv"
sourceUrl: "https://arxiv.org/abs/2404.02151"
author: "Maksym Andriushchenko、Francesco Croce、Nicolas Flammarion"
tags: ["LLM Security", "Jailbreak", "Adaptive Attack", "Adversarial Suffix", "Random Search"]
draft: false
---

## 原文信息

- 标题：Jailbreaking Leading Safety-Aligned LLMs with Simple Adaptive Attacks
- 作者：Maksym Andriushchenko、Francesco Croce、Nicolas Flammarion
- 会议：ICLR 2025
- arXiv：2404.02151
- 研究方向：LLM Safety / Jailbreak / Adaptive Attack

### 一句话定位

> 这篇论文真正想证明的不是“Random Search 是一个很强的新攻击算法”，而是：
>
> **面对不同安全模型和不同防御机制时，只要根据目标模型实际暴露的信息和防御结构调整攻击方式，一些非常简单的攻击组件也可以达到极高的攻击成功率。**

论文的核心关键词因此不是 **Random Search**，而是：

> **Adaptivity（自适应性）**

---

# 0. 摘要核心翻译

安全对齐后的大型语言模型通常被训练为拒绝危险请求，但作者发现，即使是当时最先进的安全对齐模型，也没有对简单的**自适应 jailbreak attack** 表现出真正可靠的鲁棒性。

作者首先构造一个人工设计的 adversarial prompt template，然后在模型能够提供 token logprob 的情况下，对输入末尾的 **adversarial suffix** 运行 Random Search，使模型生成第一个目标 token（通常是 `"Sure"`）的概率不断提高。

在此基础上，作者进一步使用：

- adversarial prompt template；
- adversarial suffix；
- Random Search；
- self-transfer；
- cross-model transfer；
- in-context prompt；
- assistant response prefilling；

针对不同模型采用不同组合。

论文在包括：

- Llama-2-Chat；
- Llama-3-Instruct；
- Gemma；
- GPT-3.5；
- GPT-4 Turbo；
- GPT-4o；
- Claude；
- adversarially trained R2D2；

在内的一系列安全对齐模型上获得非常高的攻击成功率。

其中很多模型按照 GPT-4 semantic judge 的标准达到 **100% ASR**。

但更重要的发现是：

> **不存在一个攻击结构能够同样有效地攻击所有模型。**

例如：

- R2D2 对普通 suffix attack 很强，但对改变输入结构的 in-context attack 很脆弱；
- GPT-4o 对原始 template 很强，但 customized prompt + suffix optimization 可以绕过；
- Claude 不提供 logprobs，因此无法直接运行论文中的 Random Search，但其 API 的 prefilling 功能提供了另一条攻击路径。

因此论文最终强调：

> **攻击者不应该固定使用某一种攻击，而应该根据目标模型的防御和接口重新设计攻击。**

---

# 1. 方法动机

## 1.1 作者真正质疑的问题是什么？

Safety alignment 的基本目标是让模型形成如下行为：

```text
正常请求
→ 正常回答

危险请求
→ 拒绝回答
```

因此一种直观想法是：

> 如果一个安全模型已经针对 GCG、adversarial suffix、jailbreak prompt 等攻击进行训练，那么它是不是已经比较安全了？

作者认为很多已有安全评估存在一个重要问题：

> **研究者经常拿一个固定攻击去测试一个模型，然后根据攻击失败就认为模型具有鲁棒性。**

但这和 adversarial robustness 中真正严格的评估并不一样。

因为如果防御者已经针对攻击 A 进行了训练，那么：

```text
攻击 A
→ 防御成功
```

并不能推出：

```text
其他针对该防御设计的攻击
→ 也失败
```

论文因此引入 adaptive attack 的观点。

---

## 1.2 什么是 Adaptive Attack？

论文采用 adversarial robustness 文献中的定义：

> **Adaptive attack 是专门针对某一个具体 defense 设计的攻击。**

这里非常容易产生一个误解：

> Random Search = Adaptive Attack？

不是。

Random Search 本身只是一种优化算法。

真正的 adaptivity 是：

```text
观察目标模型 / defense
        ↓
判断它暴露什么信息、抵抗什么结构
        ↓
针对性修改攻击
        ↓
必要时甚至换一种攻击机制
```

例如：

```text
普通模型
↓
Prompt + Random Search

R2D2 对 suffix 结构做过 adversarial training
↓
不用原来的输入结构
↓
换成 in-context prompt

GPT-4o 对原模板表现出较强鲁棒性
↓
重新设计 GPT-4o-specific prompt

Claude 不提供 logprobs
↓
Random Search 失去优化信号
↓
使用 transfer / prefilling
```

所以这篇论文最大的设计思想可以概括为：

> **不要问“哪个 jailbreak algorithm 最强”，而要问“这个模型为什么能挡住当前攻击，以及还有什么接口或输入结构没有被防御覆盖”。**

---

## 1.3 为什么作者强调“simple”？

这篇论文实际上具有一种反直觉的研究动机。

很多 jailbreak 方法越来越复杂，例如：

- gradient-based discrete optimization；
- auxiliary LLM；
- iterative prompt refinement；
- tree search；
- multi-agent attack；
- elaborate semantic rewriting。

但作者发现：

> **复杂攻击并不是达到高 ASR 的必要条件。**

如果能够：

1. 找到合适的 prompt template；
2. 获得一个简单但连续的优化信号；
3. 针对模型特点调整输入结构；

那么甚至 Random Search 这种非常朴素的方法也可能成功。

因此论文想说明的不是：

> Random Search 比所有其他优化算法都先进。

而是：

> **安全模型的漏洞可能如此明显，以至于简单的 adaptive attack 已经足够暴露问题。**

---

# 2. 方法设计

## 2.1 总体 Pipeline

论文的方法可以抽象成：

```text
选择 target model
        ↓
分析模型暴露的攻击面
        ↓
设计 / 调整 prompt template
        ↓
加入 harmful request
        ↓
如果可以获得 logprobs：
    加入 adversarial suffix
        ↓
    Random Search 优化 suffix
        ↓
    Self-transfer 提高初始化质量

如果无法获得 logprobs：
    Cross-model transfer
    或 API-specific attack（如 prefilling）
        ↓
生成完整回答
        ↓
Semantic Judge 判断是否真正完成目标行为
```

因此论文实际上包含两个层次：

```text
外层：Adaptive Attack
    决定“对这个模型用什么攻击结构”

内层：Optimization
    决定“在给定结构下如何搜索攻击输入”
```

Random Search 属于第二层，而不是整个方法本身。

---

# 2.2 第一步：形式化 Jailbreak 问题

论文首先把攻击目标形式化为：
$$
\operatorname{find} P\in T^*
\quad
\text{subject to }
\operatorname{JUDGE}(\operatorname{LLM}(P),R)=YES
$$
其中：

- \(R\)：原始 harmful request；
- \(P\)：最终构造出来的完整 adversarial prompt；
- \(LLM(P)\)：模型对攻击 prompt 的输出；
- `JUDGE(output, R)`：判断输出是否真正满足原始 request。

所以攻击者真正寻找的是：

> **一个能够让安全模型实际执行目标行为的完整 prompt \(P\)。**

这里特别要注意：
$$
P \neq R
$$
一般而言：

```text
P =
攻击模板
+
R
+
adversarial suffix
```

而 \(R\) 只是其中的 `{goal}`。

---

## 追问：为什么目标函数里面没有 `"Sure"`？

因为：
$$
\log P(\text{"Sure"})
$$
并不是 jailbreak 的最终定义。

真正目标仍然是：
$$
JUDGE(LLM(P),R)=YES
$$
`"Sure"` 的 logprob 只是作者为了方便搜索而引入的：

> **surrogate objective / proxy signal**

也就是说：

```text
真正目标：
模型最终是否完成目标行为

非常昂贵、不容易直接优化
        ↓
使用代理目标：

第一 token 是肯定式 token 的概率
```

所以一定不能把：

> `"Sure"` 概率高

直接等价成：

> jailbreak 成功。

论文后面的 suffix length ablation 恰好证明，两者并不完全一致。

---

# 2.3 第二步：确定攻击者能够获得什么信息

不同模型暴露的接口完全不同，因此作者首先考虑：

```text
攻击者能访问什么？
```

主要包括：

- 模型输出；
- token logprobs；
- system prompt 控制；
- assistant response prefilling；
- open-weight 模型的完整参数。

这些信息决定攻击方法。

---

## 追问：这里的“输入”是不是都是攻击函数的参数？

不完全是。

论文形式化攻击时明确包含的是：

```text
target LLM
harmful request R
judge
```

而：

```text
能不能看 logprobs
能不能修改 system message
能不能 prefill assistant response
有没有模型权重
```

更准确地说是：

> **attacker capabilities / interface information**

也就是攻击者可利用的攻击面。

---

## 追问：API 为什么会提供 logprobs？

一个 LLM 每生成一个 token，本来就在计算整个 vocabulary 上的概率分布。

如果 logits 是：
$$
z_1,z_2,\ldots,z_n
$$
那么：
$$
P(t_i)=
\frac{e^{z_i}}
{\sum_j e^{z_j}}
$$
对应：
$$
\log P(t_i)
$$
就是 token \(t_i\) 的 logprob。

API 暴露 logprobs 并不是专门为了安全攻击，而可以用于很多正常用途，例如：

- classification confidence；
- ranking；
- token-level uncertainty；
- debugging；
- constrained decoding；
- scoring candidate outputs。

攻击者利用的是一个正常 API feature。

因此攻击场景并不是：

```text
攻击者入侵服务器
→ 读取内部神经网络
```

而可能仅仅是：

```text
普通 API 用户
→ 请求模型回答
→ API 同时返回部分 token logprobs
→ 把这些 logprobs 当作 optimization feedback
```

这也是这篇论文值得关注的地方：

> **攻击可能不需要模型权重，也不需要内部梯度。**

---

# 2.4 第三步：构造 Prompt Template

作者首先人工构造一个通用 prompt template。

其抽象结构为：

```text
[一组攻击规则]

[要求模型采用某种固定回答形式]

[要求避免拒绝行为]

{goal}

{adv_suffix}
```

因此：
$$
P = T + R + s
$$
其中：

- \(T\)：prompt template；
- \(R\)：harmful request / `{goal}`；
- \(s\)：adversarial suffix。

作者逐条调整 template 中的规则，并观察第一 target token 的 logprob 是否提高。

因此 template 本身实际上也是经过一种：

> **manual logprob-guided optimization**

得到的。

但它不是 gradient optimization，而是：

```text
加入/修改一条 rule
↓
观察 target logprob
↓
如果有帮助则保留
```

在 GPT-3.5 Turbo 上，仅这个 prompt template 就能够达到论文报告的 100% ASR。

但在更强的模型上，单靠 template 不够，因此才继续引入 adversarial suffix optimization。

---

# 2.5 第四步：为什么优化第一个 token 的 Logprob？

作者默认选择：

```text
"Sure"
```

作为 target token。

Random Search 优化：
$$
\log P_{\text{LLM}}
(
\text{"Sure"}
\mid
T,R,s
)
$$
即：

> 给定完整 prompt 后，模型在**第一个输出位置**生成 `"Sure"` 的 logprob。

---

## 追问：为什么一个 token 就可能提供有效信号？

LLM 是 autoregressive model。

生成：

$$
y_1, y_2, \ldots, y_n
$$

时：

$$
P(y_1, \ldots, y_n \mid x)
=
\prod_i P(y_i \mid x, y_{<i})
$$

第一个 token 一旦生成，就成为后续生成的 conditioning context。

因此可以粗略理解：

```text
Prompt
  ↓
第一个 token
  ↓
后面的 continuation
```

在 safety-aligned model 中，很多拒绝回答和接受回答具有不同的开头模式。

例如抽象来说：

```text
拒绝轨迹：
[拒绝式开头]
→ safety explanation
→ 不执行

肯定轨迹：
[肯定式开头]
→ task continuation
→ 更可能继续完成请求
```

所以作者利用：

> **第一 token 的 affirmative probability**

作为模型是否正在靠近某种 compliant generation trajectory 的代理信号。

---

## 但是 `"Sure"` 是不是一个真正的“行为开关”？

不能这么强地理解。

论文没有证明模型内部存在：

```text
一个 Sure neuron
或者
一个明确的 refusal/compliance branch
```

更加严谨的说法是：

> **实验上，第一位置的 affirmative-token logprob 与最终攻击成功具有足够强的相关性，因此可以作为有效 optimization proxy。**

而不是：
$$
P(\text{Sure})↑
\Rightarrow
\text{一定 jailbreak}
$$
论文甚至观察到：

> suffix 太长时，虽然 `"Sure"` logprob 可以很高，模型却可能跑题，因此 judge 仍然判定攻击失败。

所以：

```text
target-token logprob
       ↓
搜索信号

semantic judge
       ↓
真正成功标准
```

二者必须严格区分。

---

# 2.6 第五步：加入 Adversarial Suffix

作者在 prompt 最后加入一段短 token sequence：
$$
s=(s_1,s_2,\ldots,s_L)
$$
论文默认：
$$
L=25
$$
这就是 **adversarial suffix**。

整个输入变成：

```text
Prompt template
+
harmful request
+
adversarial suffix
```

即：
$$
x = T + R + s
$$
suffix 的 token 不一定具有自然语言意义。

它的目的不是：

> 向人类表达一种语义。

而是：

> **通过改变模型输入 token，使模型生成分布向攻击者希望的方向移动。**

---

## 追问：为什么它叫 adversarial suffix？是不是和 adversarial attack 有关系？

是。

它可以类比计算机视觉中的 adversarial perturbation：

```text
图像攻击：

原始图片
+
人为设计的小扰动 δ
→
模型预测发生变化
```

而这里变成：

```text
原始 prompt
+
人为搜索的 token sequence s
→
模型生成行为发生变化
```

最大的区别是：

```text
图像：
连续数值空间中的 perturbation

LLM suffix：
离散 token 空间中的 perturbation
```

因此 adversarial suffix 本身就是一种：

> **discrete adversarial perturbation**

---

## 追问：自动化 jailbreak 是不是本质上就是 adversarial suffix？

不能完全这样等价。

Adversarial suffix 是自动攻击的一种非常重要技术，但：
$$
\text{Automated Jailbreak}
\neq
\text{Adversarial Suffix}
$$
自动攻击还可能使用：

- automatic prompt rewriting；
- gradient-based token search；
- auxiliary attacker LLM；
- tree search；
- evolutionary search；
- multi-turn attack；
- transfer attack。

这篇论文只是选择：

```text
固定 prompt structure
+
自动搜索 suffix
```

作为核心自动优化方式。

---

# 2.7 为什么使用 Adversarial Suffix，而不是其他技术？

这里需要把**论文明确说明的原因**和**合理的设计解释**分开。

论文明确说明：

> 作者对 suffix 而不是 prefix 的偏好，以及优化 `"Sure"` 的策略，主要受到 Zou et al. 的 GCG 工作启发。

因此论文实际上**没有做系统实验来证明**：
$$
suffix > prefix
$$
也没有证明：

> token 越靠近输出位置影响一定越强。

所以不能把“suffix 离输出最近，因此一定最好”当作论文结论。

但从方法设计角度，可以理解为什么 suffix 很适合这个实验。

固定：
$$
T,R
$$
只优化：
$$
s
$$
以后，问题就变成了一个非常干净的离散优化问题：

```text
固定语义任务
+
固定攻击规则
+
一个长度有限的可优化 token 区域
```

这样作者不需要每一步都重新生成整段自然语言 prompt。

---

## 与 GCG 的关系

GCG 同样会搜索 adversarial suffix。

但是 GCG 大体依赖：

```text
模型梯度
↓
估计哪些 token substitution 最可能降低 loss
↓
搜索候选 token
```

因此通常需要较强的 white-box access。

而本文：

```text
不计算 gradient

只需要：

candidate suffix
→ model
→ target-token logprob
```

所以：

> **suffix 的攻击思想不是本文原创；本文的重要变化是证明非常简单的 Random Search + logprob feedback 也可以优化 suffix。**

---

# 2.8 第六步：Random Search 优化 Suffix

论文的 Random Search 可以抽象为：

```text
初始化 suffix s
↓
计算当前 target-token logprob

重复：

    随机选择 suffix 中的一段位置
            ↓
    随机换成新的 token
            ↓
    查询模型：
    target token 的 logprob 是否提高？
            ↓
       ┌───────┴────────┐
       │                │
      Yes              No
       │                │
    保留修改          丢弃修改
       │
       ↓
继续搜索
```

形式化地：

当前 suffix：
$$
s^*
$$
当前 score：
$$
p^*
=
\log P(t|x,s^*)
$$
随机得到 candidate：
$$
s_i
$$
然后计算：
$$
p_i=
\log P(t|x,s_i)
$$
如果：
$$
p_i>p^*
$$
则：
$$
s^*\leftarrow s_i
$$
否则保持原 suffix。

所以它本质上就是：

> **hill-climbing style random search**

只是 candidate proposal 是随机 token substitution。

---

## 为什么作者选择 Random Search？

论文给出两个主要理由。

第一：

> **简单，而且不需要 gradient。**

只需要：
$$
\text{logprob}
$$
因此可以攻击某些只能通过 API 访问的模型。

第二：

> 作者此前在计算机视觉 adversarial attack 中观察到 Random Search 也可以非常有效。

所以他们想测试：

> 一个非常朴素的 black/gray-box optimization method 是否已经足够攻击 LLM。

结果表明，在很多模型上确实如此。

---

## Random Search 和 GCG 到底有什么区别？

最关键区别不是：

```text
一个搜索 token
另一个也搜索 token
```

因为两者最终都可能修改离散 token。

真正区别是 candidate 选择机制：

```text
GCG：

gradient
  ↓
判断哪些 token substitution 值得尝试
  ↓
搜索候选


本文 Random Search：

random token substitution
  ↓
直接查询 logprob
  ↓
如果 score 更好就保留
```

所以：

| 方法 | 优化空间 | 是否使用梯度 | 模型访问 |
|---|---|---:|---|
| GCG | discrete token | 是 | 通常 white-box |
| 本文 RS | discrete token | 否 | logprob API 即可 |
| latent PGD 类方法 | continuous hidden / embedding | 是 | white-box |

这也是它和前面讨论过的 LOCKET 类 latent adversarial training 在方法论上的根本区别：

```text
latent PGD：
在连续 representation space 中直接沿 gradient 更新 δ

GCG：
使用 gradient 指导离散 token candidate

本文：
完全不用 gradient，在离散 token 空间做 Random Search
```

这部分是为了帮助理解方法关系，并不是本文对 LOCKET 的实验比较。

---

# 2.9 第七步：为什么默认使用 25 Token Suffix？

作者测试了不同 suffix length。

在 Gemma-7B 上比较：

```text
5
15
25
40
60 tokens
```

结果发现：

> 25 tokens 在该实验设置中表现最好。

这不是因为 25 有某种理论特殊性，而是一个 empirical choice。

---

## 为什么 suffix 不是越长越好？

直觉上可能认为：
$$
\text{更多 token}
\Rightarrow
\text{更多 optimization variables}
\Rightarrow
\text{攻击更强}
$$
但实际不是。

作者发现两个问题。

### 优化困难

维度增加之后：

```text
搜索空间迅速增大
↓
Random Search 更难找到好的组合
```

因此更长 suffix 反而可能得到更差的 target logprob。

### 容易跑题

更加重要的是：

```text
Random Search
↓
成功让第一 token 变成目标 token
↓
但是后续 generation 被长 suffix 干扰
↓
模型回答了另外一个东西
```

于是出现：
$$
\text{target logprob 很高}
$$
但：
$$
JUDGE=NO
$$
这再次说明：

> `"Sure"` logprob 只是 surrogate，而不是最终攻击目标。

---

# 2.10 第八步：Self-Transfer 到更困难的 Request

这是论文中提升攻击效率非常关键的一步。

首先需要明确：

> **这里所谓的 request，就是 prompt template 中的 `{goal}`。**

整个结构是：

```text
T
+
R
+
s
```

例如：

```text
固定：
Prompt template T

变化：
harmful request R

优化：
suffix s
```

---

## 什么叫“容易的 Request”？

这里的 easy / hard 不是人类语义上的：

```text
危害较小
危害较大
```

作者使用的是一个操作性定义：

> **初始状态下 target token logprob 较大的 request 更容易攻击。**

假设两个 request：
$$
R_A,R_B
$$
固定：
$$
T,s_0
$$
如果：
$$
\log P
(
\text{"Sure"}
|
T,R_A,s_0
)
>
\log P
(
\text{"Sure"}
|
T,R_B,s_0
)
$$
那么 \(R_A\) 就被认为比 \(R_B\) 更容易。

---

## Self-Transfer 的具体流程

首先在：
$$
R_{\text{easy}}
$$
上优化：
$$
T+R_{\text{easy}}+s_0
$$
经过 Random Search 得到：
$$
s_{\text{easy}}^*
$$
然后处理：
$$
R_{\text{hard}}
$$
普通 Random Search 原本是：
$$
T+R_{\text{hard}}+s_0
$$
而 self-transfer 改成：
$$
T+R_{\text{hard}}+s_{\text{easy}}^*
$$
然后继续优化：
$$
s_{\text{easy}}^*
\rightarrow
s_{\text{hard}}^*
$$
所以它可以写成：

```text
Request A
↓
Random Search
↓
得到 suffix_A

       ↓ transfer

Request B + suffix_A
↓
继续 Random Search
↓
suffix_B
```

---

## 所以 Self-Transfer 的核心是不是 suffix 的可迁移性？

**是。**

更加准确地说，是两种迁移能力。

### 直接迁移

某个 request 上优化的 suffix：
$$
s_A^*
$$
拿到另一个 request：
$$
R_B
$$
上可能直接有效。

### 初始化迁移

即使：
$$
s_A^*
$$
不能直接攻击 \(R_B\)，它仍然可能比原始初始化：
$$
s_0
$$
更接近好的搜索区域。

所以：
$$
s_A^*
\rightarrow
\text{initialization for optimizing }R_B
$$
往往能够显著减少查询次数。

Figure 2 显示 self-transfer：

- target logprob 上升更快；
- ASR 更快提高；
- Llama-2 和 Gemma 上效果尤其明显。

---

## 为什么不同 Request 上的 Suffix 可以迁移？

论文证明的是一个**经验现象**：

> 同一模型、某一 request 上优化得到的 suffix，经常能够直接迁移到另一 request，或者成为好的 initialization。

但是论文**没有证明其内部机制**。

一种合理解释是：

```text
Request A ─┐
Request B ─┼→ 同一个 safety-aligned model
Request C ─┘
```

它们虽然语义不同，但都受到同一套模型安全行为影响。

于是不同 request 的 optimization landscape 可能包含某些共享结构。

所以：
$$
s_A^*
$$
在 \(R_A\) 上找到的有利区域，也可能在 \(R_B\) 上仍然比较有利。

但必须注意：

> “共享 refusal direction”只是机制层面的合理假设，并不是论文证明的结论。

论文明确指出，其 suffix 仍然是：

> **model-specific + request-specific**

所以论文没有发现一个：
$$
s_{\text{universal}}
$$
能够对所有 request 通用。

Self-transfer 更准确理解为：

> **弱可迁移性 + 好初始化**

而不是 universal jailbreak。

---

# 2.11 第九步：Cross-Model Transfer Attack

Self-transfer 和 transfer attack 很容易混淆。

### Self-transfer

```text
同一个模型

Request A
↓
suffix_A
↓
Request B
```

即：
$$
M \text{ fixed}
$$
变化的是：
$$
R_A\rightarrow R_B
$$
---

### Transfer Attack

```text
Model A
↓
得到攻击 prompt / suffix
↓
Model B
```

变化的是：
$$
M_A\rightarrow M_B
$$
作者发现，一些在 GPT-4 上找到的攻击可以直接迁移到 Claude。

这点特别重要，因为：

> Claude 当时不向 API 用户提供 logprobs。

于是：

```text
Claude
↓
无法直接计算目标 token score
↓
无法运行本文 Random Search
```

但是：

```text
GPT-4
↓
可以优化 suffix
↓
把结果迁移到 Claude
```

就提供了另一条攻击路径。

---

# 2.12 第十步：Prefilling Attack

Claude API 当时允许调用者：

> **提前提供 assistant response 的开头，然后让模型从这个开头继续生成。**

正常生成：

```text
User message
    ↓
Model 自己决定 assistant 的第一个 token
    ↓
继续生成
```

Prefilling：

```text
User message
+
Assistant prefix
    ↓
Model 被要求从已经存在的 assistant prefix 后继续生成
```

这意味着：

> Random Search 原本花大量查询试图提高“第一 token 是 affirmative token”的概率，而 prefilling 可以绕过这个优化问题，直接规定 assistant response 已经从目标方向开始。

所以从 optimization 的角度看：

```text
Random Search：

寻找 s
使得
P(target first token | prompt+s) ↑


Prefilling：

直接给定 response prefix
↓
不需要再优化第一个 token
```

这就是为什么作者称其为：

> **optimization-free attack**

---

## Prefilling 为什么体现 Adaptivity？

因为它并不是：

> 我发明了一个对所有 LLM 都有效的新算法。

而是：

```text
观察 Claude API
↓
发现它允许一个特殊 interaction primitive
↓
利用这个模型特有的接口攻击面
```

所以它完美体现论文的核心观点：

> **攻击应该针对具体系统，而不是机械复用固定 benchmark attack。**

---

# 2.13 第十一步：模型不同，攻击方式也必须变化

这是整篇论文最核心的实验逻辑。

---

## Llama-2：Prompt 不够，Suffix Optimization 很重要

Llama-2-Chat-7B：

| 方法 | ASR |
|---|---:|
| Prompt | 0% |
| Prompt + Random Search | 50% |
| Prompt + Random Search + Self-Transfer | **100%** |

这里说明：

```text
人工 prompt
↓
不足以绕过 safety alignment

加入自动 suffix optimization
↓
明显提高

再利用 suffix transferability
↓
达到 100%
```

所以 self-transfer 不只是优化速度技巧，也直接提高最终 ASR。

---

## Gemma-7B

| 方法 | ASR |
|---|---:|
| Prompt | 20% |
| Prompt + Random Search | 84% |
| + Self-Transfer | **100%** |

表现出类似规律。

---

# 2.14 R2D2：为什么普通攻击突然失效？

R2D2 是非常重要的实验，因为它体现：

> **真正的 adaptive attack 不是把同一个 optimizer 跑得更久。**

R2D2 做过 adversarial training，训练过程中包含了与：

```text
harmful request
+
adversarial suffix
```

类似的攻击结构。

因此：

| 方法 | ASR |
|---|---:|
| Prompt | 8% |
| Prompt + RS + Self-transfer | 12% |

也就是说：

> 原来的 suffix attack 结构基本被防住了。

---

## 作者怎么解决？

他们没有继续说：

```text
那我把 Random Search 从 10k 跑到 100k
```

而是：

> **直接改变 prompt structure。**

他们构造一个：

> in-context learning prompt

让模型观察一种示范行为并模仿这种输入—输出模式。

结果：

| 方法 | ASR |
|---|---:|
| In-context Prompt | 90% |
| In-context Prompt + RS | **100%** |

这个结果是整篇论文理解 adaptivity 最好的例子：

```text
Defense：
专门学习抵抗 request + suffix

攻击者：
不继续和这个结构硬碰硬

而是：
改变攻击 representation / prompt structure
```

所以：

> **一个 defense 对某个 attack distribution 很强，不等于对经过适应性调整后的攻击仍然强。**

---

# 2.15 GPT-4o：为什么还要重新设计 Prompt？

原始 prompt 在 GPT-4o 上：
$$
ASR=0\%
$$
而且直接在其上运行 Random Search 也没有很好解决问题。

于是作者利用 logprob feedback：

```text
修改 prompt
↓
观察 target token logprob
↓
继续人工调整
```

得到 GPT-4o-specific custom prompt。

结果：

| 方法 | ASR |
|---|---:|
| 原 Prompt | 0% |
| Custom Prompt | 72% |
| Custom Prompt + RS + Self-transfer | **100%** |

这说明攻击效果不仅取决于：
$$
\text{optimizer}
$$
还强烈取决于：
$$
\text{optimization parameterization}
$$
也就是：

> **你到底让 optimizer 在什么 prompt structure 上工作。**

如果输入结构本身处于模型非常稳固的拒绝区域，单纯优化 suffix 可能没有用。

---

# 2.16 Claude：为什么不能直接复制 GPT 的方法？

Claude 不提供论文 Random Search 所需要的 target-token logprob。

于是：
$$
\log P(t|x,s)
$$
不可观察。

那么算法无法判断：

```text
candidate suffix A
```

和：

```text
candidate suffix B
```

哪个更好。

所以：

> Random Search 并不是一个纯粹只看最终文本的 black-box attack。

更准确地说，它属于：

> **需要 logprob feedback 的 gray-box / API-feedback attack。**

对 Claude，作者因此改用：

```text
GPT attack transfer

或者

assistant prefilling
```

最终 prefilling 在论文的 GPT-4 judge 标准下，对多种 Claude 模型达到很高 ASR。

这再次表明：

> **API design 本身也是 LLM security attack surface。**

---

# 3. 实验结果

## 3.1 主要模型结果

论文在 AdvBench 中经过筛选的 50 个 harmful requests 上测试攻击。

攻击成功标准非常严格：

> GPT-4 semantic judge 给出 10/10 jailbreak score 才算成功。

主要结果包括：

| 模型 | Adaptive Attack | ASR |
|---|---|---:|
| Llama-2-Chat-7B | Prompt + RS + Self-transfer | 100% |
| Llama-2-Chat-13B | Prompt + RS + Self-transfer | 100% |
| Llama-2-Chat-70B | Prompt + RS + Self-transfer | 100% |
| Llama-3-Instruct-8B | Prompt + RS | 100% |
| Gemma-7B | Prompt + RS + Self-transfer | 100% |
| R2D2 | In-context Prompt + RS | 100% |
| GPT-3.5 Turbo | Prompt | 100% |
| GPT-4 Turbo | Prompt + RS + Self-transfer | 96% |
| GPT-4o | Custom Prompt + RS + Self-transfer | 100% |
| 多个 Claude 模型 | Prompt + Prefilling | 100%* |

Claude 2.1 的结果需要特别谨慎，因为作者人工检查发现 GPT-4 judge 在该模型上存在明显 false positive。

---

# 3.2 Self-Transfer 的消融

最明显的例子：

### Llama-2-7B

```text
Prompt
0%

↓ Random Search

50%

↓ Self-transfer

100%
```

### Gemma-7B

```text
Prompt
20%

↓ Random Search

84%

↓ Self-transfer

100%
```

Figure 2 同时显示：

```text
好的 suffix initialization
↓
target logprob 上升更快
↓
攻击更快成功
↓
查询数量下降
```

所以 Self-transfer 同时改善：

- query efficiency；
- convergence；
- final ASR。

---

# 3.3 Random Search 的计算成本

Random Search 每一次 iteration 最昂贵的操作就是：

> target model forward pass。

作者报告：

> Llama-3-8B 上，单 A100、无 prefix caching 的情况下，4000 iterations 大约需要 20.9 分钟。

但有 self-transfer 后：

> 大多数 request 少于约 200 iterations 就可以解决。

只有不到 10% 的行为需要达到约 4000 iterations。

因此整个实验通常在数小时尺度。

这也说明 self-transfer 的作用不只是 ASR：

> **它实际上把“每个 request 都从零开始搜”的成本显著降低。**

---

# 4. 与其他攻击方法的关系

| 方法 | 攻击空间 | Feedback | 是否需要梯度 | 核心思想 |
|---|---|---|---:|---|
| Manual Jailbreak | natural-language prompt | 人工观察 | 否 | 手工设计攻击 prompt |
| GCG | discrete suffix tokens | loss + gradient | 是 | gradient-guided token search |
| 本文 Random Search | discrete suffix tokens | target-token logprob | 否 | random proposal + score acceptance |
| PAIR 类 | natural-language prompt | judge / attacker LLM | 否 | LLM 自动迭代改写 |
| Prefilling | assistant response prefix | 无需 iterative optimization | 否 | 利用 generation interface |
| Latent PGD 类方法 | continuous representation | gradient | 是 | optimization in hidden space |

这张表解释了一个重要问题：

> **本文并不是发现了 adversarial suffix，而是把 suffix attack 从“需要复杂 gradient optimization”的方向，推向了“仅利用 API logprob 也可以做”的方向。**

---

# 5. Trojan Detection：Random Search 的第二个应用

论文还将类似思想用于 poisoned model 中的 universal trigger detection。

这里的问题变成：

```text
模型被训练数据植入了某个隐藏 trigger
↓
某个短 token sequence 出现
↓
模型行为发生异常
```

作者观察：

> poison training 中 trigger token 会反复出现，因此其 embedding 可能比正常 token 发生更异常的变化。

于是先比较多个模型的 embedding：
$$
\|v_i^{(r)}-v_i^{(s)}\|_2
$$
找出变化异常大的 token，形成 candidate pool。

然后：

```text
所有 vocabulary
↓
embedding difference 筛选
↓
少量可疑 token
↓
Random Search trigger
```

这里和 jailbreak 的区别非常有意思。

在 jailbreak 中：

> 限制 vocabulary search space 反而使结果变差。

但在 trojan detection 中：

> 利用先验知识限制 token space 非常关键。

这又一次体现作者所谓：

> **adaptivity**

即：

```text
不同问题
↓
利用不同 problem-specific information
↓
改变搜索空间和攻击方法
```

而不是坚持一个统一 algorithm。

---

# 6. 论文最重要的 Ablation 和设计观察

## 6.1 Target Token

默认：

```text
Sure
```

作者还尝试：

```text
exactly
certainly
```

没有观察到改进。

因此 `"Sure"` 并不是理论唯一最优 token，而是经验上好用的 target token。

---

## 6.2 Suffix Length

测试：

```text
5
15
25
40
60
```

25 tokens 表现较好。

过短：

```text
optimization capacity 不足
```

过长：

```text
search space 太大
+
容易使 generation 偏离原任务
```

---

## 6.3 Vocabulary Restriction

对于 jailbreak：

> 从整个 vocabulary 随机采样效果反而比较好。

作者尝试只允许包含 Latin characters 的 token，没有提高性能。

而 Trojan Detection 恰恰相反，需要强 candidate filtering。

这再次说明：

> **优化技巧不能脱离具体攻击场景讨论。**

---

# 7. 论文真正贡献了什么？

如果只把论文总结成：

> “作者用 Random Search 搜索 adversarial suffix。”

其实严重低估了论文。

更准确地说有四个层次。

---

## 贡献一：证明非常简单的 Logprob-guided Search 已经足够危险

作者说明：
$$
\text{gradient access}
$$
不是高成功率 suffix attack 的必要条件。

只要能够获得：
$$
\text{target-token logprob}
$$
一个非常简单的 Random Search 就可能工作。

---

## 贡献二：提出并系统使用 Self-Transfer

在同一模型内部：
$$
R_A
\rightarrow
s_A^*
\rightarrow
R_B
$$
利用 suffix 的跨 request 可迁移性改善 initialization。

核心并不是 universal suffix，而是：

> **previous optimization result contains reusable information about the same model.**

---

## 贡献三：展示真正的 Adaptive Evaluation

R2D2 是最强的证据。

如果只测：

```text
GCG-like suffix attack
```

可能得到：

> R2D2 很 robust。

但：

```text
分析其 training defense
↓
改变 prompt structure
↓
In-context attack
```

鲁棒性迅速下降。

因此：

> **一个 defense 的安全性不能只由它针对的攻击族进行评估。**

---

## 贡献四：把 API Interface 当成 Attack Surface

Claude prefilling 是非常典型的例子。

传统模型安全容易只考虑：

```text
model weights
training data
prompt
```

但真实部署系统还存在：

```text
API semantics
chat template
role structure
prefilling
logprob exposure
system prompt controls
```

这些都可能改变安全边界。

---

# 8. 论文的主要局限

## 8.1 `"Sure"` Logprob 只是 Proxy

最明显问题：
$$
P(\text{"Sure"})↑
$$
不等于：
$$
ASR↑
$$
特别是在 suffix 很长时可能出现：

```text
Sure
↓
但是后续内容跑题
↓
Judge = failure
```

因此它是一种效果很好的 heuristic objective，而不是对真正攻击目标的严格优化。

---

## 8.2 不是 Universal Attack

论文中的 adversarial suffix：

> **model-specific + request-specific**

所以论文证明的是：

> 对每一个 request 针对性优化，可以找到攻击。

而不是：

> 找一个 suffix，然后零查询攻击所有 request。

100% ASR 不能被理解成：

```text
存在一个 universal string
→ 对所有模型、所有请求 100% 攻击成功
```

这是完全不同的结论。

---

## 8.3 Judge 存在误判

主要判断器是 GPT-4 semantic judge。

作者还进行了人工检查，并明确指出：

> Claude 2.1 存在相当明显的 false positive。

因此：
$$
100\%\ Judge\ ASR
$$
不应直接等同于：

> 100% 的回答都真正具有完全一致的人类意义上的危害性。

---

## 8.4 跨论文 Baseline 并不完全公平

论文 Table 1 中引用的一些 previous results：

- judge 不同；
- benchmark 设置可能不同；
- stopping condition 不同。

因此不能只根据 Table 1 就宣布：

> 本文算法全面优于所有 previous methods。

论文后面也进行了更加统一设置的 JailbreakBench 对比。

在那里本文方法仍然很强，但并不是所有模型都是 100%。

---

## 8.5 需要大量 Query

虽然 Random Search 非常简单，但：

```text
每次 candidate
↓
至少需要 target model forward
```

对于 closed API 来说意味着：

- monetary cost；
- rate limit；
- latency；
- detection risk。

Self-transfer 缓解，但没有消除这个问题。

---

## 8.6 对某些 Test-Time Defense 并不能直接工作

作者明确测试：

> 静态 Prompt + Random Search 并不能直接突破 SmoothLLM。

这点非常重要。

因此论文的结论不是：

> “本文攻击能够突破所有 defense。”

而是：

> **现有部署模型经常不能抵抗简单 adaptive attacks，而对于新的 defense，需要重新设计新的 adaptive attack。**

这与论文自己的核心观点是一致的。

---

# 9. 论文最值得记住的机制性洞见

## 洞见一：Attack Objective 和 True Objective 可以分离

真正目标：
$$
JUDGE(LLM(P),R)=YES
$$
搜索目标：
$$
\max_s
\log P(\text{"Sure"}|T,R,s)
$$
这是一种非常经典的 security / optimization 思想：

```text
真正目标难优化
↓
寻找一个相关而可观测的 surrogate
↓
优化 surrogate
↓
最后用真正目标验证
```

这也是为什么 logprob 很重要。

---

## 洞见二：攻击强弱取决于 Search Space 如何 Parameterize

R2D2 展示得最明显。

即便 optimizer 没变：

```text
Random Search
```

只要：

```text
request + suffix
```

换成：

```text
in-context structure + suffix
```

攻击效果就可能完全不同。

所以在 adversarial ML 中：

> **选择优化算法只是问题的一半，决定在哪个输入空间中优化同样重要。**

---

## 洞见三：同一模型不同 Request 的优化景观并非完全独立

Self-transfer 表明：
$$
s_A^*
$$
包含了一些能够被：
$$
R_B
$$
复用的信息。

虽然论文没有定位这种共享结构到底存在于模型 representation 的哪个方向，但实验已经说明：

> **不同 harmful request 的攻击 optimization landscape 存在非零共享性。**

这为后续研究留下了一个比“做一个更强 Random Search”更有意思的问题：

> 为什么这种 transferability 会存在？

例如可以继续研究：

- transferable suffix 在 representation space 中是否导致相似 activation shift；
- refusal/compliance 是否存在共享 feature；
- suffix transferability 与语义距离有什么关系；
- 不同 alignment 方法是否产生不同 transfer geometry。

这些属于论文没有回答的机制问题。

---

## 洞见四：Defense 很容易过拟合到已知 Attack Distribution

R2D2 本质上暴露：

```text
训练：
防 request + suffix attack

测试：
request + suffix attack
→ 很 robust

换 distribution：
in-context prompt
→ robustness 大幅下降
```

这与 adversarial robustness 里的经典问题高度相似：

> **robust against attack A ≠ robust in general**

因此 safety benchmark 如果只运行固定攻击集合，很容易高估安全性。

---

## 洞见五：真实 LLM Security 不只是“模型安全”

Claude prefilling 和 GPT logprobs 都说明：

```text
LLM Security
≠
只研究模型 weights
```

真实系统实际上是：

```text
Model
+
chat template
+
API
+
system prompt
+
role semantics
+
generation configuration
+
guardrails
```

任何一层接口设计都可能成为攻击面。

这对于 Agent Security 更重要，因为 Agent 系统还会继续增加：

```text
tools
memory
permissions
environment
workflow
inter-agent communication
```

攻击面只会更多。

---

# 10. 与前面讨论内容的最终统一理解

可以把整篇论文压缩成下面这一张逻辑图：

```text
                    真正目标
                       ↓
          JUDGE(LLM(P), R) = YES
                       │
                       │ 太难直接优化
                       ↓
              选择 surrogate signal
                       ↓
          first-token target logprob
                       ↓
             ┌─────────┴──────────┐
             │                    │
        Prompt Template      Adversarial Suffix
                                  │
                                  ↓
                            Random Search
                                  │
                         ┌────────┴────────┐
                         │                 │
                    默认初始化        Self-transfer
                                           │
                                 利用 suffix 可迁移性
                                           │
                                           ↓
                                     更快找到攻击

但是：

目标模型不同
      ↓
以上结构未必工作
      ↓
Adaptive Attack

R2D2
→ 改 Prompt Structure

GPT-4o
→ Custom Prompt

Claude
→ Transfer / Prefilling

Trojan Detection
→ Restrict Search Space
```

所以最终应该把这篇论文理解成：

> **Adversarial suffix 是主要的优化载体，Random Search 是优化 suffix 的工具，logprob 是搜索反馈，self-transfer 利用 suffix 的可迁移性提高初始化质量，而 adaptive attack 才是把这些组件针对不同模型重新组合起来的上层方法论。**

四者不能混为一谈：

```text
Adversarial suffix
= 优化对象

Random Search
= 优化算法

Logprob
= 优化信号

Self-transfer
= 初始化 / 迁移策略

Adaptive Attack
= 根据目标 defense 选择并修改整个攻击方案
```

---

# 11. 对这篇论文的评价

这篇论文的方法本身并不复杂，甚至作者刻意强调 simple。

如果只从 algorithm novelty 来看：

- Random Search 不是新算法；
- adversarial suffix 不是新概念；
- target-token optimization 受到 GCG 等工作的启发；
- prompt engineering 本身也不是新技术。

但论文真正有价值的地方在于：

> **通过一系列非常具体的模型案例证明，LLM safety evaluation 中“是否进行了真正 adaptive 的攻击”可能比“攻击算法本身有多复杂”更加重要。**

尤其值得记住三个实验：

```text
Llama/Gemma：
Self-transfer 极大提高 suffix search

R2D2：
换攻击结构比强化原攻击更重要

Claude：
API feature 本身产生新的攻击面
```

因此，这篇论文更接近一篇：

> **关于“如何正确进行 LLM adversarial evaluation”的论文**

而不只是一篇：

> **关于 Random Search jailbreak 的论文。**

---

# 12. 读完后值得继续追的问题

这篇论文已经证明：
$$
\text{suffix transferability exists}
$$
但没有真正解释：
$$
\text{why}
$$
因此比继续做“Random Search + 一个新 heuristic”更值得深入的问题可能是：

```text
为什么不同 harmful requests
会共享 adversarial suffix structure？

          ↓

这些 suffix 在 hidden representation 中
究竟改变了什么？

          ↓

它们是在：

削弱 refusal representation？

增强 instruction-following feature？

改变 role / task interpretation？

还是只是利用 token-level statistical shortcut？

          ↓

不同 alignment 方法产生的
shared vulnerability 是否相同？
```

也就是说：

> **这篇论文非常擅长证明“漏洞存在”，但没有真正解释“漏洞为什么存在于模型内部”。**

如果从机制研究或者更深入的 LLM Security 研究角度继续往下做，这可能是比单纯提高 ASR 更有研究价值的问题。
