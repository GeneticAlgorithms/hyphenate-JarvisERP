// JarvisERP Explainer - Main JavaScript
import './style.css';

// Glossary terms data
const glossaryTerms = [
  {
    name: 'Debit',
    category: 'fundamentals',
    definition: 'Left side of a journal entry. Increases assets and expenses, decreases liabilities and equity.',
    example: 'Buying equipment: <strong>Debit</strong> Equipment $10,000 (asset goes up)'
  },
  {
    name: 'Credit',
    category: 'fundamentals',
    definition: 'Right side of a journal entry. Decreases assets and expenses, increases liabilities and equity.',
    example: 'Buying equipment: <strong>Credit</strong> Cash $10,000 (asset goes down)'
  },
  {
    name: 'Net Amount',
    category: 'fundamentals',
    definition: 'The difference between total debits and credits on a transaction or in an account.',
    example: 'Bank line $3,912.44 splits into 4 debits, net to one credit'
  },
  {
    name: 'ERP',
    category: 'systems',
    definition: 'Enterprise Resource Planning system. The software that runs accounting, inventory, HR, etc.',
    example: 'Afterglow Labs uses QuickBooks (QBO) as their ERP'
  },
  {
    name: 'General Ledger',
    category: 'systems',
    definition: 'The master record of all accounts and transactions. The source of truth for financial statements.',
    example: 'Account 1010 Cash — Chase Operating shows $47,332 balance in the GL'
  },
  {
    name: 'Chart of Accounts',
    category: 'systems',
    definition: 'The numbered list of all accounts (assets, liabilities, equity, revenue, expenses).',
    example: '1010 Cash, 1250 Employee Receivable, 6410 Software, 6810 Bank Fees'
  },
  {
    name: 'Journal Entry',
    category: 'fundamentals',
    definition: 'A transaction posted to the ledger with debits and credits that must balance.',
    example: 'JE-0918: 4 debits totaling $3,912.44 = 1 credit $3,912.44'
  },
  {
    name: 'Subledger',
    category: 'systems',
    definition: 'Detailed records (invoices, bills, payments) that roll up to the General Ledger.',
    example: 'AP subledger: 12 vendor bills total $45,200 → GL account 2010'
  },
  {
    name: 'Accounts Payable',
    category: 'accounts',
    definition: 'Money the company owes to vendors for goods/services received but not yet paid.',
    example: 'Lumen Crew invoices $13,020 on Oct 8 → AP liability until paid'
  },
  {
    name: 'Accounts Receivable',
    category: 'accounts',
    definition: 'Money customers owe the company for goods/services delivered but not yet paid.',
    example: 'Interest earned Sep 30, deposited Oct 1 → Other Receivable at 9/30'
  },
  {
    name: 'Reconcile',
    category: 'processes',
    definition: 'Proving two sources agree by explaining every difference. Usually bank vs ledger.',
    example: 'Chase says $47,332, ledger says $47,332 → reconciled to $0.00'
  },
  {
    name: 'Bank Feed',
    category: 'systems',
    definition: 'Automated import of bank transactions into accounting software with suggested categories.',
    example: 'QBO bank feed suggests "PAYPAL" → Software Expense (wrong)'
  },
  {
    name: 'Accrual',
    category: 'timing',
    definition: 'Recording revenue/expense when earned/incurred, not when cash moves.',
    example: 'Crew works in Sep, invoices Oct → accrue $12,350 expense in Sep'
  },
  {
    name: 'Reversal',
    category: 'timing',
    definition: 'Undoing last month\'s accrual entry when the actual transaction arrives.',
    example: 'Oct 1: reverse Sep 30 interest accrual, record actual deposit'
  },
  {
    name: 'Prepaid',
    category: 'accounts',
    definition: 'Cash paid now for a benefit in a future period. An asset that becomes expense later.',
    example: 'Sep: pay $3,451.50 for Nov show → Prepaid asset, expense in Nov'
  },
  {
    name: 'Other Receivable',
    category: 'accounts',
    definition: 'Amounts owed to the company that aren\'t customer invoices (interest, employee payback, etc).',
    example: 'Employee buys Steam game $113.44 on corp card → Other Receivable'
  },
  {
    name: 'Timing Difference',
    category: 'timing',
    definition: 'When a transaction appears in one system before another (bank vs ledger, invoice vs payment).',
    example: 'Interest earned Sep 30, deposited Oct 1 → timing difference'
  },
  {
    name: 'FX',
    category: 'transactions',
    definition: 'Foreign exchange. Converting one currency to another, often with fees.',
    example: 'PayPal converts €2,950 at 1.2200 vs market 1.1700 → $147.50 FX fee'
  },
  {
    name: 'Vendor Master',
    category: 'systems',
    definition: 'The canonical list of vendors with legal names, TINs, payment details, and aliases.',
    example: 'Anthropic PBC (TIN 12-3456789) · aliases: Claude, claude.ai'
  },
  {
    name: 'Duplicate Vendor',
    category: 'data-quality',
    definition: 'Same real-world entity entered multiple times (different names, typos, product vs legal name).',
    example: 'Anthropic / Claude / ANTHROPIC PBC  → merge to one canonical vendor'
  },
  {
    name: 'Period Close',
    category: 'processes',
    definition: 'Finalizing a month\'s books: reconciliations, accruals, adjustments, then lock the period.',
    example: 'Close September: all entries in, bank rec ties, accruals booked, period locked'
  },
  {
    name: 'Materiality',
    category: 'judgments',
    definition: 'The size threshold where a difference matters. Small errors that don\'t change decisions.',
    example: '$25 bank fee might be immaterial, but personal purchase is a control issue'
  },
  {
    name: 'Internal Controls',
    category: 'governance',
    definition: 'Policies and procedures to prevent errors and fraud (approvals, reconciliations, segregation).',
    example: 'Requester cannot approve their own journal entry (segregation of duties)'
  },
  {
    name: 'Segregation of Duties',
    category: 'governance',
    definition: 'Different people prepare and approve to prevent one person from hiding mistakes or fraud.',
    example: 'Agent proposes, Controller approves, Gateway posts → 3 separate roles'
  },
  {
    name: 'Audit Trail',
    category: 'governance',
    definition: 'A complete record of who did what, when, why, with evidence. Months later, you can prove it.',
    example: 'Hash-chained log: every transition recorded with actor, reason, evidence, prev hash'
  },
  {
    name: 'System of Record',
    category: 'systems',
    definition: 'The source treated as truth for a specific fact (bank for cash, ledger for balances, etc).',
    example: 'Bank is system of record for cash movement; contracts for service period'
  },
  {
    name: 'Controller',
    category: 'roles',
    definition: 'Senior accountant who oversees close, reviews entries, and makes judgment calls.',
    example: 'Maya Chen (Controller) approves accruals, rejects self-approvals, answers questions'
  },
  {
    name: 'Trial Balance',
    category: 'reports',
    definition: 'A report showing every account\'s balance. Must sum to zero (debits = credits).',
    example: 'Trial balance Sep 30: total debits $1.2M = total credits $1.2M'
  },
  {
    name: 'Financial Package',
    category: 'reports',
    definition: 'The monthly close deliverable: Balance Sheet, Income Statement, Cash Flow, plus notes.',
    example: 'Sep package: BS/IS/CF in Excel with month-over-month columns and flux comments'
  }
];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initPresentMode();
  initGlossary();
  initInteractiveElements();
  initProgressBar();
  initChallengeDefense();
  initThreeSystemsConnectors();
});

