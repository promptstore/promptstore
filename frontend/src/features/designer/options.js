const formatOptions = [
  {
    description: 'email subject line',
    key: 'email_subject_line',
    title: 'Email Subject line',
  },
  {
    description: 'email content',
    key: 'email_content',
    title: 'Email Copy',
  },
  {
    description: 'call-to-action, CTA',
    key: 'cta',
    title: 'CTA',
  },
  {
    description: 'sms, chat',
    key: 'sms',
    title: 'SMS/Chat',
  },
  {
    description: 'social media',
    key: 'social_media',
    title: 'Social Media',
  },
  {
    description: 'web content',
    key: 'web_copy',
    title: 'Web Copy',
  },
];

const journeyOptions = [
  {
    key: 'Welcome',
    title: 'Welcome',
  },
  {
    key: 'Cross Sell',
    title: 'Cross Sell',
  },
  {
    key: 'Upsell',
    title: 'Upsell',
  },
  {
    key: 'End of Contract',
    title: 'End of Contract',
  },
  {
    key: 'Service',
    title: 'Service',
  },
  {
    key: 'Benefits',
    title: 'Benefits',
  },
];

const needStateOptions = [
  {
    key: 'gaming',
    title: 'Gaming',
  },
  {
    key: 'children\'s education',
    title: 'Children\'s Education',
  },
  {
    key: 'working from anywhere',
    title: 'Working from Anywhere',
  },
  {
    key: 'home is the hub',
    title: 'Home is the Hub',
  },
];

const styleOptions = [
  {
    key: 'persuasive',
    title: 'Persuasive',
  },
  {
    key: 'humourous',
    title: 'Humourous',
  },
  {
    key: 'family orientated',
    title: 'Family orientated',
  },
  {
    key: 'customer centric',
    title: 'Customer centric',
  },
  {
    key: 'urgency',
    title: 'Urgency',
  },
  {
    key: 'service-led',
    title: 'Service-led',
  },
  {
    key: 'Sale',
    title: 'Sale',
  },
];

const uspOptions = [
  {
    key: 'product features',
    title: 'Product Features',
  },
  {
    key: 'included data',
    title: 'Included Data',
  },
  {
    key: 'value',
    title: 'Value',
  },
  {
    key: 'save time',
    title: 'Save Time',
  },
  {
    key: 'save money',
    title: 'Save Money',
  },
  {
    key: 'value',
    title: 'Value',
  },
];

export const optionsMap = {
  format: ['Formats', formatOptions],
  journey: ['Journeys', journeyOptions],
  needState: ['Need States', needStateOptions],
  style: ['Styles', styleOptions],
  usp: ['USPs', uspOptions],
};

export const variationOptions = [
  {
    label: 'Format',
    value: 'format',
  },
  {
    label: 'Journey',
    value: 'journey',
  },
  {
    label: 'Need State',
    value: 'needState',
  },
  {
    label: 'Style',
    value: 'style',
  },
  {
    label: 'Unique Selling Point',
    value: 'usp',
  },
  {
    label: 'Prompt',
    value: 'prompt',
  },
];

export const frameworkOptions = [
  {
    label: 'AIDA (Attention, Interest, Desire, Action)',
    value: 'AIDA (Attention, Interest, Desire, Action)',
  },
  {
    label: 'PAS (Problem, Agitation, Solution)',
    value: 'PAS (Problem, Agitation, Solution)',
  },
  {
    label: 'FAB (Features, Advantages, Benefits)',
    value: 'FAB (Features, Advantages, Benefits)',
  },
  {
    label: '4 Ps (Promise, Picture, Proof, Push)',
    value: '4 Ps (Promise, Picture, Proof, Push)',
  },
  {
    label: 'Storytelling',
    value: 'Storytelling',
  },
  {
    label: 'Problem/Solution',
    value: 'Problem/Solution',
  },
  {
    label: 'Before/After/Bridge',
    value: 'Before/After/Bridge',
  },
  {
    label: 'The 5 Ws and H (Who, What, Where, When, Why, How)',
    value: 'The 5 Ws and H (Who, What, Where, When, Why, How)',
  },
  {
    label: 'The 4 Cs (Clear, Concise, Compelling, Credible)',
    value: 'The 4 Cs (Clear, Concise, Compelling, Credible)',
  },
  {
    label: 'The 7 Cs (Clear, Concise, Complete, Correct, Concrete, Credible, Compelling)',
    value: 'The 7 Cs (Clear, Concise, Complete, Correct, Concrete, Credible, Compelling)',
  },
];
