const cx = (...a) => a.filter(Boolean).join(' ');
/* =================================================================== data */
const R = {
  uk: {
    key: 'uk',
    org: 'Carrow Partners',
    orgMono: 'CP',
    orgDesc: 'Private equity, London',
    city: 'London',
    tz: 'Europe/London',
    office: 'LDN',
    me: { n: 'Master Mrin', r: 'Vice President' },
    team: ['James Morley', 'Ana Ruiz', 'Tom Hale'],
    peer: { n: 'James Morley', cell: 'F27' },
    cur: '£',
    unit: '£m',
    gaap: 'IFRS',
    fy: 'FY to 31 March',
    fyEnd: '31 March',
    exch: 'AIM',
    rate: 0.085,
    project: 'Project Kestrel',
    code: 'KST',
    runNo: 417,
    folder: 'Kestrel / Vult',
    style: 'Carrow house style v4',
    reviewer: 'R. Okafor, ACA',
    init: 'RO',
    target: 'Meridale Group plc',
    ticker: 'AIM: MRDL',
    short: 'Meridale',
    mono: 'MG',
    sector: 'Facilities-management software',
    type: 'Buy-side diligence',
    prompt:
      'Buy-side diligence on Meridale Group plc for a possible take-private. Full model with DCF and LBO, trading comps against UK and US peers, a competitor matrix, market sizing and an IC memo in our house style.',
    vdr: 'Kestrel data room, 412 files',
    periods: ['FY25A', 'FY26A', 'FY27E', 'FY28E', 'FY29E', 'FY30E', 'FY31E'],
    nAct: 2,
    rev: [162.4, 184.1],
    ebitda: [32.6, 39.8],
    da: [7.1, 8.2],
    growth: [0.125, 0.115, 0.105, 0.09, 0.08],
    margin: [0.225, 0.235, 0.245, 0.25, 0.255],
    daPct: 0.045,
    capexPct: 0.05,
    nwcPct: 0.08,
    taxRate: 0.25,
    wacc: 0.09,
    tgr: 0.025,
    netDebt: 46.8,
    ndLabel: 'Net debt incl. IFRS 16 leases',
    shares: 96.2,
    price: 468,
    pence: true,
    wk52: [382, 512],
    log: {
      f1: 'Companies House: 31 filings incl. accounts, confirmation statements and charges',
      f2: 'RNS: 64 announcements since Apr 2023, 6 results presentations',
      big: 'FY26 Annual Report: 212 pages → 4,812 data points',
      lease: 'US peers moved to an IFRS 16 basis (ASC 842 operating leases capitalised)',
      cal: 'Peers calendarised to a March year-end'
    },
    comps: [
      { n: 'Plantwise Holdings plc', s: 'Plantwise', c: 'UK', std: 'IFRS', ev: 640, evr: 2.6, g: 0.09, m: 0.225 },
      {
        n: 'Corvia Systems, Inc.',
        s: 'Corvia',
        c: 'US',
        std: 'US GAAP',
        ev: 2150,
        evr: 4.1,
        g: 0.16,
        m: 0.275,
        adj: true
      },
      {
        n: 'Stellan Workplace, Inc.',
        s: 'Stellan',
        c: 'US',
        std: 'US GAAP',
        ev: 1380,
        evr: 3.4,
        g: 0.12,
        m: 0.245,
        adj: true,
        lp: 1
      },
      { n: 'Brindle Estates Technology plc', s: 'Brindle', c: 'UK', std: 'IFRS', ev: 410, evr: 2.0, g: 0.06, m: 0.2 },
      {
        n: 'Quorra Technologies, Inc.',
        s: 'Quorra',
        c: 'US',
        std: 'US GAAP',
        ev: 3020,
        evr: 5.0,
        g: 0.21,
        m: 0.28,
        adj: true
      },
      { n: 'Fenmore Group plc', s: 'Fenmore', c: 'UK', std: 'IFRS', ev: 520, evr: 2.4, g: 0.08, m: 0.23, lp: 1 }
    ],
    leaseMult: 1.08,
    adjNote: 'US peers restated to an IFRS 16 basis so EBITDA multiples compare like for like.',
    matrix: {
      cols: [
        'Core offer',
        'Pricing model',
        'Mid-market fit',
        'Safety records (BSA 2022)',
        'US footprint',
        'Threat to Meridale'
      ],
      srcs: [
        'Meridale FY26 Annual Report',
        'Plantwise FY26 Annual Report',
        'Corvia Systems Form 10-K FY2025',
        'Stellan Workplace investor deck, Mar 2026',
        'Quorra Technologies Q2 2026 call transcript',
        'Vendor pricing pages, captured 8 Oct 2026',
        'Expert call: former FM director, UK housing association',
        'Software review sites, 1,240 reviews'
      ],
      rows: [
        {
          n: 'Meridale Group',
          m: 'MG',
          tg: true,
          doc: 0,
          x: 6.2,
          y: 8.4,
          sz: 184,
          c: [
            'CAFM and mobile-workforce suite',
            'Per site, £4k–£9k a year',
            'Core focus: sites with 50–2,000 staff',
            'Full digital record module',
            'Small, loss-making US unit',
            'Target'
          ]
        },
        {
          n: 'Plantwise',
          m: 'PW',
          doc: 1,
          x: 4.4,
          y: 7.4,
          sz: 150,
          c: [
            'CAFM for estates and education',
            'Per user, three tiers',
            'Strong in the public sector',
            'Partial: document vault only',
            'None',
            'Medium'
          ]
        },
        {
          n: 'Corvia Systems',
          m: 'CS',
          doc: 2,
          x: 7.8,
          y: 4.4,
          sz: 520,
          c: [
            'Broad IWMS platform',
            'Per sq ft, discounting in mid-market',
            'Moving down from enterprise',
            'Through a partner, launched 2026',
            'Market leader',
            'High'
          ]
        },
        {
          n: 'Stellan Workplace',
          m: 'SW',
          doc: 3,
          x: 6.7,
          y: 6.0,
          sz: 330,
          c: ['Space and workplace analytics', 'Per seat', 'Hybrid-work offices', 'Not offered', 'Strong', 'Medium']
        },
        {
          n: 'Quorra Technologies',
          m: 'QT',
          doc: 4,
          x: 8.4,
          y: 3.0,
          sz: 600,
          c: [
            'IoT-led building platform',
            'Platform fee plus sensors',
            'Large estates first',
            'Not offered',
            'Strong',
            'Medium'
          ]
        },
        {
          n: 'ERP suites',
          m: 'ER',
          doc: 6,
          x: 9.2,
          y: 1.5,
          sz: 900,
          left: true,
          c: [
            'FM modules inside ERP',
            'Bundled into enterprise deals',
            'Weak below 2,000 staff',
            'Basic records only',
            'Strong',
            'Low'
          ]
        }
      ]
    },
    industry: {
      title: 'UK and US facilities-management software',
      cagr: 0.098,
      base: 2026,
      tam: [9.4, 'All FM software and software-enabled services spend, UK and US'],
      sam: [2.1, 'Mid-market CAFM and IWMS, sites with 50 to 2,000 staff'],
      som: [0.31, 'Obtainable by FY31 at current win rates and sales capacity'],
      method: 'Bottom-up: in-scope sites × software spend per site, cross-checked top-down against peer revenue pools.',
      drivers: [
        ['up', 'Building Safety Act 2022: digital records for higher-risk buildings', 'High'],
        ['up', 'Carbon reporting: UK SECR and New York City Local Law 97', 'Medium'],
        ['up', 'Technician shortages push mobile-workforce automation', 'Medium'],
        ['down', 'Commercial property budgets squeezed by financing costs', 'Medium'],
        ['down', 'ERP suites bundling FM modules into enterprise deals', 'Low']
      ],
      forces: [
        ['Rivalry', 3],
        ['Buyer power', 2],
        ['Threat of new entrants', 2],
        ['Threat of substitutes', 1],
        ['Supplier power', 1]
      ]
    },
    company: {
      hq: 'Reading, UK',
      founded: '2004',
      staff: '1,420',
      listed: 'AIM, 2015',
      base: '3,900 sites',
      desc: 'Meridale sells facilities-management software to mid-sized property owners and service providers: maintenance scheduling, mobile workforce apps, space management and building-safety records. Most revenue is multi-year subscription.',
      kpis: [
        ['Revenue FY26', '£184.1m', '+13.4%', 'revA', 'pos'],
        ['Recurring revenue', '81%', '+3pp', 'k1', 'pos'],
        ['Adj. EBITDA margin', '21.6%', '+1.5pp', 'ebA', 'pos'],
        ['Net revenue retention', '108%', 'Data room', null, ''],
        ['Top-10 customers', '34%', 'of revenue', 'k2', 'neg'],
        ['Net debt / EBITDA', '1.2x', 'incl. leases', 'nd', '']
      ],
      seg: {
        names: ['UK and Ireland', 'North America'],
        years: ['FY22', 'FY23', 'FY24', 'FY25', 'FY26'],
        a: [104.8, 118.2, 131.9, 151.6, 171.5],
        b: [0, 2.1, 6.4, 10.8, 12.6]
      },
      bridge: {
        from: ['FY25', 162.4],
        steps: [
          ['Price', 5.1],
          ['Existing', 6.9],
          ['New sites', 12.8],
          ['Churn', -4.0],
          ['FX', 0.9]
        ],
        to: ['FY26', 184.1],
        base: 140
      },
      own: [
        ['Founder and management', 18.4],
        ['Harcourt Asset Management', 9.8],
        ['Lindqvist Capital', 7.2],
        ['Graydon Investors', 5.5],
        ['Other institutions and retail', 59.1]
      ],
      mgmt: [
        ['Helen Marsh', 'Chief Executive', '2019', 'Previously ran the UK arm of a listed property-software group'],
        [
          'David Okoro',
          'Chief Financial Officer',
          '2022',
          'Chartered accountant; former finance director of an AIM-listed software company'
        ],
        ['Priyanka Shah', 'Chief Product Officer', '2020', 'Built the mobile workforce module'],
        ['Mark Ellison', 'MD, North America', '2026', 'Joined in January after the previous MD left']
      ],
      events: [
        ['18 Jun 2026', 'FY26 results: revenue +13.4%, recurring share 81%', 'pos'],
        ['2 Apr 2026', 'Trading update in line; US pipeline slower', 'neu'],
        ['14 Jan 2026', 'New MD for North America appointed', 'neu'],
        ['18 Nov 2025', 'Capital markets day: FY29 EBITDA margin target of 25%+', 'pos'],
        ['9 Sep 2025', 'MD North America departs', 'neg']
      ],
      flags: [
        ['Customer concentration', 'Top 10 customers are 34% of revenue; three of them renew in FY28.', 'High', 'k2'],
        ['US losses', 'North America lost £4.1m of EBITDA in FY26 and is behind plan.', 'Medium', 'k3'],
        ['Leadership churn', 'Second North America MD in a year.', 'Low', null]
      ]
    },
    docs: [
      {
        id: 'ar26',
        t: 'Annual Report and Accounts FY26',
        who: 'Meridale Group plc',
        ty: 'Filing',
        f: 'pdf',
        src: 'Companies House',
        date: '24 Jul 2026',
        pages: '212 pages',
        cited: 41
      },
      {
        id: 'rns',
        t: 'Preliminary results FY26',
        who: 'Meridale Group plc',
        ty: 'Filing',
        f: 'pdf',
        src: 'RNS',
        date: '18 Jun 2026',
        pages: '24 pages',
        cited: 12
      },
      {
        id: 'cmd',
        t: 'Capital markets day presentation',
        who: 'Meridale Group plc',
        ty: 'Presentation',
        f: 'pdf',
        src: 'Company website',
        date: '18 Nov 2025',
        pages: '64 slides',
        cited: 9
      },
      {
        id: 'dr342',
        t: '3.4.2 Customer contracts schedule',
        who: 'Kestrel data room',
        ty: 'Data room',
        f: 'xls',
        src: 'Client data room',
        date: '2 Oct 2026',
        pages: '1,412 rows',
        cited: 6
      },
      {
        id: 'cor',
        t: 'Form 10-K FY2025',
        who: 'Corvia Systems, Inc.',
        ty: 'Filing',
        f: 'pdf',
        src: 'SEC EDGAR',
        date: '27 Feb 2026',
        pages: '132 pages',
        cited: 8
      },
      {
        id: 'price',
        t: 'Vendor pricing pages',
        who: '6 vendors',
        ty: 'Web',
        f: 'web',
        src: 'Captured by Vult',
        date: '8 Oct 2026',
        pages: '14 pages',
        cited: 11
      },
      {
        id: 'call',
        t: 'Expert call: former FM director',
        who: 'Licensed expert network',
        ty: 'Expert call',
        f: 'call',
        src: 'Transcript',
        date: '3 Oct 2026',
        pages: '52 min',
        cited: 5
      },
      {
        id: 'md',
        t: 'Prices and trading data',
        who: 'Licensed market data',
        ty: 'Market data',
        f: 'mkt',
        src: 'Data feed',
        date: '9 Oct 2026',
        pages: '7 tickers',
        cited: 14
      }
    ],
    pages: {
      'ar26.is': {
        p: 62,
        h: 'Financial statements',
        sub: 'Consolidated income statement',
        paras: [
          'For the year ended 31 March 2026. Adjusted measures exclude exceptional items and share-based payments; note 7 reconciles them to statutory profit.'
        ],
        cols: ['£000', 'FY26', 'FY25'],
        rows: [
          ['Revenue', '184,112', '162,418'],
          ['Cost of sales', '(61,207)', '(55,331)'],
          ['Gross profit', '122,905', '107,087', 1],
          ['Adjusted EBITDA', '39,812', '32,644'],
          ['Depreciation and amortisation', '(8,204)', '(7,096)'],
          ['Adjusted operating profit', '31,608', '25,548', 1]
        ]
      },
      'ar26.rev': {
        p: 88,
        h: 'Notes to the financial statements',
        sub: '4. Revenue',
        paras: [
          'Subscription and support revenue is recognised over the contract term; professional services as delivered. Subscription contracts typically run for three to five years.'
        ],
        cols: ['£000', 'FY26', 'FY25'],
        rows: [
          ['Subscription', '118,640', '101,204'],
          ['Support and maintenance', '30,512', '25,930'],
          ['Professional services', '34,960', '35,284'],
          ['Total revenue', '184,112', '162,418', 1]
        ]
      },
      'ar26.seg': {
        p: 91,
        h: 'Notes to the financial statements',
        sub: '5. Operating segments',
        paras: [
          'The Group reports two segments by geography. North America includes the US subsidiary acquired in 2022 and remains in an investment phase.'
        ],
        cols: ['£000', 'Revenue', 'Adj. EBITDA'],
        rows: [
          ['UK and Ireland', '171,480', '43,912'],
          ['North America', '12,632', '(4,100)'],
          ['Group', '184,112', '39,812', 1]
        ]
      },
      'ar26.bs': {
        p: 64,
        h: 'Financial statements',
        sub: 'Net debt',
        paras: [
          'Net debt includes lease liabilities recognised under IFRS 16. The £90m revolving credit facility matures in March 2029.'
        ],
        cols: ['£000', '31 Mar 2026', '31 Mar 2025'],
        rows: [
          ['Borrowings', '61,200', '68,400'],
          ['Lease liabilities', '12,300', '11,900'],
          ['Cash and cash equivalents', '(26,700)', '(28,000)'],
          ['Net debt incl. leases', '46,800', '52,300', 1]
        ]
      },
      'ar26.sh': {
        p: 140,
        h: 'Notes to the financial statements',
        sub: '24. Share capital',
        paras: ['Dilutive potential shares are calculated with the treasury stock method at the closing share price.'],
        cols: ['000s', '31 Mar 2026'],
        rows: [
          ['Ordinary shares in issue', '94,850'],
          ['Dilutive share options', '1,350'],
          ['Diluted shares', '96,200', 1]
        ]
      },
      'rns.p1': {
        p: 1,
        h: 'Regulatory announcement',
        sub: 'Preliminary results for the year ended 31 March 2026',
        paras: [
          'Revenue grew 13.4% to £184.1m, with recurring revenue rising to 81% of the total. The board recommends a final dividend of 4.2p per share.'
        ],
        cols: ['£m', 'FY26', 'FY25', 'Change'],
        rows: [
          ['Revenue', '184.1', '162.4', '+13.4%'],
          ['Recurring revenue share', '81%', '78%', '+3pp'],
          ['Adjusted EBITDA', '39.8', '32.6', '+22.1%'],
          ['Net debt incl. leases', '46.8', '52.3', '(5.5)']
        ]
      },
      'cmd.s22': {
        p: 'Slide 22',
        h: 'Capital markets day',
        sub: 'Mobile workforce: the margin lever',
        paras: [
          'New sites increasingly buy the mobile module at signing. Management expects the attach rate to rise as compliance work moves onto phones.'
        ],
        cols: ['', 'FY25', 'FY29 target'],
        rows: [
          ['Attach rate on new sites', '38%', '55%'],
          ['Module gross margin', '84%', '85%+'],
          ['Group EBITDA margin', '20.1%', '25%+']
        ]
      },
      'dr342.p1': {
        p: 'Sheet: Billings',
        h: 'Kestrel data room',
        sub: 'Customer billings, FY26',
        paras: ['Prepared by Meridale management for bidders. Customer names are anonymised in this version.'],
        cols: ['Customer', 'FY26 £000', 'Share'],
        rows: [
          ['Customer 01, housing association', '11,240', '6.1%'],
          ['Customer 02, NHS trust', '8,910', '4.8%'],
          ['Customer 03, university', '7,360', '4.0%'],
          ['Customer 04, retail estate', '6,830', '3.7%'],
          ['Customer 05, local authority', '6,120', '3.3%'],
          ['Customers 06–10', '22,506', '12.3%'],
          ['Top 10 total', '62,966', '34.2%', 1]
        ]
      },
      'cor.p1': {
        p: 58,
        h: 'Form 10-K, Item 7',
        sub: 'Mid-market strategy',
        paras: [
          'In 2026 we began serving mid-sized property owners through a partner channel in the United Kingdom, with pricing per square foot and introductory discounts for multi-year terms.'
        ],
        mark: 'introductory discounts for multi-year terms',
        cols: ['$m', 'FY2025', 'FY2024'],
        rows: [
          ['Total revenue', '612.4', '528.0'],
          ['Adjusted EBITDA', '168.4', '140.4'],
          ['Operating lease cost in opex', '14.2', '12.8']
        ]
      },
      'price.p1': {
        p: 'Snapshot',
        h: 'Vendor pricing pages',
        sub: 'List prices, mid-market tier',
        paras: ['Captured 8 Oct 2026 and stored with the run. Prices exclude VAT and implementation fees.'],
        cols: ['Vendor', 'Unit', 'List price'],
        rows: [
          ['Meridale', 'Per site, per year', '£4,000–£9,000'],
          ['Plantwise', 'Per user, per month', '£38–£95'],
          ['Corvia', 'Per sq ft, per year', '£0.21–£0.34'],
          ['Stellan', 'Per seat, per month', '£12–£22']
        ]
      },
      'call.p1': {
        p: 'Transcript',
        h: 'Expert call, 3 Oct 2026',
        sub: 'Former FM director, UK housing association',
        paras: [
          'Q: Why did you choose Meridale? A: The safety records module. After the Building Safety Act we needed a proper audit trail for every high-rise, and they were the only ones who had it ready.',
          'Q: Would you switch? A: Not easily. Our whole compliance history lives in it now.'
        ],
        mark: 'they were the only ones who had it ready'
      },
      'md.p1': {
        p: 'Feed',
        h: 'Licensed market data',
        sub: 'Meridale Group plc (AIM: MRDL)',
        paras: ['Prices at market close, 9 October 2026.'],
        cols: ['', 'Value'],
        rows: [
          ['Last close', '468.0p'],
          ['52-week high', '512.0p'],
          ['52-week low', '382.0p'],
          ['Average daily volume (3m)', '186k shares'],
          ['Free float', '81.6%']
        ]
      }
    },
    ev: {
      revA: {
        l: 'Revenue, FY26A',
        v: '£184.1m',
        pg: 'ar26.is',
        hl: [0],
        ex: 'Revenue 184,112 (£000, FY26 column)',
        rec: 'Matches the RNS preliminary results of 18 Jun 2026',
        used: [
          ['Model C4', 'model', 'C4'],
          ['Comps, target row', 'comps'],
          ['Company tear sheet', 'company']
        ]
      },
      revP: {
        l: 'Revenue, FY25A',
        v: '£162.4m',
        pg: 'ar26.is',
        hl: [0],
        ex: 'Revenue 162,418 (£000, FY25 comparative)',
        rec: 'Matches the FY25 Annual Report as first published',
        used: [['Model B4', 'model', 'B4']]
      },
      ebA: {
        l: 'Adjusted EBITDA, FY26A',
        v: '£39.8m',
        pg: 'ar26.is',
        hl: [3],
        ex: 'Adjusted EBITDA 39,812 (£000)',
        rec: 'Segments sum to it: 43,912 − 4,100',
        used: [
          ['Model C6', 'model', 'C6'],
          ['Company tear sheet', 'company']
        ]
      },
      ebP: {
        l: 'Adjusted EBITDA, FY25A',
        v: '£32.6m',
        pg: 'ar26.is',
        hl: [3],
        ex: 'Adjusted EBITDA 32,644 (£000)',
        rec: 'Matches the FY25 Annual Report',
        used: [['Model B6', 'model', 'B6']]
      },
      daA: {
        l: 'D&A, FY26A',
        v: '£8.2m',
        pg: 'ar26.is',
        hl: [4],
        ex: 'Depreciation and amortisation (8,204)',
        rec: 'Ties to the add-back in the cash flow statement',
        used: [['Model C7', 'model', 'C7']]
      },
      daP: {
        l: 'D&A, FY25A',
        v: '£7.1m',
        pg: 'ar26.is',
        hl: [4],
        ex: 'Depreciation and amortisation (7,096)',
        rec: 'Ties to the FY25 cash flow statement',
        used: [['Model B7', 'model', 'B7']]
      },
      nd: {
        l: 'Net debt incl. leases',
        v: '£46.8m',
        pg: 'ar26.bs',
        hl: [3],
        ex: 'Borrowings 61,200 + leases 12,300 − cash 26,700',
        rec: 'Cash ties to the closing balance in the cash flow statement',
        used: [
          ['Model B30', 'model', 'B30'],
          ['LBO sources and uses', 'model']
        ]
      },
      sh: {
        l: 'Diluted shares',
        v: '96.2m',
        pg: 'ar26.sh',
        hl: [2],
        ex: 'Diluted shares 96,200 (000s)',
        norm: 'Options added by the treasury method at 468p',
        rec: 'Matches the cap table in the data room',
        used: [['Model B32', 'model', 'B32']]
      },
      px: {
        l: 'Share price',
        v: '468p',
        pg: 'md.p1',
        hl: [0],
        ex: 'Last close 468.0p',
        norm: 'Quoted in pence; no conversion',
        rec: 'Cross-checked against a second price feed',
        used: [
          ['Model B34', 'model', 'B34'],
          ['Valuation summary', 'comps']
        ]
      },
      k1: {
        l: 'Recurring revenue share',
        v: '81%',
        pg: 'ar26.rev',
        hl: [0, 1],
        ex: 'Subscription 118,640 + support 30,512',
        norm: '149,152 ÷ 184,112 = 81.0%',
        rec: 'Matches the 81% stated in the RNS results',
        used: [
          ['IC memo, thesis', 'memo'],
          ['Company tear sheet', 'company']
        ]
      },
      k2: {
        l: 'Top-10 customer share',
        v: '34.2%',
        pg: 'dr342.p1',
        hl: [6],
        ex: 'Top-10 billings 62,966 of 184,112',
        norm: 'Data room figure, not public',
        rec: 'Reviewer confirmed it against the management Q&A log',
        flag: true,
        used: [
          ['IC memo, risks', 'memo'],
          ['Company red flags', 'company']
        ]
      },
      k3: {
        l: 'North America EBITDA, FY26',
        v: '(£4.1m)',
        pg: 'ar26.seg',
        hl: [1],
        ex: 'North America Adj. EBITDA (4,100)',
        rec: 'Segments sum to group EBITDA of 39,812',
        used: [
          ['IC memo, risks', 'memo'],
          ['Company red flags', 'company']
        ]
      },
      k4: {
        l: 'Mobile module attach rate',
        v: '38%',
        pg: 'cmd.s22',
        hl: [0],
        ex: 'Attach rate on new sites, 38% in FY25',
        norm: 'Management-reported KPI',
        rec: 'Consistent with the expert call of 3 Oct 2026',
        used: [['IC memo, thesis', 'memo']]
      },
      k5: {
        l: 'Corvia mid-market pricing',
        v: 'Discounted',
        pg: 'cor.p1',
        hl: [],
        ex: 'Introductory discounts for multi-year terms',
        norm: 'Qualitative disclosure',
        rec: 'Consistent with pricing pages captured 8 Oct 2026',
        used: [['Competitor matrix', 'compet']]
      }
    },
    memo: {
      to: 'Carrow Partners Investment Committee',
      thesis: [
        [
          'Compliance-led demand. Recurring revenue is 81% of the total',
          1,
          ', and building-safety record-keeping is now mandatory for higher-risk buildings.'
        ],
        [
          'Margin runway. EBITDA margin rises from {m0} in FY26A to {mN} by FY31E as the mobile-workforce module scales',
          2,
          '.'
        ],
        [
          'Discount to peers. The shares trade at {tev} NTM EBITDA against a peer median of {pmed}, with above-median growth',
          3,
          '.'
        ]
      ],
      risks: [
        [
          'Concentration. The top 10 customers are 34% of revenue, and three of those contracts renew in FY28',
          4,
          '.',
          'c1'
        ],
        ['US expansion loses money today: a £4.1m EBITDA loss in FY26', 5, '.', 'c2'],
        [
          'Process. As an AIM company, Meridale is subject to the Takeover Code. A leak would force an announcement and start a 28-day put-up-or-shut-up deadline',
          '',
          '.'
        ]
      ],
      sugg: ' In the downside case, losing one of those renewals cuts value to {down}.',
      plan: [
        'Customer calls on the top 10 accounts',
        'Contract review of the three FY28 renewals',
        'US unit economics by cohort from the data room'
      ],
      cites: ['k1', 'k4', 'comps', 'k2', 'k3']
    },
    comments: [
      {
        id: 'c1',
        who: 'James Morley',
        role: 'Partner',
        ago: '12m',
        text: 'Can we stress the three FY28 renewals in the downside case?',
        reply: 'Done. I suggested a sentence for the risk section: losing one renewal cuts value to {down}.'
      },
      {
        id: 'c2',
        who: 'Ana Ruiz',
        role: 'Associate',
        ago: '31m',
        text: 'Where does the £4.1m US loss come from?',
        reply: 'Segment note, FY26 Annual Report p.91. It is linked as source 5.'
      }
    ],
    engagements: [
      { k: 'main' },
      {
        n: 'Project Heron',
        t: 'Ashdown Leisure plc',
        ty: 'Sell-side preparation',
        s: 'run',
        p: 41,
        o: 'James Morley',
        u: '4m'
      },
      {
        n: 'Project Plover',
        t: 'Calder Rail Services',
        ty: 'Buy-side diligence',
        s: 'run',
        p: 78,
        o: 'Tom Hale',
        u: '1m'
      },
      {
        n: 'Project Larch',
        t: 'Brookvale Care Homes',
        ty: 'Credit memo',
        s: 'run',
        p: 12,
        o: 'Ana Ruiz',
        u: 'just now'
      },
      { n: 'Project Wren', t: 'Tamar Foods plc', ty: 'Earnings flash', s: 'rev', o: 'Master Mrin', u: '22m' },
      {
        n: 'Project Merlin',
        t: 'UK testing and inspection, 38 targets',
        ty: 'Sector screen',
        s: 'ok',
        o: 'James Morley',
        u: 'Yesterday'
      },
      {
        n: 'Project Linnet',
        t: 'Halcyon Dental Group',
        ty: 'Commercial diligence',
        s: 'ok',
        o: 'Ana Ruiz',
        u: 'Yesterday'
      },
      { n: 'Project Teal', t: 'Northgate Packaging plc', ty: 'Comps refresh', s: 'ok', o: 'Tom Hale', u: '8 Oct' },
      { n: 'Project Rook', t: 'Severn Water Technology', ty: 'IC memo', s: 'draft', o: 'Master Mrin', u: '7 Oct' }
    ]
  },
  us: {
    key: 'us',
    org: 'Hollis Street Capital',
    orgMono: 'HS',
    orgDesc: 'Growth equity, New York',
    city: 'New York',
    tz: 'America/New_York',
    office: 'NYC',
    me: { n: 'Master Mrin', r: 'Vice President' },
    team: ['Sarah Feld', 'Marcus Bell', 'Jen Ortiz'],
    peer: { n: 'Sarah Feld', cell: 'F27' },
    cur: '$',
    unit: '$m',
    gaap: 'US GAAP',
    fy: 'FY to 31 December',
    fyEnd: '31 December',
    exch: 'NYSE',
    rate: 0.085,
    project: 'Project Atlas',
    code: 'ATL',
    runNo: 922,
    folder: 'Atlas / Vult',
    style: 'Hollis Street house style v2',
    reviewer: 'D. Alvarez, CFA',
    init: 'DA',
    target: 'Pinecrest Payroll, Inc.',
    ticker: 'NYSE: PCRS',
    short: 'Pinecrest',
    mono: 'PP',
    sector: 'SMB payroll and HR software',
    type: 'Buy-side diligence',
    prompt:
      'Buy-side diligence on Pinecrest Payroll for a take-private. Three-statement model with DCF and LBO, trading comps, a competitor matrix, market sizing and an IC memo in our house style.',
    vdr: 'Atlas data room, 388 files',
    periods: ['FY24A', 'FY25A', 'FY26E', 'FY27E', 'FY28E', 'FY29E', 'FY30E'],
    nAct: 2,
    rev: [412.6, 468.9],
    ebitda: [99.0, 121.0],
    da: [20.2, 23.0],
    growth: [0.12, 0.11, 0.1, 0.09, 0.08],
    margin: [0.27, 0.28, 0.29, 0.295, 0.3],
    daPct: 0.05,
    capexPct: 0.04,
    nwcPct: 0.05,
    taxRate: 0.24,
    wacc: 0.095,
    tgr: 0.03,
    netDebt: 210.0,
    ndLabel: 'Net debt (excl. client fund assets)',
    shares: 58.4,
    price: 24.8,
    pence: false,
    wk52: [19.4, 27.9],
    log: {
      f1: 'SEC EDGAR: 10-K ×3, 10-Q ×7, 8-K ×22, DEF 14A ×2',
      f2: '12 earnings call transcripts, 2 investor day decks',
      big: 'FY2025 Form 10-K: 148 pages → 5,104 data points',
      lease: 'UK peer moved to an ASC 842 basis (IFRS 16 lease costs put back in opex)',
      cal: 'All peers on a December year-end; one June filer calendarised'
    },
    comps: [
      { n: 'Gridline HR, Inc.', s: 'Gridline', c: 'US', std: 'US GAAP', ev: 3900, evr: 4.6, g: 0.15, m: 0.31 },
      { n: 'Payvana Corp.', s: 'Payvana', c: 'US', std: 'US GAAP', ev: 2450, evr: 3.6, g: 0.11, m: 0.3, lp: 1 },
      { n: 'Norbury People plc', s: 'Norbury', c: 'UK', std: 'IFRS', ev: 1120, evr: 2.8, g: 0.08, m: 0.27, adj: true },
      { n: 'Tallis Workforce, Inc.', s: 'Tallis', c: 'US', std: 'US GAAP', ev: 5600, evr: 5.5, g: 0.19, m: 0.32 },
      {
        n: 'Keel & Co. Payroll, Inc.',
        s: 'Keel & Co.',
        c: 'US',
        std: 'US GAAP',
        ev: 1640,
        evr: 2.9,
        g: 0.07,
        m: 0.28,
        lp: 1
      },
      { n: 'Ostrander HCM, Inc.', s: 'Ostrander', c: 'US', std: 'US GAAP', ev: 2980, evr: 3.9, g: 0.13, m: 0.3 }
    ],
    leaseMult: 0.93,
    adjNote: 'The UK peer is restated to an ASC 842 basis so EBITDA multiples compare like for like.',
    matrix: {
      cols: ['Core offer', 'Pricing model', 'SMB fit', 'Multi-state tax', 'Benefits admin', 'Threat to Pinecrest'],
      srcs: [
        'Pinecrest Form 10-K FY2025',
        'Gridline HR Form 10-K FY2025',
        'Payvana Q2 2026 call transcript',
        'Tallis Workforce investor day, May 2026',
        'Keel & Co. product documentation',
        'Vendor pricing pages, captured 8 Oct 2026',
        'Expert call: former payroll sales leader',
        'Software review sites, 2,310 reviews'
      ],
      rows: [
        {
          n: 'Pinecrest Payroll',
          m: 'PP',
          tg: true,
          doc: 0,
          x: 5.8,
          y: 8.4,
          sz: 469,
          c: [
            'Payroll-led HR for SMBs',
            'Per employee, $6–$9 a month',
            'Core: 10–499 staff',
            'All 50 states, automated',
            'Partner-led, basic',
            'Target'
          ]
        },
        {
          n: 'Gridline HR',
          m: 'GH',
          doc: 1,
          x: 7.4,
          y: 6.0,
          sz: 850,
          c: [
            'All-in-one HR and payroll',
            'Bundles from $12 per employee',
            'Moving down-market',
            'All 50 states',
            'Native and strong',
            'High'
          ]
        },
        {
          n: 'Payvana',
          m: 'PV',
          doc: 2,
          x: 4.6,
          y: 7.0,
          sz: 680,
          c: [
            'Payroll with earned wage access',
            'Per employee plus EWA fees',
            'Hourly workforces',
            'Most states',
            'Basic',
            'Medium'
          ]
        },
        {
          n: 'Tallis Workforce',
          m: 'TW',
          doc: 3,
          x: 8.2,
          y: 4.6,
          sz: 1020,
          c: [
            'Enterprise HCM suite',
            'Custom contracts',
            'Launching an SMB tier',
            'All 50 states',
            'Native and strong',
            'High'
          ]
        },
        {
          n: 'Keel & Co.',
          m: 'KC',
          doc: 4,
          x: 3.0,
          y: 8.6,
          sz: 565,
          c: [
            'Accountant-sold payroll',
            'Flat fee per payroll run',
            'Micro businesses',
            'Limited states',
            'Not offered',
            'Low'
          ]
        },
        {
          n: 'HCM suites',
          m: 'HC',
          doc: 6,
          x: 9.2,
          y: 1.7,
          sz: 1600,
          left: true,
          c: [
            'Full HCM for large employers',
            'Enterprise licences',
            'Weak under 500 staff',
            'All 50 states',
            'Native',
            'Low'
          ]
        }
      ]
    },
    industry: {
      title: 'US SMB payroll and HR software',
      cagr: 0.086,
      base: 2026,
      tam: [24.0, 'All payroll and HR software spend by US businesses under 1,000 staff'],
      sam: [6.8, 'Payroll-led platforms for businesses with 10 to 499 staff'],
      som: [0.9, 'Obtainable by FY30 at current win rates and sales capacity'],
      method:
        'Bottom-up: employer counts by size band × attach rate × price per employee, cross-checked against peer revenue pools.',
      drivers: [
        ['up', 'State pay transparency laws, e.g. Colorado, California, New York', 'High'],
        ['up', 'More state paid-leave mandates add filing complexity', 'Medium'],
        ['up', 'Earned wage access adoption among hourly workers', 'Medium'],
        ['down', 'Lower short-term rates cut float income on client funds', 'High'],
        ['down', 'Payroll bundled into accounting and banking platforms', 'Medium']
      ],
      forces: [
        ['Rivalry', 3],
        ['Buyer power', 2],
        ['Threat of new entrants', 2],
        ['Threat of substitutes', 2],
        ['Supplier power', 1]
      ]
    },
    company: {
      hq: 'Columbus, Ohio',
      founded: '2009',
      staff: '2,860',
      listed: 'NYSE, 2019',
      base: '41,000 clients',
      desc: 'Pinecrest runs payroll, tax filing and HR for US businesses with 10 to 499 employees. It sells mainly through accounting firms and earns interest on client funds held between collection and payment.',
      kpis: [
        ['Revenue FY25', '$468.9m', '+13.6%', 'revA', 'pos'],
        ['Recurring revenue', '92%', '+1pp', 'k1', 'pos'],
        ['Adj. EBITDA margin', '25.8%', '+1.8pp', 'ebA', 'pos'],
        ['Rate sensitivity', '$21.0m', 'per 100bp', 'k2', 'neg'],
        ['New clients via accountants', '~40%', 'FY2025', 'k4', ''],
        ['Net debt / EBITDA', '1.7x', 'excl. client funds', 'nd', '']
      ],
      seg: {
        names: ['Payroll, tax and float', 'HR and benefits'],
        years: ['FY21', 'FY22', 'FY23', 'FY24', 'FY25'],
        a: [242.2, 279.5, 312.4, 350.3, 394.6],
        b: [28.8, 38.5, 48.6, 62.3, 74.3]
      },
      bridge: {
        from: ['FY24', 412.6],
        steps: [
          ['Price', 9.8],
          ['Headcount', 21.4],
          ['New clients', 30.2],
          ['Churn', -8.9],
          ['Float', 3.8]
        ],
        to: ['FY25', 468.9],
        base: 380
      },
      own: [
        ['Kessler Growth Partners', 14.6],
        ['Founders', 11.2],
        ['Marlowe Asset Management', 8.1],
        ['Tidewater Capital', 6.4],
        ['Other institutions and retail', 59.7]
      ],
      mgmt: [
        [
          'Laura Chen',
          'Chief Executive',
          '2016',
          'Co-founder; previously ran small-business payments at a regional bank'
        ],
        ['Michael Ruiz', 'Chief Financial Officer', '2021', 'Former treasurer of a listed HR software company'],
        ['Andre Wallace', 'Chief Technology Officer', '2023', 'Leading the tax-engine migration'],
        ['Nina Patel', 'Chief Revenue Officer', '2024', 'Built the accountant partner channel']
      ],
      events: [
        ['6 Aug 2026', 'Q2 results: revenue +12.8%, guidance held', 'pos'],
        ['14 May 2026', 'Investor day: 30% EBITDA margin target by FY30', 'pos'],
        ['26 Feb 2026', 'Q4 results; float income guided lower on rate cuts', 'neg'],
        ['10 Dec 2025', 'Gridline HR launches a bundled SMB tier', 'neg'],
        ['4 Nov 2025', 'Q3 results in line', 'neu']
      ],
      flags: [
        ['Rate sensitivity', 'Each 100bp cut in short-term rates removes about $21m of revenue.', 'High', 'k2'],
        ['Down-market competition', 'Gridline HR and Tallis now bundle benefits for small businesses.', 'Medium', 'k5'],
        ['Migration risk', 'Tax-engine migration is 70% complete; overruns are possible.', 'Low', 'k3']
      ]
    },
    docs: [
      {
        id: 'k25',
        t: 'Form 10-K FY2025',
        who: 'Pinecrest Payroll, Inc.',
        ty: 'Filing',
        f: 'pdf',
        src: 'SEC EDGAR',
        date: '26 Feb 2026',
        pages: '148 pages',
        cited: 44
      },
      {
        id: 'q2',
        t: 'Form 10-Q Q2 2026',
        who: 'Pinecrest Payroll, Inc.',
        ty: 'Filing',
        f: 'pdf',
        src: 'SEC EDGAR',
        date: '6 Aug 2026',
        pages: '52 pages',
        cited: 11
      },
      {
        id: 'ek',
        t: 'Form 8-K Ex. 99.1, Q4 2025 results',
        who: 'Pinecrest Payroll, Inc.',
        ty: 'Filing',
        f: 'pdf',
        src: 'SEC EDGAR',
        date: '26 Feb 2026',
        pages: '14 pages',
        cited: 7
      },
      {
        id: 'tr',
        t: 'Q2 2026 earnings call transcript',
        who: 'Pinecrest Payroll, Inc.',
        ty: 'Transcript',
        f: 'call',
        src: 'Licensed transcripts',
        date: '6 Aug 2026',
        pages: '61 min',
        cited: 9
      },
      {
        id: 'grid',
        t: 'Form 10-K FY2025',
        who: 'Gridline HR, Inc.',
        ty: 'Filing',
        f: 'pdf',
        src: 'SEC EDGAR',
        date: '3 Mar 2026',
        pages: '126 pages',
        cited: 6
      },
      {
        id: 'price',
        t: 'Vendor pricing pages',
        who: '6 vendors',
        ty: 'Web',
        f: 'web',
        src: 'Captured by Vult',
        date: '8 Oct 2026',
        pages: '12 pages',
        cited: 10
      },
      {
        id: 'call',
        t: 'Expert call: former payroll sales leader',
        who: 'Licensed expert network',
        ty: 'Expert call',
        f: 'call',
        src: 'Transcript',
        date: '1 Oct 2026',
        pages: '47 min',
        cited: 4
      },
      {
        id: 'md',
        t: 'Prices and trading data',
        who: 'Licensed market data',
        ty: 'Market data',
        f: 'mkt',
        src: 'Data feed',
        date: '9 Oct 2026',
        pages: '7 tickers',
        cited: 13
      }
    ],
    pages: {
      'k25.is': {
        p: 71,
        h: 'Item 8, Financial statements',
        sub: 'Consolidated statements of operations',
        paras: [
          'Adjusted EBITDA is a non-GAAP measure; Item 7 reconciles it to net income. Interest earned on client funds is reported within revenue.'
        ],
        cols: ['$000', 'FY2025', 'FY2024'],
        rows: [
          ['Total revenues', '468,907', '412,571'],
          ['Cost of revenues', '(150,050)', '(135,320)'],
          ['Gross profit', '318,857', '277,251', 1],
          ['Adjusted EBITDA', '120,995', '98,990'],
          ['Depreciation and amortization', '(22,980)', '(20,190)'],
          ['Adjusted operating income', '98,015', '78,800', 1]
        ]
      },
      'k25.rev': {
        p: 74,
        h: 'Notes to the financial statements',
        sub: 'Note 3. Revenue disaggregation',
        paras: ['Recurring revenue comprises payroll, tax filing and HR subscriptions billed per employee per month.'],
        cols: ['$000', 'FY2025', 'FY2024'],
        rows: [
          ['Payroll and tax filing', '356,820', '318,640'],
          ['HR and benefits administration', '74,317', '62,251'],
          ['Interest on client funds', '37,770', '31,680'],
          ['Total revenues', '468,907', '412,571', 1]
        ]
      },
      'k25.mr': {
        p: 58,
        h: 'Item 7A',
        sub: 'Market risk disclosures',
        paras: [
          'We invest client funds in high-quality, short-duration instruments. A decline in short-term interest rates reduces the interest we earn on these funds.'
        ],
        cols: ['$000', 'FY2025'],
        rows: [
          ['Average daily client funds', '2,104,000'],
          ['Interest earned on client funds', '37,770'],
          ['Effect of a 100bp decrease in rates', '(21,040)']
        ]
      },
      'k25.biz': {
        p: 9,
        h: 'Item 1, Business',
        sub: 'Distribution',
        paras: [
          'We reach most new clients through accounting firm partners, who recommend and often run payroll for their small-business clients. In 2025, approximately 40% of new clients were referred by accounting firm partners.'
        ],
        mark: 'approximately 40% of new clients were referred by accounting firm partners',
        cols: ['Share of new clients', 'FY2025'],
        rows: [
          ['Accounting firm partners', '40%'],
          ['Direct and digital', '34%'],
          ['Marketplaces and other partners', '26%']
        ]
      },
      'q2.bs': {
        p: 4,
        h: 'Form 10-Q, Balance sheet',
        sub: 'Net debt',
        paras: ['Funds held for clients are restricted and excluded from net debt.'],
        cols: ['$000', '30 Jun 2026'],
        rows: [
          ['Term loan', '395,000'],
          ['Corporate cash and equivalents', '(185,000)'],
          ['Net debt', '210,000', 1],
          ['Funds held for clients (excluded)', '2,231,400']
        ]
      },
      'q2.sh': {
        p: 'Note 12',
        h: 'Form 10-Q, Notes',
        sub: 'Earnings per share',
        paras: ['Diluted shares include RSUs and options under the treasury stock method.'],
        cols: ['000s', 'Q2 2026'],
        rows: [
          ['Class A shares outstanding', '57,050'],
          ['Dilutive RSUs and options', '1,350'],
          ['Diluted shares', '58,400', 1]
        ]
      },
      'ek.p1': {
        p: 1,
        h: 'Form 8-K, Exhibit 99.1',
        sub: 'Fourth quarter and full year 2025 results',
        paras: [
          'Full-year revenue grew 13.6% to $468.9 million. Adjusted EBITDA margin expanded 180 basis points to 25.8%.'
        ],
        cols: ['$m', 'FY2025', 'FY2024', 'Change'],
        rows: [
          ['Total revenues', '468.9', '412.6', '+13.6%'],
          ['Adjusted EBITDA', '121.0', '99.0', '+22.2%'],
          ['Recurring revenue share', '92%', '91%', '+1pp']
        ]
      },
      'tr.p1': {
        p: 'Transcript',
        h: 'Q2 2026 earnings call, 6 Aug 2026',
        sub: 'Chief Financial Officer, prepared remarks',
        paras: [
          'We are now about 70% through the tax-engine migration and expect to finish by the end of the year. Once the old engine is retired we take out roughly $9 million of annual run costs.'
        ],
        mark: 'about 70% through the tax-engine migration'
      },
      'grid.p1': {
        p: 12,
        h: 'Form 10-K, Item 1',
        sub: 'Products',
        paras: [
          'In December 2025 we launched a bundled tier for businesses with fewer than 500 employees, combining payroll, benefits and time tracking from $12 per employee per month.'
        ],
        mark: 'from $12 per employee per month',
        cols: ['$m', 'FY2025', 'FY2024'],
        rows: [
          ['Total revenue', '847.8', '737.2'],
          ['Adjusted EBITDA', '262.8', '221.2']
        ]
      },
      'price.p1': {
        p: 'Snapshot',
        h: 'Vendor pricing pages',
        sub: 'List prices, small-business tier',
        paras: ['Captured 8 Oct 2026 and stored with the run. Prices exclude implementation fees.'],
        cols: ['Vendor', 'Unit', 'List price'],
        rows: [
          ['Pinecrest', 'Per employee, per month', '$6–$9'],
          ['Gridline HR', 'Per employee, per month', 'From $12'],
          ['Payvana', 'Per employee + EWA fees', '$5 + fees'],
          ['Keel & Co.', 'Per payroll run', '$45 flat']
        ]
      },
      'call.p1': {
        p: 'Transcript',
        h: 'Expert call, 1 Oct 2026',
        sub: 'Former payroll sales leader',
        paras: [
          'Q: Where does Pinecrest win? A: With accountants. The accountant picks the payroll vendor for maybe two hundred clients at once, and Pinecrest built the best tools for them.',
          'Q: And where does it lose? A: When the client wants benefits too. Gridline bundles it cheaper now.'
        ],
        mark: 'Pinecrest built the best tools for them'
      },
      'md.p1': {
        p: 'Feed',
        h: 'Licensed market data',
        sub: 'Pinecrest Payroll, Inc. (NYSE: PCRS)',
        paras: ['Prices at market close, 9 October 2026.'],
        cols: ['', 'Value'],
        rows: [
          ['Last close', '$24.80'],
          ['52-week high', '$27.90'],
          ['52-week low', '$19.40'],
          ['Average daily volume (3m)', '1.12m shares'],
          ['Free float', '88.8%']
        ]
      }
    },
    ev: {
      revA: {
        l: 'Revenue, FY25A',
        v: '$468.9m',
        pg: 'k25.is',
        hl: [0],
        ex: 'Total revenues 468,907 ($000, FY2025)',
        rec: 'Matches the Q4 2025 earnings release (8-K, Ex. 99.1)',
        used: [
          ['Model C4', 'model', 'C4'],
          ['Comps, target row', 'comps'],
          ['Company tear sheet', 'company']
        ]
      },
      revP: {
        l: 'Revenue, FY24A',
        v: '$412.6m',
        pg: 'k25.is',
        hl: [0],
        ex: 'Total revenues 412,571 ($000, FY2024 comparative)',
        rec: 'Matches the FY2024 10-K as first filed',
        used: [['Model B4', 'model', 'B4']]
      },
      ebA: {
        l: 'Adjusted EBITDA, FY25A',
        v: '$121.0m',
        pg: 'k25.is',
        hl: [3],
        ex: 'Adjusted EBITDA 120,995 ($000)',
        rec: 'Reconciled to net income in Item 7',
        used: [
          ['Model C6', 'model', 'C6'],
          ['Company tear sheet', 'company']
        ]
      },
      ebP: {
        l: 'Adjusted EBITDA, FY24A',
        v: '$99.0m',
        pg: 'k25.is',
        hl: [3],
        ex: 'Adjusted EBITDA 98,990 ($000)',
        rec: 'Matches the FY2024 10-K',
        used: [['Model B6', 'model', 'B6']]
      },
      daA: {
        l: 'D&A, FY25A',
        v: '$23.0m',
        pg: 'k25.is',
        hl: [4],
        ex: 'Depreciation and amortization (22,980)',
        rec: 'Ties to the cash flow statement',
        used: [['Model C7', 'model', 'C7']]
      },
      daP: {
        l: 'D&A, FY24A',
        v: '$20.2m',
        pg: 'k25.is',
        hl: [4],
        ex: 'Depreciation and amortization (20,190)',
        rec: 'Ties to the FY2024 cash flow statement',
        used: [['Model B7', 'model', 'B7']]
      },
      nd: {
        l: 'Net debt',
        v: '$210.0m',
        pg: 'q2.bs',
        hl: [2],
        ex: 'Term loan 395,000 − corporate cash 185,000',
        rec: 'Client fund assets excluded and matched to the restricted cash note',
        used: [
          ['Model B30', 'model', 'B30'],
          ['LBO sources and uses', 'model']
        ]
      },
      sh: {
        l: 'Diluted shares',
        v: '58.4m',
        pg: 'q2.sh',
        hl: [2],
        ex: 'Diluted shares 58,400 (000s)',
        norm: 'RSUs and options by the treasury method at $24.80',
        rec: 'Matches the 10-Q cover page share count plus dilution',
        used: [['Model B32', 'model', 'B32']]
      },
      px: {
        l: 'Share price',
        v: '$24.80',
        pg: 'md.p1',
        hl: [0],
        ex: 'Last close $24.80',
        norm: 'No conversion needed',
        rec: 'Cross-checked against a second price feed',
        used: [
          ['Model B34', 'model', 'B34'],
          ['Valuation summary', 'comps']
        ]
      },
      k1: {
        l: 'Recurring revenue share',
        v: '92%',
        pg: 'k25.rev',
        hl: [0, 1],
        ex: 'Payroll and tax 356,820 + HR and benefits 74,317',
        norm: '431,137 ÷ 468,907 = 91.9%',
        rec: 'Matches the 92% in the Q4 earnings release',
        used: [['Company tear sheet', 'company']]
      },
      k2: {
        l: 'Revenue lost per 100bp rate cut',
        v: '$21.0m',
        pg: 'k25.mr',
        hl: [2],
        ex: 'Effect of a 100bp decrease in rates (21,040)',
        norm: '$000 → $m',
        rec: 'Consistent with management comments on the Q2 2026 call',
        used: [
          ['IC memo, risks', 'memo'],
          ['Company red flags', 'company']
        ]
      },
      k3: {
        l: 'Tax-engine migration progress',
        v: '70%',
        pg: 'tr.p1',
        hl: [],
        ex: 'About 70% through the tax-engine migration',
        norm: 'Management statement, not audited',
        rec: 'Consistent with capex disclosures in the 10-Q',
        flag: true,
        used: [['IC memo, thesis', 'memo']]
      },
      k4: {
        l: 'New clients via accountants',
        v: '~40%',
        pg: 'k25.biz',
        hl: [0],
        ex: 'Approximately 40% of new clients referred by accounting firm partners',
        norm: 'Management-reported, unaudited',
        rec: 'Consistent with the expert call of 1 Oct 2026',
        flag: true,
        used: [
          ['IC memo, thesis', 'memo'],
          ['Company tear sheet', 'company']
        ]
      },
      k5: {
        l: 'Gridline bundled SMB price',
        v: 'From $12',
        pg: 'grid.p1',
        hl: [],
        ex: 'Bundled tier from $12 per employee per month',
        norm: 'List price; discounts not disclosed',
        rec: 'Matches the pricing page captured 8 Oct 2026',
        used: [
          ['IC memo, risks', 'memo'],
          ['Competitor matrix', 'compet']
        ]
      }
    },
    memo: {
      to: 'Hollis Street Capital Investment Committee',
      thesis: [
        ['Sticky, accountant-led distribution. About 40% of new clients arrive through accounting firms', 1, '.'],
        [
          'Margin runway. EBITDA margin rises from {m0} in FY25A to {mN} by FY30E as the tax-filing engine migration completes',
          2,
          '.'
        ],
        ['Discount to peers. The shares trade at {tev} NTM EBITDA against a peer median of {pmed}', 3, '.']
      ],
      risks: [
        [
          'Float income. Client funds average $2.1bn, so each 100bp fall in short-term rates cuts annual revenue by about $21m',
          4,
          '.',
          'c1'
        ],
        ['Down-market push from Gridline HR and Tallis with bundled benefits', 5, '.', 'c2'],
        ['Process. A take-private needs an HSR filing, and the merger agreement may include a go-shop period', '', '.']
      ],
      sugg: ' The downside case assumes 150bp of cuts and gives {down}.',
      plan: [
        'Retention by acquisition channel, from the data room',
        'Float sensitivity with the treasury team',
        'Status and cost to complete of the tax-engine migration'
      ],
      cites: ['k4', 'k3', 'comps', 'k2', 'k5']
    },
    comments: [
      {
        id: 'c1',
        who: 'Sarah Feld',
        role: 'Partner',
        ago: '9m',
        text: 'How sensitive is this to rate cuts?',
        reply: 'Each 100bp cut is about $21m of revenue. I suggested a sentence: the downside case gives {down}.'
      },
      {
        id: 'c2',
        who: 'Marcus Bell',
        role: 'Associate',
        ago: '27m',
        text: 'Do we have pricing for Gridline’s bundle?',
        reply: 'Yes, from their 10-K and the pricing page captured on 8 Oct 2026. Linked as source 5.'
      }
    ],
    engagements: [
      { k: 'main' },
      {
        n: 'Project Summit',
        t: 'Bramblewood Pet Health',
        ty: 'Sell-side preparation',
        s: 'run',
        p: 55,
        o: 'Sarah Feld',
        u: '2m'
      },
      { n: 'Project Sable', t: 'Crestview Logistics', ty: 'LBO model', s: 'run', p: 64, o: 'Jen Ortiz', u: 'just now' },
      {
        n: 'Project Cedar',
        t: 'Kestle Industrial Supply',
        ty: 'Credit memo',
        s: 'run',
        p: 22,
        o: 'Marcus Bell',
        u: '6m'
      },
      { n: 'Project Mesa', t: 'Orion Field Services', ty: 'Earnings flash', s: 'rev', o: 'Master Mrin', u: '18m' },
      {
        n: 'Project Ridge',
        t: 'Vertical SaaS, 52 targets',
        ty: 'Sector screen',
        s: 'ok',
        o: 'Sarah Feld',
        u: 'Yesterday'
      },
      {
        n: 'Project Delta',
        t: 'Harborside Urgent Care',
        ty: 'Commercial diligence',
        s: 'ok',
        o: 'Marcus Bell',
        u: 'Yesterday'
      },
      { n: 'Project Juniper', t: 'Tolland Water Systems', ty: 'Comps refresh', s: 'ok', o: 'Jen Ortiz', u: '8 Oct' },
      { n: 'Project Arbor', t: 'Wexford Insurance Brokers', ty: 'IC memo', s: 'draft', o: 'Master Mrin', u: '6 Oct' }
    ]
  }
};