// Initialize scroll-triggered animations with GSAP
function initScrollAnimations() {
  gsap.registerPlugin(ScrollTrigger);

  // Section 1: The Moment - Bank line animation
  gsap.to('#bankLine', {
    opacity: 1,
    y: 0,
    duration: 0.8,
    scrollTrigger: {
      trigger: '#bankLine',
      start: 'top 80%',
    }
  });

  // Naive rule stamp
  gsap.to('#naiveRule', {
    opacity: 1,
    duration: 0.6,
    delay: 0.5,
    scrollTrigger: {
      trigger: '#bankLine',
      start: 'top 70%',
    }
  });

  // Split visual arrow
  gsap.to('.split-visual', {
    opacity: 1,
    duration: 0.6,
    scrollTrigger: {
      trigger: '.split-visual',
      start: 'top 75%',
    }
  });

  // Challenge section reveal
  gsap.to('.challenge-section', {
    opacity: 1,
    duration: 0.6,
    scrollTrigger: {
      trigger: '.challenge-section',
      start: 'top 75%',
    }
  });

  // Moment stack - Reveal and fan out stacked cards
  const momentCards = ['#momentCard1', '#momentCard2', '#momentCard3', '#momentCard4'];
  momentCards.forEach((cardId, index) => {
    const card = document.querySelector(cardId);
    if (card) {
      // Initial reveal
      gsap.to(card, {
        opacity: 1,
        duration: 0.6,
        delay: index * 0.15,
        scrollTrigger: {
          trigger: '#momentStack',
          start: 'top 70%',
        },
        onComplete: () => {
          // Add fanned class after reveal
          setTimeout(() => {
            card.classList.add('fanned');
          }, 500);
        }
      });
    }
  });

  // Legacy split container support (for challenge/defense cards)
  const splitContainer = document.querySelector('#splitContainer');
  if (splitContainer) {
    gsap.to(splitContainer, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      scrollTrigger: {
        trigger: splitContainer,
        start: 'top 75%',
      }
    });

    // Individual entry cards with stagger
    gsap.to('.entry-card', {
      opacity: 1,
      x: 0,
      duration: 0.6,
      stagger: 0.15,
      scrollTrigger: {
        trigger: splitContainer,
        start: 'top 70%',
      }
    });
  }

  // Section 3: Systems - Mismatched shapes
  gsap.to('.system-shape', {
    opacity: 1,
    scale: 1,
    rotation: 0,
    duration: 0.8,
    stagger: 0.2,
    scrollTrigger: {
      trigger: '#systemShapes',
      start: 'top 70%',
    }
  });

  // Discrepancy highlight
  gsap.to('#discrepancyHighlight', {
    opacity: 1,
    duration: 0.8,
    delay: 0.8,
    scrollTrigger: {
      trigger: '#systemShapes',
      start: 'top 60%',
    }
  });

  // Solution panel
  gsap.to('#solutionPanel', {
    opacity: 1,
    y: 0,
    duration: 0.8,
    scrollTrigger: {
      trigger: '#solutionPanel',
      start: 'top 75%',
    }
  });

  // Section 4: Problems - Cards with layers
  gsap.utils.toArray('.problem-card').forEach((card, index) => {
    gsap.to(card, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      scrollTrigger: {
        trigger: card,
        start: 'top 80%',
      }
    });

    // Animate layers within each card
    const layers = card.querySelectorAll('.layer');
    gsap.to(layers, {
      opacity: 1,
      x: 0,
      duration: 0.5,
      stagger: 0.15,
      scrollTrigger: {
        trigger: card,
        start: 'top 70%',
      }
    });
  });

  // Section 5: Challenges
  gsap.utils.toArray('.challenge-item').forEach((item) => {
    gsap.to(item, {
      opacity: 1,
      scale: 1,
      duration: 0.6,
      scrollTrigger: {
        trigger: item,
        start: 'top 75%',
      }
    });

    // Reveal answer on scroll
    const answer = item.querySelector('.challenge-answer');
    gsap.to(answer, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      delay: 0.3,
      scrollTrigger: {
        trigger: item,
        start: 'top 65%',
      }
    });
  });

  // Section 6: Architecture - Isometric Stack
  const isoLayers = document.querySelectorAll('.iso-layer');
  isoLayers.forEach((layer, index) => {
    gsap.to(layer, {
      opacity: 1,
      duration: 0.8,
      delay: index * 0.2,
      scrollTrigger: {
        trigger: '#isoStack',
        start: 'top 70%',
      },
      onComplete: () => {
        layer.classList.add('active');
      }
    });
  });

  // Animate transaction packets through the stack
  const txPacket1 = document.getElementById('txPacket1');
  const txPacket2 = document.getElementById('txPacket2');
  
  if (txPacket1) {
    gsap.to(txPacket1, {
      scrollTrigger: {
        trigger: '#isoStack',
        start: 'top 50%',
        onEnter: () => {
          txPacket1.classList.add('animating');
        }
      }
    });
  }

  if (txPacket2) {
    gsap.to(txPacket2, {
      scrollTrigger: {
        trigger: '#isoStack',
        start: 'top 45%',
        onEnter: () => {
          setTimeout(() => {
            txPacket2.classList.add('animating');
          }, 1500);
        }
      }
    });
  }

  // Denial flash on controls layer
  const denialFlash = document.getElementById('denialFlash');
  if (denialFlash) {
    gsap.to(denialFlash, {
      scrollTrigger: {
        trigger: '#isoStack',
        start: 'top 40%',
        onEnter: () => {
          setTimeout(() => {
            denialFlash.classList.add('active');
            setTimeout(() => {
              denialFlash.classList.remove('active');
            }, 2000);
          }, 2500);
        }
      }
    });
  }

  // Legacy architecture support (in case old elements exist)
  const archLayers = gsap.utils.toArray('.arch-layer');
  if (archLayers.length > 0) {
    archLayers.forEach((layer, index) => {
      gsap.to(layer, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        delay: index * 0.3,
        scrollTrigger: {
          trigger: '#archDiagram',
          start: 'top 70%',
        }
      });
    });
  }

  // Legacy packet animation
  const packet = document.getElementById('dataPacket');
  if (packet) {
    gsap.to(packet, {
      opacity: 1,
      y: () => {
        const diagram = document.getElementById('archDiagram');
        return diagram ? diagram.offsetHeight - 100 : 500;
      },
      duration: 4,
      ease: 'power1.inOut',
      scrollTrigger: {
        trigger: '#archDiagram',
        start: 'top 50%',
      },
      onComplete: () => {
        const rejection = document.getElementById('rejectionFlash');
        if (rejection) {
          gsap.to(rejection, {
            opacity: 1,
            scale: 1,
            duration: 0.3,
            onComplete: () => {
              gsap.to(rejection, {
                opacity: 0,
                scale: 0.9,
                duration: 0.3,
                delay: 1.5
              });
            }
          });
        }
      }
    });
  }

  // Section 7: Double-entry balance scale
  gsap.to('.scale-side', {
    opacity: 1,
    y: 0,
    duration: 0.8,
    stagger: 0.3,
    scrollTrigger: {
      trigger: '#balanceScale',
      start: 'top 70%',
    }
  });

  gsap.to('.scale-pivot', {
    opacity: 1,
    rotation: 0,
    duration: 0.6,
    delay: 0.4,
    scrollTrigger: {
      trigger: '#balanceScale',
      start: 'top 65%',
    }
  });

  gsap.to('#balanceCheck', {
    opacity: 1,
    scale: 1,
    duration: 0.6,
    delay: 1,
    scrollTrigger: {
      trigger: '#balanceScale',
      start: 'top 60%',
    }
  });

  // Section 8: Trust - Audit chain blocks
  gsap.utils.toArray('.audit-block').forEach((block, index) => {
    gsap.to(block, {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      delay: index * 0.15,
      scrollTrigger: {
        trigger: '#auditChain',
        start: 'top 70%',
      }
    });
  });

  // Section 9: Proof - Score cards
  gsap.utils.toArray('.score-card').forEach((card, index) => {
    gsap.to(card, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      delay: index * 0.2,
      scrollTrigger: {
        trigger: card,
        start: 'top 75%',
      }
    });
  });
}

