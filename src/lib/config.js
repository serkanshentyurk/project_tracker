// Seed data for new projects.
// Once created, everything is editable per-project via Settings.

export function buildDefaultProject(id, name) {
  return {
    _id: id || 'proj_' + Date.now().toString(36),
    name: name || 'New Project',
    settings: {
      today_month: 1,
      gantt_total_months: 36,
      gantt_start_year: 2026,
      project_full: '',
      supervisor: '',
      committee: [],
      hypothesis: '',
    },
    aims: {},
    trajectories: {},
    animals: [],
    sessions: [],
    milestones: [],
    log: [],
    protocols: [],
    events: [],
  };
}

// Example project seeded on first run
export function buildExampleProject() {
  const proj = buildDefaultProject('proj_example', 'Example Study');
  proj.settings = {
    today_month: 3,
    gantt_total_months: 24,
    gantt_start_year: 2026,
    project_full: 'Multi-Region Circuit Mapping in Behaving Mice',
    supervisor: 'J. Smith',
    committee: ['A. Jones', 'B. Lee', 'C. Park'],
    hypothesis: `This is a placeholder hypothesis. Edit it in **Settings** to describe your project's core question.

Use markdown formatting:
- **Bold** for emphasis
- *Italic* for terms
- \`code\` for technical identifiers
- ## Headings for sections
- ==yellow==Highlights==/yellow== for key phrases`,
  };

  proj.aims = {
    A1: { label: 'Aim 1', color: '#3b82f6',
      title: 'Behavioural Characterisation',
      description: 'Establish baseline task performance and define expert criteria.',
      tools: ['Behavioural analysis', 'Statistical modelling'] },
    A2: { label: 'Aim 2', color: '#f59e0b',
      title: 'Perturbation Experiments',
      description: 'Test causal necessity via targeted inactivation at key time points.',
      tools: ['Optogenetics', 'Chemogenetics'] },
    A3: { label: 'Aim 3', color: '#22c55e',
      title: 'Neural Recordings',
      description: 'Chronic recordings during task performance and across learning.',
      tools: ['Two-photon imaging', 'Electrophysiology'] },
  };

  proj.trajectories = {
    A1: [
      { id:'SURG', label:'Surgery', short:'Surg', type:'surgery' },
      { id:'RECOV', label:'Recovery', short:'Rec', type:'husbandry' },
      { id:'TRAIN', label:'Training', short:'Train', type:'behaviour' },
      { id:'EXPERT', label:'Expert criterion', short:'Expert', type:'behaviour' },
      { id:'TEST', label:'Testing phase', short:'Test', type:'behaviour' },
      { id:'DONE', label:'Complete', short:'✓', type:'done' },
    ],
    A2: [
      { id:'SURG', label:'Surgery', short:'Surg', type:'surgery' },
      { id:'RECOV', label:'Recovery', short:'Rec', type:'husbandry' },
      { id:'TRAIN', label:'Training', short:'Train', type:'behaviour' },
      { id:'EXPERT', label:'Expert criterion', short:'Expert', type:'behaviour' },
      { id:'MANIP', label:'Manipulation sessions', short:'Manip', type:'opto' },
      { id:'DONE', label:'Complete', short:'✓', type:'done' },
    ],
    A3: [
      { id:'SURG', label:'Surgery + implant', short:'Surg', type:'surgery' },
      { id:'EXPR', label:'Expression period', short:'Expr', type:'surgery' },
      { id:'RECOV', label:'Recovery', short:'Rec', type:'husbandry' },
      { id:'TRAIN', label:'Training', short:'Train', type:'behaviour' },
      { id:'EXPERT', label:'Expert criterion', short:'Expert', type:'imaging' },
      { id:'REC', label:'Recording sessions', short:'Rec', type:'imaging' },
      { id:'DONE', label:'Complete', short:'✓', type:'done' },
    ],
  };

  proj.milestones = [
    { phase:'phase1', label:'Phase 1 — Setup & Piloting', color:'#3b82f6',
      gantt_start:1, gantt_end:6,
      gantt_rows:[
        { label:'Equipment setup', s:1, e:3 },
        { label:'Protocol development', s:2, e:5 },
        { label:'Pilot animals', s:4, e:6 },
      ],
      items:[
        { id:'p1_01', text:'Hardware installed and tested', status:'todo' },
        { id:'p1_02', text:'Software pipeline validated end-to-end', status:'todo' },
        { id:'p1_03', text:'Pilot animals trained to criterion', status:'todo' },
        { id:'p1_m1', text:'Pilot complete — ready for main cohort', status:'todo', milestone:true, deadline_month:6 },
      ]},
    { phase:'phase2', label:'Phase 2 — Main Experiments', color:'#22c55e',
      gantt_start:6, gantt_end:18,
      gantt_rows:[
        { label:'Aim 1 cohort', s:6, e:12 },
        { label:'Aim 2 cohort', s:8, e:16 },
        { label:'Aim 3 cohort', s:10, e:18 },
      ],
      items:[
        { id:'p2_01', text:'Aim 1 data collection complete', status:'todo' },
        { id:'p2_02', text:'Aim 2 data collection complete', status:'todo' },
        { id:'p2_03', text:'Aim 3 data collection complete', status:'todo' },
        { id:'p2_m1', text:'All data collected', status:'todo', milestone:true, deadline_month:18 },
      ]},
    { phase:'phase3', label:'Phase 3 — Analysis & Writing', color:'#a855f7',
      gantt_start:16, gantt_end:24,
      gantt_rows:[
        { label:'Analysis', s:16, e:20 },
        { label:'Thesis writing', s:18, e:24 },
      ],
      items:[
        { id:'p3_01', text:'Cross-aim analysis complete', status:'todo' },
        { id:'p3_02', text:'Thesis submitted', status:'todo' },
      ]},
  ];

  proj.log = [
    { id:'D01', date:'2026-01-15', kind:'decision', status:'settled', title:'Example settled decision', body:'This is an example. Edit or delete it in the **Log** page.', risks:'Document any risks or caveats here.', priority:null, deadline:null, resolved_date:'', resolution:'' },
    { id:'I01', date:'2026-01-20', kind:'issue', status:'open', title:'Example open issue', body:'Track blockers, ambiguities, or things to resolve here.', risks:'', priority:'medium', deadline:null, resolved_date:'', resolution:'' },
  ];

  proj.protocols = [
    { _id:'proto_example', title:'Example Protocol', aim:'',
      steps:'## Overview\nDescribe the procedure here.\n\n## Steps\n- Step one\n- Step two\n- Step three\n\n## Notes\n**Important:** Add key reminders here.',
      items:[
        { id:'EQ01', text:'Example checklist item — click to cycle status', status:'todo' },
        { id:'EQ02', text:'Another item — add your own via + Add item', status:'todo' },
      ] },
  ];

  return proj;
}
