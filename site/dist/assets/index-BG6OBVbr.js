(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))i(e);new MutationObserver(e=>{for(const r of e)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function o(e){const r={};return e.integrity&&(r.integrity=e.integrity),e.referrerPolicy&&(r.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?r.credentials="include":e.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(e){if(e.ep)return;e.ep=!0;const r=o(e);fetch(e.href,r)}})();const u=[{name:"Debit",category:"fundamentals",definition:"Left side of a journal entry. Increases assets and expenses, decreases liabilities and equity.",example:"Buying equipment: <strong>Debit</strong> Equipment $10,000 (asset goes up)"},{name:"Credit",category:"fundamentals",definition:"Right side of a journal entry. Decreases assets and expenses, increases liabilities and equity.",example:"Buying equipment: <strong>Credit</strong> Cash $10,000 (asset goes down)"},{name:"Net Amount",category:"fundamentals",definition:"The difference between total debits and credits on a transaction or in an account.",example:"Bank line $3,912.44 splits into 4 debits, net to one credit"},{name:"ERP",category:"systems",definition:"Enterprise Resource Planning system. The software that runs accounting, inventory, HR, etc.",example:"Afterglow Labs uses QuickBooks (QBO) as their ERP"},{name:"General Ledger",category:"systems",definition:"The master record of all accounts and transactions. The source of truth for financial statements.",example:"Account 1010 Cash — Chase Operating shows $47,332 balance in the GL"},{name:"Chart of Accounts",category:"systems",definition:"The numbered list of all accounts (assets, liabilities, equity, revenue, expenses).",example:"1010 Cash, 1250 Employee Receivable, 6410 Software, 6810 Bank Fees"},{name:"Journal Entry",category:"fundamentals",definition:"A transaction posted to the ledger with debits and credits that must balance.",example:"JE-0918: 4 debits totaling $3,912.44 = 1 credit $3,912.44"},{name:"Subledger",category:"systems",definition:"Detailed records (invoices, bills, payments) that roll up to the General Ledger.",example:"AP subledger: 12 vendor bills total $45,200 → GL account 2010"},{name:"Accounts Payable",category:"accounts",definition:"Money the company owes to vendors for goods/services received but not yet paid.",example:"Lumen Crew invoices $13,020 on Oct 8 → AP liability until paid"},{name:"Accounts Receivable",category:"accounts",definition:"Money customers owe the company for goods/services delivered but not yet paid.",example:"Interest earned Sep 30, deposited Oct 1 → Other Receivable at 9/30"},{name:"Reconcile",category:"processes",definition:"Proving two sources agree by explaining every difference. Usually bank vs ledger.",example:"Chase says $47,332, ledger says $47,332 → reconciled to $0.00"},{name:"Bank Feed",category:"systems",definition:"Automated import of bank transactions into accounting software with suggested categories.",example:'QBO bank feed suggests "PAYPAL" → Software Expense (wrong)'},{name:"Accrual",category:"timing",definition:"Recording revenue/expense when earned/incurred, not when cash moves.",example:"Crew works in Sep, invoices Oct → accrue $12,350 expense in Sep"},{name:"Reversal",category:"timing",definition:"Undoing last month's accrual entry when the actual transaction arrives.",example:"Oct 1: reverse Sep 30 interest accrual, record actual deposit"},{name:"Prepaid",category:"accounts",definition:"Cash paid now for a benefit in a future period. An asset that becomes expense later.",example:"Sep: pay $3,451.50 for Nov show → Prepaid asset, expense in Nov"},{name:"Other Receivable",category:"accounts",definition:"Amounts owed to the company that aren't customer invoices (interest, employee payback, etc).",example:"Employee buys Steam game $113.44 on corp card → Other Receivable"},{name:"Timing Difference",category:"timing",definition:"When a transaction appears in one system before another (bank vs ledger, invoice vs payment).",example:"Interest earned Sep 30, deposited Oct 1 → timing difference"},{name:"FX",category:"transactions",definition:"Foreign exchange. Converting one currency to another, often with fees.",example:"PayPal converts €2,950 at 1.2200 vs market 1.1700 → $147.50 FX fee"},{name:"Vendor Master",category:"systems",definition:"The canonical list of vendors with legal names, TINs, payment details, and aliases.",example:"Anthropic PBC (TIN 12-3456789) · aliases: Claude, claude.ai"},{name:"Duplicate Vendor",category:"data-quality",definition:"Same real-world entity entered multiple times (different names, typos, product vs legal name).",example:"Anthropic / Claude / ANTHROPIC PBC  → merge to one canonical vendor"},{name:"Period Close",category:"processes",definition:"Finalizing a month's books: reconciliations, accruals, adjustments, then lock the period.",example:"Close September: all entries in, bank rec ties, accruals booked, period locked"},{name:"Materiality",category:"judgments",definition:"The size threshold where a difference matters. Small errors that don't change decisions.",example:"$25 bank fee might be immaterial, but personal purchase is a control issue"},{name:"Internal Controls",category:"governance",definition:"Policies and procedures to prevent errors and fraud (approvals, reconciliations, segregation).",example:"Requester cannot approve their own journal entry (segregation of duties)"},{name:"Segregation of Duties",category:"governance",definition:"Different people prepare and approve to prevent one person from hiding mistakes or fraud.",example:"Agent proposes, Controller approves, Gateway posts → 3 separate roles"},{name:"Audit Trail",category:"governance",definition:"A complete record of who did what, when, why, with evidence. Months later, you can prove it.",example:"Hash-chained log: every transition recorded with actor, reason, evidence, prev hash"},{name:"System of Record",category:"systems",definition:"The source treated as truth for a specific fact (bank for cash, ledger for balances, etc).",example:"Bank is system of record for cash movement; contracts for service period"},{name:"Controller",category:"roles",definition:"Senior accountant who oversees close, reviews entries, and makes judgment calls.",example:"Maya Chen (Controller) approves accruals, rejects self-approvals, answers questions"},{name:"Trial Balance",category:"reports",definition:"A report showing every account's balance. Must sum to zero (debits = credits).",example:"Trial balance Sep 30: total debits $1.2M = total credits $1.2M"},{name:"Financial Package",category:"reports",definition:"The monthly close deliverable: Balance Sheet, Income Statement, Cash Flow, plus notes.",example:"Sep package: BS/IS/CF in Excel with month-over-month columns and flux comments"}];document.addEventListener("DOMContentLoaded",()=>{k(),C(),A(),I(),B(),E(),S()});function k(){gsap.registerPlugin(ScrollTrigger),gsap.to("#bankLine",{opacity:1,y:0,duration:.8,scrollTrigger:{trigger:"#bankLine",start:"top 80%"}}),gsap.to("#naiveRule",{opacity:1,duration:.6,delay:.5,scrollTrigger:{trigger:"#bankLine",start:"top 70%"}}),gsap.to(".split-visual",{opacity:1,duration:.6,scrollTrigger:{trigger:".split-visual",start:"top 75%"}}),gsap.to(".challenge-section",{opacity:1,duration:.6,scrollTrigger:{trigger:".challenge-section",start:"top 75%"}}),["#momentCard1","#momentCard2","#momentCard3","#momentCard4"].forEach((t,l)=>{const v=document.querySelector(t);v&&gsap.to(v,{opacity:1,duration:.6,delay:l*.15,scrollTrigger:{trigger:"#momentStack",start:"top 70%"},onComplete:()=>{setTimeout(()=>{v.classList.add("fanned")},500)}})});const s=document.querySelector("#splitContainer");s&&(gsap.to(s,{opacity:1,y:0,duration:.8,scrollTrigger:{trigger:s,start:"top 75%"}}),gsap.to(".entry-card",{opacity:1,x:0,duration:.6,stagger:.15,scrollTrigger:{trigger:s,start:"top 70%"}})),gsap.to(".system-shape",{opacity:1,scale:1,rotation:0,duration:.8,stagger:.2,scrollTrigger:{trigger:"#systemShapes",start:"top 70%"}}),gsap.to("#discrepancyHighlight",{opacity:1,duration:.8,delay:.8,scrollTrigger:{trigger:"#systemShapes",start:"top 60%"}}),gsap.to("#solutionPanel",{opacity:1,y:0,duration:.8,scrollTrigger:{trigger:"#solutionPanel",start:"top 75%"}}),gsap.utils.toArray(".problem-card").forEach((t,l)=>{gsap.to(t,{opacity:1,y:0,duration:.8,scrollTrigger:{trigger:t,start:"top 80%"}});const v=t.querySelectorAll(".layer");gsap.to(v,{opacity:1,x:0,duration:.5,stagger:.15,scrollTrigger:{trigger:t,start:"top 70%"}})}),gsap.utils.toArray(".challenge-item").forEach(t=>{gsap.to(t,{opacity:1,scale:1,duration:.6,scrollTrigger:{trigger:t,start:"top 75%"}});const l=t.querySelector(".challenge-answer");gsap.to(l,{opacity:1,y:0,duration:.5,delay:.3,scrollTrigger:{trigger:t,start:"top 65%"}})}),document.querySelectorAll(".iso-layer").forEach((t,l)=>{gsap.to(t,{opacity:1,duration:.8,delay:l*.2,scrollTrigger:{trigger:"#isoStack",start:"top 70%"},onComplete:()=>{t.classList.add("active")}})});const i=document.getElementById("txPacket1"),e=document.getElementById("txPacket2");i&&gsap.to(i,{scrollTrigger:{trigger:"#isoStack",start:"top 50%",onEnter:()=>{i.classList.add("animating")}}}),e&&gsap.to(e,{scrollTrigger:{trigger:"#isoStack",start:"top 45%",onEnter:()=>{setTimeout(()=>{e.classList.add("animating")},1500)}}});const r=document.getElementById("denialFlash");r&&gsap.to(r,{scrollTrigger:{trigger:"#isoStack",start:"top 40%",onEnter:()=>{setTimeout(()=>{r.classList.add("active"),setTimeout(()=>{r.classList.remove("active")},2e3)},2500)}}});const a=gsap.utils.toArray(".arch-layer");a.length>0&&a.forEach((t,l)=>{gsap.to(t,{opacity:1,y:0,duration:.8,delay:l*.3,scrollTrigger:{trigger:"#archDiagram",start:"top 70%"}})});const d=document.getElementById("dataPacket");d&&gsap.to(d,{opacity:1,y:()=>{const t=document.getElementById("archDiagram");return t?t.offsetHeight-100:500},duration:4,ease:"power1.inOut",scrollTrigger:{trigger:"#archDiagram",start:"top 50%"},onComplete:()=>{const t=document.getElementById("rejectionFlash");t&&gsap.to(t,{opacity:1,scale:1,duration:.3,onComplete:()=>{gsap.to(t,{opacity:0,scale:.9,duration:.3,delay:1.5})}})}}),gsap.to(".scale-side",{opacity:1,y:0,duration:.8,stagger:.3,scrollTrigger:{trigger:"#balanceScale",start:"top 70%"}}),gsap.to(".scale-pivot",{opacity:1,rotation:0,duration:.6,delay:.4,scrollTrigger:{trigger:"#balanceScale",start:"top 65%"}}),gsap.to("#balanceCheck",{opacity:1,scale:1,duration:.6,delay:1,scrollTrigger:{trigger:"#balanceScale",start:"top 60%"}}),gsap.utils.toArray(".audit-block").forEach((t,l)=>{gsap.to(t,{opacity:1,scale:1,duration:.5,delay:l*.15,scrollTrigger:{trigger:"#auditChain",start:"top 70%"}})}),gsap.utils.toArray(".score-card").forEach((t,l)=>{gsap.to(t,{opacity:1,scale:1,duration:.8,delay:l*.2,scrollTrigger:{trigger:t,start:"top 75%"}})})}function B(){const n=document.getElementById("progressBar");window.addEventListener("scroll",()=>{const s=document.documentElement.scrollHeight-window.innerHeight,i=window.scrollY/s;gsap.to(n,{scaleX:i,duration:.1,ease:"none"})})}function C(){const n=document.getElementById("presentBtn"),s=document.getElementById("presentMode"),o=document.getElementById("exitPresent"),i=document.getElementById("prevSlide"),e=document.getElementById("nextSlide"),r=document.getElementById("slideCounter");let a=0,d=null;const t=new URLSearchParams(window.location.search),l=t.get("present")==="1",v=t.get("autoplay")==="1",T=parseInt(t.get("dur")||"8")*1e3,g=[{title:"Hero",render:()=>`
        <div class="slide-content slide-hero">
          <div class="slide-eyebrow">Cal Hacks 2026 · Hyphenate Track</div>
          <h1 class="slide-title">An autonomous Staff Accountant<br>you could actually hire</h1>
          <p class="slide-subtitle">JarvisERP fills Afterglow Labs' Staff Accountant and Vendor-Master seats.<br>
          It reconciles three systems that never agree, books accruals, keeps vendors deduplicated—<br>
          and cannot pass anything to humans without Controller hash-approval.</p>
        </div>
      `},{title:"The Moment",render:()=>`
        <div class="slide-content slide-moment">
          <h2 class="slide-heading">One bank line, four transactions to the cent</h2>
          <div class="slide-bank-line">
            <span class="date">09/18</span>
            <span class="desc">PAYPAL *INST XFER DCE4343478</span>
            <span class="amount">-$3,912.44</span>
          </div>
          <p class="slide-label">Jarvis decomposes the line:</p>
          <div class="slide-split-cards">
            <div class="slide-card">
              <div class="card-amount">$3,451.50</div>
              <div class="card-account">1310 · Prepaid Tour Costs</div>
              <div class="card-detail">Kraftwerk Rigging · Berlin Nov 14 · €2,950 @ 1.1700</div>
            </div>
            <div class="slide-card">
              <div class="card-amount">$147.50</div>
              <div class="card-account">6810 · Bank & FX Fees</div>
              <div class="card-detail">PayPal spread · 1.2200 vs 1.1700</div>
            </div>
            <div class="slide-card">
              <div class="card-amount">$200.00</div>
              <div class="card-account">6410 · Software</div>
              <div class="card-detail">Anthropic (alias "Claude")</div>
            </div>
            <div class="slide-card">
              <div class="card-amount">$113.44</div>
              <div class="card-account">1250 · Employee Receivable</div>
              <div class="card-detail">J. Ortiz · Steam · Policy P-0317</div>
            </div>
          </div>
          <div class="slide-total">Total: $3,912.44 ✓</div>
        </div>
      `},{title:"Afterglow Labs",render:()=>`
        <div class="slide-content slide-company">
          <h2 class="slide-heading">Afterglow Labs — where accounting gets messy</h2>
          <div class="slide-company-card">
            <div class="company-emoji">🎵</div>
            <h3>Audio-Visual Touring Studio</h3>
            <p>28-person Bay Area studio producing live-visual shows for festivals and clubs.</p>
          </div>
          <h3 class="slide-subheading">Seats Jarvis Fills</h3>
          <div class="slide-seats">
            <div class="slide-seat">
              <div class="seat-name">Staff Accountant</div>
              <div class="seat-duties">Cash & expense close, reconciliation, accruals</div>
            </div>
            <div class="slide-seat">
              <div class="seat-name">Vendor-Master Clerk</div>
              <div class="seat-duties">Deduplicate vendors, maintain canonical list</div>
            </div>
          </div>
        </div>
      `},{title:"Three Systems",render:()=>`
        <div class="slide-content slide-systems">
          <h2 class="slide-heading">Three systems that never agree</h2>
          <div class="slide-systems-row">
            <div class="slide-system-box">
              <div class="system-label">Bank Feed</div>
              <div class="system-value">$3,912.44</div>
              <div class="system-desc">"PAYPAL INST XFER"</div>
            </div>
            <div class="slide-connector">✗</div>
            <div class="slide-system-box">
              <div class="system-label">Ledger (QBO)</div>
              <div class="system-value">$3,912.44</div>
              <div class="system-desc">"Software Expense"</div>
            </div>
            <div class="slide-connector">✗</div>
            <div class="slide-system-box">
              <div class="system-label">PayPal Detail</div>
              <div class="system-value">4 payments</div>
              <div class="system-desc">€2,950 + $147.50 + $200 + $113.44</div>
            </div>
          </div>
          <p class="slide-note">Jarvis reconciles all three, books correct accounts & vendors</p>
        </div>
      `},{title:"Five Problems",render:()=>`
        <div class="slide-content slide-problems">
          <h2 class="slide-heading">What an accountant faces every close</h2>
          <div class="slide-problems-grid">
            <div class="slide-problem">
              <div class="problem-num">01</div>
              <div class="problem-name">Timing & Accruals</div>
              <div class="problem-ex">Interest earned Sep 30, deposited Oct 1</div>
            </div>
            <div class="slide-problem">
              <div class="problem-num">02</div>
              <div class="problem-name">Roll-forward</div>
              <div class="problem-ex">New GL account mid-year breaks Excel</div>
            </div>
            <div class="slide-problem">
              <div class="problem-num">03</div>
              <div class="problem-name">Vague Bank Lines</div>
              <div class="problem-ex">Bank says "PAYPAL" — what was bought?</div>
            </div>
            <div class="slide-problem">
              <div class="problem-num">04</div>
              <div class="problem-name">Evidence & Folders</div>
              <div class="problem-ex">Downloads: Statement (3).pdf duplicate mess</div>
            </div>
            <div class="slide-problem">
              <div class="problem-num">05</div>
              <div class="problem-name">Duplicate Vendors</div>
              <div class="problem-ex">Ramp suggests "Claude" but QBO has "Anthropic"</div>
            </div>
          </div>
        </div>
      `},{title:"Challenges",render:()=>`
        <div class="slide-content slide-challenges">
          <h2 class="slide-heading">Five forces that test autonomous agents</h2>
          <div class="slide-challenges-grid">
            <div class="slide-challenge-item">
              <div class="challenge-name">Trust</div>
              <div class="challenge-q">Can we trust it?</div>
              <div class="challenge-a">Hash-chained audit log, single gateway, role enforcement</div>
            </div>
            <div class="slide-challenge-item">
              <div class="challenge-name">Correctness</div>
              <div class="challenge-q">Is it right?</div>
              <div class="challenge-a">Simulation harness, 92% match on real data</div>
            </div>
            <div class="slide-challenge-item">
              <div class="challenge-name">Evidence</div>
              <div class="challenge-q">Can it cite sources?</div>
              <div class="challenge-a">Every entry links SOWs, policies, Drive files</div>
            </div>
            <div class="slide-challenge-item">
              <div class="challenge-name">Governance</div>
              <div class="challenge-q">Who approves?</div>
              <div class="challenge-a">Controller must hash-sign; no self-approval</div>
            </div>
            <div class="slide-challenge-item">
              <div class="challenge-name">Change</div>
              <div class="challenge-q">Does it learn?</div>
              <div class="challenge-a">Policies from rulings; vendors evolve</div>
            </div>
          </div>
        </div>
      `},{title:"Architecture",render:()=>`
        <div class="slide-content slide-architecture">
          <h2 class="slide-heading">System Architecture Stack</h2>
          <div class="slide-arch-stack">
            <div class="slide-arch-layer" style="--layer: 0;">
              <div class="arch-layer-label">Source Systems</div>
              <div class="arch-layer-items">Chase · PayPal · Ramp · Gusto · Drive</div>
            </div>
            <div class="slide-arch-layer" style="--layer: 1;">
              <div class="arch-layer-label">ERP / QuickBooks</div>
              <div class="arch-layer-items">GL · AP/AR · Vendor Master</div>
            </div>
            <div class="slide-arch-layer" style="--layer: 2;">
              <div class="arch-layer-label">Jarvis System of Work</div>
              <div class="arch-layer-items">Work Items · Evidence · Policies</div>
            </div>
            <div class="slide-arch-layer" style="--layer: 3;">
              <div class="arch-layer-label">Controls & Gateway</div>
              <div class="arch-layer-items">Single Gateway · Roles · Audit Chain</div>
            </div>
            <div class="slide-arch-layer" style="--layer: 4;">
              <div class="arch-layer-label">People & Outputs</div>
              <div class="arch-layer-items">Controller · Auditor · Financial Package</div>
            </div>
          </div>
          <p class="slide-note">Transaction packets flow upward; Gateway validates every write</p>
        </div>
      `},{title:"Double Entry",render:()=>`
        <div class="slide-content slide-balance">
          <h2 class="slide-heading">Every entry balances</h2>
          <div class="slide-balance-demo">
            <div class="balance-side">
              <div class="balance-label">Debits</div>
              <div class="balance-entries">
                <div class="balance-entry">1310 Prepaid $3,451.50</div>
                <div class="balance-entry">6810 Fees $147.50</div>
                <div class="balance-entry">6410 Software $200.00</div>
                <div class="balance-entry">1250 Receivable $113.44</div>
              </div>
              <div class="balance-sum">$3,912.44</div>
            </div>
            <div class="balance-pivot">⚖</div>
            <div class="balance-side">
              <div class="balance-label">Credits</div>
              <div class="balance-entries">
                <div class="balance-entry">1010 Cash $3,912.44</div>
              </div>
              <div class="balance-sum">$3,912.44</div>
            </div>
          </div>
          <p class="slide-note">✓ Balanced to the cent — every transaction, every time</p>
        </div>
      `},{title:"Trust & Limits",render:()=>`
        <div class="slide-content slide-trust">
          <h2 class="slide-heading">Trust & Limits</h2>
          <div class="slide-trust-row">
            <div class="slide-trust-card">
              <div class="trust-icon">👤</div>
              <div class="trust-title">Controller</div>
              <div class="trust-desc">Approves/rejects proposals</div>
              <div class="trust-rule">Can write journal entries</div>
            </div>
            <div class="slide-trust-card">
              <div class="trust-icon">🤖</div>
              <div class="trust-title">Jarvis</div>
              <div class="trust-desc">Proposes entries & evidence</div>
              <div class="trust-rule">Cannot write without approval</div>
            </div>
            <div class="slide-trust-card">
              <div class="trust-icon">🔍</div>
              <div class="trust-title">Auditor</div>
              <div class="trust-desc">Reads everything, writes nothing</div>
              <div class="trust-rule">Asks "why?"</div>
            </div>
          </div>
          <div class="slide-audit-note">
            <strong>Hash-Chained Audit Log:</strong> Every write hashes the previous block.
            Tampering breaks the chain forward.
          </div>
        </div>
      `},{title:"Proof",render:()=>`
        <div class="slide-content slide-proof">
          <h2 class="slide-heading">Proof: Real vs Simulation</h2>
          <div class="slide-proof-grid">
            <div class="slide-proof-card">
              <div class="proof-label">Correctness</div>
              <div class="proof-score">92%</div>
              <div class="proof-desc">Match on 134 real transactions</div>
            </div>
            <div class="slide-proof-card">
              <div class="proof-label">Speed</div>
              <div class="proof-score">&lt;1s</div>
              <div class="proof-desc">Per transaction, including evidence fetch</div>
            </div>
            <div class="slide-proof-card">
              <div class="proof-label">Audit Coverage</div>
              <div class="proof-score">100%</div>
              <div class="proof-desc">Every write logged & hash-chained</div>
            </div>
          </div>
          <p class="slide-note">Simulation harness replays real transactions, measures delta</p>
        </div>
      `},{title:"Glossary",render:()=>`
        <div class="slide-content slide-glossary">
          <h2 class="slide-heading">30+ Accounting Terms</h2>
          <p class="slide-subtitle">Interactive flip cards on the main site</p>
          <div class="slide-glossary-highlights">
            <div class="glossary-term"><strong>Debit:</strong> Left side of entry (↑ assets/expenses)</div>
            <div class="glossary-term"><strong>Credit:</strong> Right side of entry (↑ liabilities/equity)</div>
            <div class="glossary-term"><strong>Accrual:</strong> Record when earned, not when cash moves</div>
            <div class="glossary-term"><strong>Prepaid:</strong> Cash paid now, benefit later (asset)</div>
            <div class="glossary-term"><strong>Journal Entry:</strong> Balanced debits & credits</div>
            <div class="glossary-term"><strong>Reconcile:</strong> Prove two sources agree</div>
            <div class="glossary-term"><strong>Subledger:</strong> Detailed records rolling up to GL</div>
            <div class="glossary-term"><strong>Cut-off:</strong> Transactions in correct period</div>
          </div>
        </div>
      `}],L=()=>{r.textContent=`${a+1} / ${g.length}`,i.disabled=a===0,e.disabled=a===g.length-1},p=c=>{var w;const f=document.querySelector(".present-slide"),x=g[c];f.innerHTML=x.render();const P=gsap.timeline(),b=((w=f.children[0])==null?void 0:w.children)||[];b.length>0&&P.from(b,{opacity:0,y:30,duration:.6,stagger:.1,ease:"power2.out"}),L()},y=()=>{d&&clearInterval(d),d=setInterval(()=>{a<g.length-1?(a++,p(a)):m()},T)},m=()=>{d&&(clearInterval(d),d=null)},h=()=>{try{if(!s||!r){console.error("Present mode elements not found");return}s.classList.remove("hidden"),a=0,p(a),document.body.style.overflow="hidden",v&&y()}catch(c){console.error("Error opening present mode:",c)}};n==null||n.addEventListener("click",h),l&&(console.log("Auto-opening present mode..."),setTimeout(h,1e3)),o.addEventListener("click",()=>{s.classList.add("hidden"),document.body.style.overflow="",m()}),i.addEventListener("click",()=>{a>0&&(a--,p(a),m())}),e.addEventListener("click",()=>{a<g.length-1&&(a++,p(a),v&&y())}),document.addEventListener("keydown",c=>{s.classList.contains("hidden")||(c.key==="Escape"?(s.classList.add("hidden"),document.body.style.overflow="",m()):c.key==="ArrowLeft"||c.key==="ArrowUp"?a>0&&(a--,p(a),m()):(c.key==="ArrowRight"||c.key==="ArrowDown"||c.key===" ")&&(c.preventDefault(),a<g.length-1&&(a++,p(a),v&&y())))})}function E(){const n=document.getElementById("challengeBtn"),s=document.getElementById("newEvidenceBtn"),o=document.getElementById("challengeCard"),i=document.getElementById("defenseCard"),e=document.getElementById("concessionCard");n&&n.addEventListener("click",()=>{o.style.display="block",gsap.from(o,{opacity:0,y:20,duration:.5}),setTimeout(()=>{i.style.display="block",gsap.from(i,{opacity:0,y:20,duration:.5}),s.style.display="inline-block"},1e3)}),s&&s.addEventListener("click",()=>{e.style.display="block",gsap.from(e,{opacity:0,y:20,duration:.5})})}function S(){const n=document.querySelectorAll(".connector"),s=document.getElementById("fitConnectors");gsap.utils.toArray(n).forEach((o,i)=>{gsap.to(o,{opacity:1,scrollTrigger:{trigger:"#systemShapes",start:"top 60%"},delay:.5+i*.3,onStart:()=>{o.classList.add("visible")}})}),s&&gsap.to(s,{opacity:1,scrollTrigger:{trigger:"#solutionPanel",start:"top 60%"},delay:.5,onStart:()=>{s.style.display="block",s.classList.add("visible")}})}function A(){const n=document.getElementById("glossaryGrid"),s=document.getElementById("glossarySearch"),o=i=>{n.innerHTML=i.map(e=>`
      <div class="term-card" data-term="${e.name.toLowerCase()}">
        <div class="term-front">
          <div class="term-name">${e.name}</div>
          <div class="term-category">${e.category}</div>
          <div class="term-definition">${e.definition}</div>
          <div class="term-example">${e.example}</div>
        </div>
      </div>
    `).join(""),document.querySelectorAll(".term-card").forEach(e=>{e.addEventListener("click",()=>{e.classList.toggle("flipped")})}),gsap.fromTo(".term-card",{opacity:0,y:20},{opacity:1,y:0,duration:.4,stagger:.03,ease:"power2.out",clearProps:"transform"})};o(u),s&&s.addEventListener("input",i=>{const e=i.target.value.toLowerCase(),r=e?u.filter(a=>a.name.toLowerCase().includes(e)||a.definition.toLowerCase().includes(e)||a.example.toLowerCase().includes(e)):u;o(r)})}function I(){const n=document.getElementById("tamperTest"),s=document.getElementById("resetChain"),o=document.getElementById("tamperMessage");n&&n.addEventListener("click",()=>{const i=document.querySelector('.audit-block[data-block="3"]'),e=document.querySelector('.audit-block[data-block="4"]');i&&e&&(i.classList.add("tampered"),i.querySelector(".block-content").textContent="Block 3: [TAMPERED]",setTimeout(()=>{e.classList.add("tampered"),o&&(o.style.display="flex"),s&&(s.style.display="inline-block")},500))}),s&&s.addEventListener("click",()=>{document.querySelectorAll(".audit-block").forEach(r=>{r.classList.remove("tampered")});const e=document.querySelector('.audit-block[data-block="3"]');e&&(e.querySelector(".block-content").textContent="Block 3: Controller approves"),o&&(o.style.display="none"),s.style.display="none"}),document.querySelectorAll('a[href^="#"]').forEach(i=>{i.addEventListener("click",function(e){e.preventDefault();const r=document.querySelector(this.getAttribute("href"));r&&r.scrollIntoView({behavior:"smooth",block:"start"})})})}window.jarvisExplainer={glossaryTerms:u,initScrollAnimations:k,initPresentMode:C,initGlossary:A,initChallengeDefense:E,initThreeSystemsConnectors:S};