// Initialize progress bar
function initProgressBar() {
  const progressBar = document.getElementById('progressBar');
  
  window.addEventListener('scroll', () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const progress = scrolled / scrollHeight;
    
    gsap.to(progressBar, {
      scaleX: progress,
      duration: 0.1,
      ease: 'none'
    });
  });
}

// Initialize Present Mode with autoplay support
function initPresentMode() {
  const presentBtn = document.getElementById('presentBtn');
  const presentMode = document.getElementById('presentMode');
  const exitBtn = document.getElementById('exitPresent');
  const prevBtn = document.getElementById('prevSlide');
  const nextBtn = document.getElementById('nextSlide');
  const slideCounter = document.getElementById('slideCounter');

  let currentSlide = 0;
  let autoplayInterval = null;
  
  // Check for URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const autoOpenPresent = urlParams.get('present') === '1';
  const autoplay = urlParams.get('autoplay') === '1';
  const duration = parseInt(urlParams.get('dur') || '8') * 1000;

  // Define purpose-built slides with 16:9 layouts
  const slides = [
    {
      title: 'JarvisERP',
      render: () => `
        <div class="present-slide-hero">
          <div class="present-eyebrow">Cal Hacks 2026 · Hyphenate Track</div>
          <h1 class="present-title">An autonomous Staff Accountant<br>you could actually hire</h1>
          <p class="present-subtitle">JarvisERP fills Afterglow Labs' Staff Accountant and Vendor-Master seats.<br>
          It reconciles three systems that never agree, books accruals, keeps vendors deduplicated—<br>
          and cannot pass anything to humans without Controller hash-approval.</p>
        </div>
      `
    },
    {
      title: 'The Moment',
      render: () => {
        const moment = document.querySelector('#moment .moment-content');
        return moment ? moment.innerHTML : '<p>Moment content</p>';
      }
    },
    {
      title: 'Afterglow Labs',
      render: () => {
        const company = document.querySelector('#company .company-content');
        return company ? company.innerHTML : '<p>Company content</p>';
      }
    },
    {
      title: 'Three Systems',
      render: () => {
        const systems = document.querySelector('#systems .systems-content');
        return systems ? systems.innerHTML : '<p>Systems content</p>';
      }
    },
    {
      title: 'Five Problems',
      render: () => {
        const problems = document.querySelector('#problems .problems-grid');
        return problems ? `<div class="present-problems-grid">${problems.innerHTML}</div>` : '<p>Problems</p>';
      }
    },
    {
      title: 'Challenges',
      render: () => {
        const challenges = document.querySelector('#challenges .challenges-content');
        return challenges ? challenges.innerHTML : '<p>Challenges</p>';
      }
    },
    {
      title: 'Architecture',
      render: () => {
        const arch = document.querySelector('#architecture .iso-stack');
        return arch ? `<div style="transform: scale(0.85);">${arch.outerHTML}</div>` : '<p>Architecture</p>';
      }
    },
    {
      title: 'Double Entry',
      render: () => {
        const balance = document.querySelector('#balance .balance-content');
        return balance ? balance.innerHTML : '<p>Balance</p>';
      }
    },
    {
      title: 'Trust & Limits',
      render: () => {
        const trust = document.querySelector('#trust .trust-content');
        return trust ? trust.innerHTML : '<p>Trust</p>';
      }
    },
    {
      title: 'Proof',
      render: () => {
        const proof = document.querySelector('#proof .proof-content');
        return proof ? proof.innerHTML : '<p>Proof</p>';
      }
    },
    {
      title: 'Glossary',
      render: () => `
        <div class="present-glossary">
          <h2>30+ Accounting Terms</h2>
          <p>Interactive flip cards covering fundamentals, systems, accounts, timing, and processes.</p>
          <div class="glossary-sample">
            <div class="sample-grid">
              <div class="sample-term"><strong>Debit</strong> — Left side of entry</div>
              <div class="sample-term"><strong>Credit</strong> — Right side of entry</div>
              <div class="sample-term"><strong>Accrual</strong> — Record when earned</div>
              <div class="sample-term"><strong>Prepaid</strong> — Future benefit asset</div>
              <div class="sample-term"><strong>Journal Entry</strong> — Balanced transaction</div>
              <div class="sample-term"><strong>Reconcile</strong> — Prove sources agree</div>
            </div>
          </div>
        </div>
      `
    }
  ];

  const updateSlideCounter = () => {
    slideCounter.textContent = `${currentSlide + 1} / ${slides.length}`;
    prevBtn.disabled = currentSlide === 0;
    nextBtn.disabled = currentSlide === slides.length - 1;
  };

  const showSlide = (index) => {
    const slideContainer = document.querySelector('.present-slide');
    const slide = slides[index];
    
    // Render the slide
    slideContainer.innerHTML = slide.render();
    
    // Animate elements in
    const elements = slideContainer.querySelectorAll('*');
    elements.forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    
    gsap.from(slideContainer.children, {
      opacity: 0,
      y: 20,
      duration: 0.5,
      stagger: 0.08,
      ease: 'power2.out'
    });
    
    updateSlideCounter();
  };

  const startAutoplay = () => {
    if (autoplayInterval) clearInterval(autoplayInterval);
    
    autoplayInterval = setInterval(() => {
      if (currentSlide < slides.length - 1) {
        currentSlide++;
        showSlide(currentSlide);
      } else {
        stopAutoplay();
      }
    }, duration);
  };

  const stopAutoplay = () => {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
      autoplayInterval = null;
    }
  };

  const openPresentMode = () => {
    presentMode.classList.remove('hidden');
    currentSlide = 0;
    showSlide(currentSlide);
    document.body.style.overflow = 'hidden';
    
    if (autoplay) {
      startAutoplay();
    }
  };

  presentBtn.addEventListener('click', openPresentMode);

  // Auto-open if ?present=1
  if (autoOpenPresent) {
    setTimeout(openPresentMode, 500);
  }

  exitBtn.addEventListener('click', () => {
    presentMode.classList.add('hidden');
    document.body.style.overflow = '';
    stopAutoplay();
  });

  prevBtn.addEventListener('click', () => {
    if (currentSlide > 0) {
      currentSlide--;
      showSlide(currentSlide);
      stopAutoplay();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      showSlide(currentSlide);
      if (autoplay) startAutoplay();
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (presentMode.classList.contains('hidden')) return;
    
    if (e.key === 'Escape') {
      presentMode.classList.add('hidden');
      document.body.style.overflow = '';
      stopAutoplay();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (currentSlide > 0) {
        currentSlide--;
        showSlide(currentSlide);
        stopAutoplay();
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      if (currentSlide < slides.length - 1) {
        currentSlide++;
        showSlide(currentSlide);
        if (autoplay) startAutoplay();
      }
    }
  });
}

// Initialize Challenge/Defense Interactive
function initChallengeDefense() {
  const challengeBtn = document.getElementById('challengeBtn');
  const newEvidenceBtn = document.getElementById('newEvidenceBtn');
  const challengeCard = document.getElementById('challengeCard');
  const defenseCard = document.getElementById('defenseCard');
  const concessionCard = document.getElementById('concessionCard');

  if (challengeBtn) {
    challengeBtn.addEventListener('click', () => {
      challengeCard.style.display = 'block';
      gsap.from(challengeCard, { opacity: 0, y: 20, duration: 0.5 });
      
      setTimeout(() => {
        defenseCard.style.display = 'block';
        gsap.from(defenseCard, { opacity: 0, y: 20, duration: 0.5 });
        newEvidenceBtn.style.display = 'inline-block';
      }, 1000);
    });
  }

  if (newEvidenceBtn) {
    newEvidenceBtn.addEventListener('click', () => {
      concessionCard.style.display = 'block';
      gsap.from(concessionCard, { opacity: 0, y: 20, duration: 0.5 });
    });
  }
}

// Initialize Three Systems Connectors
function initThreeSystemsConnectors() {
  const connectors = document.querySelectorAll('.connector');
  const fitConnectors = document.getElementById('fitConnectors');

  gsap.utils.toArray(connectors).forEach((connector, index) => {
    gsap.to(connector, {
      opacity: 1,
      scrollTrigger: {
        trigger: '#systemShapes',
        start: 'top 60%',
      },
      delay: 0.5 + index * 0.3,
      onStart: () => {
        connector.classList.add('visible');
      }
    });
  });

  if (fitConnectors) {
    gsap.to(fitConnectors, {
      opacity: 1,
      scrollTrigger: {
        trigger: '#solutionPanel',
        start: 'top 60%',
      },
      delay: 0.5,
      onStart: () => {
        fitConnectors.style.display = 'block';
        fitConnectors.classList.add('visible');
      }
    });
  }
}

// Initialize glossary with search and flip cards
function initGlossary() {
  const glossaryGrid = document.getElementById('glossaryGrid');
  const searchInput = document.getElementById('glossarySearch');

  // Render glossary terms
  const renderTerms = (terms) => {
    glossaryGrid.innerHTML = terms.map(term => `
      <div class="term-card" data-term="${term.name.toLowerCase()}">
        <div class="term-front">
          <div class="term-name">${term.name}</div>
          <div class="term-category">${term.category}</div>
          <div class="term-definition">${term.definition}</div>
          <div class="term-example">${term.example}</div>
        </div>
      </div>
    `).join('');

    // Add click handlers for flip animation
    document.querySelectorAll('.term-card').forEach(card => {
      card.addEventListener('click', () => {
        card.classList.toggle('flipped');
      });
    });

    // Animate cards in
    gsap.from('.term-card', {
      opacity: 0,
      y: 20,
      duration: 0.4,
      stagger: 0.03
    });
  };

  // Initial render
  renderTerms(glossaryTerms);

  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = query
        ? glossaryTerms.filter(term =>
            term.name.toLowerCase().includes(query) ||
            term.definition.toLowerCase().includes(query) ||
            term.example.toLowerCase().includes(query)
          )
        : glossaryTerms;
      
      renderTerms(filtered);
    });
  }
}