const DELIV = [
  { k: '3s', n: 'Three-statement model', tr: 'model', min: 25, gbp: 1700, usd: 2150 },
  { k: 'dcf', n: 'DCF valuation', tr: 'model', min: 10, gbp: 700, usd: 850 },
  { k: 'lbo', n: 'LBO model', tr: 'model', min: 15, gbp: 1800, usd: 2300 },
  { k: 'comps', n: 'Trading comps', tr: 'an', min: 20, gbp: 950, usd: 1200 },
  { k: 'compet', n: 'Competitor matrix', tr: 'an', min: 30, gbp: 1600, usd: 2000 },
  { k: 'industry', n: 'Market sizing', tr: 'an', min: 35, gbp: 1900, usd: 2400 },
  { k: 'memo', n: 'IC memo', tr: 'write', min: 22, gbp: 900, usd: 1150 },
  { k: 'pitch', n: 'Pitch book pages', tr: 'write', min: 8, gbp: 800, usd: 1000 }
];
const ALL = DELIV.map(x => x.k);
const PACK = { uk: 6500, us: 8200 };
const SCEN = {
  base: { g: 0, m: 0, l: 'Base' },
  upside: { g: 0.02, m: 0.015, l: 'Upside' },
  downside: { g: -0.025, m: -0.02, l: 'Downside' }
};
const TEMPLATES = [
  { i: 'briefcase', n: 'Take-private diligence', d: 'Model, comps, market, memo', sel: ALL, p: d => d.prompt },
  {
    i: 'slides',
    n: 'Sell-side pitch',
    d: 'Comps, DCF, buyer pages',
    sel: ['3s', 'dcf', 'comps', 'pitch'],
    p: d =>
      `Pitch pages for a sale of ${d.target}: situation overview, trading comps, a DCF and a buyer universe in the client template.`
  },
  {
    i: 'shield',
    n: 'Credit memo',
    d: 'Debt capacity, downside',
    sel: ['3s', 'lbo', 'comps', 'memo'],
    p: d =>
      `Credit memo on ${d.target}: three-statement model, debt capacity, covenant headroom, LBO downside cases and a lender-ready memo.`
  },
  {
    i: 'grid',
    n: 'Sector screen',
    d: 'Market, competitors, comps',
    sel: ['comps', 'compet', 'industry'],
    p: d =>
      `Screen ${d.sector.toLowerCase()} across the UK and US: market size, a competitor matrix and trading comps for every listed name.`
  }
];
const PEOPLE_H = {
  'Master Mrin': 214,
  'James Morley': 205,
  'Ana Ruiz': 330,
  'Tom Hale': 150,
  'Sarah Feld': 10,
  'Marcus Bell': 180,
  'Jen Ortiz': 290,
  'R. Okafor, ACA': 120,
  'D. Alvarez, CFA': 40
};
const TABS = [
  ['run', 'Run', 'network'],
  ['company', 'Company', 'building'],
  ['model', 'Model', 'sheet'],
  ['comps', 'Comps', 'scatter'],
  ['compet', 'Competitors', 'grid'],
  ['market', 'Market', 'globe'],
  ['memo', 'IC memo', 'file'],
  ['deck', 'Deck', 'slides'],
  ['sources', 'Sources', 'book'],
  ['delivery', 'Delivery', 'shield']
];
const GKEYS = {
  h: ['home'],
  e: ['engagements'],
  p: ['platform'],
  r: ['engagement', 'run'],
  c: ['engagement', 'company'],
  m: ['engagement', 'model'],
  v: ['engagement', 'comps'],
  x: ['engagement', 'compet'],
  k: ['engagement', 'market'],
  d: ['engagement', 'memo'],
  s: ['engagement', 'sources'],
  l: ['engagement', 'delivery']
};

