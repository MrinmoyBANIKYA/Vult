// Always-on agents, overnight briefings and the human approval queue, per workspace.
export const AUTO = {
  uk: {
    brief: [
      {
        id: 'b1',
        kind: 'price',
        when: '02:14',
        agent: 'Price-change watch',
        title: 'Corvia cut its UK mid-market list price by about 12%',
        body: 'Detected on corvia.com/pricing overnight. The competitor matrix for Project Kestrel now shows the new price; the threat rating stays High.',
        impact: 'Kestrel thesis: low impact',
        act: ['Open the matrix', 'engagement', 'compet'],
        tone: 'warn'
      },
      {
        id: 'b2',
        kind: 'filing',
        when: '06:31',
        agent: 'Filing sentinel',
        title: 'Plantwise trading update: revenue guidance cut 4%',
        body: 'RNS at 07:00 yesterday. Comps refreshed: the peer median EV / NTM EBITDA moves from 12.7x to 12.5x and Meridale’s discount narrows.',
        impact: 'Comps refreshed',
        act: ['Review comps', 'engagement', 'comps'],
        tone: 'info'
      },
      {
        id: 'b3',
        kind: 'earnings',
        when: 'Tue 07:00',
        agent: 'Earnings flash',
        title: 'Tamar Foods half-year results land on Tuesday at 07:00',
        body: 'The flash is armed: a two-page note against your model, ready about 30 minutes after the RNS, then sent to the Wren deal team.',
        impact: 'Scheduled',
        act: ['See Autopilot', 'autopilot'],
        tone: 'gold'
      }
    ],
    approvals: [
      {
        id: 'a1',
        kind: 'model_update',
        title: 'Meridale downside case, version 5',
        who: 'Modeller agent',
        why: 'James asked to stress the three FY28 renewals. The downside now assumes one renews at 80% of value.',
        diff: [
          ['Value per share, downside', '452p', '431p'],
          ['EV / NTM EBITDA, downside', '9.6x', '9.2x']
        ],
        eng: 'Project Kestrel',
        age: '14m'
      },
      {
        id: 'a2',
        kind: 'add_peer',
        title: 'Add Halden Systems plc to the Kestrel peer set',
        who: 'Comps agent',
        why: 'Listed on AIM on 6 Oct. FM software, 71% recurring revenue, similar size. It passes all five screening rules.',
        diff: [
          ['Peers', '6', '7'],
          ['Peer median EV / NTM EBITDA', '12.7x', '12.9x']
        ],
        eng: 'Project Kestrel',
        age: '1h'
      },
      {
        id: 'a3',
        kind: 'send_flash',
        title: 'Send the Tamar Foods earnings flash',
        who: 'Earnings flash agent',
        why: 'Draft is assayed and reviewed by R. Okafor. It goes to the Wren deal team only.',
        diff: [
          ['Recipients', '—', '4 people'],
          ['Fineness', '—', '999']
        ],
        eng: 'Project Wren',
        age: '2h'
      }
    ],
    monitors: [
      {
        id: 'm1',
        n: 'Earnings flash',
        scope: '48 portfolio and watchlist names',
        trig: 'Results announcement',
        last: 'Yesterday 07:31',
        next: 'Tue 07:00, Tamar Foods',
        on: true,
        runs: 212
      },
      {
        id: 'm2',
        n: 'Filing sentinel',
        scope: 'Companies House, RNS and EDGAR for 214 entities',
        trig: 'New filing',
        last: '06:31',
        next: 'Continuous',
        on: true,
        runs: 3104
      },
      {
        id: 'm3',
        n: 'Price-change watch',
        scope: '38 competitor pricing pages',
        trig: 'Page change',
        last: '02:14',
        next: 'Every 6 hours',
        on: true,
        runs: 1520
      },
      {
        id: 'm4',
        n: 'Comps refresh',
        scope: '11 live peer sets',
        trig: 'Nightly at 02:00',
        last: '02:00',
        next: 'Tonight 02:00',
        on: true,
        runs: 365
      },
      {
        id: 'm5',
        n: 'Covenant monitor',
        scope: '9 portfolio credits',
        trig: 'Monthly accounts',
        last: '1 Oct',
        next: '1 Nov',
        on: true,
        runs: 88
      },
      {
        id: 'm6',
        n: 'Management moves',
        scope: 'Boards of 62 companies',
        trig: 'Director change',
        last: 'Thu',
        next: 'Continuous',
        on: false,
        runs: 41
      }
    ],
    log: [
      ['06:31', 'Filing sentinel', 'Read the Plantwise RNS and refreshed 3 peer sets'],
      ['04:10', 'Covenant monitor', 'Checked Brookvale Care headroom: 31%, no action'],
      ['02:14', 'Price-change watch', 'Logged a Corvia price change and updated 1 matrix'],
      ['02:00', 'Comps refresh', 'Refreshed 11 peer sets, 74 companies'],
      ['Yesterday 18:42', 'Earnings flash', 'Armed for Tamar Foods half-year results'],
      ['Yesterday 07:31', 'Earnings flash', 'Delivered the Northgate Packaging flash in 31 minutes']
    ],
    stats: { agents: 14, agentHours: 1286, humanMin: 131, saved: '£214k' }
  },
  us: {
    brief: [
      {
        id: 'b1',
        kind: 'price',
        when: '01:52',
        agent: 'Price-change watch',
        title: 'Gridline HR cut its bundled SMB tier to $11 per employee',
        body: 'Detected on gridlinehr.com/pricing overnight. The competitor matrix for Project Atlas now shows the new price; the threat rating stays High.',
        impact: 'Atlas thesis: medium impact',
        act: ['Open the matrix', 'engagement', 'compet'],
        tone: 'warn'
      },
      {
        id: 'b2',
        kind: 'filing',
        when: '06:05',
        agent: 'Filing sentinel',
        title: 'Payvana 8-K: CFO departure announced',
        body: 'Filed after the close yesterday. Comps are unchanged; the event is logged on the Payvana profile and flagged for the next IC.',
        impact: 'Logged',
        act: ['Review comps', 'engagement', 'comps'],
        tone: 'info'
      },
      {
        id: 'b3',
        kind: 'earnings',
        when: 'Thu 16:05',
        agent: 'Earnings flash',
        title: 'Orion Field Services Q3 results land on Thursday after the close',
        body: 'The flash is armed: a two-page note against your model, ready about 30 minutes after the release, then sent to the Mesa deal team.',
        impact: 'Scheduled',
        act: ['See Autopilot', 'autopilot'],
        tone: 'gold'
      }
    ],
    approvals: [
      {
        id: 'a1',
        kind: 'model_update',
        title: 'Pinecrest downside case, version 5',
        who: 'Modeller agent',
        why: 'Sarah asked how sensitive this is to rates. The downside now assumes 150bp of cuts by the end of 2027.',
        diff: [
          ['Value per share, downside', '$20.90', '$20.10'],
          ['EV / NTM EBITDA, downside', '9.9x', '9.5x']
        ],
        eng: 'Project Atlas',
        age: '11m'
      },
      {
        id: 'a2',
        kind: 'add_peer',
        title: 'Add Brightwage, Inc. to the Atlas peer set',
        who: 'Comps agent',
        why: 'IPO on the NYSE on 2 Oct. SMB payroll, 88% recurring revenue, similar size. It passes all five screening rules.',
        diff: [
          ['Peers', '6', '7'],
          ['Peer median EV / NTM EBITDA', '13.0x', '13.3x']
        ],
        eng: 'Project Atlas',
        age: '1h'
      },
      {
        id: 'a3',
        kind: 'send_flash',
        title: 'Send the Orion Field Services earnings flash',
        who: 'Earnings flash agent',
        why: 'Draft is assayed and signed by D. Alvarez. It goes to the Mesa deal team only.',
        diff: [
          ['Recipients', '—', '5 people'],
          ['Fineness', '—', '999']
        ],
        eng: 'Project Mesa',
        age: '3h'
      }
    ],
    monitors: [
      {
        id: 'm1',
        n: 'Earnings flash',
        scope: '63 portfolio and watchlist names',
        trig: 'Earnings release',
        last: 'Yesterday 16:41',
        next: 'Thu 16:05, Orion',
        on: true,
        runs: 248
      },
      {
        id: 'm2',
        n: 'Filing sentinel',
        scope: 'EDGAR 8-K, 10-Q and 13D for 288 entities',
        trig: 'New filing',
        last: '06:05',
        next: 'Continuous',
        on: true,
        runs: 4410
      },
      {
        id: 'm3',
        n: 'Price-change watch',
        scope: '44 competitor pricing pages',
        trig: 'Page change',
        last: '01:52',
        next: 'Every 6 hours',
        on: true,
        runs: 1702
      },
      {
        id: 'm4',
        n: 'Comps refresh',
        scope: '14 live peer sets',
        trig: 'Nightly at 02:00 ET',
        last: '02:00',
        next: 'Tonight 02:00',
        on: true,
        runs: 365
      },
      {
        id: 'm5',
        n: 'Covenant monitor',
        scope: '12 portfolio credits',
        trig: 'Monthly accounts',
        last: '1 Oct',
        next: '1 Nov',
        on: true,
        runs: 132
      },
      {
        id: 'm6',
        n: 'Management moves',
        scope: 'Boards of 88 companies',
        trig: 'Director change',
        last: 'Yesterday',
        next: 'Continuous',
        on: false,
        runs: 57
      }
    ],
    log: [
      ['06:05', 'Filing sentinel', 'Read the Payvana 8-K and updated its profile'],
      ['03:40', 'Covenant monitor', 'Checked Kestle Industrial headroom: 24%, no action'],
      ['02:00', 'Comps refresh', 'Refreshed 14 peer sets, 96 companies'],
      ['01:52', 'Price-change watch', 'Logged a Gridline price change and updated 1 matrix'],
      ['Yesterday 18:20', 'Earnings flash', 'Armed for Orion Field Services Q3 results'],
      ['Yesterday 16:41', 'Earnings flash', 'Delivered the Tolland Water flash in 34 minutes']
    ],
    stats: { agents: 16, agentHours: 1544, humanMin: 148, saved: '$288k' }
  }
};