// Initialize interactive elements
function initInteractiveElements() {
  // Improved tamper test for audit chain
  const tamperBtn = document.getElementById('tamperTest');
  const resetBtn = document.getElementById('resetChain');
  const tamperMessage = document.getElementById('tamperMessage');
  
  if (tamperBtn) {
    tamperBtn.addEventListener('click', () => {
      const block3 = document.querySelector('.audit-block[data-block="3"]');
      const block4 = document.querySelector('.audit-block[data-block="4"]');
      
      if (block3 && block4) {
        block3.classList.add('tampered');
        block3.querySelector('.block-content').textContent = 'Block 3: [TAMPERED]';
        
        setTimeout(() => {
          block4.classList.add('tampered');
          if (tamperMessage) {
            tamperMessage.style.display = 'flex';
          }
          if (resetBtn) {
            resetBtn.style.display = 'inline-block';
          }
        }, 500);
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const blocks = document.querySelectorAll('.audit-block');
      blocks.forEach(block => {
        block.classList.remove('tampered');
      });
      
      const block3 = document.querySelector('.audit-block[data-block="3"]');
      if (block3) {
        block3.querySelector('.block-content').textContent = 'Block 3: Controller approves';
      }
      
      if (tamperMessage) {
        tamperMessage.style.display = 'none';
      }
      resetBtn.style.display = 'none';
    });
  }

  // Smooth scroll for navigation
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// Export for debugging
window.jarvisExplainer = {
  glossaryTerms,
  initScrollAnimations,
  initPresentMode,
  initGlossary,
  initChallengeDefense,
  initThreeSystemsConnectors
};