/* =================================================================== format */
const nf1 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const fm = v => (v == null || isNaN(v) ? '' : v < 0 ? '(' + nf1.format(-v) + ')' : nf1.format(v));
const fp = (v, dp = 1) =>
  v == null || isNaN(v) ? '' : v < 0 ? '(' + (-v * 100).toFixed(dp) + '%)' : (v * 100).toFixed(dp) + '%';
const fpS = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
const fx = v => v.toFixed(1) + 'x';
const money = (d, v) => d.cur + nf0.format(v);
const sharePx = (d, v) => (d.pence ? nf0.format(v) + 'p' : '$' + v.toFixed(2));
const sheetPx = (d, v) => (d.pence ? nf0.format(v) : v.toFixed(2));
const hm = m => {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60),
    mm = m % 60;
  return h ? `${h}h ${String(mm).padStart(2, '0')}m` : `${mm}m`;
};
const clk = m => {
  const s = Math.max(0, Math.round(m * 60));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(x => String(x).padStart(2, '0')).join(':');
};
const tzTime = (d, date) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: d.tz, hour: '2-digit', minute: '2-digit' }).format(date);
  } catch (e) {
    return date.toTimeString().slice(0, 5);
  }
};
const tzHour = d => {
  try {
    return +new Intl.DateTimeFormat('en-GB', { timeZone: d.tz, hour: '2-digit', hour12: false }).format(new Date());
  } catch (e) {
    return new Date().getHours();
  }
};
const clamp01 = v => Math.max(0, Math.min(1, v));
const initials = n =>
  n
    .replace(/,.*$/, '')
    .split(/[\s.]+/)
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
const median = a => {
  const s = [...a].sort((x, y) => x - y),
    n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const pctile = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * p,
    lo = Math.floor(i),
    hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =================================================================== model */
function calc(d, sc, wacc, tgr) {
  const A = SCEN[sc],
    P = d.periods.length,
    na = d.nAct,
    z = () => Array(P).fill(null);
  const o = {
    rev: z(),
    g: z(),
    m: z(),
    eb: z(),
    da: z(),
    ebit: z(),
    tax: z(),
    capex: z(),
    nwc: z(),
    fcf: z(),
    per: z(),
    df: z(),
    pv: z()
  };
  for (let i = 0; i < na; i++) {
    o.rev[i] = d.rev[i];
    o.eb[i] = d.ebitda[i];
    o.da[i] = d.da[i];
    o.m[i] = o.eb[i] / o.rev[i];
    if (i) o.g[i] = o.rev[i] / o.rev[i - 1] - 1;
    o.ebit[i] = o.eb[i] - o.da[i];
  }
  for (let j = 0; j < P - na; j++) {
    const i = na + j;
    o.g[i] = d.growth[j] + A.g;
    o.m[i] = d.margin[j] + A.m;
    o.rev[i] = o.rev[i - 1] * (1 + o.g[i]);
    o.eb[i] = o.rev[i] * o.m[i];
    o.da[i] = o.rev[i] * d.daPct;
    o.ebit[i] = o.eb[i] - o.da[i];
    o.tax[i] = -o.ebit[i] * d.taxRate;
    o.capex[i] = -o.rev[i] * d.capexPct;
    o.nwc[i] = -(o.rev[i] - o.rev[i - 1]) * d.nwcPct;
    o.fcf[i] = o.ebit[i] + o.tax[i] + o.da[i] + o.capex[i] + o.nwc[i];
    o.per[i] = j + 0.5;
    o.df[i] = 1 / Math.pow(1 + wacc, o.per[i]);
    o.pv[i] = o.fcf[i] * o.df[i];
  }
  const L = P - 1;
  o.sumPV = o.pv.reduce((s, v) => s + (v || 0), 0);
  o.tv = (o.fcf[L] * (1 + tgr)) / (wacc - tgr);
  o.pvtv = o.tv / Math.pow(1 + wacc, o.per[L] + 0.5);
  o.ev = o.sumPV + o.pvtv;
  o.eq = o.ev - d.netDebt;
  o.vps = (o.eq / d.shares) * (d.pence ? 100 : 1);
  o.up = o.vps / d.price - 1;
  o.evE = o.ev / o.eb[na];
  return o;
}
const marketEV = d => (d.price * d.shares) / (d.pence ? 100 : 1) + d.netDebt;
const perShareFromEV = (d, ev) => ((ev - d.netDebt) / d.shares) * (d.pence ? 100 : 1);
const COLS = 'ABCDEFGH';
const EVCELL = { B4: 'revP', C4: 'revA', B6: 'ebP', C6: 'ebA', B7: 'daP', C7: 'daA', B30: 'nd', B32: 'sh', B34: 'px' };
function sheetCells(d, m) {
  const o = calc(d, m.scen, m.wacc, m.tgr),
    C = {},
    na = d.nAct,
    P = d.periods.length,
    L = i => COLS[i + 1],
    set = (a, v) => {
      C[a] = v;
    };
  set('A1', { v: `${d.target}: DCF in ${d.unit} unless stated, ${d.fy}`, c: 'ttl', span: 8, k: 'label', f: '' });
  set('A2', { v: d.unit, c: 'hd lb', k: 'label', f: d.unit });
  d.periods.forEach((p, i) => set(L(i) + '2', { v: p, c: 'hd', k: 'label', f: p }));
  const lbl = {
    3: 'Revenue growth',
    4: 'Revenue',
    5: 'EBITDA margin',
    6: 'EBITDA',
    7: 'D&A',
    8: 'EBIT',
    9: 'Tax on EBIT',
    10: 'Capex',
    11: 'Change in working capital',
    12: 'Unlevered free cash flow',
    13: 'Discount period (mid-year)',
    14: 'Discount factor',
    15: 'PV of free cash flow'
  };
  Object.entries(lbl).forEach(([r, l]) =>
    set('A' + r, { v: l, c: cx('lb', r == 12 && 'hd', (r == 3 || r == 5) && 'it'), k: 'label', f: l })
  );
  for (let i = 0; i < P; i++) {
    const c = L(i),
      pc = i ? L(i - 1) : null,
      act = i < na;
    if (o.g[i] != null)
      set(
        c + '3',
        act
          ? { v: fp(o.g[i]), c: 'it', k: 'calc', f: `=${c}4/${pc}4-1` }
          : {
              v: fp(o.g[i]),
              c: 'in',
              k: 'in',
              f: (o.g[i] * 100).toFixed(1) + '%',
              note: `${SCEN[m.scen].l} case. Built bottom-up from order book, pipeline and win rates.`
            }
      );
    set(
      c + '4',
      act
        ? { v: fm(o.rev[i]), c: 'lk', k: 'lk', f: `='Hist IS'!${c}12` }
        : { v: fm(o.rev[i]), k: 'calc', f: `=${pc}4*(1+${c}3)` }
    );
    set(
      c + '5',
      act
        ? { v: fp(o.m[i]), c: 'it', k: 'calc', f: `=${c}6/${c}4` }
        : {
            v: fp(o.m[i]),
            c: 'in',
            k: 'in',
            f: (o.m[i] * 100).toFixed(1) + '%',
            note: `${SCEN[m.scen].l} case. Mix shift to higher-margin modules, per segment disclosures.`
          }
    );
    set(
      c + '6',
      act
        ? { v: fm(o.eb[i]), c: 'lk', k: 'lk', f: `='Hist IS'!${c}24` }
        : { v: fm(o.eb[i]), k: 'calc', f: `=${c}4*${c}5` }
    );
    set(
      c + '7',
      act
        ? { v: fm(o.da[i]), c: 'lk', k: 'lk', f: `='Hist IS'!${c}19` }
        : { v: fm(o.da[i]), k: 'calc', f: `=${c}4*$B$18` }
    );
    set(c + '8', { v: fm(o.ebit[i]), k: 'calc', f: `=${c}6-${c}7` });
    if (!act) {
      set(c + '9', { v: fm(o.tax[i]), k: 'calc', f: `=-${c}8*$B$21` });
      set(c + '10', { v: fm(o.capex[i]), k: 'calc', f: `=-${c}4*$B$19` });
      set(c + '11', { v: fm(o.nwc[i]), k: 'calc', f: `=-(${c}4-${pc}4)*$B$20` });
      set(c + '12', { v: fm(o.fcf[i]), c: 'tot', k: 'calc', f: `=${c}8+${c}9+${c}7+${c}10+${c}11` });
      set(
        c + '13',
        i === na
          ? {
              v: '0.50',
              c: 'in',
              k: 'in',
              f: '0.5',
              note: 'Valuation date at the start of the first forecast year; cash arrives mid-year.'
            }
          : { v: o.per[i].toFixed(2), k: 'calc', f: `=${pc}13+1` }
      );
      set(c + '14', { v: o.df[i].toFixed(3), k: 'calc', f: `=1/(1+$B$22)^${c}13` });
      set(c + '15', { v: fm(o.pv[i]), k: 'calc', f: `=${c}12*${c}14` });
    }
  }
  set('A17', { v: 'Assumptions', c: 'hd lb', k: 'label', f: 'Assumptions' });
  [
    [18, 'D&A % revenue', d.daPct, 'Three-year historical average.'],
    [19, 'Capex % revenue', d.capexPct, 'In line with guidance and the three-year average.'],
    [20, 'Working capital % of revenue growth', d.nwcPct, 'Historical relationship over four years.'],
    [
      21,
      'Tax rate',
      d.taxRate,
      d.key === 'uk' ? 'UK main rate of corporation tax.' : 'Federal 21% plus a blended state rate.'
    ],
    [22, 'WACC', m.wacc, 'CAPM: risk-free rate, peer-levered beta, equity risk premium and after-tax cost of debt.'],
    [23, 'Terminal growth', m.tgr, 'Long-run nominal growth.']
  ].forEach(([r, l, v, n]) => {
    set('A' + r, { v: l, c: 'lb', k: 'label', f: l });
    set('B' + r, { v: fp(v), c: 'in', k: 'in', f: (v * 100).toFixed(2) + '%', note: n });
  });
  set('C17', {
    v: `Implied value per share${d.pence ? ' (p)' : ' ($)'}, with WACC across and terminal growth down`,
    c: 'hd lb',
    span: 6,
    k: 'label',
    f: ''
  });
  set('C18', {
    v: sheetPx(d, o.vps),
    c: 'it',
    k: 'calc',
    f: '=B33',
    note: 'The data table’s corner cell points at the output being flexed.'
  });
  const ws = [-0.01, -0.005, 0, 0.005, 0.01].map(x => m.wacc + x),
    gs = [-0.01, -0.005, 0, 0.005, 0.01].map(x => m.tgr + x);
  ws.forEach((w, j) =>
    set(COLS[3 + j] + '18', {
      v: fp(w),
      c: 'hd',
      k: 'calc',
      f: (w * 100).toFixed(2) + '%',
      note: 'WACC in steps of 0.5pp.'
    })
  );
  gs.forEach((g, i) => {
    set('C' + (19 + i), {
      v: fp(g),
      c: 'hd',
      k: 'calc',
      f: (g * 100).toFixed(2) + '%',
      note: 'Terminal growth in steps of 0.5pp.'
    });
    ws.forEach((w, j) => {
      const a = COLS[3 + j] + (19 + i);
      if (w - g < 0.005) {
        set(a, {
          v: 'n/m',
          c: 'it',
          k: 'calc',
          f: '{=TABLE(B22,B23)}',
          note: 'Not meaningful: terminal growth at or above WACC.'
        });
        return;
      }
      const v = calc(d, m.scen, w, g).vps;
      set(a, {
        v: sheetPx(d, v),
        c: cx(v >= d.price * 1.15 ? 'shi' : v < d.price ? 'slo' : '', i === 2 && j === 2 && 'ctr'),
        k: 'calc',
        f: '{=TABLE(B22,B23)}',
        note: `Excel data table at WACC ${fp(w)}, terminal growth ${fp(g)}.`
      });
    });
  });
  set('A25', { v: 'Valuation', c: 'hd lb', k: 'label', f: 'Valuation' });
  const L5 = L(P - 1);
  [
    [26, 'Sum of PV of free cash flow', fm(o.sumPV), 'calc', `=SUM(${L(na)}15:${L5}15)`],
    [27, 'Terminal value (Gordon growth)', fm(o.tv), 'calc', `=${L5}12*(1+B23)/(B22-B23)`],
    [28, 'PV of terminal value', fm(o.pvtv), 'calc', `=B27/(1+B22)^(${L5}13+0.5)`],
    [29, 'Enterprise value', fm(o.ev), 'calc', '=B26+B28', 'tot'],
    [30, d.ndLabel, fm(d.netDebt), 'lk', "='BS'!H41"],
    [31, 'Equity value', fm(o.eq), 'calc', '=B29-B30', 'tot'],
    [32, 'Diluted shares (m)', nf1.format(d.shares), 'lk', "='Cap table'!E18"],
    [
      33,
      `Implied value per share${d.pence ? ' (p)' : ' ($)'}`,
      sheetPx(d, o.vps),
      'calc',
      d.pence ? '=B31/B32*100' : '=B31/B32',
      'tot'
    ],
    [34, `Current share price${d.pence ? ' (p)' : ' ($)'}`, sheetPx(d, d.price), 'lk', '=MarketData!C4'],
    [35, 'Upside / (downside)', fp(o.up), 'calc', '=B33/B34-1'],
    [36, 'Implied EV / NTM EBITDA', fx(o.evE), 'calc', `=B29/${L(na)}6`]
  ].forEach(([r, l, v, k, f, c]) => {
    set('A' + r, { v: l, c: cx('lb', c), k: 'label', f: l });
    set('B' + r, { v, c: cx(k === 'lk' && 'lk', c), k, f });
  });
  set('D25', { v: 'Scenario summary', c: 'hd lb', span: 5, k: 'label', f: '' });
  ['Scenario', 'EV', 'Value / share', 'Upside', 'EV / EBITDA'].forEach((h, j) =>
    set(COLS[3 + j] + '26', { v: h, c: cx('hd', j === 0 && 'lb'), k: 'label', f: h })
  );
  ['base', 'upside', 'downside'].forEach((s, i) => {
    const r = calc(d, s, m.wacc, m.tgr),
      row = 27 + i;
    set('D' + row, { v: SCEN[s].l, c: cx('lb', s === m.scen && 'hd'), k: 'label', f: SCEN[s].l });
    [
      [fm(r.ev), 'F'],
      [sheetPx(d, r.vps), 'G'],
      [fp(r.up), 'H'],
      [fx(r.evE), 'I']
    ].forEach(([v, sc], j) =>
      set(COLS[4 + j] + row, {
        v,
        c: 'lk',
        k: 'lk',
        f: `='Scenarios'!${sc}${12 + i}`,
        note: 'The Scenarios sheet runs each case through this same model.'
      })
    );
  });
  Object.keys(EVCELL).forEach(a => {
    if (C[a]) C[a].ev = EVCELL[a];
  });
  return { C, o };
}

/* =================================================================== LBO */
function defaultEntry(d) {
  const e0 = d.ebitda[d.nAct - 1];
  return Math.round((((d.price * 1.3 * d.shares) / (d.pence ? 100 : 1) + d.netDebt) / e0) * 2) / 2;
}
function lbo(d, o, entry, exit, lev) {
  const na = d.nAct,
    P = d.periods.length,
    e0 = o.eb[na - 1];
  const ev0 = entry * e0,
    fees = ev0 * 0.025,
    debt0 = lev * e0,
    eq0 = ev0 + fees - debt0;
  let debt = debt0;
  const sched = [];
  for (let i = na; i < P; i++) {
    const int = debt * d.rate,
      ebt = o.ebit[i] - int,
      tax = Math.max(0, ebt) * d.taxRate;
    const fcf = o.eb[i] + o.capex[i] + o.nwc[i] - tax - int;
    debt = Math.max(0, debt - Math.max(0, fcf));
    sched.push({ y: d.periods[i], int, fcf, debt, lev: debt / o.eb[i], cover: o.eb[i] / Math.max(int, 0.01) });
  }
  const exitEV = exit * o.eb[P - 1],
    eqX = exitEV - debt,
    moic = eqX / eq0,
    irr = Math.pow(Math.max(moic, 0), 1 / (P - na)) - 1;
  const offer = perShareFromEV(d, ev0);
  return { e0, ev0, fees, debt0, eq0, sched, exitEV, eqX, moic, irr, offer, prem: offer / d.price - 1 };
}

/* =================================================================== comps */
function compsData(d, m, filt, leaseOn) {
  const o = calc(d, m.scen, m.wacc, m.tgr),
    na = d.nAct;
  const all = d.comps.map((c, i) => ({ ...c, i, eve: (c.evr / c.m) * (c.adj && !leaseOn ? d.leaseMult : 1) }));
  const peers = all.filter(c => filt === 'all' || c.c.toLowerCase() === filt);
  const ev = marketEV(d);
  const tgt = {
    n: d.target,
    s: d.short,
    c: d.key.toUpperCase(),
    std: d.gaap,
    ev,
    evr: ev / o.rev[na],
    eve: ev / o.eb[na],
    g: o.g[na],
    m: o.m[na],
    tg: true
  };
  const xs = all.map(p => p.g * 100),
    ys = all.map(p => p.evr),
    mx = xs.reduce((a, b) => a + b, 0) / xs.length,
    my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxx = 0,
    sxy = 0;
  xs.forEach((x, i) => {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (ys[i] - my);
  });
  const b = sxy / sxx,
    a0 = my - b * mx,
    impMult = a0 + b * tgt.g * 100;
  const ps = ev2 => perShareFromEV(d, ev2);
  const eves = all.map(p => p.eve);
  const med = {
    evr: median(peers.map(p => p.evr)),
    eve: median(peers.map(p => p.eve)),
    g: median(peers.map(p => p.g)),
    m: median(peers.map(p => p.m)),
    ev: median(peers.map(p => p.ev))
  };
  return {
    o,
    peers,
    all,
    tgt,
    a0,
    b,
    impMult,
    impVps: ps(impMult * o.rev[na]),
    med,
    medVps: ps(med.eve * o.eb[na]),
    comp25: ps(pctile(eves, 0.25) * o.eb[na]),
    comp75: ps(pctile(eves, 0.75) * o.eb[na]),
    reg: [ps((impMult - 0.3) * o.rev[na]), ps((impMult + 0.3) * o.rev[na])]
  };
}

/* =================================================================== plan & log */
function planFor(sel, ws, priority) {
  const s = DELIV.filter(x => sel.has(x.k));
  const sum = tr => s.filter(x => x.tr === tr).reduce((a, x) => a + x.min, 0);
  const f = priority ? 0.7 : 1;
  const model = Math.round(sum('model') * f),
    an = Math.round(sum('an') * 0.6 * f),
    write = Math.round(Math.max(6, sum('write')) * f);
  const assay = 12 + s.length,
    review = 10;
  const st = [
    { k: 'scope', n: 'Scope', a: 0, b: 6 },
    { k: 'ingest', n: 'Ingest', a: 6, b: 28 },
    { k: 'extract', n: 'Extract', a: 28, b: 50 },
    { k: 'model', n: 'Model', a: 50, b: 50 + model, skip: !model },
    { k: 'an', n: 'Analysis', a: 50, b: 50 + an, skip: !an }
  ];
  const w0 = 50 + Math.max(model, an);
  st.push(
    { k: 'write', n: 'Write', a: w0, b: w0 + write },
    { k: 'assay', n: 'Assay', a: w0 + write, b: w0 + write + assay },
    { k: 'review', n: 'Sign-off', a: w0 + write + assay, b: w0 + write + assay + review }
  );
  const total = w0 + write + assay + review;
  const has = k => sel.has(k);
  const outs = {
    run: 0,
    company: 50,
    sources: 28,
    model: has('3s') || has('dcf') || has('lbo') ? 50 + model : null,
    comps: has('comps') ? 50 + an : null,
    compet: has('compet') ? 50 + an : null,
    market: has('industry') ? 50 + an : null,
    memo: has('memo') ? w0 + write : null,
    deck: has('memo') || has('pitch') ? w0 + write : null,
    delivery: total
  };
  let price = s.reduce((a, x) => a + x[ws === 'uk' ? 'gbp' : 'usd'], 0),
    packed = false;
  if (s.length >= 5 && price > PACK[ws]) {
    price = PACK[ws];
    packed = true;
  }
  if (priority) price = Math.round((price * 1.3) / 50) * 50;
  return { st, total, outs, sel: new Set(sel), n: s.length, price, packed, an: { a: 50, b: 50 + an } };
}
const AG = {
  PLAN: { n: 'Planner', i: 'flag', node: 'plan' },
  INGEST: { n: 'Extractor', i: 'db', node: 'ext' },
  EXTRACT: { n: 'Extractor', i: 'db', node: 'ext' },
  NORM: { n: 'Extractor', i: 'db', node: 'ext' },
  MODEL: { n: 'Modeller', i: 'sigma', node: 'mod' },
  COMPS: { n: 'Comps analyst', i: 'scatter', node: 'cmp' },
  MARKET: { n: 'Market analyst', i: 'globe', node: 'mkt' },
  COMPET: { n: 'Competitor analyst', i: 'grid', node: 'cpt' },
  WRITE: { n: 'Writer', i: 'pen', node: 'wri' },
  ASSAY: { n: 'Assayer', i: 'shield', c: 'gold', node: 'asy' },
  REVIEW: { n: 'Reviewer', i: 'user', c: 'green', node: 'rev' },
  DELIVER: { n: 'Delivery', i: 'send', c: 'green', node: 'rev' }
};
function logLines(plan, d) {
  const has = k => plan.sel.has(k),
    anyM = has('3s') || has('dcf') || has('lbo'),
    L = [];
  const at = (k, f, tag, x, s) => {
    const st = plan.st.find(q => q.k === k);
    if (st && !st.skip) L.push({ t: st.a + (st.b - st.a) * f, tag, x, s: s || x });
  };
  at(
    'scope',
    0.2,
    'PLAN',
    `Brief parsed: ${d.type.toLowerCase()} on ${d.target} (${d.ticker}), ${d.gaap}, ${d.fy}.`,
    'Parsing the brief'
  );
  at('scope', 0.6, 'PLAN', `Conflict check clear. Information barrier opened for ${d.org}.`, 'Conflict check clear');
  at(
    'scope',
    0.9,
    'PLAN',
    `Plan: ${plan.n} deliverables across ${Math.min(6, plan.n + 2)} agents, critical path ${hm(plan.total)}.`,
    `${plan.n} deliverables planned`
  );
  at('ingest', 0.2, 'INGEST', d.log.f1, 'Pulling filings');
  at('ingest', 0.5, 'INGEST', d.log.f2, 'Reading announcements');
  at('ingest', 0.75, 'INGEST', `Data room connected: ${d.vdr}.`, 'Indexing the data room');
  at(
    'ingest',
    0.95,
    'INGEST',
    '1,243 documents indexed. 41 possible peers screened from market data.',
    '1,243 documents indexed'
  );
  at('extract', 0.25, 'EXTRACT', d.log.big, d.log.big.split(':')[0]);
  at('extract', 0.5, 'NORM', d.log.lease, 'Aligning lease accounting');
  at('extract', 0.7, 'NORM', d.log.cal, 'Calendarising peers');
  at(
    'extract',
    0.92,
    'EXTRACT',
    '38,406 data points in the Ledger Graph. 3 conflicts between sources resolved.',
    '38,406 data points'
  );
  if (anyM)
    at(
      'model',
      0.3,
      'MODEL',
      'Three-statement build: 7 tabs, 2,912 formulas, 0 hard-codes in calculation rows.',
      'Building 3 statements'
    );
  if (has('dcf'))
    at(
      'model',
      0.6,
      'MODEL',
      `DCF linked. WACC ${fp(d.wacc)} from CAPM, terminal growth ${fp(d.tgr)}.`,
      'Linking the DCF'
    );
  if (has('lbo'))
    at(
      'model',
      0.88,
      'MODEL',
      'LBO built: 5.0x senior leverage, cash sweep, IRR and MOIC by exit year.',
      'Building the LBO'
    );
  if (has('comps'))
    at('an', 0.25, 'COMPS', 'Kept 6 peers from 41 screened. 2 excluded for pending M&A.', 'Screening 41 peers');
  if (has('industry'))
    at(
      'an',
      0.55,
      'MARKET',
      `Bottom-up market size: SAM ${d.cur}${d.industry.sam[0]}bn growing ${fp(d.industry.cagr)} a year.`,
      'Sizing the market'
    );
  if (has('compet'))
    at('an', 0.85, 'COMPET', 'Matrix filled: 6 companies × 6 questions, 71 sources cited.', 'Filling the matrix');
  if (has('memo'))
    at('write', 0.4, 'WRITE', `IC memo drafted in ${d.style}: 9 pages, 61 citations.`, 'Drafting the IC memo');
  if (has('pitch') || has('compet') || has('industry'))
    at('write', 0.8, 'WRITE', 'Slides set in the client slide master: 32 slides.', 'Setting slides');
  if (!has('memo') && !has('pitch') && !has('compet') && !has('industry'))
    at(
      'write',
      0.6,
      'WRITE',
      'Workbook formatted to house style. Cover and checks sheets added.',
      'Formatting workbook'
    );
  at('assay', 0.2, 'ASSAY', '412 of 412 integrity checks passed.', '412 checks passed');
  at(
    'assay',
    0.5,
    'ASSAY',
    'Red team challenged 7 claims. 2 rewritten, 5 upheld with extra sources.',
    'Red-teaming the thesis'
  );
  at(
    'assay',
    0.82,
    'ASSAY',
    '3,184 of 3,187 figures traced to source. 3 labelled as estimates. Fineness 999.',
    'Tracing 3,187 figures'
  );
  at('review', 0.5, 'REVIEW', `${d.reviewer} reviewed 3 flagged items.`, 'Reviewing 3 flags');
  at('review', 0.97, 'DELIVER', `${filesFor(plan, d).length} files delivered to ${d.org}: ${d.folder}.`, 'Delivered');
  return L.sort((a, b) => a.t - b.t);
}
function filesFor(plan, d) {
  const has = k => plan.sel.has(k),
    f = [];
  if (has('3s') || has('dcf') || has('lbo'))
    f.push(['xlsx', `${d.short}_Model_v1.xlsx`, '7 tabs, 2,912 formulas', '2.4 MB']);
  if (has('comps')) f.push(['xlsx', `${d.short}_Comps.xlsx`, '6 peers, 41 screened', '640 KB']);
  if (has('compet')) f.push(['pptx', `${d.short}_Competitors.pptx`, '14 slides', '5.1 MB']);
  if (has('industry')) f.push(['pptx', `${d.short}_Market.pptx`, '18 slides', '6.8 MB']);
  if (has('pitch')) f.push(['pptx', `${d.short}_Pitch_Pages.pptx`, '12 slides', '4.3 MB']);
  if (has('memo'))
    f.push(['docx', `${d.project.replace('Project ', '')}_IC_Memo.docx`, '9 pages, 61 citations', '880 KB']);
  return f;
}

/* =================================================================== evidence */
function getEvidence(d, key, m) {
  const steps = (e, doc, pg) => [
    ['file', 'Source', `${doc.who}, ${doc.t}, ${typeof pg.p === 'number' ? 'p.' + pg.p : pg.p}. ${doc.src}.`, ''],
    ['search', 'Extracted', e.ex, ''],
    [
      'sliders',
      'Normalised',
      e.norm ||
        (d.key === 'uk' ? '£000 converted to £m, one decimal place' : '$000 converted to $m, one decimal place'),
      ''
    ],
    ['link', 'Reconciled', e.rec, ''],
    e.flag
      ? ['flag', 'Flagged', 'Not an audited figure. Labelled as such wherever it is used.', 'gold']
      : ['shield', 'Assayed', 'Recalculated independently. 0 differences.', 'ok'],
    ['user', 'Signed', `${d.reviewer}, 10 Oct 2026`, 'ok']
  ];
  if (key === 'comps') {
    const X = compsData(d, m, 'all', true);
    const rows = [...X.all].sort((a, b) => b.eve - a.eve).map(p => [p.n, fx(p.evr), fx(p.eve), fp(p.g)]);
    rows.push(['Peer median', fx(X.med.evr), fx(X.med.eve), fp(X.med.g), 1]);
    const doc = {
      id: 'comps',
      t: 'Trading comps',
      who: 'Vult',
      ty: 'Analysis',
      f: 'xls',
      src: 'Built from 6 filings and licensed market data',
      date: '9 Oct 2026',
      pages: '6 peers'
    };
    const pg = {
      p: 'Comps sheet',
      h: `${d.short}_Comps.xlsx`,
      sub: 'Peer multiples, NTM',
      paras: [`Prices at the 9 Oct 2026 close. ${d.adjNote}`],
      cols: ['Company', 'EV / rev.', 'EV / EBITDA', 'Growth'],
      rows
    };
    const e = {
      l: 'Peer median EV / NTM EBITDA',
      v: fx(X.med.eve),
      ex: `${X.all.length} peers, median of NTM EBITDA multiples`,
      norm: 'Calendarised to a common year-end; leases aligned',
      rec: 'Each peer EV rebuilt from its own filing',
      used: [
        ['Comps table', 'comps'],
        ['IC memo, thesis', 'memo']
      ]
    };
    return { key, l: e.l, v: e.v, doc, pg, hl: [rows.length - 1], steps: steps(e, doc, pg), used: e.used, flag: false };
  }
  if (key.indexOf('peer:') === 0) {
    const p = d.comps[+key.slice(5)],
      u = d.unit.replace('m', '');
    const mc = p.ev * 0.82,
      nd = p.ev * (p.adj ? 0.13 : 0.18),
      ls = p.adj ? p.ev * 0.05 : 0,
      eb = p.ev / (p.evr / p.m);
    const doc = {
      id: 'peer',
      t: p.std === 'IFRS' ? 'Annual report' : 'Form 10-K FY2025',
      who: p.n,
      ty: 'Filing',
      f: 'pdf',
      src: p.std === 'IFRS' ? 'Companies House' : 'SEC EDGAR',
      date: '2026',
      pages: ''
    };
    const rows = [
      ['Market capitalisation', nf0.format(mc)],
      ['Net debt', nf0.format(nd)]
    ];
    if (p.adj) rows.push(['Operating lease liabilities (restated)', nf0.format(ls)]);
    rows.push(
      ['Enterprise value', nf0.format(mc + nd + ls), '', 1],
      ['NTM EBITDA (Vult estimate)', nf1.format(eb)],
      ['EV / NTM EBITDA', fx(p.evr / p.m)]
    );
    const pg = {
      p: 'EV build',
      h: 'Vult comps, peer detail',
      sub: `${p.n}: enterprise value`,
      paras: [p.adj ? `Leases restated so EBITDA compares with ${d.gaap} peers.` : 'No lease restatement needed.'],
      cols: [`${u}m`, 'Value'],
      rows
    };
    const e = {
      l: `${p.s} EV / NTM EBITDA`,
      v: fx(p.evr / p.m),
      ex: `Shares, debt and cash from the latest ${p.std === 'IFRS' ? 'annual report' : '10-K and 10-Q'}`,
      norm: p.adj ? 'Leases restated to match the target’s accounting' : 'Calendarised to the target’s year-end',
      rec: 'Market cap at the 9 Oct 2026 close',
      used: [['Comps table', 'comps']]
    };
    return { key, l: e.l, v: e.v, doc, pg, hl: [rows.length - 1], steps: steps(e, doc, pg), used: e.used, flag: false };
  }
  const e = d.ev[key];
  if (!e) return null;
  const docId = e.pg.split('.')[0],
    doc = d.docs.find(x => x.id === docId),
    pg = d.pages[e.pg];
  return { key, l: e.l, v: e.v, doc, pg, hl: e.hl, steps: steps(e, doc, pg), used: e.used, flag: !!e.flag };
}

/* =================================================================== co-pilot */
function copilot(q, ctx) {
  const { d, m } = ctx,
    s = q.toLowerCase(),
    o = calc(d, m.scen, m.wacc, m.tgr),
    X = compsData(d, m, 'all', true);
  const num = re => {
    const r = s.match(re);
    return r ? parseFloat(r[1]) : null;
  };
  const px = v => sharePx(d, v);
  const uk = d.key === 'uk';
  if (/wacc|discount rate|cost of capital/.test(s)) {
    let w = num(/(?:wacc|discount rate|cost of capital)[^0-9]*(\d+(?:\.\d+)?)/);
    w = w != null ? (w > 1 ? w / 100 : w) : m.wacc + 0.01;
    w = Math.min(0.15, Math.max(0.06, w));
    const tg = Math.min(m.tgr, w - 0.02);
    const o2 = calc(d, m.scen, w, tg);
    const per50 = Math.abs(calc(d, m.scen, m.wacc + 0.005, m.tgr).vps - o.vps);
    return {
      think: [
        'Reading the DCF sheet: 36 rows, 2,912 formulas',
        'Re-running the valuation at the new discount rate',
        'Checking the result with the Assayer'
      ],
      text: `At a ${fp(w)} WACC the DCF gives **${px(o2.vps)} per share**, ${fpS(o2.vps / o.vps - 1)} against the current ${px(o.vps)}. That is ${fpS(o2.up)} versus today's ${px(d.price)}.\nTerminal value is ${Math.round((o2.pvtv / o2.ev) * 100)}% of enterprise value, so every 50bp on the discount rate moves value by about ${px(per50)}. I would keep ${fp(d.wacc)} as the base case and show this as a sensitivity in the IC paper.`,
      cites: ['px', 'comps'],
      action: {
        title: 'Change the discount rate',
        rows: [
          ['WACC (B22)', fp(m.wacc), fp(w)],
          ['Value per share (B33)', px(o.vps), px(o2.vps)],
          ['Upside vs ' + px(d.price), fpS(o.up), fpS(o2.up)]
        ],
        patch: { wacc: w, tgr: tg },
        cells: ['B22', 'B33', 'B35']
      }
    };
  }
  if (/terminal|perpetu|long[- ]run growth/.test(s)) {
    let g = num(/(?:terminal|perpetu\w*|long[- ]run growth)[^0-9]*(\d+(?:\.\d+)?)/);
    g = g != null ? (g > 0.5 ? g / 100 : g) : m.tgr + 0.005;
    g = Math.min(m.wacc - 0.02, Math.max(0.005, g));
    const o2 = calc(d, m.scen, m.wacc, g);
    return {
      think: [
        'Reading the terminal value build',
        'Re-running the Gordon growth calculation',
        'Checking the result with the Assayer'
      ],
      text: `With ${fp(g)} terminal growth the DCF gives **${px(o2.vps)} per share** (${fpS(o2.up)} vs ${px(d.price)}). Terminal value becomes ${Math.round((o2.pvtv / o2.ev) * 100)}% of enterprise value.\nAnything above about 3% implies ${d.short} grows faster than nominal GDP forever, which the IC will push back on.`,
      cites: ['px'],
      action: {
        title: 'Change terminal growth',
        rows: [
          ['Terminal growth (B23)', fp(m.tgr), fp(g)],
          ['Value per share (B33)', px(o.vps), px(o2.vps)]
        ],
        patch: { tgr: g },
        cells: ['B23', 'B33', 'B35']
      }
    };
  }
  if (/downside|stress|renewal|rate cut|lose|bear/.test(s)) {
    const o2 = calc(d, 'downside', m.wacc, m.tgr);
    return {
      think: [
        'Loading the downside case: growth −2.5pp, margin −2pp a year',
        uk ? 'Checking the FY28 renewal schedule in the data room' : 'Checking the client funds disclosure in the 10-K',
        'Re-running the DCF and LBO'
      ],
      text: uk
        ? `The downside case takes 2.5pp off growth and 2pp off margin every year, which is roughly what losing one of the three FY28 renewals at 80% of value would do. The DCF falls to **${px(o2.vps)} per share**, ${fpS(o2.up)} against today's price, and EV / NTM EBITDA to ${fx(o2.evE)}.\nThe top 10 customers are 34% of revenue, so renewal calls should be the first item in phase 2.`
        : `The downside case takes 2.5pp off growth and 2pp off margin every year, which is about what 150bp of rate cuts plus slower client growth would do. The DCF falls to **${px(o2.vps)} per share**, ${fpS(o2.up)} against today's price.\nEach 100bp cut removes about $21m of revenue, so the float sensitivity should be the first item in phase 2.`,
      cites: uk ? ['k2', 'k3'] : ['k2', 'k5'],
      action: {
        title: 'Switch the model to the downside case',
        rows: [
          ['Scenario', SCEN[m.scen].l, 'Downside'],
          ['Value per share (B33)', px(o.vps), px(o2.vps)],
          ['EV / NTM EBITDA', fx(o.evE), fx(o2.evE)]
        ],
        patch: { scen: 'downside' },
        cells: ['D3', 'E3', 'F3', 'G3', 'H3', 'B33', 'B35']
      }
    };
  }
  if (/lever|irr|lbo|debt|moic|return/.test(s)) {
    let lv = num(/(\d+(?:\.\d+)?)\s*x/) || num(/lever\w*[^0-9]*(\d+(?:\.\d+)?)/);
    lv = lv != null ? Math.min(7, Math.max(2, lv)) : m.lev + 0.5;
    const L0 = lbo(d, o, m.entry, m.exit, m.lev),
      L1 = lbo(d, o, m.entry, m.exit, lv);
    return {
      think: [
        'Reading the LBO: sources and uses, debt schedule, returns',
        `Re-running at ${lv.toFixed(1)}x senior leverage with a full cash sweep`,
        'Checking interest cover in year one'
      ],
      text: `At ${lv.toFixed(1)}x senior leverage the LBO returns **${fp(L1.irr)} IRR** and ${L1.moic.toFixed(2)}x MOIC over five years, entering and exiting at ${fx(m.entry)}. At ${m.lev.toFixed(1)}x it was ${fp(L0.irr)}.\nYear-one interest cover is ${L1.sched[0].cover.toFixed(1)}x, and leverage falls to ${fx(L1.sched[L1.sched.length - 1].lev)} by exit as free cash flow sweeps the debt. ${L1.sched[0].cover < 2.5 ? 'That cover is thin; I would not go above this.' : 'That cover leaves room in a downside case.'}`,
      cites: ['nd', 'ebA'],
      action: {
        title: 'Change LBO leverage',
        rows: [
          ['Senior leverage', fx(m.lev), fx(lv)],
          ['IRR', fp(L0.irr), fp(L1.irr)],
          ['MOIC', L0.moic.toFixed(2) + 'x', L1.moic.toFixed(2) + 'x']
        ],
        patch: { lev: lv, sheet: 'LBO' },
        cells: []
      }
    };
  }
  if (/peer|comps|multiple|cheap|discount|gap|valuation|undervalu/.test(s)) {
    const disc = 1 - X.tgt.eve / X.med.eve,
      mc = (d.price * d.shares) / (d.pence ? 100 : 1);
    return {
      think: [
        'Reading the comps sheet: 6 peers, leases aligned',
        'Comparing growth, margin and size',
        'Pulling risk factors from the memo sources'
      ],
      text: `${d.short} trades at **${fx(X.tgt.eve)} NTM EBITDA** against a peer median of ${fx(X.med.eve)}, a ${Math.round(disc * 100)}% discount, while growing faster (${fp(X.tgt.g)} vs ${fp(X.med.g)}).\nThree things explain most of the gap:\n• Size and liquidity: a ${d.cur}${nf0.format(mc)}m market cap against a peer median EV of ${d.cur}${nf0.format(X.med.ev)}m\n• ${uk ? 'Customer concentration: the top 10 customers are 34% of revenue' : 'Rate sensitivity: each 100bp cut removes about $21m of revenue'}\n• ${uk ? 'A loss-making US arm the market gives no value to' : 'Down-market pressure from Gridline HR and Tallis'}\nAt the peer median multiple the shares would be worth about ${px(X.medVps)}.`,
      cites: ['comps', 'k2', uk ? 'k3' : 'k5'],
      action: {
        kind: 'memo',
        title: 'Add this to the IC memo',
        rows: [['Valuation section', 'No peer-gap analysis', 'New paragraph']],
        patch: {},
        cells: []
      }
    };
  }
  if (/risk|ic|summar|memo|concern/.test(s)) {
    return {
      think: [
        'Reading the IC memo and 61 citations',
        'Ranking risks by value at stake',
        'Checking each claim against its source'
      ],
      text: uk
        ? `The IC should focus on three risks:\n• **Concentration.** The top 10 customers are 34% of revenue, and three renew in FY28.\n• **US losses.** North America lost £4.1m of EBITDA in FY26 and the MD changed twice in a year.\n• **Process.** Meridale is on AIM, so the Takeover Code applies: a leak starts a 28-day put-up-or-shut-up clock.\nThe first two are diligence questions; the third is about deal hygiene.`
        : `The IC should focus on three risks:\n• **Rates.** Each 100bp cut in short-term rates removes about $21m of revenue.\n• **Competition.** Gridline HR now bundles benefits from $12 per employee, which is where Pinecrest is weakest.\n• **Execution.** The tax-engine migration is 70% done; overruns would delay the margin plan.\nThe first two drive the downside case; the third drives timing.`,
      cites: uk ? ['k2', 'k3', 'k1'] : ['k2', 'k5', 'k3']
    };
  }
  // generic: no built-in analysis matched, so a connected backend may answer instead.
  return {
    generic: true,
    think: [
      'Reading the engagement: 1,243 documents, the model and the memo',
      'Matching your question to the evidence'
    ],
    text: `I can work across everything in ${d.project}: the model, comps, competitor matrix, market sizing, the memo and all 1,243 source documents. For example:\n• Re-run the DCF at a different WACC or terminal growth\n• Stress the downside case and show what changes\n• Test LBO returns at a different leverage\n• Explain the valuation gap to peers, with sources\nEvery number I give you links back to the page it came from.`,
    cites: []
  };
}

export {
  R,
  DELIV,
  ALL,
  PACK,
  SCEN,
  TEMPLATES,
  PEOPLE_H,
  TABS,
  GKEYS,
  nf1,
  nf0,
  fm,
  fp,
  fpS,
  fx,
  money,
  sharePx,
  sheetPx,
  hm,
  clk,
  tzTime,
  tzHour,
  clamp01,
  initials,
  median,
  pctile,
  rng,
  calc,
  marketEV,
  perShareFromEV,
  COLS,
  EVCELL,
  sheetCells,
  defaultEntry,
  lbo,
  compsData,
  planFor,
  AG,
  logLines,
  filesFor,
  getEvidence,
  copilot
};
